import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { WarningIcon } from '../../constants/icons.jsx';
import { sessionErrorTime } from '../../store/chatSessionErrors.js';

/**
 * Chat session-error modal (owner-approved design, 2026-10-31).
 *
 * A failed ENTITY session is not a socket problem: the engine may be up and
 * the socket live while the session start was rejected (missing API key, bad
 * provider config, session state unavailable). The owner asked for exactly
 * this shape — the header says "Degraded" (never "Offline") and a warning
 * bubble next to it opens the list of failures, newest first, with the raw
 * engine message kept verbatim and a coarse code chip that only picks the
 * hint. The list is capped in the store and clears on the next successful
 * session, which the footer states plainly.
 *
 * The panel captures the invoking element on open and restores focus on
 * close, so keyboard users land back on the bubble rather than at the top of
 * the page. Escape and a click on the dimmed backdrop both close it.
 */
const ChatErrorModal = ({ isOpen, onClose, onRetry, entityName, errors }) => {
    const { t } = useTranslation('chat');
    const panelRef = useRef(null);
    const restoreFocusRef = useRef(null);
    // The parent passes a fresh inline `onClose` every render; keeping it in a
    // ref lets the open/close effect depend on `isOpen` alone, so it never
    // re-captures focus while the modal is open.
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        if (!isOpen) return undefined;
        restoreFocusRef.current = typeof document !== 'undefined' ? document.activeElement : null;
        panelRef.current?.focus();
        const onKey = (event) => {
            if (event.key === 'Escape') onCloseRef.current?.();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            const target = restoreFocusRef.current;
            if (target && target.isConnected !== false && typeof target.focus === 'function') {
                target.focus();
            }
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const list = errors || [];
    const count = list.length;

    return (
        <div
            className="chat-error-overlay"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose?.();
            }}
        >
            <div
                className="chat-error-modal"
                role="dialog"
                aria-modal="true"
                aria-label={t('conversation.errors.why')}
                ref={panelRef}
                tabIndex={-1}
            >
                <div className="chat-error-head">
                    <div className="chat-error-icon">
                        <WarningIcon className="w-4 h-4" />
                    </div>
                    <div>
                        <span className="chat-error-title">{t('conversation.errors.why')}</span>
                        <span className="chat-error-sub">
                            {entityName}
                            {' · '}
                            {t('conversation.errors.errorCount', { count })}
                            {' · '}
                            {t('conversation.errors.newestFirst')}
                        </span>
                    </div>
                    <button
                        type="button"
                        className="chat-error-x"
                        aria-label={t('conversation.errors.close')}
                        onClick={() => onClose?.()}
                    >
                        ✕
                    </button>
                </div>

                <div className="chat-error-list">
                    {list.map((error, index) => (
                        <div
                            key={`${error.at}-${index}`}
                            className={`chat-error-item${index > 0 ? ' chat-error-item-old' : ''}`}
                        >
                            <div className="chat-error-item-top">
                                <span className="chat-error-code">
                                    {t(`conversation.errors.code.${error.code}`)}
                                </span>
                                <span className="chat-error-when">{sessionErrorTime(error.at)}</span>
                            </div>
                            <div className="chat-error-item-msg">{error.message}</div>
                            <div className="chat-error-item-hint">
                                {t(`conversation.errors.hint.${error.code}`)}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="chat-error-foot">
                    <button
                        type="button"
                        className="chat-error-btn chat-error-btn-primary"
                        onClick={() => onRetry?.()}
                    >
                        {t('conversation.errors.retry')}
                    </button>
                    <button type="button" className="chat-error-btn" onClick={() => onClose?.()}>
                        {t('conversation.errors.close')}
                    </button>
                    <span className="chat-error-note">{t('conversation.errors.clearNote')}</span>
                </div>
            </div>
        </div>
    );
};

export default ChatErrorModal;
