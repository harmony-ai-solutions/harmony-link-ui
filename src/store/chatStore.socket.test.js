/**
 * Desktop chat — the N+1 participant-session model, at the STORE level.
 *
 * The chat store is what opens sessions (one per participant, per chat) and
 * routes sends through them, so these tests drive it against a controllable
 * WebSocket double: every assertion is about the FRAMES that reach the engine
 * and the timeline that comes back, not about internal bookkeeping.
 *
 * Node has no WebSocket; the store constructs `ChatSocketService` lazily, so
 * installing the double on `globalThis` before importing the store is enough.
 */
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';

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

    /** Deliver an engine frame to the client. */
    deliver(frame) {
        this.onmessage?.({ data: JSON.stringify(frame) });
    }

    frames(eventType) {
        return this.sent.filter((frame) => frame.event_type === eventType);
    }
}

globalThis.WebSocket = FakeWebSocket;

/** REST double for the reconnect-tail seam (only that test calls fetch). */
let nextBody = { messages: [] };
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => nextBody });

const { default: useChatStore } = await import('./chatStore.js');

const CONVERSATION = {
    entityId: 'ai1',
    personaId: 'user',
    participantIds: ['ai1', 'user'],
    participantKey: 'ai1:user',
    replyMode: 'instant',
};

/** Fresh registry + the open conversation, as `openConversation` leaves it. */
function reset(conversation = CONVERSATION) {
    FakeWebSocket.instances = [];
    useChatStore.setState({
        activeConversation: conversation,
        messages: [],
        connectionState: 'connected',
        connectionDropSince: null,
        error: null,
        sessionErrors: [],
        wireFrames: [],
    });
}

/**
 * Open the chat's participant sessions and let the double report `open`.
 * `connectSocket` creates every socket synchronously before its first await,
 * so both instances exist as soon as it is called.
 */
async function connect(conversation = CONVERSATION) {
    const pending = useChatStore.getState().connectSocket(conversation);
    for (const ws of FakeWebSocket.instances) ws.open();
    await pending;
    return FakeWebSocket.instances.slice();
}

/** Identify a session's socket by the entity_id in its INIT_ENTITY frame. */
function socketFor(instances, entityId) {
    return instances.find((ws) => ws.frames('INIT_ENTITY')[0]?.payload?.entity_id === entityId);
}

// Any delivered frame starts the session heartbeat; a manual close is what
// stops it and guarantees the test process can exit.
afterEach(() => {
    useChatStore.setState({ activeConversation: CONVERSATION });
    useChatStore.getState().closeSocket();
});

/** Deliver an INIT_ENTITY SUCCESS exactly as the engine does. */
function initSuccess(ws, { interactionId, capabilities }) {
    ws.deliver({
        event_id: `init-${interactionId}`,
        event_type: 'INIT_ENTITY',
        status: 'SUCCESS',
        payload: { interaction_id: interactionId, capabilities },
    });
}

test('opening a private chat opens TWO sessions — persona AND partner', async () => {
    reset();
    const instances = await connect();

    assert.equal(instances.length, 2, 'N+1: one session per participant');

    const partner = socketFor(instances, 'ai1');
    const persona = socketFor(instances, 'user');
    assert.ok(partner, 'the partner session is open');
    assert.ok(persona, 'the persona session is open — it is NOT optional');

    const partnerInit = partner.frames('INIT_ENTITY')[0];
    const personaInit = persona.frames('INIT_ENTITY')[0];
    assert.deepEqual(partnerInit.payload.participant_ids, ['ai1', 'user']);
    assert.deepEqual(personaInit.payload.participant_ids, ['ai1', 'user'], 'the SAME participant set on both');
    assert.equal(partnerInit.payload.entity_id, 'ai1');
    assert.equal(personaInit.payload.entity_id, 'user');
    assert.equal(partnerInit.payload.device_type, 'web');
    assert.equal(personaInit.payload.device_type, 'web');
    assert.equal(partnerInit.payload.device_id, personaInit.payload.device_id, 'one desktop, one device id');
    assert.equal(partnerInit.payload.reply_mode, 'instant');
    assert.equal(personaInit.payload.reply_mode, 'instant');
});

