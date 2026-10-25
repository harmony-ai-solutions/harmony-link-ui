import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EditIcon, TrashIcon, RefreshIcon, ClipboardIcon, SmileIcon, ImageIcon } from '../../constants/icons.jsx';
import {
    messageDirection,
    conversationPreview,
    isProactiveMessage,
    parseReactions,
    replyQuoteText,
    QUICK_REACTIONS,
} from '../../store/chatStoreUtils.js';
import {
    TRANSCRIPTION_PENDING,
    canRetranscribeMessage,
    hasTranscribedText,
} from '../../store/transcriptionUtils.js';
import { fetchMessageImageObjectUrl } from '../../services/management/chatReadService.js';
import { toast } from '../../store/toastStore.js';
import AudioBubble from './AudioBubble.jsx';
import Tooltip from '../ui/Tooltip.jsx';

/**
 * One message bubble (F3) with a hover / right-click action menu (F9 / F13 /
 * F14). Media bubbles delegate playback to AudioBubble (F8) and image previews
 * to a lazy thumbnail (F15) so the timeline stays light.
 *
 * Task 02-6 made every menu entry real:
 *
 * - **React** opens an inline row of the six quick reactions; tapping one
 *   toggles it through the engine (the chip row under the bubble is clickable
 *   for the same purpose).
 * - **Forward** copies the text into another thread (1.0 semantics — see
 *   `onForward`; there is no engine forward primitive).
 * - **Pin/Unpin** flips `conversation_messages.is_pinned` and renders a 📌
 *   marker. It deliberately does NOT reorder the timeline.
 * - **Reply-to** shows the quoted TEXT (server-computed `reply_preview`, with a
 *   timeline fallback for a just-sent reply) instead of a placeholder.
 * - **Regenerate** is rendered DISABLED with the reason in its tooltip: the
 *   engine has no re-process event (Task 02-3 dropped the endpoint rather than
 *   fake it), and the previous behaviour — resending the last user message —
 *   created a duplicate, which is worse than an absent button.
 * - **Translate** was removed outright. A "not available in this build" entry
 *   is still a dead button; there is no translator to wire it to in 1.0.
 *
 * The acceptance rule for this component is that no visible affordance is a
 * no-op: everything either works or is disabled WITH the reason explained.
 */
