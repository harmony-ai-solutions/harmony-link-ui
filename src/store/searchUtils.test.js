/**
 * Message search — pure helpers (Task 02-9).
 *
 * These pin the rules the acceptance criterion rests on: a 1-character query is
 * never sent, a 250 ms debounce coalesces typing into one request, results are
 * capped at the engine's own 100, and a snippet highlights the match without
 * splitting an emoji in half.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    MIN_QUERY_LENGTH,
    SEARCH_DEBOUNCE_MS,
    SEARCH_RESULT_LIMIT,
    normalizeSearchTerm,
    searchTermLength,
    isSearchable,
    searchQueryState,
    buildSnippet,
    highlightParts,
    normalizeSearchHit,
    normalizeSearchResults,
    capSearchResults,
    filterHitsByParticipant,
    searchHitPartner,
    jumpTargetFromHit,
    hitMatchesConversation,
    groupHitsByConversation,
    createDebouncer,
} from './searchUtils.js';

// ── Query gating ─────────────────────────────────────────────────────────

test('the task constants are the ones the UI must honour', () => {
    assert.equal(MIN_QUERY_LENGTH, 2);
    assert.equal(SEARCH_DEBOUNCE_MS, 250);
    assert.equal(SEARCH_RESULT_LIMIT, 100);
});

test('normalizeSearchTerm trims the ends but keeps inner spacing', () => {
    assert.equal(normalizeSearchTerm('  ocean  '), 'ocean');
    assert.equal(normalizeSearchTerm('  two  words '), 'two  words');
    assert.equal(normalizeSearchTerm(null), '');
    assert.equal(normalizeSearchTerm(undefined), '');
    assert.equal(normalizeSearchTerm(42), '42');
});

test('searchTermLength counts characters, not UTF-16 units', () => {
    assert.equal(searchTermLength('ab'), 2);
    assert.equal(searchTermLength('🌊🌊'), 2, 'an emoji is one character');
    assert.equal(searchTermLength('  🌊 '), 1);
});

test('isSearchable enforces the 2-character floor', () => {
    assert.equal(isSearchable(''), false);
    assert.equal(isSearchable('a'), false);
    assert.equal(isSearchable(' a '), false);
    assert.equal(isSearchable('ab'), true);
    assert.equal(isSearchable('🌊🌊'), true);
});

test('searchQueryState separates empty from too-short', () => {
    assert.deepEqual(searchQueryState('   '), {
        term: '', length: 0, empty: true, tooShort: false, canSearch: false,
    });
    assert.deepEqual(searchQueryState(' o '), {
        term: 'o', length: 1, empty: false, tooShort: true, canSearch: false,
    });
    assert.equal(searchQueryState('oc').canSearch, true);
});

// ── Snippets ─────────────────────────────────────────────────────────────

test('buildSnippet centres a match with ellipses on both sides', () => {
    const content = `${'a'.repeat(200)}ocean${'b'.repeat(200)}`;
    const snippet = buildSnippet(content, 'ocean', { context: 10, maxLength: 40 });
    assert.equal(snippet.text.includes('ocean'), true);
    assert.equal(snippet.leadingEllipsis, true);
    assert.equal(snippet.trailingEllipsis, true);
    const start = snippet.matchStart;
    assert.equal(snippet.text.slice(start, start + snippet.matchLength), 'ocean');
});

test('buildSnippet matches case-insensitively but reports the ORIGINAL casing', () => {
    const snippet = buildSnippet('I love the Ocean at dawn', 'ocean');
    const start = snippet.matchStart;
    assert.equal(snippet.text.slice(start, start + snippet.matchLength), 'Ocean');
    assert.equal(snippet.leadingEllipsis, false);
    assert.equal(snippet.trailingEllipsis, false);
});

test('buildSnippet with no match starts at the beginning and flags no match', () => {
    const snippet = buildSnippet('short message', 'zzz');
    assert.equal(snippet.text, 'short message');
    assert.equal(snippet.matchStart, -1);
    assert.equal(snippet.matchLength, 0);
});

test('buildSnippet handles empty content', () => {
    assert.deepEqual(buildSnippet('', 'x'), {
        text: '', matchStart: -1, matchLength: 0, leadingEllipsis: false, trailingEllipsis: false,
    });
    assert.deepEqual(buildSnippet(null, 'x'), {
        text: '', matchStart: -1, matchLength: 0, leadingEllipsis: false, trailingEllipsis: false,
    });
});

test('buildSnippet never splits an emoji across the cut', () => {
    // Each 🌊 is two UTF-16 units; a naive slice at the cap would split one.
    // `context` counts CHARACTERS, so 2 means two emoji — not two code units.
    const content = '🌊'.repeat(30);
    const snippet = buildSnippet(content, '🌊', { context: 2, maxLength: 9 });
    const glyphs = Array.from(snippet.text);
    assert.equal(glyphs.every((g) => g === '🌊'), true, `no half emoji in ${JSON.stringify(snippet.text)}`);
    // match (1) + 2 characters of context on the right, and no room on the left.
    assert.equal(glyphs.length, 3);
    assert.equal(snippet.matchLength, 1);
    assert.equal(snippet.trailingEllipsis, true);
});

test('buildSnippet keeps a match visible when the cap barely exceeds it', () => {
    const snippet = buildSnippet('xx needle yy', 'needle', { context: 2, maxLength: 8 });
    assert.ok(snippet.matchLength > 0, 'the match must not be clipped away entirely');
    const { matchStart, matchLength, text } = snippet;
    assert.equal(text.slice(matchStart, matchStart + matchLength), 'needle'.slice(0, matchLength));
});

// ── Highlight parts ──────────────────────────────────────────────────────

test('highlightParts joins back to the snippet text exactly', () => {
    const snippet = buildSnippet('I love the Ocean at dawn', 'ocean');
    const parts = highlightParts(snippet);
    assert.equal(parts.map((p) => p.text).join(''), snippet.text);
    assert.equal(parts.filter((p) => p.match).length, 1);
    assert.equal(parts.find((p) => p.match).text, 'Ocean');
});

test('highlightParts returns one plain part when there is no match', () => {
    assert.deepEqual(highlightParts({ text: 'hello', matchStart: -1, matchLength: 0 }), [
        { text: 'hello', match: false },
    ]);
    assert.deepEqual(highlightParts({ text: '', matchStart: -1, matchLength: 0 }), []);
    assert.deepEqual(highlightParts(null), []);
});

// ── Hit normalisation ────────────────────────────────────────────────────

/** An engine hit as `handleSearchChatMessages` emits it. */
const hit = (id, extra = {}) => ({
    message: {
        id,
        entity_id: 'claire',
        sender_entity_id: 'user',
        interaction_id: 'i1',
        content: `content of ${id}`,
        message_type: 'text',
        created_at: '2026-10-01T09:00:00Z',
        updated_at: '2026-10-01T09:00:00Z',
        ...(extra.message || {}),
    },
    interaction_id: 'i1',
    participant_key: 'claire+user',
    ...extra.outer,
});

