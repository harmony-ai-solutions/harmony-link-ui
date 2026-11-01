/**
 * ChatSocketService lifecycle — the reconnect-flap regressions.
 *
 * These tests use a controllable WebSocket double (the service already takes a
 * `WebSocketImpl`) so the exact sequence the owner saw can be reproduced:
 * drops, a heartbeat timeout during a live connection, a manual close, and a
 * superseded socket closing late.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ChatSocketService, MAX_HANDSHAKE_FAILURES } from './chatSocketService.js';

/** A WebSocket double the test opens/closes/fails on purpose. */
class FakeWebSocket {
    static instances = [];

    constructor(url) {
        this.url = url;
        this.sent = [];
        this.closed = false;
        FakeWebSocket.instances.push(this);
    }

    open() {
        if (this.closed) return;
        this.onopen?.();
    }

    send(data) {
        this.sent.push(JSON.parse(data));
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        this.onclose?.();
    }

    fail(error = new Error('boom')) {
        this.onerror?.(error);
        this.close();
    }
}

const lastSocket = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

/** Build a service plus the events it emitted, with a fresh double registry. */
function makeService() {
    FakeWebSocket.instances = [];
    const service = new ChatSocketService({ url: 'ws://test', WebSocketImpl: FakeWebSocket });
    const events = [];
    service.onEvent((type, payload) => events.push({ type, payload }));
    return { service, events };
}

/** Connect and resolve once the double reports open (INIT_ENTITY is sent). */
async function connect(service) {
    const pending = service.connect({ entityId: 'ai1', participantIds: ['ai1'] });
    lastSocket().open();
    await pending;
    return lastSocket();
}

test('connect opens the socket and sends INIT_ENTITY', async () => {
    const { service, events } = makeService();
    const ws = await connect(service);

    assert.equal(service.connected, true);
    assert.deepEqual(events.map((e) => e.type), ['connected']);
    assert.equal(ws.sent[0].event_type, 'INIT_ENTITY');
});

test('a manual disconnect is NOT a drop — no disconnected event', async () => {
    const { service, events } = makeService();
    await connect(service);
    events.length = 0;

    service.disconnect();

    assert.equal(service.connected, false);
    assert.deepEqual(events, [], 'closing a thread must not look like a reconnect');
});

test('a heartbeat timeout closes the dead socket and reconnects exactly once', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { service, events } = makeService();
    const first = await connect(service);
    events.length = 0;

    service.handleHeartbeatTimeout();
    assert.equal(first.closed, true, 'the half-open socket is actually closed');

    t.mock.timers.tick(2000);
    assert.equal(FakeWebSocket.instances.length, 2, 'one replacement, not a growing pile');
    const second = lastSocket();
    second.open();

    assert.equal(service.connected, true);
    assert.deepEqual(events.map((e) => e.type), ['disconnected', 'reconnecting', 'connected']);
    assert.equal(second.sent[0].event_type, 'INIT_ENTITY', 'INIT is replayed on the new socket');
});

test('INIT_ENTITY replay on reconnect does not stack sessions', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { service } = makeService();
    await connect(service);

    service.handleHeartbeatTimeout();
    t.mock.timers.tick(2000);
    lastSocket().open();
    service.handleHeartbeatTimeout();
    t.mock.timers.tick(2000);
    lastSocket().open();

    assert.equal(FakeWebSocket.instances.length, 3);
    const live = FakeWebSocket.instances.filter((ws) => !ws.closed);
    assert.equal(live.length, 1, 'at most one live socket at any moment');
});

test('a superseded socket closing late cannot flip the live connection', async () => {
    const { service, events } = makeService();
    const first = await connect(service);
    events.length = 0;

    // A second attempt races the first (e.g. a backoff timer firing while a
    // connection was still open). The second becomes current, the first closes.
    const pending = service.openSocket();
    lastSocket().open();
    await pending;

    // Even a hand-delivered late close from the old socket must be ignored.
    first.onclose?.();

    assert.equal(service.connected, true);
    assert.deepEqual(events.map((e) => e.type), ['connected'], 'nothing was reported for the stale socket');
});

test('a failed handshake rejects with a real message and emits no raw error', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { service, events } = makeService();

    const pending = service.connect({ entityId: 'ai1', participantIds: ['ai1'] });
    const expectFail = assert.rejects(pending, /refused this page's origin/);
    // Browser WS error events carry no reason — the service must still reject
    // with canonical text, not the useless raw event (owner incident 2026-10-31).
    lastSocket().fail(new Error('browser events carry no reason'));
    await expectFail;

    assert.deepEqual(
        events.filter((e) => e.type === 'error'),
        [],
        'a raw socket error is never re-emitted — the rejection carries the text',
    );
    assert.equal(service.handshakeFailures, 1);
});

