/**
 * chatStore conversation actions — optimistic update + rollback (Task 02-5).
 *
 * These tests exercise the STORE (not its pure helpers), which is where the
 * optimistic contract lives: patch locally first, call the engine, restore on
 * failure and toast the reason.
 *
 * The service module is replaced through a module mock: `node --test` has no
 * bundler and no fetch, and stubbing the transport is also the only way to
 * assert the ORDER of events (local patch before the request).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// ── Transport stubs ──────────────────────────────────────────────────────
// `mock.module` is not available in this Node line, so the store's imports are
// satisfied by REAL modules with a stubbed global fetch instead. That is the
// same seam the service uses, and it keeps the test honest: the store calls the
// real request builder, only the network is fake.

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

const row = (participantKey, extra = {}) => ({
    participant_key: participantKey,
    entity_id: 'ai1',
    interaction_id: 'i1',
    participant_ids: ['ai1', 'user'],
    companion_display_name: 'Claire',
    unread_count: 2,
    pinned: false,
    archived: false,
    muted: false,
    entity_disabled: false,
    last_activity_at: '2026-01-02T00:00:00Z',
    last_message: null,
    ...extra,
});

/** Reset store + stubs between tests. */
function reset({ conversations = [], archived = [], active = null } = {}) {
    calls.length = 0;
    nextResponse = { ok: true, body: { status: 'ok' }, status: 200 };
    clearToasts();
    useChatStore.setState({
        conversations,
        archivedConversations: archived,
        activeConversation: active,
        messages: [],
        detailCloseTick: 0,
        error: null,
    });
}

const lastCall = () => calls[calls.length - 1];

// ── setPinned ────────────────────────────────────────────────────────────

test('setPinned patches the row before the request and keeps it on success', async () => {
    reset({ conversations: [row('ai1:user')] });

    const pending = useChatStore.getState().setPinned(row('ai1:user'), true);
    // Optimistic: already true, before the request resolves.
    assert.equal(useChatStore.getState().conversations[0].pinned, true);
    const ok = await pending;

    assert.equal(ok, true);
    assert.equal(calls.length, 1);
    assert.match(lastCall().url, /\/entities\/conversations\/i1\/pin$/);
    assert.deepEqual(JSON.parse(lastCall().body), { pinned: true });
    assert.equal(useChatStore.getState().conversations[0].pinned, true);
    // The success toast is pushed from conversationActions (common:toast.*).
    assert.equal(useToastStore.getState().toasts.length, 1);
});

test('setPinned rolls the row back and toasts when the engine fails', async () => {
    reset({ conversations: [row('ai1:user')] });
    nextResponse = { ok: false, status: 500, body: { error: 'boom' } };

    const ok = await useChatStore.getState().setPinned(row('ai1:user'), true);

    assert.equal(ok, false);
    assert.equal(useChatStore.getState().conversations[0].pinned, false, 'optimistic patch reverted');
    const toasts = useToastStore.getState().toasts;
    assert.equal(toasts.length, 1);
    assert.equal(toasts[0].kind, 'error');
    assert.equal(toasts[0].message, 'boom', 'the engine copy is surfaced verbatim');
});

test('setPinned needs a participant key and stays silent without one', async () => {
    reset({ conversations: [row('ai1:user')] });
    const ok = await useChatStore.getState().setPinned({ entity_id: 'ai1' }, true);
    assert.equal(ok, false);
    assert.equal(calls.length, 0);
});

// ── setArchived ──────────────────────────────────────────────────────────

test('setArchived MOVES the row between arrays (not an in-place flag flip)', async () => {
    reset({ conversations: [row('ai1:user'), row('ai2:user', { entity_id: 'ai2' })] });

    const pending = useChatStore.getState().setArchived(row('ai1:user'), true);
    // Optimistic: the row has already left the active array.
    assert.deepEqual(
        useChatStore.getState().conversations.map((r) => r.participant_key),
        ['ai2:user']
    );
    assert.deepEqual(
        useChatStore.getState().archivedConversations.map((r) => r.participant_key),
        ['ai1:user']
    );
    await pending;

    assert.match(lastCall().url, /\/archive$/);
    assert.deepEqual(JSON.parse(lastCall().body), { archived: true });
});

