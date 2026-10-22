/**
 * Pure character-image helpers (contract 1.8.0).
 *
 * `GET /character-profiles/:id/images` is METADATA-ONLY: items carry `id`,
 * `is_primary` and the `thumbnail_state` tri-state (`ready` | `pending` |
 * `unavailable`) but no `data_url`. The UI loads bytes separately through an
 * object URL (`characterService.fetchCharacterImageObjectUrl`). These helpers
 * stay import-free so they can be unit-tested with `node --test`.
 */

/**
 * Pick the image that backs a character's avatar: the primary image, else the
 * first image, else null.
 *
 * @param {Array<object>|null|undefined} images
 * @returns {object|null}
 */
export function selectPrimaryImage(images) {
    if (!Array.isArray(images) || images.length === 0) return null;
    return images.find((image) => image?.is_primary) || images[0] || null;
}

/**
 * Resolve the variant to request for one image.
 *
 * - `ready` / `pending` → the requested preview variant (`pending` is generated
 *   and persisted lazily by the engine's `?variant=thumb` route);
 * - `unavailable` → `null` (no preview exists; fetch the original instead);
 * - no requested variant → `null` (original).
 *
 * @param {object|null|undefined} image
 * @param {string|null} [desiredVariant]
 * @returns {string|null}
 */
export function resolveImageVariant(image, desiredVariant = 'thumb') {
    if (!desiredVariant) return null;
    if (image?.thumbnail_state === 'unavailable') return null;
    return desiredVariant;
}
