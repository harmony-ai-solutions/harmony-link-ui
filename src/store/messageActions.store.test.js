/**
 * chatStore MESSAGE actions — reactions / pin / delete / forward (Task 02-6).
 *
 * Same seam as conversationActions.store.test.js: the real service module is
 * used and only the network is stubbed, so the ORDER of events (local patch
 * before the request) and the exact wire bodies are both assertable without a
 * bundler or a browser.
 *
 * The behaviours under test are the ones the task's acceptance rule rests on —
 * "no menu item is a no-op, every visible action either works or is clearly
 * disabled with a reason":
 *
 *   1. a reaction POSTs `{emoji, op}` and adopts the ENGINE's re-marshalled
 *      column (the engine owns reactions_json, not the client);
 *   2. the op is `remove` when you already reacted, `add` otherwise;
 *   3. a pin flips the flag and never touches the timeline order;
 *   4. a failed delete leaves the message on screen (a delete is not optimistic);
 *   5. a forward is a copy-to-another-thread request, not a new engine concept.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const calls = [];
/** @type {{ok: boolean, body: object, status: number}} */
let nextResponse = { ok: true, body: { status: 'ok' }, status: 200 };

globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body });
    return {
        ok: nextResponse.ok,
        status: nextResponse.status,
        json: async () => nextResponse.body,
    };
};

const { default: useChatStore } = await import('./chatStore.js');
const { clearToasts, default: useToastStore } = await import('./toastStore.js');

/** A timeline message in the shape the bubbles/bubbles consume. */
const message = (id, extra = {}) => ({
    id,
    entity_id: 'ai1',
    sender_entity_id: 'ai1',
    interaction_id: 'i1',
    content: `content of ${id}`,
    message_type: 'text',
    has_audio: false,
    has_image: false,
    is_edited: false,
    is_pinned: false,
    is_read: true,
    reply_to_message_id: '',
    reply_preview: '',
    reactions_json: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...extra,
});

function reset({ messages = [] } = {}) {
    calls.length = 0;
    nextResponse = { ok: true, body: { status: 'ok' }, status: 200 };
    clearToasts();
    useChatStore.setState({ messages, error: null, forwardRequest: null });
}

const lastCall = () => calls[calls.length - 1];
const findMessage = (id) => useChatStore.getState().messages.find((m) => m.id === id);

// ── toggleReaction ───────────────────────────────────────────────────────

test('toggleReaction POSTs add for a new emoji and adopts the engine column', async () => {
    reset({ messages: [message('m1')] });
    // The engine answers with the canonical ARRAY OF EMOJI STRINGS.
    nextResponse = { ok: true, status: 200, body: { status: 'ok', reactions_json: '["❤️"]', reactions: ['❤️'] } };

    const pending = useChatStore.getState().toggleReaction('m1', '❤️');
    // Optimistic: the chip is already on the bubble.
    assert.equal(findMessage('m1').reactions_json, '[{"emoji":"❤️","count":1}]');

    const ok = await pending;
    assert.equal(ok, true);
    assert.equal(calls.length, 1);
    assert.match(lastCall().url, /\/messages\/m1\/reactions$/);
    assert.equal(lastCall().method, 'POST');
    assert.deepEqual(JSON.parse(lastCall().body), { emoji: '❤️', op: 'add' });
    // The engine's encoding replaced the optimistic one.
    assert.equal(findMessage('m1').reactions_json, '["❤️"]');
});

test('toggleReaction POSTs remove when the emoji is already yours', async () => {
    reset({ messages: [message('m1', { reactions_json: '["❤️","😂"]' })] });
    nextResponse = { ok: true, status: 200, body: { status: 'ok', reactions_json: '["😂"]', reactions: ['😂'] } };

    await useChatStore.getState().toggleReaction('m1', '❤️');

    assert.deepEqual(JSON.parse(lastCall().body), { emoji: '❤️', op: 'remove' });
    assert.equal(findMessage('m1').reactions_json, '["😂"]');
});

test('toggleReaction clears the column when the engine returns an empty set', async () => {
    reset({ messages: [message('m1', { reactions_json: '["❤️"]' })] });
    // The handler emits reactions_json: null for an empty list.
    nextResponse = { ok: true, status: 200, body: { status: 'ok', reactions_json: null, reactions: [] } };

    await useChatStore.getState().toggleReaction('m1', '❤️');

    // '' — not "[]" — so parseReactions treats it as "no reactions".
    assert.equal(findMessage('m1').reactions_json, '');
});

