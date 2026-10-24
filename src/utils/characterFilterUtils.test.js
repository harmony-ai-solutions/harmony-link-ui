import test from 'node:test';
import assert from 'node:assert/strict';
import {
    FILTER_ALL,
    FILTER_FAVORITES,
    CATEGORY_FILTER_PREFIX,
    isFavorite,
    isFavoriteProfile,
    categoryFilterId,
    categoryIdFromFilter,
    isCategoryFilter,
    buildCategoryMemberIndex,
    isProfileInCategory,
    matchesCharacterFilters,
    filterCharacterProfiles,
    countFavorites,
    countCategoryMembers,
    resolveCharacterFilter,
    shouldShowCategoryChip,
    moveListItem,
} from './characterFilterUtils.js';

/** Build a category row shaped like the engine's GET /character-categories. */
const category = (id, profileIds = [], extra = {}) => ({
    id,
    name: `Category ${id}`,
    sort_order: 0,
    member_count: profileIds.length,
    profile_ids: profileIds,
    ...extra,
});

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
    // Not a `category:` filter id, so it is honoured verbatim.
    assert.equal(resolveCharacterFilter('category-abc', []), 'category-abc');
});

// ── Category filter ids ─────────────────────────────────────────────────────
// A category filter is `category:<id>`, never the bare id: the prefix keeps a
// category from ever colliding with the two reserved ids.

test('categoryFilterId prefixes the id and refuses to build a filter without one', () => {
    assert.equal(categoryFilterId('cat-1'), `${CATEGORY_FILTER_PREFIX}cat-1`);
    assert.equal(categoryFilterId(''), FILTER_ALL);
    assert.equal(categoryFilterId(null), FILTER_ALL);
    assert.equal(categoryFilterId(undefined), FILTER_ALL);
    assert.equal(categoryFilterId(42), FILTER_ALL);
});

test('categoryIdFromFilter round-trips and rejects reserved/other filters', () => {
    assert.equal(categoryIdFromFilter(categoryFilterId('cat-1')), 'cat-1');
    assert.equal(categoryIdFromFilter(FILTER_ALL), null);
    assert.equal(categoryIdFromFilter(FILTER_FAVORITES), null);
    // `category-abc` (hyphen, no colon) was a filter in an older test — it must
    // NOT be read as a category id, or a rename of the prefix would silently
    // start filtering by a nonsense id.
    assert.equal(categoryIdFromFilter('category-abc'), null);
    // A bare prefix with no id is not a usable filter.
    assert.equal(categoryIdFromFilter(CATEGORY_FILTER_PREFIX), null);
    assert.equal(categoryIdFromFilter(undefined), null);
    assert.equal(categoryIdFromFilter(null), null);
});

test('isCategoryFilter distinguishes category filters from All/Favorites', () => {
    assert.equal(isCategoryFilter(categoryFilterId('cat-1')), true);
    assert.equal(isCategoryFilter(FILTER_ALL), false);
    assert.equal(isCategoryFilter(FILTER_FAVORITES), false);
    assert.equal(isCategoryFilter(undefined), false);
});

// ── buildCategoryMemberIndex / isProfileInCategory ──────────────────────────

test('buildCategoryMemberIndex maps each category to its member set', () => {
    const index = buildCategoryMemberIndex([
        category('heroes', ['p-aria', 'p-bram']),
        category('villains', ['p-cyd']),
        category('empty', []),
    ]);
    assert.deepEqual([...index.heroes], ['p-aria', 'p-bram']);
    assert.deepEqual([...index.villains], ['p-cyd']);
    assert.equal(index.empty.size, 0);
});

test('buildCategoryMemberIndex tolerates garbage rows and non-array input', () => {
    assert.deepEqual(buildCategoryMemberIndex(null), {});
    assert.deepEqual(buildCategoryMemberIndex(undefined), {});
    assert.deepEqual(buildCategoryMemberIndex({}), {});

    const index = buildCategoryMemberIndex([
        null,
        {},
        { id: '' , profile_ids: ['x'] },
        { id: 'ok', profile_ids: null },
        { id: 'ok2', profile_ids: ['', null, 42, 'p-real'] },
    ]);
    assert.equal(Object.keys(index).length, 2, 'only rows with a usable id are indexed');
    assert.equal(index.ok.size, 0, 'a null profile_ids must not throw');
    assert.deepEqual([...index.ok2], ['p-real'], 'only non-empty strings survive');
});

