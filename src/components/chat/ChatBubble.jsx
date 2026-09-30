import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditIcon, TrashIcon, RefreshIcon, ClipboardIcon, SmileIcon, ImageIcon } from '../../constants/icons.jsx';
import { messageDirection, conversationPreview, parseReactions, isProactiveMessage } from '../../store/chatStoreUtils.js';
import { fetchMessageImageObjectUrl } from '../../services/management/chatService.js';
import AudioBubble from './AudioBubble.jsx';
import Tooltip from '../ui/Tooltip.jsx';

/**
 * One message bubble (F3) with a hover / right-click action menu (F9 / F13 /
 * F14). Media bubbles delegate playback to AudioBubble (F8) and image previews
 * to a lazy thumbnail (F15) so the timeline stays light.
 */
const ChatBubble = ({
    message,
    ownEntityId,
    isLast,
    onEdit,
    onDelete,
    onRegenerate,
    onReply,
    onReact,
    onOpenImage,
}) => {
    const { t } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);
    const direction = messageDirection(message, ownEntityId);
    const isOut = direction === 'out';

    const handleCopy = () => {
        navigator.clipboard?.writeText(message.content || '').catch(() => {});
        setMenuOpen(false);
    };

    const time = new Date(message.created_at);
    const timeLabel = Number.isNaN(time.getTime())
        ? ''
        : time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const isAudioOnly = message.has_audio && !message.has_image;
    const reactions = parseReactions(message.reactions_json);
    const proactive = isProactiveMessage(message);

    return (
        <div className={`chat-bubble-row ${isOut ? 'chat-bubble-row-out' : 'chat-bubble-row-in'}`}>
            <div
                className={`chat-bubble ${isOut ? 'chat-bubble-out' : 'chat-bubble-in'}`}
                onContextMenu={(e) => { e.preventDefault(); setMenuOpen(true); }}
            >
                {/* Proactive (lifecycle beat) badge (F16) */}
                {proactive && (
                    <div className="chat-bubble-proactive">{t('chat:proactive.badge')}</div>
                )}

                {/* Reply-to quote (F13) */}
                {message.reply_to_message_id && (
                    <div className="chat-bubble-quote">{t('chat:actions.replyingTo')}</div>
                )}

                {/* Media (F8 / F15) */}
                {message.has_image && (
                    <ChatImageThumb message={message} onOpen={onOpenImage} />
                )}
                {message.has_audio && <AudioBubble message={message} />}

                {/* Text */}
                {!isAudioOnly && (
                    <p className="chat-bubble-text">
                        {message.content || (message.has_image ? '' : conversationPreview(message))}
                    </p>
                )}

                {/* Reactions (F14) */}
                {reactions.length > 0 && (
                    <div className="chat-bubble-reactions">
                        {reactions.map((r) => (
                            <span key={r.emoji} className="chat-bubble-reaction">
                                {r.emoji}{r.count > 1 ? ` ${r.count}` : ''}
                            </span>
                        ))}
                    </div>
                )}

                {/* Meta */}
                <div className="chat-bubble-meta">
                    {message.is_edited && (
                        <Tooltip content={t('chat:bubble.editedTooltip')}>
                            <span className="chat-bubble-edited">
                                {t('chat:bubble.edited')}
                            </span>
                        </Tooltip>
                    )}
                    {timeLabel && <span>{timeLabel}</span>}
                </div>

                {/* Hover / context action menu */}
                <div className={`chat-bubble-actions ${menuOpen ? 'chat-bubble-actions-open' : ''}`}>
                    <Tooltip content={t('chat:actions.reply')}>
                        <button type="button"
                            className="chat-bubble-action" onClick={() => { onReply?.(message); setMenuOpen(false); }}>
                            <RefreshIcon className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>
                    <Tooltip content={t('chat:actions.react')}>
                        <button type="button"
                            className="chat-bubble-action" onClick={() => { onReact?.(message); setMenuOpen(false); }}>
                            <SmileIcon className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>
                    {isOut && (
                        <Tooltip content={t('chat:actions.edit')}>
                            <button type="button"
                                className="chat-bubble-action" onClick={() => { onEdit?.(message); setMenuOpen(false); }}>
                                <EditIcon className="w-3.5 h-3.5" />
                            </button>
                        </Tooltip>
                    )}
                    <Tooltip content={t('chat:actions.copy')}>
                        <button type="button"
                            className="chat-bubble-action" onClick={handleCopy}>
                            <ClipboardIcon className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>
                    {isOut && isLast && (
                        <Tooltip content={t('chat:actions.regenerate')}>
                            <button type="button"
                                className="chat-bubble-action" onClick={() => { onRegenerate?.(message); setMenuOpen(false); }}>
                                <RefreshIcon className="w-3.5 h-3.5" />
                            </button>
                        </Tooltip>
                    )}
                    {isOut && (
                        <Tooltip content={t('chat:actions.delete')}>
                            <button type="button"
                                className="chat-bubble-action chat-bubble-action-danger"
                                onClick={() => { onDelete?.(message); setMenuOpen(false); }}>
                                <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                        </Tooltip>
                    )}
                </div>
            </div>
        </div>
    );
};

/** Lazily fetches and renders a message's image (F15). */
const ChatImageThumb = ({ message, onOpen }) => {
    const { t } = useTranslation();
    const [url, setUrl] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            const objectUrl = await fetchMessageImageObjectUrl(message.id);
            if (!active) return;
            if (objectUrl) setUrl(objectUrl);
            else setFailed(true);
        })();
        return () => { active = false; };
    }, [message.id]);

    if (failed) {
        return <div className="chat-image-fallback">{t('chat:images.failed')}</div>;
    }
    return (
        <button type="button" className="chat-image-thumb" onClick={() => onOpen?.(message, url)}>
            {url
                ? <img src={url} alt={t('chat:images.viewTitle')} />
                : <div className="chat-image-fallback"><ImageIcon className="w-5 h-5" /></div>}
        </button>
    );
};

export default ChatBubble;
