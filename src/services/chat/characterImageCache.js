/**
 * Shared object-URL cache for CHARACTER IMAGES (avatars, cards, gallery).
 *
 * ── WHY IT EXISTS ────────────────────────────────────────────────────────
 *
 * An avatar used to fetch its bytes on every mount: a 40-row inbox issued 40
 * requests (one per row, even when several rows name the same character), and
 * every remount fetched again because no URL outlived its component. Swapping
 * chat lists therefore re-downloaded the whole gallery.
 *
 * This module reuses the reference-counted registry in `objectUrlCache.js`
 * (one entry per key, in-flight promise dedupe, revoke when the last holder
 * lets go) under a dedicated `character` kind, keyed by
 * `profileId : imageId : variant`.
 *
 * ── URL OWNERSHIP RULE ───────────────────────────────────────────────────
 *
 * The CACHE owns every URL it hands out. A component/hook must call
 * {@link releaseCharacterImage} when it stops displaying the image (unmount or
 * key change) and must NEVER call `URL.revokeObjectURL` on it: the same blob is
 * frequently displayed by several rows at once, so a per-component revoke
 * breaks the others. When the last holder releases, the cache revokes.
 *
 * That also makes a remount cheap while another holder is alive (shared list +
 * detail avatar), while a fully unmounted image is not retained forever.
 */

import {
    acquireObjectUrl,
    releaseObjectUrl,
    hasObjectUrl,
    objectUrlRefCount,
    resetObjectUrls,
    setObjectUrlApi,
} from './objectUrlCache.js';

/** Registry kind — its own bucket, so chat media teardown cannot touch it. */
const KIND = 'character';

/**
 * Stable cache key: profile + concrete image + variant.
 *
 * `imageId: null` means "the profile's primary image"; the fetch decides which
 * image that is, but the key must not change between mounts (the resolved id
 * would be a second, unstable name for the same avatar).
 *
 * @param {{ profileId?: string|null, imageId?: string|null,
 *   variant?: string|null }} [params]
 * @returns {string} empty when there is nothing to fetch
 */
export function characterImageCacheKey({ profileId, imageId = null, variant = 'thumb' } = {}) {
    if (!profileId) return '';
    return `${profileId}:${imageId || 'primary'}:${variant || 'original'}`;
}

/**
 * Acquire a shared URL for a character image, fetching at most once per key.
 *
 * @param {string} key - from {@link characterImageCacheKey}
 * @param {() => Promise<string|null>} fetchUrl - performs the request
 * @returns {Promise<string|null>}
 */
export function acquireCharacterImage(key, fetchUrl) {
    if (!key) return Promise.resolve(null);
    return acquireObjectUrl(KIND, key, fetchUrl);
}

/**
 * Drop one holder; the cache revokes the URL when the last one lets go.
 *
 * @param {string} key
 * @returns {boolean} true when a URL was revoked
 */
export function releaseCharacterImage(key) {
    return releaseObjectUrl(KIND, key);
}

/** Whether a live URL is cached for `key` (diagnostics/tests). */
export function hasCharacterImage(key) {
    return hasObjectUrl(KIND, key);
}

/** Current holder count for `key` (diagnostics/tests). */
export function characterImageRefCount(key) {
    return objectUrlRefCount(KIND, key);
}

/** Test helper: forget all bookkeeping without touching the browser. */
export function resetCharacterImageCache() {
    resetObjectUrls();
}

export { setObjectUrlApi };

export default {
    characterImageCacheKey,
    acquireCharacterImage,
    releaseCharacterImage,
    hasCharacterImage,
    characterImageRefCount,
    resetCharacterImageCache,
    setObjectUrlApi,
};