test('a send is written on the persona session as well as the partner session', async () => {
    reset();
    const instances = await connect();
    const partner = socketFor(instances, 'ai1');
    const persona = socketFor(instances, 'user');

    assert.equal(useChatStore.getState().sendText('user', 'hello there'), true);

    const partnerUtterance = partner.frames('ENTITY_UTTERANCE');
    const personaUtterance = persona.frames('ENTITY_UTTERANCE');
    assert.equal(partnerUtterance.length, 1, 'cognition must receive it to answer');
    assert.equal(personaUtterance.length, 1, 'the recorder needs it for the persona-POV copy');
    assert.equal(personaUtterance[0].payload.entity_id, 'user', 'the SPEAKER is the persona');
    assert.equal(partnerUtterance[0].payload.entity_id, 'user');
    assert.equal(
        personaUtterance[0].payload.message_id,
        partnerUtterance[0].payload.message_id,
        'one origin id across POVs (the engine dedupes on it)'
    );

    // The optimistic row is the only copy the session will ever see: a session
    // never receives its own utterance back.
    const { messages } = useChatStore.getState();
    assert.equal(messages.length, 1);
    assert.equal(messages[0].sender_entity_id, 'user');
});

test('audio and edits use the same origin id on every participant session', async () => {
    reset();
    const instances = await connect();
    const partner = socketFor(instances, 'ai1');
    const persona = socketFor(instances, 'user');

    useChatStore.getState().sendAudio('user', { audioBase64: 'AAA', mimeType: 'audio/ogg', duration: 1 });
    assert.equal(partner.frames('ENTITY_UTTERANCE').length, 1);
    assert.equal(persona.frames('ENTITY_UTTERANCE').length, 1);
    assert.equal(
        partner.frames('ENTITY_UTTERANCE')[0].payload.message_id,
        persona.frames('ENTITY_UTTERANCE')[0].payload.message_id
    );

    useChatStore.getState().editMessage('user', 'm1', 'edited');
    assert.equal(partner.frames('ENTITY_UTTERANCE_EDIT').length, 1);
    assert.equal(persona.frames('ENTITY_UTTERANCE_EDIT').length, 1);
});

test('the persona session is scoped PER CHAT — two chats, two persona sockets', async () => {
    reset();
    const chatA = await connect();
    const personaA = socketFor(chatA, 'user');

    // A different thread with the SAME persona shares no socket slot.
    const conversationB = {
        entityId: 'ai2',
        personaId: 'user',
        participantIds: ['ai2', 'user'],
        participantKey: 'ai2:user',
    };
    useChatStore.setState({ activeConversation: conversationB });
    const baseline = FakeWebSocket.instances.length;
    await connect(conversationB);
    const chatB = FakeWebSocket.instances.slice(baseline);
    const personaB = socketFor(chatB, 'user');

    assert.ok(personaA && personaB);
    assert.notEqual(personaA, personaB, 'a shared entity-user slot would race the two chats');
    assert.equal(FakeWebSocket.instances.length, 4);
    assert.equal(FakeWebSocket.instances.filter((ws) => !ws.closed).length, 4);

    // Sends belong to the OPEN chat only.
    const beforeA = personaA.frames('ENTITY_UTTERANCE').length;
    useChatStore.getState().sendText('user', 'to ai2');
    assert.equal(personaA.frames('ENTITY_UTTERANCE').length, beforeA, 'chat A was not written to');
    assert.equal(personaB.frames('ENTITY_UTTERANCE').length, 1);

    // Leaving chat B closes ITS sessions and leaves chat A's alone.
    useChatStore.getState().closeSocket();
    assert.equal(personaB.closed, true);
    assert.equal(socketFor(chatB, 'ai2').closed, true);
    assert.equal(personaA.closed, false);
    assert.equal(socketFor(chatA, 'ai1').closed, false);

    // Cleanup: close the still-open chat A.
    useChatStore.setState({ activeConversation: CONVERSATION });
    useChatStore.getState().closeSocket();
});