test('normalizeSearchHit carries the thread identity and recovers participant ids', () => {
    const hitRow = normalizeSearchHit(hit('m1'));
    assert.equal(hitRow.id, 'm1');
    assert.equal(hitRow.participant_key, 'claire+user');
    assert.deepEqual(hitRow.participant_ids, ['claire', 'user']);
    // The OWNER of the thread, not the sender.
    assert.equal(hitRow.entity_id, 'claire');
    assert.equal(hitRow.sender_entity_id, 'user');
    assert.equal(hitRow.content, 'content of m1');
});

test('normalizeSearchHit tolerates a missing participant_key', () => {
    const hitRow = normalizeSearchHit(hit('m1', { outer: { participant_key: null } }));
    assert.equal(hitRow.participant_key, '');
    assert.deepEqual(hitRow.participant_ids, []);
    assert.equal(hitRow.interaction_id, 'i1');
});

test('normalizeSearchHit rejects a hit with no message', () => {
    assert.equal(normalizeSearchHit(null), null);
    assert.equal(normalizeSearchHit({}), null);
    assert.equal(normalizeSearchHit({ message: { content: 'no id' } }), null);
});

test('normalizeSearchResults dedupes by message id and applies the cap', () => {
    const raw = [hit('a'), hit('a'), hit('b'), hit('c')];
    const results = normalizeSearchResults(raw);
    assert.deepEqual(results.map((r) => r.id), ['a', 'b', 'c']);

    assert.equal(normalizeSearchResults(raw, 2).length, 2);
    assert.equal(normalizeSearchResults(raw, 0).length, 3, 'a non-positive cap falls back to the default');
});

test('normalizeSearchResults caps at the engine limit by default', () => {
    const raw = Array.from({ length: 150 }, (_, i) => hit(`m${i}`));
    assert.equal(normalizeSearchResults(raw).length, SEARCH_RESULT_LIMIT);
});