test('setArchived restores the row to the active array on failure', async () => {
    reset({ conversations: [row('ai1:user'), row('ai2:user', { entity_id: 'ai2' })] });
    nextResponse = { ok: false, status: 500, body: { error: 'nope' } };

    const ok = await useChatStore.getState().setArchived(row('ai1:user'), true);

    assert.equal(ok, false);
    assert.deepEqual(
        useChatStore.getState().conversations.map((r) => r.participant_key),
        ['ai1:user', 'ai2:user']
    );
    assert.deepEqual(useChatStore.getState().archivedConversations, []);
});

test('setArchived unarchives back into the active list', async () => {
    reset({ conversations: [row('ai2:user', { entity_id: 'ai2' })], archived: [row('ai1:user', { archived: true })] });

    const ok = await useChatStore.getState().setArchived(row('ai1:user', { archived: true }), false);

    assert.equal(ok, true);
    assert.deepEqual(useChatStore.getState().archivedConversations, []);
    assert.ok(useChatStore.getState().conversations.some((r) => r.participant_key === 'ai1:user'));
});

// ── setMuted ─────────────────────────────────────────────────────────────

test('setMuted patches EVERY thread of the same companion (entity-level flag)', async () => {
    reset({
        conversations: [
            row('ai1:user', { entity_id: 'ai1' }),
            row('ai1:ai2:user', { entity_id: 'ai1' }),
            row('ai2:user', { entity_id: 'ai2' }),
        ],
    });

    useChatStore.setState({ chatEntities: [{ id: 'ai1', is_muted: false }] });
    await useChatStore.getState().setMuted(row('ai1:user', { entity_id: 'ai1' }), true);

    const muted = useChatStore.getState().conversations.filter((r) => r.muted);
    assert.equal(muted.length, 2, 'both of ai1\'s threads follow the partner flag');
    assert.equal(muted.every((r) => r.entity_id === 'ai1'), true);
    // chatEntities mirrors the flag for the detail view's status column.
    assert.equal(useChatStore.getState().chatEntities[0].is_muted, true);
    assert.match(lastCall().url, /\/mute$/);
});

test('setMuted rolls every thread back on failure', async () => {
    reset({ conversations: [row('ai1:user'), row('ai1:ai2:user')] });
    nextResponse = { ok: false, status: 500, body: { error: 'mute failed' } };

    await useChatStore.getState().setMuted(row('ai1:user'), true);

    assert.equal(useChatStore.getState().conversations.every((r) => r.muted === false), true);
});

// ── markRead ─────────────────────────────────────────────────────────────

test('markRead clears the badge and is idempotent engine-side', async () => {
    reset({ conversations: [row('ai1:user', { unread_count: 7 })] });

    const ok = await useChatStore.getState().markRead(row('ai1:user'), { read: true });

    assert.equal(ok, true);
    assert.equal(useChatStore.getState().conversations[0].unread_count, 0);
    // The interaction-keyed read receipt is preferred.
    assert.match(lastCall().url, /\/entities\/conversations\/i1\/read$/);
});

test('markRead with read:false restores one unread (set-to-1 semantics)', async () => {
    reset({ conversations: [row('ai1:user', { unread_count: 0 })] });

    await useChatStore.getState().markRead(row('ai1:user'), { read: false });

    assert.equal(useChatStore.getState().conversations[0].unread_count, 1);
    // Unread has no interaction route — it falls back to the participant key.
    assert.match(lastCall().url, /\/entities\/ai1\/conversations\/.+\/read$/);
    assert.deepEqual(JSON.parse(lastCall().body), { read: false });
});

test('markRead stays silent on success (it also fires on open and refocus)', async () => {
    reset({ conversations: [row('ai1:user', { unread_count: 3 })] });
    await useChatStore.getState().markRead(row('ai1:user'), { read: true });
    assert.equal(useToastStore.getState().toasts.length, 0);
});

