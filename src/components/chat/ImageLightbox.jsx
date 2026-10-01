import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from '../../constants/icons.jsx';

/**
 * Zoomable image lightbox (F15). Shows a message's image full-screen on a
 * dimmed backdrop; click the backdrop or press Escape to close.
 */
const ImageLightbox = ({ isOpen, url, onClose }) => {
    const { t } = useTranslation();

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

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
