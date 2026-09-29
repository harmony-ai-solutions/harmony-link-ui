import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listEmojiActions } from '../../services/management/chatService.js';

/** A small, curated quick-reaction set (browser emoji input covers the rest). */
export const QUICK_EMOJI = ['😀', '😂', '🥰', '😍', '😊', '😉', '😎', '🤔',
    '😢', '😭', '😡', '😱', '👍', '👎', '👏', '🙏', '❤️', '🔥', '✨', '🎉'];

/**
 * Emoji picker (F11).
 *
 * Two sections:
 *   1. Quick reactions — plain emoji appended to the message text.
 *   2. Emoji actions — the character's `entity_emoji_actions`; picking one
 *      sends an action that also shifts the character's mood (F11).
 *
 * @param {{ entityId?: string, onPick: (emoji: string) => void,
 *   onPickAction?: (action: object) => void, onClose: () => void }} props
 */
const EmojiPicker = ({ entityId, onPick, onPickAction, onClose }) => {
    const { t } = useTranslation();
    const [actions, setActions] = useState([]);

    useEffect(() => {
        let active = true;
        if (!entityId) return undefined;
        (async () => {
            const list = await listEmojiActions(entityId);
            if (active) setActions(list);
        })();
        return () => { active = false; };
    }, [entityId]);

    return (
        <div className="chat-emoji-picker" role="dialog" aria-label={t('chat:emoji.quickTitle')}>
            <div className="chat-emoji-picker-head">
                <span className="chat-emoji-picker-title">{t('chat:emoji.quickTitle')}</span>
                <button type="button" className="chat-emoji-close" onClick={onClose}>×</button>
            </div>

            <div className="chat-emoji-grid">
                {QUICK_EMOJI.map((emoji) => (
                    <button
                        key={emoji}
                        type="button"
                        className="chat-emoji-btn"
                        onClick={() => onPick?.(emoji)}
                    >
                        {emoji}
                    </button>
                ))}
            </div>

            <div className="chat-emoji-picker-head">
                <span className="chat-emoji-picker-title">{t('chat:emoji.actionsTitle')}</span>
            </div>
            {actions.length === 0 ? (
                <p className="chat-emoji-empty">{t('chat:emoji.none')}</p>
            ) : (
                <div className="chat-emoji-grid">
                    {actions.map((action) => (
                        <button
                            key={action.id}
                            type="button"
                            className="chat-emoji-btn chat-emoji-btn-action"
                            title={action.emotion_effect || action.substitution_text || ''}
                            onClick={() => onPickAction?.(action)}
                        >
                            {action.emoji_native}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default EmojiPicker;