test('leaving a thread closes BOTH participant sessions', async () => {
    reset();
    const instances = await connect();

    useChatStore.getState().closeSocket();

    assert.deepEqual(instances.map((ws) => ws.closed), [true, true]);
    assert.equal(useChatStore.getState().connectionState, 'idle');
});

test('one logical message that arrives twice renders once (dedupe by id)', async () => {
    reset();
    const instances = await connect();
    const partner = socketFor(instances, 'ai1');
    initSuccess(partner, { interactionId: 'int-ai', capabilities: ['chat', 'cognition'] });

    const payload = { message_id: 'm1', entity_id: 'ai1', content: 'hello', message_type: 'text' };
    partner.deliver({ event_id: 'e1', event_type: 'AI_UTTERANCE', status: 'NEW', payload });
    // The same perception relayed under the other event type.
    partner.deliver({ event_id: 'e2', event_type: 'ENTITY_UTTERANCE', status: 'NEW', payload });

    const { messages } = useChatStore.getState();
    assert.equal(messages.length, 1, 'mergeMessages collapses the duplicate by message id');
    assert.equal(messages[0].id, 'm1');
});

test('a partner utterance is relayed to the persona session, once', async () => {
    reset();
    const instances = await connect();
    const partner = socketFor(instances, 'ai1');
    const persona = socketFor(instances, 'user');
    initSuccess(partner, { interactionId: 'int-ai', capabilities: ['chat', 'cognition'] });
    initSuccess(persona, { interactionId: 'int-user', capabilities: ['chat'] });

    const payload = { message_id: 'relay-1', entity_id: 'ai1', content: 'hello', message_type: 'text' };
    partner.deliver({ event_id: 'e1', event_type: 'ENTITY_UTTERANCE', status: 'NEW', payload });
    // A duplicate delivery must not be relayed twice.
    partner.deliver({ event_id: 'e2', event_type: 'ENTITY_UTTERANCE', status: 'NEW', payload });

    assert.equal(persona.frames('ENTITY_UTTERANCE').length, 1, 'the recorder sink got it exactly once');
    assert.equal(persona.frames('ENTITY_UTTERANCE')[0].payload.message_id, 'relay-1');
    assert.equal(partner.frames('ENTITY_UTTERANCE').length, 0, 'never echoed back to its origin');

    // The navigation handle stays the PARTNER's interaction id (deterministic).
    assert.equal(useChatStore.getState().activeConversation.interactionId, 'int-ai');
});

test('the persona session never relays onward (loop safety)', async () => {
    reset();
    const instances = await connect();
    const partner = socketFor(instances, 'ai1');
    const persona = socketFor(instances, 'user');
    initSuccess(partner, { interactionId: 'int-ai', capabilities: ['chat', 'cognition'] });
    initSuccess(persona, { interactionId: 'int-user', capabilities: ['chat'] });

    persona.deliver({
        event_id: 'e1',
        event_type: 'ENTITY_UTTERANCE',
        status: 'NEW',
        payload: { message_id: 'm-user', entity_id: 'user', content: 'hi' },
    });

    assert.equal(partner.frames('ENTITY_UTTERANCE').length, 0, 'relaying it would re-enter cognition');
});