test('toggleReaction rolls the bubble back and toasts when the engine fails', async () => {
    reset({ messages: [message('m1', { reactions_json: '["😂"]' })] });
    nextResponse = { ok: false, status: 500, body: { error: 'reaction failed' } };

    const ok = await useChatStore.getState().toggleReaction('m1', '❤️');

    assert.equal(ok, false);
    assert.equal(findMessage('m1').reactions_json, '["😂"]', 'the previous column is restored');
    const toasts = useToastStore.getState().toasts;
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].kind, 'error');
    assert.equal(toasts[0].message, 'reaction failed');
});

test('toggleReaction refuses an unknown message or a blank emoji without a request', async () => {
    reset({ messages: [message('m1')] });

    assert.equal(await useChatStore.getState().toggleReaction('nope', '❤️'), false);
    assert.equal(await useChatStore.getState().toggleReaction('m1', ''), false);
    assert.equal(calls.length, 0);
});

// ── setMessagePinned ─────────────────────────────────────────────────────

test('setMessagePinned flips the flag WITHOUT reordering the timeline', async () => {
    reset({ messages: [message('m1'), message('m2'), message('m3')] });

    const pending = useChatStore.getState().setMessagePinned('m1', true);
    // Optimistic: the 📌 is on the oldest bubble already.
    assert.equal(findMessage('m1').is_pinned, true);

    const ok = await pending;
    assert.equal(ok, true);
    assert.match(lastCall().url, /\/messages\/m1\/pin$/);
    assert.deepEqual(JSON.parse(lastCall().body), { pinned: true });
    // A pin is a MARKER in 1.0 — the order is untouched.
    assert.deepEqual(
        useChatStore.getState().messages.map((m) => m.id),
        ['m1', 'm2', 'm3']
    );
    assert.equal(useToastStore.getState().toasts.at(-1).kind, 'success');
});

test('setMessagePinned rolls back on failure', async () => {
    reset({ messages: [message('m1')] });
    nextResponse = { ok: false, status: 404, body: { error: 'message not found' } };

    const ok = await useChatStore.getState().setMessagePinned('m1', true);

    assert.equal(ok, false);
    assert.equal(findMessage('m1').is_pinned, false);
});

// ── deleteMessage ────────────────────────────────────────────────────────

test('deleteMessage removes the row only AFTER the engine accepts it', async () => {
    reset({ messages: [message('m1'), message('m2')] });
    nextResponse = { ok: true, status: 200, body: { status: 'message deleted' } };

    const pending = useChatStore.getState().deleteMessage('m1');
    // NOT optimistic: the message is still there while the request is in
    // flight, so a failure never looks like a successful delete.
    assert.equal(useChatStore.getState().messages.length, 2);

    const ok = await pending;
    assert.equal(ok, true);
    assert.equal(lastCall().method, 'DELETE');
    assert.match(lastCall().url, /\/messages\/m1$/);
    assert.deepEqual(useChatStore.getState().messages.map((m) => m.id), ['m2']);
    assert.equal(useToastStore.getState().toasts.at(-1).kind, 'success');
});

test('deleteMessage keeps the message on screen when the engine fails', async () => {
    reset({ messages: [message('m1')] });
    nextResponse = { ok: false, status: 500, body: { error: 'delete failed' } };

    const ok = await useChatStore.getState().deleteMessage('m1');

    assert.equal(ok, false);
    assert.equal(useChatStore.getState().messages.length, 1, 'nothing disappeared');
    assert.equal(useToastStore.getState().toasts.at(-1).message, 'delete failed');
});

test('deleteMessage refuses an unknown message without a request', async () => {
    reset({ messages: [] });
    assert.equal(await useChatStore.getState().deleteMessage('ghost'), false);
    assert.equal(calls.length, 0);
});

// ── Forward request handoff ──────────────────────────────────────────────

test('requestForward carries the trimmed text and its source thread', () => {
    reset();
    useChatStore.getState().requestForward({ content: '  hello there  ', fromTitle: 'Claire' });

    const request = useChatStore.getState().forwardRequest;
    assert.equal(request.content, 'hello there', 'whitespace-only framing is trimmed');
    assert.equal(request.fromTitle, 'Claire');

    useChatStore.getState().clearForwardRequest();
    assert.equal(useChatStore.getState().forwardRequest, null);
});

test('requestForward ignores an empty message (there is nothing to copy)', () => {
    reset();
    useChatStore.getState().requestForward({ content: '   ', fromTitle: 'Claire' });
    assert.equal(useChatStore.getState().forwardRequest, null);
    assert.equal(calls.length, 0, 'no picker opens for an empty forward');
});

test('reset clears a pending forward', () => {
    reset();
    useChatStore.getState().requestForward({ content: 'hi' });
    assert.notEqual(useChatStore.getState().forwardRequest, null);
    useChatStore.getState().reset();
    assert.equal(useChatStore.getState().forwardRequest, null);
});
