import useCharacterImage from '../../hooks/useCharacterImage.js';

/**
 * Render a character image through an object URL (contract 1.8.0: the image
 * list is metadata-only, so `<img>` cannot point at the API directly — auth
 * headers are required and are applied by the fetch).
 *
 * Pass `imageId` for one specific image, or omit it to render the profile's
 * primary image. `variant: null` loads the original bytes (full-size views);
 * the default `'thumb'` loads the small preview. While loading — and when no
 * image is servable — `fallback` is rendered (robot icon, silhouette, …).
 *
 * @param {Object} props
 * @param {string|null|undefined} props.profileId - character profile id
 * @param {string|null} [props.imageId] - specific image; default = primary
 * @param {string|null} [props.variant] - 'thumb' (default) or null (original)
 * @param {string} [props.alt]
 * @param {string} [props.className]
 * @param {import('react').ReactNode} [props.fallback]
 */
export default function CharacterImage({
    profileId,
    imageId = null,
    variant = 'thumb',
    alt = '',
    className,
    fallback = null,
    ...rest
}) {
    const src = useCharacterImage({ profileId, imageId, variant });
    if (!src) return fallback;
    return <img src={src} alt={alt} className={className} {...rest} />;
}