test('a partner session without cognition is not relayed (phone directional rule)', async () => {
    reset();
    const instances = await connect();
    const partner = socketFor(instances, 'ai1');
    const persona = socketFor(instances, 'user');
    initSuccess(partner, { interactionId: 'int-ai', capabilities: ['chat'] });

    partner.deliver({
        event_id: 'e1',
        event_type: 'ENTITY_UTTERANCE',
        status: 'NEW',
        payload: { message_id: 'm1', entity_id: 'ai1', content: 'hi' },
    });

    assert.equal(persona.frames('ENTITY_UTTERANCE').length, 0);
});

test('SET_REPLY_MODE is remembered by every session and pushed to partners only', async () => {
    reset();
    const instances = await connect();
    const partner = socketFor(instances, 'ai1');
    const persona = socketFor(instances, 'user');

    assert.equal(useChatStore.getState().setReplyMode('realistic'), true);

    const partnerFrames = partner.frames('SET_REPLY_MODE');
    assert.equal(partnerFrames.length, 1);
    assert.equal(partnerFrames[0].payload.reply_mode, 'realistic');
    assert.equal(partnerFrames[0].payload.entity_id, 'user', 'the phone names the persona as the changing entity');
    assert.equal(persona.frames('SET_REPLY_MODE').length, 0, 'the persona has no reply pacing');

    // The mode still rides INIT_ENTITY after a fresh connect (reconnect replay).
    reset();
    const reconnected = await connect({ ...CONVERSATION, replyMode: 'realistic' });
    assert.deepEqual(
        reconnected.map((ws) => ws.frames('INIT_ENTITY')[0].payload.reply_mode),
        ['realistic', 'realistic']
    );
});

test('a failing sibling keeps the chat Degraded until it recovers', async () => {
    reset();
    const instances = await connect();
    const partner = socketFor(instances, 'ai1');
    const persona = socketFor(instances, 'user');

    // The persona session is rejected; the partner reports a healthy INIT.
    persona.deliver({
        event_id: 'e-err',
        event_type: 'INIT_ENTITY',
        status: 'ERROR',
        payload: { error: 'entity_not_defined', error_code: 'entity_not_defined' },
    });
    initSuccess(partner, { interactionId: 'int-ai', capabilities: ['chat', 'cognition'] });

    let state = useChatStore.getState();
    assert.equal(state.connectionState, 'error', 'one failed participant means Degraded');
    assert.equal(state.sessionErrors.length, 1, 'the sibling success must not wipe the failure');

    // ...and only ITS recovery clears the slate.
    initSuccess(persona, { interactionId: 'int-user', capabilities: ['chat'] });
    state = useChatStore.getState();
    assert.deepEqual(state.sessionErrors, []);
    assert.equal(state.connectionState, 'connected', 'the chat leaves Degraded once the last session is healthy');
});

// ── Perception dedupe (one engine row per POV, DIFFERENT ids) ─────────────
//
// The engine stores the same logical message once per participant and fans
// each row out to that entity's sessions (lifecycle/chat_fanout_observer.go),
// so both sockets deliver the message with their own row id. `mergeMessages`
// cannot see that; the store folds the second perception instead.

test('a peer-applied message perceived on BOTH sessions renders exactly once', async () => {
    reset();
    const instances = await connect();
    const partner = socketFor(instances, 'ai1');
    const persona = socketFor(instances, 'user');

    // Live DB shapes: same sender/content, each row id belongs to its POV.
    partner.deliver({
        event_id: 'e-partner',
        event_type: 'ENTITY_UTTERANCE',
        status: 'NEW',
        payload: {
            message_id: 'pov-partner',
            entity_id: 'ai1',
            sender_entity_id: 'ai1',
            content: 'shared words',
            message_type: 'text',
            created_at: '2026-01-01T00:00:00.000Z',
        },
    });
    persona.deliver({
        event_id: 'e-user',
        event_type: 'ENTITY_UTTERANCE',
        status: 'NEW',
        payload: {
            message_id: 'pov-user',
            entity_id: 'user',
            sender_entity_id: 'ai1',
            content: 'shared words',
            message_type: 'text',
            created_at: '2026-01-01T00:00:01.000Z',
        },
    });

    const { messages } = useChatStore.getState();
    assert.equal(messages.length, 1, 'one logical message, one bubble');
    assert.equal(messages[0].id, 'pov-partner', 'the first perception stands');
});