const ChatBubble = ({
    message,
    ownEntityId,
    isLast,
    timeline,
    onEdit,
    onDelete,
    onReply,
    onReact,
    onForward,
    onTogglePin,
    onOpenImage,
    onRetranscribe,
}) => {
    const { t } = useTranslation();
    const [menuOpen, setMenuOpen] = useState(false);
    // Which secondary panel the menu is showing: null | 'react'.
    const [panel, setPanel] = useState(null);
    const direction = messageDirection(message, ownEntityId);
    const isOut = direction === 'out';

    /** Close the menu AND reset the panel, so the next open starts clean. */
    const closeMenu = () => {
        setMenuOpen(false);
        setPanel(null);
    };

    const handleCopy = () => {
        // Promise-safe: only confirm the toast once the copy actually landed,
        // and keep it silent when the clipboard API is unavailable or rejects.
        const text = message.content || '';
        const write = navigator.clipboard?.writeText(text);
        if (write && typeof write.then === 'function') {
            write.then(() => toast.success(t('chat:actions.copied'))).catch(() => {});
        }
        closeMenu();
    };

    const time = new Date(message.created_at);
    const timeLabel = Number.isNaN(time.getTime())
        ? ''
        : time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    /**
     * ── AUDIO + TEXT ARE NOT EITHER/OR (Task 04-3 step 4) ────────────────
     *
     * This used to be `has_audio && !has_image`, and the text block was gated on
     * `!isAudioOnly`. That is correct for the two states the OLD pipeline could
     * produce (a voice note with no text yet, or a finished text message), but it
     * erases the third state this task introduces: an audio message whose
     * transcription arrived. Android patches `content` in place and loses the
     * "this was a voice note" affordance entirely; the desktop keeps BOTH, which
     * is what `message_type = 'combined'` already means to this engine
     * (modules/cognition.go derives exactly that for audio + content).
     *
     * So the audio bubble renders whenever there is audio, and the text paragraph
     * renders whenever there is text. `isAudioOnly` now only suppresses the
     * composer-placeholder fallback (there is nothing to preview on a note).
     */
    const isAudioOnly = message.has_audio && !hasTranscribedText(message);
    const transcriptionPending = message.transcription === TRANSCRIPTION_PENDING;
    const showRetryTranscription = canRetranscribeMessage(message);
    const reactions = parseReactions(message.reactions_json);
    const proactive = isProactiveMessage(message);
    const quote = replyQuoteText(message, timeline);
    const pinned = !!message.is_pinned;
    // A forward in 1.0 copies TEXT. A media-only message has nothing to copy,
    // so the entry is disabled with that reason rather than copying an empty
    // string into another thread.
    const canForward = !!(message.content || '').trim();
    const canDelete = isOut;

    const handleReaction = (emoji) => {
        onReact?.(message, emoji);
        closeMenu();
    };

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

                {/* Reply-to quote (F13 / Task 02-6 step 2). The TEXT of the
                    parent, not a placeholder — resolved server-side so quoting
                    costs no per-message request. */}
                {message.reply_to_message_id && (
                    <div className="chat-bubble-quote">
                        <span className="chat-bubble-quote-label">{t('chat:actions.replyingTo')}</span>
                        {quote
                            ? <span className="chat-bubble-quote-text">{quote}</span>
                            /* Parent purged/never loaded: say so rather than
                               rendering an empty quote bar. */
                            : <span className="chat-bubble-quote-text chat-bubble-quote-missing">
                                {t('chat:actions.replyUnavailable')}
                            </span>}
                    </div>
                )}

                {/* Media (F8 / F15) */}
                {message.has_image && (
                    <ChatImageThumb message={message} onOpen={onOpenImage} />
                )}
                {message.has_audio && <AudioBubble message={message} />}

                {/* Transcription surface (Task 04-3). Three states, and each gets
                    exactly one affordance so the bubble is never a dead end:
                      pending → "Transcribing…" (the attempt is live),
                      failed  → Retry (the ONLY way back; nothing re-sends audio),
                      done    → nothing here; the text paragraph below is the result. */}
                {transcriptionPending && (
                    <div className="chat-bubble-transcription chat-bubble-transcription-pending"
                        role="status" aria-live="polite">
                        <span className="chat-bubble-transcription-spinner" aria-hidden="true" />
                        {t('chat:bubble.transcribing')}
                    </div>
                )}
                {showRetryTranscription && (
                    <div className="chat-bubble-transcription chat-bubble-transcription-failed">
                        <span className="chat-bubble-transcription-label">
                            {t('chat:bubble.failedTranscription')}
                        </span>
                        <button
                            type="button"
                            className="chat-bubble-transcription-retry"
                            onClick={() => onRetranscribe?.(message)}
                        >
                            <RefreshIcon className="w-3 h-3" />
                            {t('chat:bubble.retryTranscription')}
                        </button>
                    </div>
                )}

                {/* Text. Rendered whenever there IS text — including on an audio
                    message, so a transcribed voice note shows the words AND keeps
                    its play button. A media-only row still shows nothing. */}
                {message.content ? (
                    <p className="chat-bubble-text">{message.content}</p>
                ) : (!isAudioOnly && !message.has_image && (
                    <p className="chat-bubble-text">{conversationPreview(message)}</p>
                ))}

                {/* Reactions (F14 / Task 02-6 step 1). Aggregated chips with
                    counts; clicking one toggles YOUR reaction, so the chip row
                    is itself an action surface, not just a display. */}
                {reactions.length > 0 && (
                    <div className="chat-bubble-reactions">
                        {reactions.map((r) => (
                            <button
                                key={r.emoji}
                                type="button"
                                className="chat-bubble-reaction"
                                title={t('chat:actions.removeReaction')}
                                onClick={() => handleReaction(r.emoji)}
                            >
                                {r.emoji}{r.count > 1 ? ` ${r.count}` : ''}
                            </button>
                        ))}
                    </div>
                )}

                {/* Meta */}
                <div className="chat-bubble-meta">
                    {pinned && (
                        <Tooltip content={t('chat:actions.pinnedTooltip')}>
                            <span className="chat-bubble-pin" role="img" aria-label={t('chat:actions.pinned')}>
                                📌
                            </span>
                        </Tooltip>
                    )}
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
                            className="chat-bubble-action" onClick={() => { onReply?.(message); closeMenu(); }}>
                            <RefreshIcon className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>
                    <Tooltip content={t('chat:actions.react')}>
                        <button type="button"
                            className={`chat-bubble-action ${panel === 'react' ? 'chat-bubble-action-active' : ''}`}
                            aria-expanded={panel === 'react'}
                            onClick={() => setPanel(panel === 'react' ? null : 'react')}>
                            <SmileIcon className="w-3.5 h-3.5" />
                        </button>
                    </Tooltip>
                    {isOut && (
                        <Tooltip content={t('chat:actions.edit')}>
                            <button type="button"
                                className="chat-bubble-action" onClick={() => { onEdit?.(message); closeMenu(); }}>
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
                    {/* Forward = "send this text in another thread" for 1.0. */}
                    <Tooltip content={canForward
                        ? t('chat:actions.forward')
                        : t('chat:actions.forwardUnavailable')}>
                        <button type="button"
                            className="chat-bubble-action"
                            disabled={!canForward}
                            onClick={() => { onForward?.(message); closeMenu(); }}>
                            <ForwardGlyph />
                        </button>
                    </Tooltip>
                    <Tooltip content={t(pinned ? 'chat:actions.unpin' : 'chat:actions.pin')}>
                        <button type="button"
                            className={`chat-bubble-action ${pinned ? 'chat-bubble-action-active' : ''}`}
                            onClick={() => { onTogglePin?.(message, !pinned); closeMenu(); }}>
                            <PinGlyph />
                        </button>
                    </Tooltip>
                    {/* Regenerate: DISABLED, with the real reason. The engine has
                        no re-process event, and the old behaviour duplicated the
                        user's message. A visible-but-honest disabled entry beats
                        both a lie and a silent harmful action. */}
                    {isOut && isLast && (
                        <Tooltip content={t('chat:actions.regenerateUnavailable')}>
                            <button type="button"
                                className="chat-bubble-action"
                                disabled
                                aria-disabled="true">
                                <RefreshIcon className="w-3.5 h-3.5" />
                            </button>
                        </Tooltip>
                    )}
                    {canDelete && (
                        <Tooltip content={t('chat:actions.delete')}>
                            <button type="button"
                                className="chat-bubble-action chat-bubble-action-danger"
                                onClick={() => { onDelete?.(message); closeMenu(); }}>
                                <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                        </Tooltip>
                    )}
                </div>

                {/* Quick reaction strip (Task 02-6 step 1). Rendered inline
                    under the menu so it can never be clipped by the timeline
                    scroll container, and only while the React panel is open. */}
                {panel === 'react' && (
                    <div className="chat-bubble-quick-reactions" role="group"
                        aria-label={t('chat:actions.react')}>
                        {QUICK_REACTIONS.map((emoji) => (
                            <button
                                key={emoji}
                                type="button"
                                className="chat-bubble-quick-reaction"
                                onClick={() => handleReaction(emoji)}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

/** Inline pin glyph (kept local — it is only used by the bubble menu). */
const PinGlyph = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 4.5l4.5 4.5-2.25 2.25-.75 4.5-2.25-2.25L9 18.75 5.25 15l5.25-5.25L8.25 7.5l4.5-.75L15 4.5z" />
    </svg>
);

/** Inline forward glyph (an arrow leaving a box). */
const ForwardGlyph = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 7l5 5-5 5M18 12H8a4 4 0 00-4 4v2" />
    </svg>
);

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
