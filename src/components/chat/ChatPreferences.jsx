import { useTranslation } from 'react-i18next';
import { XIcon } from '../../constants/icons.jsx';

/**
 * Chat preferences panel (F10).
 *
 * Reply mode is per-conversation (instant vs realistic delays) and is sent to
 * the engine via SET_REPLY_MODE. The display options (font size, spacing, sound)
 * are desktop-only and persisted in localStorage by the parent view.
 *
 * @param {{ isOpen: boolean, replyMode: string, onReplyModeChange: (m: string) => void,
 *   prefs: {fontSize: string, spacing: string, sound: boolean},
 *   onPrefsChange: (patch: object) => void, onClose: () => void }} props
 */
const ChatPreferences = ({ isOpen, replyMode, onReplyModeChange, prefs, onPrefsChange, onClose }) => {
    const { t } = useTranslation();
    if (!isOpen) return null;

    return (
        <div className="chat-prefs-panel">
            <div className="chat-prefs-head">
                <span className="chat-prefs-title">{t('chat:preferences.title')}</span>
                <button type="button" className="chat-prefs-close" aria-label={t('chat:images.close')}
                    onClick={onClose}>
                    <XIcon className="w-4 h-4" />
                </button>
            </div>

            {/* Reply mode (per conversation) */}
            <div className="chat-prefs-group">
                <span className="chat-prefs-label">{t('chat:preferences.replyMode')}</span>
                <div className="chat-prefs-segments">
                    <button
                        type="button"
                        className={`chat-prefs-segment ${replyMode === 'instant' ? 'chat-prefs-segment-active' : ''}`}
                        onClick={() => onReplyModeChange?.('instant')}
                    >
                        {t('chat:preferences.replyModeInstant')}
                    </button>
                    <button
                        type="button"
                        className={`chat-prefs-segment ${replyMode !== 'instant' ? 'chat-prefs-segment-active' : ''}`}
                        onClick={() => onReplyModeChange?.('realistic')}
                    >
                        {t('chat:preferences.replyModeRealistic')}
                    </button>
                </div>
                <p className="chat-prefs-hint">
                    {replyMode === 'instant'
                        ? t('chat:preferences.replyModeInstantHint')
                        : t('chat:preferences.replyModeRealisticHint')}
                </p>
            </div>

            {/* Font size (desktop-only) */}
            <div className="chat-prefs-group">
                <span className="chat-prefs-label">{t('chat:preferences.fontSize')}</span>
                <div className="chat-prefs-segments">
                    {[
                        { id: 'small', label: t('chat:preferences.fontSmall') },
                        { id: 'medium', label: t('chat:preferences.fontMedium') },
                        { id: 'large', label: t('chat:preferences.fontLarge') },
                    ].map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            className={`chat-prefs-segment ${prefs.fontSize === option.id ? 'chat-prefs-segment-active' : ''}`}
                            onClick={() => onPrefsChange?.({ fontSize: option.id })}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Spacing (desktop-only) */}
            <div className="chat-prefs-group">
                <span className="chat-prefs-label">{t('chat:preferences.spacing')}</span>
                <div className="chat-prefs-segments">
                    <button
                        type="button"
                        className={`chat-prefs-segment ${prefs.spacing === 'comfortable' ? 'chat-prefs-segment-active' : ''}`}
                        onClick={() => onPrefsChange?.({ spacing: 'comfortable' })}
                    >
                        {t('chat:preferences.spacingComfortable')}
                    </button>
                    <button
                        type="button"
                        className={`chat-prefs-segment ${prefs.spacing === 'compact' ? 'chat-prefs-segment-active' : ''}`}
                        onClick={() => onPrefsChange?.({ spacing: 'compact' })}
                    >
                        {t('chat:preferences.spacingCompact')}
                    </button>
                </div>
            </div>

            {/* Sound (desktop-only) */}
            <label className="chat-prefs-toggle">
                <input
                    type="checkbox"
                    checked={!!prefs.sound}
                    onChange={(e) => onPrefsChange?.({ sound: e.target.checked })}
                />
                <span>{t('chat:preferences.soundOnMessage')}</span>
            </label>
        </div>
    );
};

export default ChatPreferences;
