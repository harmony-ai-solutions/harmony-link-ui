/**
 * chatStore message search — request gating, scoping, jump and pagination
 * (Task 02-9).
 *
 * Same seam as the other store suites: the real service module is used and only
 * `fetch` is stubbed, so the URL the store builds, the scope it applies and the
 * ORDER of the jump handoff are all assertable without a bundler or a browser.
 *
 * The behaviours under test are the ones the acceptance criterion rests on —
 * "searching a word finds messages across partners and jumps to the right
 * place":
 *
 *   1. a term shorter than two characters never reaches the network;
 *   2. hits are normalised, deduped and capped;
 *   3. an in-thread search keeps only that thread's hits;
 *   4. a SLOWER response cannot overwrite a newer query's results;
 *   5. a jump publishes the open-request the container watches and the message
 *      id the timeline scrolls to;
 *   6. `loadUntilMessage` pages backwards until the hit is loaded, and stops
 *      honestly when it is not there.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const calls = [];
/** @type {{ok: boolean, body: object, status: number}} */
let nextResponse = { ok: true, body: { count: 0, results: [] }, status: 200 };

globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body });
    return {
        ok: nextResponse.ok,
        status: nextResponse.status,
        json: async () => nextResponse.body,
    };
};

const { default: useChatStore } = await import('./chatStore.js');
const { clearToasts } = await import('./toastStore.js');

/** One engine hit, in the exact shape `handleSearchChatMessages` emits. */
const hit = (id, extra = {}) => ({
    message: {
        id,
        entity_id: 'claire',
        sender_entity_id: 'user',
        interaction_id: 'i1',
        content: `content about the ocean ${id}`,
        message_type: 'text',
        created_at: '2026-10-01T09:00:00Z',
        updated_at: '2026-10-01T09:00:00Z',
        ...(extra.message || {}),
    },
    interaction_id: 'i1',
    participant_key: 'claire+user',
    ...(extra.outer || {}),
});

/** A timeline message. */
const message = (id, extra = {}) => ({
    id,
    entity_id: 'claire',
    sender_entity_id: 'claire',
    interaction_id: 'i1',
    content: `content of ${id}`,
    message_type: 'text',
    is_read: true,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...extra,
});

function reset(overrides = {}) {
    calls.length = 0;
    nextResponse = { ok: true, status: 200, body: { count: 0, results: [] } };
    clearToasts();
    useChatStore.setState({
        searchTerm: '',
        searchResults: [],
        searching: false,
        searchError: null,
        searchScope: null,
        searchJump: null,
        focusMessage: null,
        messages: [],
        hasMore: false,
        loadingOlder: false,
        nextCursor: null,
        activeConversation: null,
        ...overrides,
    });
}

const lastCall = () => calls[calls.length - 1];

// ── Gating ───────────────────────────────────────────────────────────────

test('searchMessages refuses a term shorter than two characters without a request', async () => {
    reset();

    assert.deepEqual(await useChatStore.getState().searchMessages(''), []);
    assert.deepEqual(await useChatStore.getState().searchMessages('a'), []);
    assert.deepEqual(await useChatStore.getState().searchMessages('  o  '), []);
    assert.equal(calls.length, 0, 'a short query must never reach the engine');
    assert.deepEqual(useChatStore.getState().searchResults, []);
});

test('searchMessages replaces the previous results when the query becomes too short', async () => {
    reset({ searchResults: [{ id: 'stale' }], searchTerm: 'ocean' });

    await useChatStore.getState().searchMessages('o');

    // Publishing NOTHING is the point: stale hits under a new query read as
    // matches for it.
    assert.deepEqual(useChatStore.getState().searchResults, []);
    assert.equal(useChatStore.getState().searchTerm, '');
});

// ── The happy path ───────────────────────────────────────────────────────

test('searchMessages requests the global endpoint with the trimmed term and the cap', async () => {
    reset();
    nextResponse = { ok: true, status: 200, body: { count: 2, results: [hit('m1'), hit('m2')] } };

    const hits = await useChatStore.getState().searchMessages('  ocean  ');

    assert.equal(calls.length, 1);
    assert.match(lastCall().url, /\/entities\/messages\/search\?/);
    assert.match(lastCall().url, /q=ocean/);
    assert.match(lastCall().url, /limit=100/);
    assert.equal(lastCall().method, 'GET');

    assert.deepEqual(hits.map((h) => h.id), ['m1', 'm2']);
    const state = useChatStore.getState();
    assert.equal(state.searchTerm, 'ocean');
    assert.equal(state.searching, false);
    assert.equal(state.searchError, null);
    assert.equal(state.searchResults.length, 2);
});

test('searchMessages normalises hits and carries the partner identity', async () => {
    reset();
    nextResponse = { ok: true, status: 200, body: { results: [hit('m1')] } };

    const [first] = await useChatStore.getState().searchMessages('ocean');

    assert.equal(first.participant_key, 'claire+user');
    assert.equal(first.entity_id, 'claire');
    assert.deepEqual(first.participant_ids, ['claire', 'user']);
    assert.equal(first.content, 'content about the ocean m1');
});

