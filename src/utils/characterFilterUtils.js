/**
 * Pure helpers behind the Characters toolbar (plan 03-1 "Favourites" and
 * plan 03-2 "Categories").
 *
 * Kept framework-free and side-effect free so `node --test` can cover the
 * rules that are easy to get subtly wrong.
 *
 * The filter model is a single `filter` id that is ONE of:
 *   - `FILTER_ALL` ('all')
 *   - `FILTER_FAVORITES` ('favorites')
 *   - `categoryFilterId(<uuid>)` ('category:<uuid>')
 *
 * Search composes WITH the filter rather than replacing it, so typing in the
 * search box always narrows the active chip instead of resetting it.
 */

/** Filter chip id for "no filter". */
export const FILTER_ALL = 'all';

/** Filter chip id for the favourites-only chip. */
export const FILTER_FAVORITES = 'favorites';

/**
 * Prefix that turns a category id into a filter id.
 *
 * A prefix (rather than the bare id) means a category can never be mistaken for
 * the two reserved ids no matter what the user names it, and it makes the
 * filter value self-describing in logs and tests.
 */
export const CATEGORY_FILTER_PREFIX = 'category:';

/**
 * Normalize the engine's `is_favorite` wire value to a boolean.
 *
 * The engine stores this as a SQLite `0/1` INTEGER and `config.CharacterProfileConfig`
 * declares it `int64`, so JSON delivers a NUMBER — never `true`. A plain
 * `profile.is_favorite === true` test therefore reports "not favourite" for every
 * favourite character. Booleans and numeric strings are accepted too, because
 * sync-applied rows, optimistic store patches and tests all flow through here.
 *
 * @param {*} value - raw `is_favorite` from the API, the store, or a test
 * @returns {boolean}
 */
export function isFavorite(value) {
    if (value === true) return true;
    if (value === false || value === null || value === undefined) return false;
    // NaN is the one number that must NOT read as a favourite: `NaN !== 0` is
    // true, so a missing/garbage numeric field would otherwise light the heart up.
    if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
    if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        if (trimmed === '') return false;
        if (trimmed === 'true') return true;
        if (trimmed === 'false') return false;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n !== 0 : false;
    }
    return false;
}

/**
 * Convenience wrapper: is this profile (an object, not a raw value) a favourite?
 * @param {Object|null|undefined} profile
 * @returns {boolean}
 */
export function isFavoriteProfile(profile) {
    return isFavorite(profile?.is_favorite);
}

// ── Category filter ids ─────────────────────────────────────────────────────

/**
 * Build the filter id for a category chip.
 * @param {string} categoryId
 * @returns {string} `category:<id>`, or FILTER_ALL when the id is missing
 */
export function categoryFilterId(categoryId) {
    if (!categoryId || typeof categoryId !== 'string') return FILTER_ALL;
    return `${CATEGORY_FILTER_PREFIX}${categoryId}`;
}

/**
 * Extract the category id from a filter id.
 * @param {string} filter
 * @returns {string|null} the category id, or null when this is not a category filter
 */
export function categoryIdFromFilter(filter) {
    if (typeof filter !== 'string') return null;
    if (!filter.startsWith(CATEGORY_FILTER_PREFIX)) return null;
    const id = filter.slice(CATEGORY_FILTER_PREFIX.length);
    return id === '' ? null : id;
}

/**
 * Is this filter id a category filter?
 * @param {string} filter
 * @returns {boolean}
 */
export function isCategoryFilter(filter) {
    return categoryIdFromFilter(filter) !== null;
}

// ── Category membership ────────────────────────────────────────────────────

/**
 * Index a category list into `{ [categoryId]: Set<profileId> }`.
 *
 * Built ONCE per render so filtering is O(profiles) instead of scanning every
 * category's `profile_ids` array per profile. Tolerates missing/garbage input:
 * the engine always sends `profile_ids`, but an optimistic or partial row may
 * not while a request is in flight.
 *
 * @param {Object[]} categories - engine categories (each with `id`, `profile_ids`)
 * @returns {Object<string, Set<string>>}
 */
export function buildCategoryMemberIndex(categories) {
    const index = {};
    if (!Array.isArray(categories)) return index;
    categories.forEach((category) => {
        if (!category || typeof category.id !== 'string' || category.id === '') return;
        const ids = Array.isArray(category.profile_ids) ? category.profile_ids : [];
        index[category.id] = new Set(ids.filter((id) => typeof id === 'string' && id !== ''));
    });
    return index;
}

/**
 * Is a profile a member of a category (per a prebuilt index)?
 * @param {string} profileId
 * @param {string} categoryId
 * @param {Object<string, Set<string>>} index - from buildCategoryMemberIndex
 * @returns {boolean}
 */
export function isProfileInCategory(profileId, categoryId, index) {
    if (!profileId || !categoryId) return false;
    const members = index?.[categoryId];
    if (!members || typeof members.has !== 'function') return false;
    return members.has(profileId);
}

/**
 * Does a profile satisfy the active search + filter combination?
 *
 * Search matches name OR description, case-insensitively, on trimmed input —
 * the same contract the pre-existing Characters search had, now composed WITH
 * the active chip rather than replacing it (03-2 step 5: "keep search working
 * within the active filter").
 *
 * @param {Object} profile
 * @param {{ search?: string, filter?: string, memberIds?: Set<string>|null }} [options]
 *   `memberIds` is the member set for the ACTIVE category filter, prebuilt by
 *   the caller. It is ignored for All / Favorites.
 * @returns {boolean}
 */
