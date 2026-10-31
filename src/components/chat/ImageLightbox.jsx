import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from '../../constants/icons.jsx';
import { releaseObjectUrl, retainObjectUrl } from '../../services/chat/objectUrlCache.js';

/**
 * Zoomable image lightbox (F15). Shows a message's image full-screen on a
 * dimmed backdrop; click the backdrop or press Escape to close.
 *
 * ── WHY IT TAKES ITS OWN REFERENCE (Task 04-4 step 5) ──────────────────────
 *
 * The URL it renders is the thumbnail's object URL — the bytes are already
 * downloaded and the thumbnail is still mounted behind the overlay. Two things
 * can happen while the lightbox is open:
 *
 * 1. The thumbnail unmounts anyway (the timeline's render window slides when the
 *    user scrolls the list behind the overlay, or the thread is re-rendered).
 *    Without a reference, its cleanup would revoke the URL and the full-screen
 *    image would go blank.
 * 2. The lightbox closes. If it revoked on close, the thumbnail behind it would
 *    show a broken image until the next fetch.
 *
 * So it RETAINS on open and RELEASES on close, and the registry's count decides
 * when the blob is actually released. When the URL is not (or no longer) in the
 * registry — e.g. a thumbnail that failed to fetch — `retainObjectUrl` returns
 * null, the release is a no-op, and nothing is double-counted.
 */
const ImageLightbox = ({ isOpen, url, messageId, onClose }) => {
    const { t } = useTranslation();

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    /**
     * Hold the image for as long as the overlay is open. Keyed on `messageId`
     * rather than the URL string so a re-render cannot balance a retain against
     * a different message's entry.
     */
    useEffect(() => {
        if (!isOpen || !messageId) return undefined;
        // Returns null when the entry is already gone; the release below is then
        // a harmless no-op rather than a decrement of someone else's hold.
        const held = retainObjectUrl('image', messageId);
        if (!held) return undefined;
        return () => { releaseObjectUrl('image', messageId); };
    }, [isOpen, messageId]);

    if (!isOpen) return null;

    return (
        <div className="chat-lightbox" onClick={onClose} role="dialog" aria-modal="true">
            <button type="button" className="chat-lightbox-close" aria-label={t('chat:images.close')}
                onClick={onClose}>
                <XIcon className="w-5 h-5" />
            </button>
            {url
                ? <img src={url} alt={t('chat:images.viewTitle')} className="chat-lightbox-image"
                    onClick={(e) => e.stopPropagation()} />
                : <div className="chat-lightbox-fallback">{t('chat:images.failed')}</div>}
        </div>
    );
};

export default ImageLightbox;