test('the same words three minutes apart are a genuine second message', async () => {
    reset();
    const instances = await connect();
    const partner = socketFor(instances, 'ai1');

    const frame = (id, createdAt) => ({
        event_id: `e-${id}`,
        event_type: 'ENTITY_UTTERANCE',
        status: 'NEW',
        payload: {
            message_id: id,
            entity_id: 'ai1',
            sender_entity_id: 'ai1',
            content: 'shared words',
            message_type: 'text',
            created_at: createdAt,
        },
    });
    partner.deliver(frame('m-first', '2026-01-01T00:00:00.000Z'));
    partner.deliver(frame('m-later', '2026-01-01T00:03:00.000Z'));

    assert.deepEqual(useChatStore.getState().messages.map((m) => m.id), ['m-first', 'm-later']);
});

test('the same words from different senders stay two perceptions', async () => {
    reset();
    const instances = await connect();
    const partner = socketFor(instances, 'ai1');
    const persona = socketFor(instances, 'user');

    partner.deliver({
        event_id: 'e-ai',
        event_type: 'ENTITY_UTTERANCE',
        status: 'NEW',
        payload: {
            message_id: 'from-ai',
            entity_id: 'ai1',
            sender_entity_id: 'ai1',
            content: 'same words',
            message_type: 'text',
            created_at: '2026-01-01T00:00:00.000Z',
        },
    });
    persona.deliver({
        event_id: 'e-user',
        event_type: 'ENTITY_UTTERANCE',
        status: 'NEW',
        payload: {
            message_id: 'from-user',
            entity_id: 'user',
            sender_entity_id: 'user',
            content: 'same words',
            message_type: 'text',
            created_at: '2026-01-01T00:00:01.000Z',
        },
    });

    assert.deepEqual(useChatStore.getState().messages.map((m) => m.id), ['from-ai', 'from-user']);
});

test('a reconnect tail read does not duplicate a live partner-POV bubble', async () => {
    reset();
    useChatStore.setState({
        messages: [{
            id: 'partner-pov',
            entity_id: 'ai1',
            sender_entity_id: 'ai1',
            content: 'shared words',
            message_type: 'text',
            is_read: true,
            created_at: '2026-01-01T00:00:00.000Z',
        }],
    });
    nextBody = {
        messages: [{
            id: 'persona-pov',
            entity_id: 'user',
            sender_entity_id: 'ai1',
            content: 'shared words',
            message_type: 'text',
            is_read: true,
            created_at: '2026-01-01T00:00:02.000Z',
        }],
    };

    assert.equal(await useChatStore.getState().refreshNewestMessages(), true);
    assert.deepEqual(useChatStore.getState().messages.map((m) => m.id), ['partner-pov']);
});

test('a reconnect tail read still updates a row it already knows by id', async () => {
    reset();
    useChatStore.setState({
        messages: [{
            id: 'live-1',
            entity_id: 'ai1',
            sender_entity_id: 'ai1',
            content: 'old text',
            message_type: 'text',
            is_read: false,
            created_at: '2026-01-01T00:00:00.000Z',
        }],
    });
    nextBody = {
        messages: [{
            id: 'live-1',
            entity_id: 'ai1',
            sender_entity_id: 'ai1',
            content: 'edited text',
            message_type: 'text',
            is_read: true,
            created_at: '2026-01-01T00:00:00.000Z',
        }],
    };

    assert.equal(await useChatStore.getState().refreshNewestMessages(), true);
    const { messages } = useChatStore.getState();
    assert.equal(messages.length, 1);
    assert.equal(messages[0].content, 'edited text', 'same-id rows still merge their fields');
    assert.equal(messages[0].is_read, true);
});
