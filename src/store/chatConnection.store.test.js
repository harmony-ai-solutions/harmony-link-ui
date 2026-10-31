/**
 * chatStore connection status — reconnect honesty (owner-reported flap).
 *
 * The store (not a helper) owns the timer that decides when a drop is admitted,
 * so these tests drive `handleSocketEvent` exactly as the socket service does:
 * `disconnected`, retry events, and `connected`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { RECONNECT_STATUS_GRACE_MS } from '../services/chat/chatConnectionUtils.js';

const calls = [];
let nextBody = { messages: [] };

globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET' });
    return { ok: true, status: 200, json: async () => nextBody };
};

const { default: useChatStore } = await import('./chatStore.js');

const active = {
    entityId: 'ai1',
    participantKey: 'ai1:user',
    personaId: 'user',
    participantIds: ['ai1'],
};

const msg = (id, createdAt) => ({
    id,
    created_at: createdAt,
    sender_entity_id: 'ai1',
    content: id,
    message_type: 'text',
    is_read: true,
});

/** Reset the store to "a live conversation" (and the fetch recorder). */
function reset(extra = {}) {
    calls.length = 0;
    nextBody = { messages: [] };
    useChatStore.setState({
        activeConversation: active,
        messages: [],
        hasMore: true,
        nextCursor: 'cursor-1',
        connectionState: 'connected',
        connectionDropSince: null,
        error: null,
        sessionErrors: [],
        ...extra,
    });
}

/** Let the fire-and-forget tail read settle. */
const flush = () => new Promise((resolve) => setImmediate(resolve));

test('a drop that reconnects inside the grace window never shows "reconnecting"', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 5000 });
    reset();
    const states = [];
    const unsubscribe = useChatStore.subscribe((state) => states.push(state.connectionState));

    useChatStore.getState().handleSocketEvent('disconnected');

    assert.equal(useChatStore.getState().connectionState, 'connected', 'the drop is recorded, not admitted');
    assert.equal(typeof useChatStore.getState().connectionDropSince, 'number');

    t.mock.timers.tick(1000); // inside the window
    useChatStore.getState().handleSocketEvent('connected');
    await flush();
    t.mock.timers.tick(10000); // the cancelled timer must not fire late
    unsubscribe();

    assert.equal(useChatStore.getState().connectionState, 'connected');
    assert.equal(useChatStore.getState().connectionDropSince, null);
    assert.ok(!states.includes('reconnecting'), 'no flicker for a successful retry');
});

test('a drop that outlives the grace window becomes "reconnecting"', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
    reset();

    useChatStore.getState().handleSocketEvent('disconnected');
    t.mock.timers.tick(RECONNECT_STATUS_GRACE_MS - 1);
    assert.equal(useChatStore.getState().connectionState, 'connected', 'still inside the window');

    t.mock.timers.tick(1);
    assert.equal(useChatStore.getState().connectionState, 'reconnecting');
});

test('the repeated retry event does not restart or duplicate the window', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
    reset();

    useChatStore.getState().handleSocketEvent('disconnected');
    t.mock.timers.tick(1000);
    useChatStore.getState().handleSocketEvent('reconnecting'); // attempt #1
    t.mock.timers.tick(RECONNECT_STATUS_GRACE_MS - 1000);
    assert.equal(useChatStore.getState().connectionState, 'reconnecting', 'admitted on the original deadline');
});

test('a connection error stays offline — it is not a reconnect in disguise', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
    reset({ connectionState: 'error' });

    useChatStore.getState().handleSocketEvent('disconnected');
    t.mock.timers.tick(10000);

    assert.equal(useChatStore.getState().connectionState, 'error');
});

test('a drop with no open conversation changes nothing', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
    reset({ activeConversation: null, connectionState: 'idle' });

    useChatStore.getState().handleSocketEvent('disconnected');
    t.mock.timers.tick(10000);

    assert.equal(useChatStore.getState().connectionState, 'idle');
    assert.equal(useChatStore.getState().connectionDropSince, null);
});

test('the FIRST connect of a thread does not refetch the tail', async () => {
    reset();

    useChatStore.getState().handleSocketEvent('connected');
    await flush();

    assert.equal(calls.length, 0, 'opening a chat still costs exactly its initial page');
});

test('a reconnect after a drop MERGES the newest page without touching the cursor', async () => {
    reset({ messages: [msg('a', '2026-01-01T00:00:00Z')] });
    nextBody = { messages: [msg('b', '2026-01-02T00:00:00Z')] };

    useChatStore.getState().handleSocketEvent('disconnected');
    useChatStore.getState().handleSocketEvent('connected');
    await flush();

    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/entities\/user\/conversations\/ai1%3Auser\/messages/);
    const state = useChatStore.getState();
    assert.deepEqual(state.messages.map((m) => m.id), ['a', 'b']);
    assert.equal(state.hasMore, true, 'history flags belong to the older-page read');
    assert.equal(state.nextCursor, 'cursor-1');
});

test('a tail read that fails does not blank the timeline', async () => {
    reset({ messages: [msg('a', '2026-01-01T00:00:00Z')] });
    globalThis.fetch = async () => {
        throw new Error('engine down');
    };

    useChatStore.getState().handleSocketEvent('disconnected');
    useChatStore.getState().handleSocketEvent('connected');
    await flush();

    const state = useChatStore.getState();
    assert.deepEqual(state.messages.map((m) => m.id), ['a']);
    assert.equal(state.error, 'engine down');
});

// ── Session errors (owner-approved 2026-10-31) ────────────────────────────
//
// An ERROR frame is an ENTITY-session failure, not a socket drop: the header
// says Degraded and the failure joins the modal's list, which a successful
// INIT_ENTITY clears.

test('an ERROR frame degrades the header and records a classified session error', () => {
    reset();
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ messages: [] }) });

    useChatStore.getState().handleSocketEvent('error', {
        message: 'provider openai has no API key configured',
    });

    const state = useChatStore.getState();
    assert.equal(state.connectionState, 'error');
    assert.equal(state.error, 'provider openai has no API key configured');
    assert.equal(state.sessionErrors.length, 1);
    assert.equal(state.sessionErrors[0].code, 'config');
    assert.equal(state.sessionErrors[0].message, 'provider openai has no API key configured');
});

test('an ERROR frame without a message still records an entry', () => {
    reset();

    useChatStore.getState().handleSocketEvent('error', {});

    const state = useChatStore.getState();
    assert.equal(state.error, 'Connection error');
    assert.equal(state.sessionErrors[0].message, 'Connection error');
});

test('session errors are newest first and capped at ten', () => {
    reset();

    for (let i = 0; i < 12; i += 1) {
        useChatStore.getState().handleSocketEvent('error', { message: `session failure ${i}` });
    }

    const { sessionErrors } = useChatStore.getState();
    assert.equal(sessionErrors.length, 10);
    assert.equal(sessionErrors[0].message, 'session failure 11');
    assert.equal(sessionErrors[9].message, 'session failure 2');
});

test('a successful INIT_ENTITY clears the session errors', () => {
    reset({
        sessionErrors: [
            { code: 'config', message: 'no API key', at: '2026-10-31T10:00:00Z' },
        ],
    });

    useChatStore.getState().handleSocketEvent('event', {
        event_type: 'INIT_ENTITY',
        status: 'SUCCESS',
        payload: {},
    });

    assert.deepEqual(useChatStore.getState().sessionErrors, []);
});