test('searchMessages caps the published list even if the engine returns more', async () => {
    reset();
    const many = Array.from({ length: 150 }, (_, i) => hit(`m${i}`));
    nextResponse = { ok: true, status: 200, body: { results: many } };

    const hits = await useChatStore.getState().searchMessages('ocean');

    assert.equal(hits.length, 100);
    assert.equal(useChatStore.getState().searchResults.length, 100);
});

// ── Scoping ──────────────────────────────────────────────────────────────

test('an in-thread search keeps only that thread\'s hits', async () => {
    reset();
    nextResponse = {
        ok: true,
        status: 200,
        body: {
            results: [
                hit('mine'),
                hit('other', { outer: { participant_key: 'zoe+user' } }),
            ],
        },
    };

    const hits = await useChatStore.getState().searchMessages('ocean', {
        scope: { participantKey: 'claire+user' },
    });

    assert.deepEqual(hits.map((h) => h.id), ['mine']);
    assert.deepEqual(useChatStore.getState().searchScope, { participantKey: 'claire+user' });
    // The narrowing is CLIENT-side on purpose: an `interaction_id` filter would
    // hide the older messages a thread search is looking for.
    assert.equal(calls.length, 1);
    assert.doesNotMatch(lastCall().url, /interaction_id/);
});

// ── Races and failures ───────────────────────────────────────────────────

test('a slower response cannot overwrite a newer query\'s results', async () => {
    reset();

    /** A fetch that resolves when the test says so. */
    const deferred = [];
    globalThis.fetch = async (url) => {
        calls.push({ url: String(url), method: 'GET' });
        return new Promise((resolve) => {
            deferred.push(() => resolve({
                ok: true,
                status: 200,
                json: async () => ({ results: [hit(String(url).includes('q=old') ? 'old' : 'new')] }),
            }));
        });
    };

    const pendingOld = useChatStore.getState().searchMessages('old');
    const pendingNew = useChatStore.getState().searchMessages('newer');

    // Resolve the NEWER request first, then the older one.
    deferred[1]();
    await pendingNew;
    deferred[0]();
    await pendingOld;

    assert.deepEqual(
        useChatStore.getState().searchResults.map((h) => h.id),
        ['new'],
        'the stale response must be dropped'
    );

    // Restore the shared stub.
    globalThis.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), method: options.method || 'GET', body: options.body });
        return {
            ok: nextResponse.ok,
            status: nextResponse.status,
            json: async () => nextResponse.body,
        };
    };
});

test('searchMessages surfaces a failure without keeping stale hits', async () => {
    reset({ searchResults: [{ id: 'stale' }] });
    nextResponse = { ok: false, status: 500, body: { error: 'search blew up' } };

    const hits = await useChatStore.getState().searchMessages('ocean');

    assert.deepEqual(hits, []);
    const state = useChatStore.getState();
    assert.deepEqual(state.searchResults, []);
    assert.equal(state.searching, false);
    assert.equal(state.searchError, 'search blew up');
});

test('clearSearch drops the term, the hits and the scope', async () => {
    reset({
        searchTerm: 'ocean',
        searchResults: [{ id: 'm1' }],
        searchError: 'boom',
        searchScope: { participantKey: 'claire+user' },
    });

    useChatStore.getState().clearSearch();

    const state = useChatStore.getState();
    assert.equal(state.searchTerm, '');
    assert.deepEqual(state.searchResults, []);
    assert.equal(state.searchError, null);
    assert.equal(state.searchScope, null);
});

// ── Jump ─────────────────────────────────────────────────────────────────

test('jumpToSearchHit publishes the open request and the scroll target together', async () => {
    reset();
    nextResponse = { ok: true, status: 200, body: { results: [hit('m1')] } };
    const [first] = await useChatStore.getState().searchMessages('ocean');

    const ok = useChatStore.getState().jumpToSearchHit(first);

    assert.equal(ok, true);
    const state = useChatStore.getState();
    // What ChatView consumes to open the thread...
    assert.deepEqual(state.searchJump, {
        interactionId: 'i1',
        entityId: 'claire',
        participantKey: 'claire+user',
        participantIds: ['claire', 'user'],
        partnerEntityId: 'user',
        messageId: 'm1',
        query: 'ocean',
    });
    // ...and what the timeline consumes to land on the message.
    assert.deepEqual(state.focusMessage, { id: 'm1', participantKey: 'claire+user' });
});

test('jumpToSearchHit refuses a hit that cannot name a conversation', async () => {
    reset();

    const ok = useChatStore.getState().jumpToSearchHit({ id: 'm1', participant_key: '', entity_id: '' });

    assert.equal(ok, false);
    assert.equal(useChatStore.getState().searchJump, null);
    assert.equal(useChatStore.getState().focusMessage, null);
});

