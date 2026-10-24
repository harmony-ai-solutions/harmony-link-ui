/**
 * Pure helpers behind the Characters toolbar (plan 03-1 "Favourites").
 *
 * Kept framework-free and side-effect free so `node --test` can cover the
 * rules that are easy to get subtly wrong, and so 03-2 (categories) can extend
 * the filter object without touching any component.
 */

/** Filter chip id for "no filter". */
export const FILTER_ALL = 'all';

/** Filter chip id for the favourites-only chip. */
export const FILTER_FAVORITES = 'favorites';

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

/**
 * Does a profile satisfy the active search + filter combination?
 *
 * Search matches name OR description, case-insensitively, on trimmed input —
 * the same contract the pre-existing Characters search had, now composed WITH
 * the favourite filter rather than replacing it (03-2 step 5: "keep search
 * working within the active filter").
 *
 * @param {Object} profile
 * @param {{ search?: string, filter?: string }} [options]
 * @returns {boolean}
 */
export function matchesCharacterFilters(profile, { search = '', filter = FILTER_ALL } = {}) {
    if (!profile) return false;

    if (filter === FILTER_FAVORITES && !isFavoriteProfile(profile)) return false;

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
 * @param {{ search?: string, filter?: string }} [options]
 * @returns {Object[]}
 */
export function filterCharacterProfiles(profiles, options = {}) {
    if (!Array.isArray(profiles)) return [];
    return profiles.filter((profile) => matchesCharacterFilters(profile, options));
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
 * Is the requested filter still meaningful for this list? A stale filter (e.g.
 * the last favourite was just un-hearted while the Favourites chip is active)
 * falls back to All instead of stranding the user on a permanent empty grid.
 *
 * @param {string} filter
 * @param {Object[]} profiles
 * @returns {string} the filter to actually use
 */
export function resolveCharacterFilter(filter, profiles) {
    if (filter === FILTER_FAVORITES && countFavorites(profiles) === 0) return FILTER_ALL;
    return filter || FILTER_ALL;
}
