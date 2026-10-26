/**
 * Reference-counted object URLs for message media (Task 04-4 step 5).
 *
 * ── WHY A REGISTRY AND NOT JUST `revokeObjectURL` IN A CLEANUP ──────────────
 *
 * The obvious fix for "revoke every object URL on unmount" is a cleanup effect
 * that revokes whatever the component fetched. That fix is actively WRONG on
 * this screen, for two reasons:
 *
 * 1. **The same blob is fetched by more than one mount path.** The image
 *    thumbnail fetches a URL and hands it to the lightbox; the lightbox renders
 *    that URL while the thumbnail is still mounted behind it. Revoking on the
 *    thumbnail's unmount (or on the lightbox's) kills an image the other one is
 *    still painting — a broken image, not a leak.
 * 2. **The render window UNMOUNTS bubbles constantly.** `ChatDetailView` keeps
 *    at most `TIMELINE_RENDER_LIMIT` bubbles mounted, so scrolling a long
 *    thread mounts and unmounts rows continuously. A revoke-on-unmount without
 *    a cache would re-download every image/voice note on every scroll-back;
 *    a revoke-on-unmount WITH a naively shared cache would revoke a URL another
 *    live row still needs.
 *
 * So the registry is keyed by `<kind>:<messageId>` and counts holders. Fetch
 * once, `retain` on every mount that displays it, `release` on unmount, and the
 * URL is revoked exactly when the last holder lets go. That is what makes
 * "no memory growth after scrolling a long thread" true in both directions:
 * nothing accumulates, and nothing is re-fetched on scroll-back.
 *
 * The audio player holds a reference for as long as a URL is loaded in the
 * single shared `HTMLAudioElement`, so a bubble unmounting mid-playback does not
 * revoke the source out from under it.
 *
 * ── TESTABILITY ─────────────────────────────────────────────────────────────
 *
 * Every browser surface (`URL.createObjectURL`, `URL.revokeObjectURL`) is
 * injectable, and there is a `resetObjectUrls()` for tests. The module is not
 * a singleton of React state — it is plain module state, because the shared
 * audio element is one per app, not one per mount.
 */

/** kind → { messageId → { url, refs, promise } } */
const entries = new Map();

let urlApi = null;

/** Resolve the browser URL API, or `null` when there is none (node/tests). */
function getUrlApi() {
    if (urlApi) return urlApi;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
    urlApi = URL;
    return urlApi;
}

/**
 * Override the URL API (tests) — pass `null` to go back to the real one.
 * @param {{createObjectURL: Function, revokeObjectURL: Function}|null} api
 */
export function setObjectUrlApi(api) {
    urlApi = api;
}

function bucket(kind) {
    let map = entries.get(kind);
    if (!map) {
        map = new Map();
        entries.set(kind, map);
    }
    return map;
}

/**
 * Obtain a URL for a message's blob, fetching at most once per live holder set.
 *
 * Concurrent callers share ONE fetch: the in-flight promise is stored, so two
 * bubbles rendering the same message in the same tick cannot download it twice
 * (and cannot create two object URLs for one blob, only one of which would ever
 * be revoked).
 *
 * @param {string} kind - `'audio'` | `'image'`
 * @param {string} messageId
 * @param {() => Promise<string|null>} fetchUrl - performs the request
 * @returns {Promise<string|null>}
 */
