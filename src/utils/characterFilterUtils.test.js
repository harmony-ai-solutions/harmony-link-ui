import test from 'node:test';
import assert from 'node:assert/strict';
import {
    FILTER_ALL,
    FILTER_FAVORITES,
    isFavorite,
    isFavoriteProfile,
    matchesCharacterFilters,
    filterCharacterProfiles,
    countFavorites,
    resolveCharacterFilter,
} from './characterFilterUtils.js';

/** Build a profile; defaults describe a non-favourite profile named "Aria". */
const profile = (name, extra = {}) => ({
    id: `id-${name}`,
    name,
    description: `Description of ${name}`,
    is_favorite: 0,
    ...extra,
});

// ── isFavorite ──────────────────────────────────────────────────────────────
// The engine sends is_favorite as a JSON NUMBER (int64 0/1), never a boolean.

test('isFavorite reads the engine 0/1 number wire value', () => {
    assert.equal(isFavorite(1), true);
    assert.equal(isFavorite(0), false);
    // The bug this guards: `is_favorite === true` is false for every real row.
    assert.notEqual(profile('Aria', { is_favorite: 1 }).is_favorite === true, true);
});

test('isFavorite accepts booleans, numeric strings and truthy descriptors', () => {
    assert.equal(isFavorite(true), true);
    assert.equal(isFavorite(false), false);
    assert.equal(isFavorite('1'), true);
    assert.equal(isFavorite('0'), false);
    assert.equal(isFavorite('true'), true);
    assert.equal(isFavorite('false'), false);
    assert.equal(isFavorite(' TRUE '), true);
    assert.equal(isFavorite(2), true);
    assert.equal(isFavorite(-1), true);
});

test('isFavorite treats missing and unparseable values as not-favourite', () => {
    assert.equal(isFavorite(undefined), false);
    assert.equal(isFavorite(null), false);
    assert.equal(isFavorite(''), false);
    assert.equal(isFavorite('   '), false);
    assert.equal(isFavorite('yes'), false);
    assert.equal(isFavorite({}), false);
    assert.equal(isFavorite([]), false);
    assert.equal(isFavorite(NaN), false);
});

test('isFavoriteProfile tolerates a missing profile', () => {
    assert.equal(isFavoriteProfile(profile('Aria', { is_favorite: 1 })), true);
    assert.equal(isFavoriteProfile(profile('Aria')), false);
    assert.equal(isFavoriteProfile(null), false);
    assert.equal(isFavoriteProfile(undefined), false);
});

// ── matchesCharacterFilters ─────────────────────────────────────────────────

test('no search and the All filter admits every profile', () => {
    assert.equal(matchesCharacterFilters(profile('Aria')), true);
    assert.equal(matchesCharacterFilters(profile('Aria'), { search: '', filter: FILTER_ALL }), true);
    assert.equal(matchesCharacterFilters(profile('Aria'), { search: '   ' }), true);
});

test('the Favorites filter admits only favourites', () => {
    const fav = profile('Aria', { is_favorite: 1 });
    const plain = profile('Bram', { is_favorite: 0 });
    assert.equal(matchesCharacterFilters(fav, { filter: FILTER_FAVORITES }), true);
    assert.equal(matchesCharacterFilters(plain, { filter: FILTER_FAVORITES }), false);
});

test('search matches name or description, case-insensitively, on trimmed input', () => {
    const p = profile('Aria', { description: 'A wandering scholar' });
    assert.equal(matchesCharacterFilters(p, { search: 'ari' }), true);
    assert.equal(matchesCharacterFilters(p, { search: '  ARIA  ' }), true);
    assert.equal(matchesCharacterFilters(p, { search: 'wander' }), true);
    assert.equal(matchesCharacterFilters(p, { search: 'WANDERING SCHOLAR' }), true);
    assert.equal(matchesCharacterFilters(p, { search: 'nomatch' }), false);
});

test('search and the favourite filter COMPOSE (search runs within the filter)', () => {
    const fav = profile('Aria', { is_favorite: 1 });
    const plainAria = profile('Aria Prime', { is_favorite: 0 });

    // Matches the search but is not a favourite → excluded by the filter.
    assert.equal(matchesCharacterFilters(plainAria, { search: 'aria', filter: FILTER_FAVORITES }), false);
    // Favourite but does not match the search → excluded by the search.
    assert.equal(matchesCharacterFilters(fav, { search: 'zzz', filter: FILTER_FAVORITES }), false);
    // Both satisfied.
    assert.equal(matchesCharacterFilters(fav, { search: 'ari', filter: FILTER_FAVORITES }), true);
});

test('matchesCharacterFilters tolerates a null profile and non-string fields', () => {
    assert.equal(matchesCharacterFilters(null), false);
    assert.equal(matchesCharacterFilters(undefined), false);
    const p = { id: 'x', name: null, description: undefined, is_favorite: 1 };
    assert.equal(matchesCharacterFilters(p, { search: 'a' }), false);
    assert.equal(matchesCharacterFilters(p, { search: '' }), true);
});

// ── filterCharacterProfiles ─────────────────────────────────────────────────

test('filterCharacterProfiles preserves list order and never mutates the input', () => {
    const list = [
        profile('Aria', { is_favorite: 1 }),
        profile('Bram'),
        profile('Cyd', { is_favorite: 1 }),
    ];
    const snapshot = JSON.parse(JSON.stringify(list));

    const favorites = filterCharacterProfiles(list, { filter: FILTER_FAVORITES });
    assert.deepEqual(favorites.map((p) => p.name), ['Aria', 'Cyd']);
    assert.notEqual(favorites, list, 'must return a new array');
    assert.deepEqual(list, snapshot, 'input must be untouched');
});

test('filterCharacterProfiles degrades to an empty array for non-array input', () => {
    assert.deepEqual(filterCharacterProfiles(null), []);
    assert.deepEqual(filterCharacterProfiles(undefined), []);
    assert.deepEqual(filterCharacterProfiles({}), []);
    assert.deepEqual(filterCharacterProfiles([]), []);
});

// ── countFavorites / resolveCharacterFilter ─────────────────────────────────

test('countFavorites counts the numeric wire value', () => {
    assert.equal(countFavorites([
        profile('Aria', { is_favorite: 1 }),
        profile('Bram', { is_favorite: 0 }),
        profile('Cyd', { is_favorite: 1 }),
    ]), 2);
    assert.equal(countFavorites([]), 0);
    assert.equal(countFavorites(null), 0);
});

test('a stale Favorites filter falls back to All instead of stranding the grid', () => {
    const noFavorites = [profile('Aria'), profile('Bram')];
    const withFavorites = [profile('Aria', { is_favorite: 1 })];

    // The user un-hearted the last favourite while the chip was active.
    assert.equal(resolveCharacterFilter(FILTER_FAVORITES, noFavorites), FILTER_ALL);
    assert.equal(resolveCharacterFilter(FILTER_FAVORITES, withFavorites), FILTER_FAVORITES);
    // An empty list can never honour the filter either.
    assert.equal(resolveCharacterFilter(FILTER_FAVORITES, []), FILTER_ALL);
});

test('resolveCharacterFilter passes non-favourite filters through untouched', () => {
    assert.equal(resolveCharacterFilter(FILTER_ALL, []), FILTER_ALL);
    assert.equal(resolveCharacterFilter(undefined, []), FILTER_ALL);
    assert.equal(resolveCharacterFilter(null, []), FILTER_ALL);
    assert.equal(resolveCharacterFilter('category-abc', []), 'category-abc');
});
