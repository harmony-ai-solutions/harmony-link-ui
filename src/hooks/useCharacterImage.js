import { useEffect, useState } from 'react';
import * as characterService from '../services/management/characterService.js';

/**
 * Load a character image as an object URL and keep its lifecycle tied to the
 * component (revoked on unmount / when the profile, image or variant changes).
 *
 * With `imageId` the exact image is loaded; without it the profile's primary
 * image is resolved first. `variant: null` requests the original bytes
 * (full-size lightbox / editor); the default `'thumb'` is the small 512px
 * preview used by avatars, cards and gallery tiles.
 *
 * @param {{ profileId?: string|null, imageId?: string|null,
 *   variant?: string|null }} [params]
 * @returns {string|null} object URL, or null while loading / when unavailable
 */
export default function useCharacterImage({ profileId, imageId = null, variant = 'thumb' } = {}) {
    const [src, setSrc] = useState(null);

    useEffect(() => {
        let active = true;
        let objectUrl = null;

        if (!profileId) {
            setSrc(null);
            return undefined;
        }

        setSrc(null);
        (async () => {
            try {
                objectUrl = imageId
                    ? await characterService.fetchCharacterImageObjectUrl(profileId, imageId, { variant })
                    : await characterService.fetchPrimaryCharacterImageObjectUrl(profileId, { variant });
            } catch {
                objectUrl = null;
            }
            if (!active) {
                // Stale response — release it instead of leaking.
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                return;
            }
            setSrc(objectUrl);
        })();

        return () => {
            active = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [profileId, imageId, variant]);

    return src;
}