test('a hit inside the OPEN thread sets only the scroll target, never a reopen', async () => {
    reset({
        // The store's own open conversation is keyed by participantKey (camelCase).
        activeConversation: { entityId: 'claire', participantKey: 'claire+user', interactionId: 'i1' },
    });
    nextResponse = { ok: true, status: 200, body: { results: [hit('m1')] } };
    const [first] = await useChatStore.getState().searchMessages('ocean');

    const ok = useChatStore.getState().jumpToSearchHit(first);

    assert.equal(ok, true);
    // Re-opening would reset the timeline, tear the socket down and re-fetch the
    // newest page — a visible reload for a message already on screen.
    assert.equal(useChatStore.getState().searchJump, null);
    assert.deepEqual(useChatStore.getState().focusMessage, { id: 'm1', participantKey: 'claire+user' });
});

test('jumpToSearchHit records the query the caller captured, not the cleared one', async () => {
    reset();
    nextResponse = { ok: true, status: 200, body: { results: [hit('m1')] } };
    const [first] = await useChatStore.getState().searchMessages('ocean');

    // The search panel clears itself as part of choosing a hit.
    useChatStore.getState().clearSearch();

    useChatStore.getState().jumpToSearchHit(first, { query: 'ocean' });

    assert.equal(useChatStore.getState().searchJump.query, 'ocean');
});

test('the jump request is consumed once', () => {
    reset({ searchJump: { entityId: 'claire', messageId: 'm1' } });

    useChatStore.getState().clearSearchJump();
    assert.equal(useChatStore.getState().searchJump, null);

    reset({ focusMessage: { id: 'm1', participantKey: 'claire+user' } });
    useChatStore.getState().clearFocusMessage();
    assert.equal(useChatStore.getState().focusMessage, null);
});

// ── loadUntilMessage ─────────────────────────────────────────────────────

test('loadUntilMessage returns immediately when the message is already loaded', async () => {
    reset({
        messages: [message('m1')],
        activeConversation: { entityId: 'claire', participantKey: 'claire+user' },
        hasMore: true,
        nextCursor: 'cursor',
    });

    const found = await useChatStore.getState().loadUntilMessage('m1');

    assert.equal(found, true);
    assert.equal(calls.length, 0, 'no page is fetched for a message already on screen');
});

test('loadUntilMessage pages backwards until the message appears', async () => {
    reset({
        messages: [message('newest')],
        activeConversation: { entityId: 'claire', participantKey: 'claire+user' },
        hasMore: true,
        nextCursor: 'c1',
    });

    // Page 1: does not contain the target, still more history.
    // Page 2: contains it.
    let page = 0;
    globalThis.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), method: options.method || 'GET', body: options.body });
        page += 1;
        const body = page === 1
            ? {
                messages: [message('older-1', { created_at: '2026-09-30T00:00:00Z' })],
                has_more: true,
                next_cursor: 'c2',
            }
            : {
                messages: [
                    message('older-1', { created_at: '2026-09-30T00:00:00Z' }),
                    message('target', { created_at: '2026-09-29T00:00:00Z' }),
                ],
                has_more: false,
                next_cursor: null,
            };
        return { ok: true, status: 200, json: async () => body };
    };

    const found = await useChatStore.getState().loadUntilMessage('target');

    assert.equal(found, true);
    assert.equal(calls.length, 2);
    assert.ok(useChatStore.getState().messages.some((m) => m.id === 'target'));

    // Restore the shared stub.
    globalThis.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), method: options.method || 'GET', body: options.body });
        return {
            ok: nextResponse.ok,
            status: nextResponse.status,
            json: async () => nextResponse.body,
        };
    };
});

test('loadUntilMessage stops when there is no more history, and reports the miss', async () => {
    reset({
        messages: [message('newest')],
        activeConversation: { entityId: 'claire', participantKey: 'claire+user' },
        hasMore: false,
        nextCursor: null,
    });

    const found = await useChatStore.getState().loadUntilMessage('missing');

    assert.equal(found, false);
    assert.equal(calls.length, 0, 'exhausted history must not keep requesting');
});

test('loadUntilMessage is bounded by maxPages', async () => {
    reset({
        messages: [message('newest')],
        activeConversation: { entityId: 'claire', participantKey: 'claire+user' },
        hasMore: true,
        nextCursor: 'c1',
    });

    globalThis.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), method: options.method || 'GET', body: options.body });
        return {
            ok: true,
            status: 200,
            json: async () => ({
                messages: [message(`page-${calls.length}`, { created_at: '2026-01-01T00:00:00Z' })],
                has_more: true,
                next_cursor: `c${calls.length + 1}`,
            }),
        };
    };

    const found = await useChatStore.getState().loadUntilMessage('never', { maxPages: 3 });

    assert.equal(found, false);
    assert.equal(calls.length, 3, 'the loop must stop at the page cap');

    // Restore the shared stub.
    globalThis.fetch = async (url, options = {}) => {
        calls.push({ url: String(url), method: options.method || 'GET', body: options.body });
        return {
            ok: nextResponse.ok,
            status: nextResponse.status,
            json: async () => nextResponse.body,
        };
    };
});

test('loadUntilMessage refuses without a message id or an open conversation', async () => {
    reset();

    assert.equal(await useChatStore.getState().loadUntilMessage(''), false);
    assert.equal(await useChatStore.getState().loadUntilMessage('m1'), false);
    assert.equal(calls.length, 0);
});