test('capSearchResults only ever shrinks', () => {
    const list = [{ id: 'a' }, { id: 'b' }];
    assert.equal(capSearchResults(list, 5), list, 'under the cap the same array is returned');
    assert.deepEqual(capSearchResults(list, 1), [{ id: 'a' }]);
});

test('filterHitsByParticipant narrows to one thread and is a no-op without a key', () => {
    const results = normalizeSearchResults([
        hit('a'),
        hit('b', { outer: { participant_key: 'zoe+user' } }),
    ]);
    assert.deepEqual(filterHitsByParticipant(results, 'claire+user').map((r) => r.id), ['a']);
    assert.equal(filterHitsByParticipant(results, ''), results);
});

// ── Navigation ───────────────────────────────────────────────────────────

test('searchHitPartner prefers the loaded entity name and falls back to the id', () => {
    const hitRow = normalizeSearchHit(hit('m1'));
    assert.deepEqual(
        searchHitPartner(hitRow, { claire: { id: 'claire', display_name: 'Claire', character_profile_id: 'p1' } }),
        { id: 'claire', name: 'Claire', profileId: 'p1' }
    );
    assert.deepEqual(searchHitPartner(hitRow, {}), { id: 'claire', name: 'claire', profileId: '' });
});

test('jumpTargetFromHit shapes a conversation the open path already accepts', () => {
    const target = jumpTargetFromHit(normalizeSearchHit(hit('m1')));
    assert.deepEqual(target, {
        interactionId: 'i1',
        entityId: 'claire',
        participantKey: 'claire+user',
        participantIds: ['claire', 'user'],
        partnerEntityId: 'user',
    });
});

test('hitMatchesConversation compares the participant key, not the interaction', () => {
    const hitRow = normalizeSearchHit(hit('m1'));
    assert.equal(hitMatchesConversation(hitRow, { participantKey: 'claire+user' }), true);
    assert.equal(hitMatchesConversation(hitRow, { participant_key: 'claire+user' }), true);
    assert.equal(hitMatchesConversation(hitRow, { participantKey: 'other' }), false);
    assert.equal(hitMatchesConversation(hitRow, null), false);
});

test('groupHitsByConversation keeps the engine order', () => {
    const results = normalizeSearchResults([
        hit('a'),
        hit('b', { outer: { participant_key: 'zoe+user' } }),
        hit('c'),
    ]);
    const groups = groupHitsByConversation(results);
    assert.deepEqual(groups.map((g) => g.participantKey), ['claire+user', 'zoe+user']);
    assert.deepEqual(groups[0].hits.map((h) => h.id), ['a', 'c']);
});

// ── Debounce ─────────────────────────────────────────────────────────────

/** A deterministic clock so the debounce can be driven without real waiting. */
function fakeClock() {
    let nextId = 1;
    const pending = new Map();
    return {
        set(callback, ms) {
            const id = nextId++;
            pending.set(id, { callback, ms });
            return id;
        },
        clear(id) {
            pending.delete(id);
        },
        /** Fire every pending timer. */
        flush() {
            const entries = [...pending.entries()];
            pending.clear();
            for (const [, entry] of entries) entry.callback();
        },
        get size() {
            return pending.size;
        },
        delays() {
            return [...pending.values()].map((entry) => entry.ms);
        },
    };
}

test('createDebouncer fires once with the LAST arguments after the delay', () => {
    const clock = fakeClock();
    const seen = [];
    const debounced = createDebouncer((value) => seen.push(value), SEARCH_DEBOUNCE_MS, clock);

    debounced('o');
    debounced('oc');
    debounced('oce');

    assert.equal(seen.length, 0, 'nothing fires before the delay');
    assert.equal(clock.size, 1, 'earlier timers were cancelled');
    assert.deepEqual(clock.delays(), [SEARCH_DEBOUNCE_MS]);

    clock.flush();
    assert.deepEqual(seen, ['oce']);
});

test('createDebouncer cancel drops a pending call and pending() reports it', () => {
    const clock = fakeClock();
    const seen = [];
    const debounced = createDebouncer((value) => seen.push(value), 250, clock);

    debounced('ocean');
    assert.equal(debounced.pending(), true);
    debounced.cancel();
    assert.equal(debounced.pending(), false);
    clock.flush();
    assert.deepEqual(seen, [], 'a cancelled call never fires');
});

test('createDebouncer is re-armable after firing', () => {
    const clock = fakeClock();
    const seen = [];
    const debounced = createDebouncer((value) => seen.push(value), 250, clock);

    debounced('one');
    clock.flush();
    debounced('two');
    clock.flush();

    assert.deepEqual(seen, ['one', 'two']);
    assert.equal(debounced.pending(), false);
});
