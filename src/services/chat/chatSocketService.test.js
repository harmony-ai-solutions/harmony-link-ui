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

import { ChatSocketService } from './chatSocketService.js';

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