test('markRead restores the badge on failure', async () => {
    reset({ conversations: [row('ai1:user', { unread_count: 3 })] });
    nextResponse = { ok: false, status: 500, body: { error: 'read failed' } };

    await useChatStore.getState().markRead(row('ai1:user'), { read: true });

    assert.equal(useChatStore.getState().conversations[0].unread_count, 3);
});

// ── deleteConversation ───────────────────────────────────────────────────

test('deleteConversation drops the row, closes the open thread and toasts', async () => {
    const target = row('ai1:user');
    reset({
        conversations: [target, row('ai2:user', { entity_id: 'ai2' })],
        active: { interactionId: 'i1', partnerEntityId: 'ai1', participantKey: 'ai1:user' },
    });

    const ok = await useChatStore.getState().deleteConversation(target);

    assert.equal(ok, true);
    assert.deepEqual(
        useChatStore.getState().conversations.map((r) => r.participant_key),
        ['ai2:user']
    );
    assert.equal(useChatStore.getState().activeConversation, null);
    // The one-shot signal ChatView watches to unmount the detail view.
    assert.equal(useChatStore.getState().detailCloseTick, 1);
    assert.equal(useToastStore.getState().toasts.at(-1).kind, 'success');
    assert.match(lastCall().url, /\/entities\/conversations\/i1$/);
    assert.equal(lastCall().method, 'DELETE');
});

test('deleteConversation surfaces the 409 copy and restores the open thread', async () => {
    const target = row('ai1:user');
    const active = { interactionId: 'i1', partnerEntityId: 'ai1', participantKey: 'ai1:user', title: 'Claire' };
    reset({ conversations: [target], active });
    nextResponse = {
        ok: false,
        status: 409,
        body: { error: 'Close the conversation before deleting it.' },
    };

    const ok = await useChatStore.getState().deleteConversation(target);

    assert.equal(ok, false);
    assert.equal(useChatStore.getState().conversations.length, 1);
    assert.equal(useChatStore.getState().activeConversation, active, 'the exact previous object is restored');
    assert.equal(useChatStore.getState().detailCloseTick, 0, 'the detail view stays open');
    assert.equal(
        useToastStore.getState().toasts.at(-1).message,
        'Close the conversation before deleting it.'
    );
});

test('deleteConversation refuses a thread with no interaction (nothing saved yet)', async () => {
    reset({ conversations: [row('ai1:user')] });
    const ok = await useChatStore.getState().deleteConversation({ participant_key: 'ai1:user', entity_id: 'ai1' });
    assert.equal(ok, false);
    assert.equal(calls.length, 0);
    assert.equal(useChatStore.getState().conversations.length, 1);
});

// ── setDisabled ──────────────────────────────────────────────────────────

test('setDisabled patches the entity flag on rows and chatEntities', async () => {
    reset({ conversations: [row('ai1:user'), row('ai1:ai2:user')] });
    useChatStore.setState({ chatEntities: [{ id: 'ai1', is_disabled: false }, { id: 'user', entity_type: 'user' }] });

    const ok = await useChatStore.getState().setDisabled('ai1', true);

    assert.equal(ok, true);
    assert.equal(useChatStore.getState().conversations.every((r) => r.entity_disabled), true);
    assert.equal(useChatStore.getState().chatEntities[0].is_disabled, true);
    // Delegates to the EXISTING entity update (no second write path).
    assert.match(lastCall().url, /\/entities\/ai1$/);
    assert.deepEqual(JSON.parse(lastCall().body), { is_disabled: true });
});

test('setDisabled rolls both patches back on failure', async () => {
    reset({ conversations: [row('ai1:user')] });
    useChatStore.setState({ chatEntities: [{ id: 'ai1', is_disabled: false }] });
    nextResponse = { ok: false, status: 500, body: { error: 'disable failed' } };

    const ok = await useChatStore.getState().setDisabled('ai1', true);

    assert.equal(ok, false);
    assert.equal(useChatStore.getState().conversations[0].entity_disabled, false);
    assert.equal(useChatStore.getState().chatEntities[0].is_disabled, false);
});

test('setDisabled needs an entity id', async () => {
    reset({ conversations: [] });
    assert.equal(await useChatStore.getState().setDisabled('', true), false);
    assert.equal(calls.length, 0);
});