test('isProfileInCategory answers membership without a quota of scanning', () => {
    const index = buildCategoryMemberIndex([category('heroes', ['p-aria'])]);
    assert.equal(isProfileInCategory('p-aria', 'heroes', index), true);
    assert.equal(isProfileInCategory('p-bram', 'heroes', index), false);
    assert.equal(isProfileInCategory('p-aria', 'villains', index), false);
    assert.equal(isProfileInCategory('', 'heroes', index), false);
    assert.equal(isProfileInCategory('p-aria', '', index), false);
    assert.equal(isProfileInCategory('p-aria', 'heroes', null), false);
});

// ── Category filtering ─────────────────────────────────────────────────────

test('the category filter admits only its members', () => {
    const heroes = [profile('Aria'), profile('Bram'), profile('Cyd')];
    const index = buildCategoryMemberIndex([category('heroes', ['id-Aria', 'id-Cyd'])]);

    const filtered = filterCharacterProfiles(heroes, {
        filter: categoryFilterId('heroes'),
        categoryIndex: index,
    });
    assert.deepEqual(filtered.map((p) => p.name), ['Aria', 'Cyd']);
});

test('an unknown category filter matches NOTHING rather than everything', () => {
    // This is the failure mode that matters: a deleted category still selected
    // in a stale UI state must read as empty, never as "show all characters".
    const list = [profile('Aria')];
    assert.deepEqual(
        filterCharacterProfiles(list, { filter: categoryFilterId('deleted-cat') }),
        []
    );
    assert.deepEqual(
        filterCharacterProfiles(list, {
            filter: categoryFilterId('deleted-cat'),
            categoryIndex: buildCategoryMemberIndex([]),
        }),
        []
    );
});

test('a category with no members filters down to an empty grid', () => {
    const list = [profile('Aria')];
    const index = buildCategoryMemberIndex([category('fresh', [])]);
    assert.deepEqual(
        filterCharacterProfiles(list, { filter: categoryFilterId('fresh'), categoryIndex: index }),
        []
    );
});

test('search composes WITH the category filter (search runs within the filter)', () => {
    const list = [profile('Aria'), profile('Aria Prime'), profile('Bram')];
    const index = buildCategoryMemberIndex([category('heroes', ['id-Aria', 'id-Bram'])]);

    // Bram is in the category but does not match the search.
    assert.deepEqual(
        filterCharacterProfiles(list, {
            search: 'aria',
            filter: categoryFilterId('heroes'),
            categoryIndex: index,
        }).map((p) => p.name),
        ['Aria']
    );
    // Aria Prime matches the search but is not in the category.
    assert.deepEqual(
        filterCharacterProfiles(list, {
            search: 'prime',
            filter: categoryFilterId('heroes'),
            categoryIndex: index,
        }),
        []
    );
    // Both satisfied.
    assert.deepEqual(
        filterCharacterProfiles(list, {
            search: 'bram',
            filter: categoryFilterId('heroes'),
            categoryIndex: index,
        }).map((p) => p.name),
        ['Bram']
    );
});

test('the category filter preserves list order and does not mutate the input', () => {
    const list = [profile('Cyd'), profile('Aria'), profile('Bram')];
    const snapshot = JSON.parse(JSON.stringify(list));
    const index = buildCategoryMemberIndex([
        category('heroes', ['id-Cyd', 'id-Aria', 'id-Bram']),
    ]);
    const filtered = filterCharacterProfiles(list, {
        filter: categoryFilterId('heroes'),
        categoryIndex: index,
    });
    assert.deepEqual(filtered.map((p) => p.name), ['Cyd', 'Aria', 'Bram']);
    assert.notEqual(filtered, list);
    assert.deepEqual(list, snapshot);
});

