import test from 'node:test';
import assert from 'node:assert/strict';
import { personaOwnedProfileIds, excludePersonaOwnedProfiles } from './personaProfileUtils.js';
import {
    FILTER_ALL,
    FILTER_FAVORITES,
    buildCategoryMemberIndex,
    categoryFilterId,
    countCategoryMembers,
    countFavorites,
    filterCharacterProfiles,
} from './characterFilterUtils.js';

/**
 * 03-6 step 3: the Characters grid must keep excluding persona-owned profiles
 * AFTER the category work. Categories are a local organisation feature whose
 * membership rows carry raw profile ids, so nothing stops a persona-owned card
 * from being a member — the exclusion has to survive the join, not replace it.
 */

const profile = (id, extra = {}) => ({
    id,
    name: `Name of ${id}`,
    description: `Description of ${id}`,
    is_favorite: 0,
    ...extra,
});

// Aria is a character card; You is the profile owned by the 'user' persona.
const aria = profile('p-aria');
const you = profile('p-you');
const max = profile('p-max', { is_favorite: 1 });
const profiles = [aria, you, max];

const entities = [
    // The built-in persona — owns 'p-you'.
    { id: 'user', entity_type: 'user', character_profile_id: 'p-you' },
    // An AI partner that links the SAME card live (defensive case: persona
    // ownership must still win, per personaProfileUtils' documented rule).
    { id: 'aria-20260101000000', entity_type: 'ai', character_profile_id: 'p-aria' },
    { id: 'max-20260101000001', entity_type: 'ai', character_profile: { id: 'p-max' } },
];

test('persona-owned ids resolve from a top-level link and an embedded profile', () => {
    const owned = personaOwnedProfileIds(entities, profiles);
    assert.deepEqual([...owned], ['p-you']);
});

test('the visible list drops persona-owned cards and keeps engine order', () => {
    assert.deepEqual(
        excludePersonaOwnedProfiles(profiles, entities).map((p) => p.id),
        ['p-aria', 'p-max'],
    );
});

test('an AI entity linking the same card does NOT rescue it — persona ownership wins', () => {
    // Both entities point at 'p-aria' here; the persona must still hide it.
    const dual = [
        { id: 'user', entity_type: 'user', character_profile_id: 'p-aria' },
        { id: 'aria-20260101000000', entity_type: 'ai', character_profile_id: 'p-aria' },
    ];
    assert.deepEqual(excludePersonaOwnedProfiles([aria], dual), []);
});

test('stale references to unknown profiles are ignored, and the input is never mutated', () => {
    const stale = [{ id: 'ghost', entity_type: 'user', character_profile_id: 'p-deleted' }];
    const snapshot = profiles.map((p) => p.id);
    const result = excludePersonaOwnedProfiles(profiles, stale);
    assert.deepEqual(result.map((p) => p.id), snapshot);
    assert.notEqual(result, profiles, 'a new array is always returned');
    assert.deepEqual(profiles.map((p) => p.id), snapshot);
});

test('a garbage profile list degrades to empty instead of throwing', () => {
    assert.deepEqual(excludePersonaOwnedProfiles(null, entities), []);
    assert.deepEqual(excludePersonaOwnedProfiles(undefined, entities), []);
});

test('a category join CANNOT resurface a persona-owned card — the exclusion runs first', () => {
    // The persona's card is a member of a character category. This is the exact
    // scenario 03-6 asks us to verify: if the grid filtered categories over the
    // RAW list, 'p-you' would come back through the chip.
    const categories = [
        { id: 'cat-heroes', name: 'Heroes', sort_order: 0, profile_ids: ['p-aria', 'p-you', 'p-max'] },
    ];
    const categoryIndex = buildCategoryMemberIndex(categories);
    const visible = excludePersonaOwnedProfiles(profiles, entities);

    const filtered = filterCharacterProfiles(visible, {
        filter: categoryFilterId('cat-heroes'),
        categoryIndex,
    });

    assert.deepEqual(filtered.map((p) => p.id), ['p-aria', 'p-max']);
    assert.ok(!filtered.some((p) => p.id === 'p-you'));
});

test('category chip counts are measured against the VISIBLE list, not the memberships', () => {
    const categories = [
        { id: 'cat-heroes', name: 'Heroes', sort_order: 0, profile_ids: ['p-aria', 'p-you', 'p-max'], member_count: 3 },
    ];
    const categoryIndex = buildCategoryMemberIndex(categories);
    const visible = excludePersonaOwnedProfiles(profiles, entities);

    // The engine says 3; the chip must advertise 2 — a chip promising a card the
    // grid refuses to render is the bug 03-2's rules warn about.
    assert.equal(categories[0].member_count, 3);
    assert.equal(countCategoryMembers(visible, 'cat-heroes', categoryIndex), 2);
});

test('search does not resurface a persona-owned card either', () => {
    const visible = excludePersonaOwnedProfiles(profiles, entities);
    const hits = filterCharacterProfiles(visible, { search: 'Name of p-you', filter: FILTER_ALL });
    // The search text matches, but the card is excluded BEFORE search runs.
    assert.deepEqual(hits, []);
});

test('favouriting a persona-owned card cannot pull it back through the chip', () => {
    const favouritePersonaCard = profile('p-you', { is_favorite: 1 });
    const list = [aria, favouritePersonaCard, max];
    const visible = excludePersonaOwnedProfiles(list, entities);

    assert.equal(countFavorites(visible), 1, 'only p-max counts');
    assert.ok(!filterCharacterProfiles(visible, { filter: FILTER_FAVORITES })
        .some((p) => p.id === 'p-you'));
});

test('with no personas every card is visible, in order', () => {
    assert.deepEqual(
        excludePersonaOwnedProfiles(profiles, [{ id: 'a', entity_type: 'ai', character_profile_id: 'p-aria' }])
            .map((p) => p.id),
        ['p-aria', 'p-you', 'p-max'],
    );
    assert.deepEqual(excludePersonaOwnedProfiles(profiles, []).map((p) => p.id), ['p-aria', 'p-you', 'p-max']);
});