test('the ladder gives up after MAX_HANDSHAKE_FAILURES never-opened attempts — one terminal error, no storm', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { service, events } = makeService();

    const pending = service.connect({ entityId: 'ai1', participantIds: ['ai1'] });
    const expectFail = assert.rejects(pending, /origin/);
    lastSocket().fail();
    await expectFail;
    assert.equal(FakeWebSocket.instances.length, 1);

    // Attempts #2..#5 fail identically along the 2s→20s backoff ladder.
    for (const delay of [2000, 5000, 10000, 20000]) {
        t.mock.timers.tick(delay);
        lastSocket().fail();
    }
    assert.equal(FakeWebSocket.instances.length, MAX_HANDSHAKE_FAILURES, 'exactly five attempts, then give-up');

    // No sixth socket may appear, however much time passes.
    t.mock.timers.tick(120000);
    assert.equal(FakeWebSocket.instances.length, MAX_HANDSHAKE_FAILURES);

    const terminal = events.filter((e) => e.type === 'error');
    assert.equal(terminal.length, 1, 'exactly one terminal error — not one per attempt');
    assert.equal(terminal[0].payload.code, 'RECONNECT_GAVE_UP');
    assert.match(terminal[0].payload.message, /Gave up reconnecting after 5/);
});

test('a user Retry after give-up starts a fresh ladder', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const { service } = makeService();

    const pending = service.connect({ entityId: 'ai1', participantIds: ['ai1'] });
    const expectFail = assert.rejects(pending);
    lastSocket().fail();
    await expectFail;
    for (const delay of [2000, 5000, 10000, 20000]) {
        t.mock.timers.tick(delay);
        lastSocket().fail();
    }
    assert.equal(service.gaveUp, true);

    const retry = service.connect({ entityId: 'ai1', participantIds: ['ai1'] });
    lastSocket().open();
    await retry;

    assert.equal(service.connected, true);
    assert.equal(service.handshakeFailures, 0);
    assert.equal(service.gaveUp, false);
});

// ── One session per participant (N+1) ─────────────────────────────────────
//
// A chat's persona session and partner session are independent services: each
// owns its socket, heartbeat and reconnect ladder. These tests pin that the
// two do not interfere, and that the INIT payload each one sends is shaped for
// ITS OWN entity with the shared participant set.

test('two participant sessions INIT with their own entity and the same set', async () => {
    FakeWebSocket.instances = [];
    const persona = new ChatSocketService({ url: 'ws://test', WebSocketImpl: FakeWebSocket });
    const partner = new ChatSocketService({ url: 'ws://test', WebSocketImpl: FakeWebSocket });

    const personaPending = persona.connect({
        entityId: 'user',
        participantIds: ['ai1', 'user'],
        deviceId: 'dev-1',
        replyMode: 'realistic',
    });
    const partnerPending = partner.connect({
        entityId: 'ai1',
        participantIds: ['ai1', 'user'],
        deviceId: 'dev-1',
        replyMode: 'realistic',
    });
    const [personaWs, partnerWs] = FakeWebSocket.instances;
    personaWs.open();
    partnerWs.open();
    await Promise.all([personaPending, partnerPending]);

    const personaInit = personaWs.sent[0];
    const partnerInit = partnerWs.sent[0];
    assert.equal(personaInit.event_type, 'INIT_ENTITY');
    assert.equal(personaInit.payload.entity_id, 'user');
    assert.equal(partnerInit.payload.entity_id, 'ai1');
    assert.deepEqual(personaInit.payload.participant_ids, ['ai1', 'user']);
    assert.deepEqual(partnerInit.payload.participant_ids, ['ai1', 'user']);
    assert.equal(personaInit.payload.device_id, 'dev-1');
    assert.equal(partnerInit.payload.device_id, 'dev-1');
    assert.equal(personaInit.payload.device_type, 'web');
    assert.equal(partnerInit.payload.device_type, 'web');
});

test('INIT_ENTITY SUCCESS records the session capabilities (relay direction)', async () => {
    const { service } = makeService();
    const ws = await connect(service);

    ws.onmessage?.({
        data: JSON.stringify({
            event_type: 'INIT_ENTITY',
            status: 'SUCCESS',
            payload: { interaction_id: 'int-ai', capabilities: ['chat', 'cognition'] },
        }),
    });

    assert.equal(service.interactionId, 'int-ai');
    assert.deepEqual(service.capabilities, ['chat', 'cognition']);
    // Any inbound frame arms the 30 s heartbeat; stop it so the runner exits.
    service.disconnect();
});

test('each participant session reconnects on its OWN ladder', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    FakeWebSocket.instances = [];
    const persona = new ChatSocketService({ url: 'ws://test', WebSocketImpl: FakeWebSocket });
    const partner = new ChatSocketService({ url: 'ws://test', WebSocketImpl: FakeWebSocket });

    const personaPending = persona.connect({ entityId: 'user', participantIds: ['ai1', 'user'] });
    const partnerPending = partner.connect({ entityId: 'ai1', participantIds: ['ai1', 'user'] });
    const [personaWs, partnerWs] = FakeWebSocket.instances;
    personaWs.open();
    partnerWs.open();
    await Promise.all([personaPending, partnerPending]);
    t.mock.timers.tick(0);

    // Only the partner's socket dies (a black-holed connection).
    partner.handleHeartbeatTimeout();
    assert.equal(partnerWs.closed, true);
    assert.equal(persona.connected, true, 'the sibling session is untouched');
    assert.equal(personaWs.closed, false);

    t.mock.timers.tick(2000);
    assert.equal(FakeWebSocket.instances.length, 3, 'exactly one replacement for the dead session');
    const replacement = lastSocket();
    replacement.open();

    assert.equal(partner.connected, true);
    assert.equal(replacement.sent[0].event_type, 'INIT_ENTITY');
    assert.equal(replacement.sent[0].payload.entity_id, 'ai1');

    // Clean up the (live) timers so the test process can exit.
    persona.disconnect();
    partner.disconnect();
});