// ── countCategoryMembers ───────────────────────────────────────────────────

test('countCategoryMembers counts against the VISIBLE list, not the engine count', () => {
    const visible = [profile('Aria'), profile('Bram')];
    // The category holds three profiles engine-side; one is persona-owned and
    // therefore absent from the visible grid.
    const index = buildCategoryMemberIndex([
        category('heroes', ['id-Aria', 'id-Bram', 'id-persona-owned']),
    ]);
    assert.equal(countCategoryMembers(visible, 'heroes', index), 2);
    assert.equal(countCategoryMembers(visible, 'unknown', index), 0);
    assert.equal(countCategoryMembers(null, 'heroes', index), 0);
    assert.equal(countCategoryMembers(visible, '', index), 0);
});

// ── resolveCharacterFilter with categories ─────────────────────────────────

test('a stale category filter falls back to All when the category is gone', () => {
    const list = [profile('Aria')];
    const filter = categoryFilterId('deleted-cat');
    assert.equal(
        resolveCharacterFilter(filter, list, { categoryIds: new Set(['still-here']) }),
        FILTER_ALL
    );
});

test('a live category filter is honoured even when it has no members', () => {
    const list = [profile('Aria')];
    const filter = categoryFilterId('fresh');
    assert.equal(
        resolveCharacterFilter(filter, list, { categoryIds: new Set(['fresh']) }),
        filter
    );
});

test('without a categoryIds set the filter cannot be proven stale, so it survives', () => {
    const filter = categoryFilterId('whatever');
    assert.equal(resolveCharacterFilter(filter, []), filter);
});

test('a stale Favorites filter still wins over the category logic', () => {
    const filter = categoryFilterId('heroes');
    // Sanity: the favourites branch is not applied to category filters.
    assert.equal(
        resolveCharacterFilter(filter, [], { categoryIds: new Set(['heroes']) }),
        filter
    );
    // And a favourites request with no favourites still collapses to All even
    // when a categoryIds set is supplied.
    assert.equal(resolveCharacterFilter(FILTER_FAVORITES, [], { categoryIds: new Set() }), FILTER_ALL);
});

// ── shouldShowCategoryChip ─────────────────────────────────────────────────

test('an empty category chip hides unless it is the active one', () => {
    assert.equal(shouldShowCategoryChip({ id: 'empty', count: 0 }, FILTER_ALL), false);
    assert.equal(shouldShowCategoryChip({ id: 'empty', count: 0 }, categoryFilterId('empty')), true,
        'yanking the active chip away mid-interaction is worse than an empty grid');
    assert.equal(shouldShowCategoryChip({ id: 'full', count: 3 }, FILTER_ALL), true);
});

test('shouldShowCategoryChip rejects a chip without an id', () => {
    assert.equal(shouldShowCategoryChip(null, FILTER_ALL), false);
    assert.equal(shouldShowCategoryChip({ count: 2 }, FILTER_ALL), false);
    assert.equal(shouldShowCategoryChip({ id: '', count: 2 }, FILTER_ALL), false);
});

// ── moveListItem (drag reorder) ────────────────────────────────────────────

test('moveListItem moves an item down and up, returning a new array', () => {
    const list = ['a', 'b', 'c'];
    assert.deepEqual(moveListItem(list, 0, 2), ['b', 'c', 'a']);
    assert.deepEqual(moveListItem(list, 2, 0), ['c', 'a', 'b']);
    assert.deepEqual(moveListItem(list, 1, 1), ['a', 'b', 'c']);
    assert.deepEqual(list, ['a', 'b', 'c'], 'the input must not be mutated');
});

test('moveListItem ignores out-of-range indexes instead of corrupting the order', () => {
    const list = ['a', 'b'];
    assert.equal(moveListItem(list, -1, 0), list);
    assert.equal(moveListItem(list, 0, 5), list);
    assert.equal(moveListItem(list, 7, 0), list);
    assert.equal(moveListItem(list, 0.5, 1), list, 'non-integer indexes are rejected');
    assert.deepEqual(moveListItem(null, 0, 1), []);
});