export function acquireObjectUrl(kind, messageId, fetchUrl) {
    if (!messageId) return Promise.resolve(null);
    const map = bucket(kind);

    const existing = map.get(messageId);
    if (existing) {
        if (existing.url) {
            existing.refs += 1;
            return Promise.resolve(existing.url);
        }
        // A fetch for this blob is already in flight — join it rather than
        // starting a second one.
        if (existing.promise) {
            existing.refs += 1;
            return existing.promise;
        }
    }

    const entry = { url: null, refs: 1, promise: null };
    map.set(messageId, entry);

    const resolver = getUrlApi();
    if (!resolver) return Promise.resolve(null);

    entry.promise = (async () => {
        let url = null;
        try {
            url = await fetchUrl();
        } catch {
            url = null;
        }
        entry.promise = null;
        if (!url) {
            // Nothing to revoke and nothing to cache — and the entry MUST go,
            // not just be emptied. A leftover `{url: null, promise: null}`
            // makes the next `acquireObjectUrl` take the "already cached" branch
            // and resolve to null forever, so a retry after a transient 500
            // could never re-fetch. (A test caught this; the entry is now
            // removed unconditionally, whether or not a holder is still there —
            // a holder that stays gets a null and shows its own failure state.)
            map.delete(messageId);
            return null;
        }
        // Every holder released while the request was in flight: revoke now
        // instead of caching a URL nobody owns.
        if (entry.refs <= 0) {
            try {
                resolver.revokeObjectURL(url);
            } catch {
                /* ignore */
            }
            map.delete(messageId);
            return null;
        }
        entry.url = url;
        return url;
    })();

    return entry.promise;
}

/**
 * Drop one holder. The URL is revoked when the count reaches zero.
 *
 * @param {string} kind
 * @param {string} messageId
 * @returns {boolean} true when a URL was actually revoked
 */
export function releaseObjectUrl(kind, messageId) {
    const map = entries.get(kind);
    if (!map || !messageId) return false;
    const entry = map.get(messageId);
    if (!entry) return false;

    entry.refs -= 1;
    if (entry.refs > 0) return false;

    // refs <= 0: no live holder. A still-pending fetch is left to settle (its
    // own tail revokes and deletes); a settled one is revoked here.
    if (entry.url) {
        const resolver = getUrlApi();
        if (resolver) {
            try {
                resolver.revokeObjectURL(entry.url);
            } catch {
                /* the URL was already revoked — not an error worth surfacing */
            }
        }
        map.delete(messageId);
        return true;
    }
    if (!entry.promise) map.delete(messageId);
    return false;
}

/**
 * Add a holder to a URL that was already acquired — used when a second
 * component starts displaying a URL obtained via {@link acquireObjectUrl}.
 *
 * @param {string} kind
 * @param {string} messageId
 * @returns {string|null} the cached URL, if any
 */
export function retainObjectUrl(kind, messageId) {
    const map = entries.get(kind);
    const entry = map?.get(messageId);
    if (!entry) return null;
    entry.refs += 1;
    return entry.url;
}

/** Current holder count for a message's URL (diagnostics and tests). */
export function objectUrlRefCount(kind, messageId) {
    return entries.get(kind)?.get(messageId)?.refs ?? 0;
}

/** Whether a live URL is currently cached. */
export function hasObjectUrl(kind, messageId) {
    return !!entries.get(kind)?.get(messageId)?.url;
}

/**
 * Revoke everything. Called on teardown paths (closing a conversation, tests);
 * never from a single bubble's cleanup, which only releases its own hold.
 *
 * @returns {number} how many URLs were revoked
 */
export function revokeAllObjectUrls() {
    const resolver = getUrlApi();
    let revoked = 0;
    for (const map of entries.values()) {
        for (const entry of map.values()) {
            if (entry.url && resolver) {
                try {
                    resolver.revokeObjectURL(entry.url);
                } catch {
                    /* ignore */
                }
                revoked += 1;
            }
            entry.url = null;
            entry.refs = 0;
        }
        map.clear();
    }
    entries.clear();
    return revoked;
}

/** Test helper: forget all bookkeeping without touching the browser. */
export function resetObjectUrls() {
    entries.clear();
}

/** Total live entries across kinds (a leak counter for the acceptance test). */
export function objectUrlEntryCount() {
    let total = 0;
    for (const map of entries.values()) total += map.size;
    return total;
}

export default {
    acquireObjectUrl,
    releaseObjectUrl,
    retainObjectUrl,
    objectUrlRefCount,
    hasObjectUrl,
    revokeAllObjectUrls,
    resetObjectUrls,
    objectUrlEntryCount,
    setObjectUrlApi,
};