export function matchesCharacterFilters(profile, { search = '', filter = FILTER_ALL, memberIds = null } = {}) {
    if (!profile) return false;

    if (filter === FILTER_FAVORITES && !isFavoriteProfile(profile)) return false;

    if (isCategoryFilter(filter)) {
        // A category filter with no membership set must match NOTHING, not
        // everything: an unknown/deleted category selected in a stale UI state
        // has to read as empty, never as "all characters".
        if (!memberIds || typeof memberIds.has !== 'function') return false;
        if (!memberIds.has(profile.id)) return false;
    }

    const query = typeof search === 'string' ? search.trim().toLowerCase() : '';
    if (!query) return true;

    const name = typeof profile.name === 'string' ? profile.name.toLowerCase() : '';
    const description = typeof profile.description === 'string' ? profile.description.toLowerCase() : '';
    return name.includes(query) || description.includes(query);
}

/**
 * Apply the toolbar state to a profile list.
 *
 * Order is preserved (the engine's list order is meaningful to the user), and a
 * new array is always returned so callers can hand it straight to React without
 * mutating store state.
 *
 * @param {Object[]} profiles
 * @param {{ search?: string, filter?: string, categoryIndex?: Object }} [options]
 *   `categoryIndex` is built once by the view via {@link buildCategoryMemberIndex}.
 * @returns {Object[]}
 */
export function filterCharacterProfiles(profiles, options = {}) {
    if (!Array.isArray(profiles)) return [];
    const { categoryIndex } = options;
    const activeCategoryId = categoryIdFromFilter(options.filter);
    const memberIds = activeCategoryId && categoryIndex ? categoryIndex[activeCategoryId] : null;
    return profiles.filter((profile) => matchesCharacterFilters(profile, {
        search: options.search,
        filter: options.filter,
        memberIds,
    }));
}

/**
 * How many profiles are favourites — drives the chip's count badge and lets the
 * toolbar hide the chip entirely when nothing is favourited (a chip that can
 * only ever produce an empty grid is noise).
 *
 * @param {Object[]} profiles
 * @returns {number}
 */
export function countFavorites(profiles) {
    if (!Array.isArray(profiles)) return 0;
    return profiles.reduce((total, profile) => (isFavoriteProfile(profile) ? total + 1 : total), 0);
}

/**
 * How many of the given profiles belong to a category.
 *
 * Counted against the VISIBLE profile list rather than trusted from the
 * engine's `member_count`, for two reasons: the grid excludes persona-owned
 * profiles, so the engine count would overstate what the chip can show; and a
 * chip whose count disagrees with the grid it produces is a bug report waiting
 * to happen.
 *
 * @param {Object[]} profiles
 * @param {string} categoryId
 * @param {Object<string, Set<string>>} index - from buildCategoryMemberIndex
 * @returns {number}
 */
export function countCategoryMembers(profiles, categoryId, index) {
    if (!Array.isArray(profiles) || !categoryId) return 0;
    const members = index?.[categoryId];
    if (!members || typeof members.has !== 'function') return 0;
    return profiles.reduce((total, profile) => (profile?.id && members.has(profile.id) ? total + 1 : total), 0);
}

/**
 * Is the requested filter still meaningful for this list? A stale filter falls
 * back to All instead of stranding the user on a permanent empty grid.
 *
 * Two stale cases are handled:
 *   - Favourites active, but nothing is favourited any more (the last heart was
 *     un-clicked, or a profile was deleted).
 *   - A category filter active, but the category no longer exists (deleted in
 *     the Manage modal, or in another window).
 *
 * A category chip that simply has ZERO members is deliberately NOT treated as
 * stale: the user may be looking at it on purpose (they just created it), so the
 * chip hides itself instead (see the chip row) and the grid shows a clear
 * empty state.
 *
 * @param {string} filter
 * @param {Object[]} profiles
 * @param {{ categoryIds?: Set<string> }} [options] - live category ids
 * @returns {string} the filter to actually use
 */
export function resolveCharacterFilter(filter, profiles, { categoryIds = null } = {}) {
    if (filter === FILTER_FAVORITES && countFavorites(profiles) === 0) return FILTER_ALL;

    const activeCategoryId = categoryIdFromFilter(filter);
    if (activeCategoryId) {
        const known = categoryIds && typeof categoryIds.has === 'function'
            ? categoryIds.has(activeCategoryId)
            : true; // no set supplied → cannot prove it is stale, so honour it
        if (!known) return FILTER_ALL;
    }

    return filter || FILTER_ALL;
}

/**
 * Should a category chip be rendered at all?
 *
 * Mirrors the favourites-chip rule: a chip that can only ever produce an empty
 * grid is noise, EXCEPT for the chip that is currently active — yanking the
 * active chip out from under the user mid-interaction is worse than showing an
 * empty grid with a clear message.
 *
 * @param {{ count: number, id: string }} chip
 * @param {string} activeFilter
 * @returns {boolean}
 */
export function shouldShowCategoryChip(chip, activeFilter) {
    if (!chip || !chip.id) return false;
    if (chip.count > 0) return true;
    return activeFilter === categoryFilterId(chip.id);
}

/**
 * Move an item within a list (drag reorder), returning a NEW array.
 *
 * Rejects out-of-range indexes by returning the input list unchanged, so a
 * stray drag event can never corrupt the order. Kept here (not in the modal) so
 * the reorder rule is unit-tested.
 *
 * @param {Array} list
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {Array}
 */
export function moveListItem(list, fromIndex, toIndex) {
    if (!Array.isArray(list)) return [];
    const lastIndex = list.length - 1;
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex)) return list;
    if (fromIndex < 0 || fromIndex > lastIndex) return list;
    if (toIndex < 0 || toIndex > lastIndex) return list;
    if (fromIndex === toIndex) return list;
    const next = list.slice();
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
}
