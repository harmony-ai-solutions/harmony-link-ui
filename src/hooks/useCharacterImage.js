import { useEffect, useState } from 'react';
import * as characterService from '../services/management/characterService.js';
import {
    acquireCharacterImage,
    releaseCharacterImage,
    characterImageCacheKey,
} from '../services/chat/characterImageCache.js';

/**
 * Load a character image as a SHARED object URL (see `characterImageCache.js`).
 *
 * With `imageId` the exact image is loaded; without it the profile's primary
 * image is resolved first. `variant: null` requests the original bytes
 * (full-size lightbox / editor); the default `'thumb'` is the small 512px
 * preview used by avatars, cards and gallery tiles.
 *
 * ── OWNERSHIP ────────────────────────────────────────────────────────────
 *
 * The cache owns the URL: this hook acquires a holder on mount/key change and
 * releases it on cleanup, and NEVER revokes the URL itself. Several rows can
 * display the same blob at once (the inbox avatar and the detail header, say);
 * a component-local revoke would break the others, and a cache entry without
 * refcounting would leak. This also dedupes the fetches: N rows naming one
 * character cost one request, and concurrent mounts share the in-flight fetch.
 *
 * @param {{ profileId?: string|null, imageId?: string|null,
 *   variant?: string|null }} [params]
 * @returns {string|null} object URL, or null while loading / when unavailable
 */
export default function useCharacterImage({ profileId, imageId = null, variant = 'thumb' } = {}) {
    const [src, setSrc] = useState(null);
    const key = characterImageCacheKey({ profileId, imageId, variant });

    useEffect(() => {
        let active = true;

        if (!key) {
            setSrc(null);
            return undefined;
        }

        setSrc(null);
        acquireCharacterImage(key, () => (
            imageId
                ? characterService.fetchCharacterImageObjectUrl(profileId, imageId, { variant })
                : characterService.fetchPrimaryCharacterImageObjectUrl(profileId, { variant })
        )).then((objectUrl) => {
            // A stale response (key changed / unmounted) is dropped: its hold
            // was released by the cleanup below, so the cache already revoked
            // the URL if nobody else kept it.
            if (active) setSrc(objectUrl);
        });

        return () => {
            active = false;
            releaseCharacterImage(key);
        };
    }, [key, profileId, imageId, variant]);

    return src;
}
