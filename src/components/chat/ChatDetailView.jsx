import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ChevronRightIcon, ArrowDownIcon, SettingsGearIcon, RefreshIcon, TerminalIcon,
} from '../../constants/icons.jsx';
import useChatStore from '../../store/chatStore.js';
import { messageDirection, isUnreadInbound, deriveParticipantKey } from '../../store/chatStoreUtils.js';
import useChatPrefsStore from '../../store/chatPrefsStore.js';
import ChatBubble from './ChatBubble.jsx';
import ChatInput from './ChatInput.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import NewMessagesDivider from './NewMessagesDivider.jsx';
import ImageLightbox from './ImageLightbox.jsx';
import ChatPreferences from './ChatPreferences.jsx';
import ImpersonationSelector from './ImpersonationSelector.jsx';
import ChatWireInspector from './ChatWireInspector.jsx';
import ConversationMenu from './ConversationMenu.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Skeleton from '../ui/Skeleton.jsx';
import { MessageIcon } from '../../constants/icons.jsx';
import ConfirmDialog from '../modals/ConfirmDialog.jsx';
import InputDialog from '../modals/InputDialog.jsx';
import useUIModeStore, { isModeAllowed } from '../../store/uiModeStore.js';
import { toast } from '../../store/toastStore.js';

/**
 * Chat detail screen (F2): the scrolling message timeline, typing dots (F5),
 * the "new messages" divider (F6), the input box (F4) and the message action
 * flows (F9 / F13 / F14). Windowing keeps thousands of messages fast.
 *
 * Task 02-5 adds the thread-level action menu (`⋯` in the header), the
 * mark-read triggers (first page + window focus) and the disabled-AI banner
 * that replaces the composer.
 */
const ChatDetailView = ({ conversation, ownEntityId, personas, onBack, onOwnEntityChange }) => {
    const { t } = useTranslation();
    const messages = useChatStore((s) => s.messages);
    /**
     * The row this thread corresponds to, when the inbox has loaded it. Reading
     * the flag from the STORE (not from the `conversation` prop) is what makes
     * the disabled banner react the instant the menu toggles it — the prop was
     * captured when the thread was opened and never updates.
     */
    const inboxRow = useChatStore((s) => {
        const key = s.activeConversation?.participant_key
            || s.activeConversation?.participantKey
            || conversation.participantKey;
        if (!key) return null;
        return s.conversations.find((row) => row.participant_key === key)
            || s.archivedConversations.find((row) => row.participant_key === key)
            || null;
    });
    const chatEntities = useChatStore((s) => s.chatEntities);
    const loadingMessagesState = useChatStore((s) => s.loadingMessages);
    const markRead = useChatStore((s) => s.markRead);
    const setDisabled = useChatStore((s) => s.setDisabled);
    const hasMore = useChatStore((s) => s.hasMore);
    const loadingMessages = useChatStore((s) => s.loadingMessages);
    const loadingOlder = useChatStore((s) => s.loadingOlder);
    const connectionState = useChatStore((s) => s.connectionState);
    const typingByEntity = useChatStore((s) => s.typingByEntity);
    const recordingByEntity = useChatStore((s) => s.recordingByEntity);
    const sendText = useChatStore((s) => s.sendText);
    const sendAudio = useChatStore((s) => s.sendAudio);
    const sendImage = useChatStore((s) => s.sendImage);
    const editMessage = useChatStore((s) => s.editMessage);
    const deleteMessageLocal = useChatStore((s) => s.deleteMessageLocal);
    const setReplyMode = useChatStore((s) => s.setReplyMode);
    const loadOlderMessages = useChatStore((s) => s.loadOlderMessages);

    const wireFrames = useChatStore((s) => s.wireFrames);
    const clearWireFrames = useChatStore((s) => s.clearWireFrames);

    // Developer-mode wire inspector (Phase 3, D7) — only available in Dev mode.
    const uiMode = useUIModeStore((s) => s.mode);
    const showWireInspector = isModeAllowed(uiMode, 'dev');

    const prefs = useChatPrefsStore();
    const [replyTo, setReplyTo] = useState(null);
    const [editing, setEditing] = useState(null);
    const [lightbox, setLightbox] = useState({ open: false, url: null });
    const [showPrefs, setShowPrefs] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [showJump, setShowJump] = useState(false);
    const [showWire, setShowWire] = useState(false);
    const [menuPosition, setMenuPosition] = useState(null);

    const scrollRef = useRef(null);
    const bottomRef = useRef(null);

    const partnerId = conversation.entityId;
    const isTyping = !!typingByEntity[partnerId];
    const isRecording = !!recordingByEntity[partnerId];

    /**
     * The row the menu and the banner act on: the live inbox row when the
     * thread is in the list, otherwise a row-shaped object built from the open
     * conversation (a brand-new chat has no row until its first message).
     *
     * `entity_disabled` comes from `chatEntities` first: disabling is an ENTITY
     * flag, and the setter patches there, so the banner reacts even for a thread
     * that has no inbox row yet.
     */
    const threadRow = useMemo(() => {
        const entity = chatEntities.find((item) => item.id === partnerId);
        const participantIds = inboxRow?.participant_ids || conversation.participantIds || [];
        // A brand-new chat has no inbox row and no participant_key yet, but the
        // key is DETERMINISTIC (sorted participant set), so it can be derived —
        // that is what lets pin/archive/read work before the first message
        // creates the row.
        const participantKey = inboxRow?.participant_key
            || conversation.participantKey
            || deriveParticipantKey(participantIds, partnerId, 'private');
        return {
            participant_key: participantKey || '',
            entity_id: inboxRow?.entity_id || partnerId,
            interaction_id: inboxRow?.interaction_id || conversation.interactionId || '',
            participant_ids: participantIds,
            companion_display_name: inboxRow?.companion_display_name || conversation.title || '',
            pinned: !!inboxRow?.pinned,
            archived: !!inboxRow?.archived,
            muted: !!inboxRow?.muted,
            unread_count: Number(inboxRow?.unread_count) || 0,
            entity_disabled: entity ? !!entity.is_disabled : !!inboxRow?.entity_disabled,
        };
    }, [inboxRow, chatEntities, conversation, partnerId]);

    const aiDisabled = threadRow.entity_disabled;
    const threadName = conversation.title || threadRow.companion_display_name || partnerId;

    // Auto-scroll to the newest message.
    const scrollToBottom = useCallback((behavior = 'smooth') => {
        bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
    }, []);

    useEffect(() => {
        scrollToBottom('auto');
    }, [conversation.interactionId]);

    /**
     * Mark read ONCE the first page has landed — never on every scroll.
     *
     * The task calls for read receipts on open and on refocus, explicitly not on
     * scroll: a scroll-triggered write would fire a request per wheel event. This
     * effect keys on the loading→loaded EDGE (`loadingMessages` true→false) per
     * thread, so re-renders and older-page loads do not re-fire it.
     *
     * The store's own `openConversation` also marks read (fire-and-forget, so a
     * failure never blocks opening); this effect is what covers a thread opened
     * before the write path existed and a re-open that races the first page.
     */
    const markedThreadRef = useRef('');
    useEffect(() => {
        if (loadingMessagesState) return;
        const key = threadRow.participant_key || partnerId;
        if (!key || markedThreadRef.current === key) return;
        markedThreadRef.current = key;
        markRead(threadRow, { read: true });
    }, [loadingMessagesState, threadRow, partnerId, markRead]);

    /**
     * Mark read when the window regains focus while this thread is open.
     *
     * Returning to the app is exactly when messages arrived unread in the
     * background, so this is the second (and only other) trigger. `document`
     * `visibilitychange` is included for the same reason on platforms where a
     * minimised window fires that but not `focus`.
     *
     * Guarded on `unread_count > 0`: a refocus with nothing new must not send a
     * write (and a successful markRead zeroes the local count, so an immediate
     * second refocus is a no-op rather than a duplicate request).
     */
    const unreadCount = threadRow.unread_count;
    useEffect(() => {
        if (unreadCount <= 0) return undefined;
        const onFocus = () => {
            if (document.visibilityState === 'hidden') return;
            markRead(threadRow, { read: true });
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, [threadRow, unreadCount, markRead]);

    useEffect(() => {
        // Only auto-scroll when the user is already near the bottom.
        const el = scrollRef.current;
        if (!el) return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
        if (nearBottom) scrollToBottom('smooth');
        else setShowJump(true);
    }, [messages.length]);

    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        if (el.scrollTop < 120 && hasMore && !loadingOlder) {
            loadOlderMessages();
        }
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
        setShowJump(!nearBottom);
    };

    // Index of the first unread inbound message (for the F6 divider).
    const firstUnreadIndex = useMemo(() => {
        for (let i = 0; i < messages.length; i += 1) {
            if (isUnreadInbound(messages[i], ownEntityId)) return i;
        }
        return -1;
    }, [messages, ownEntityId]);

    const lastOutboundIndex = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            if (messageDirection(messages[i], ownEntityId) === 'out') return i;
        }
        return -1;
    }, [messages, ownEntityId]);

    const handleSendText = (text) => {
        sendText(ownEntityId, text, { replyToMessageId: replyTo?.id });
        setReplyTo(null);
    };

    const handleSendAudio = (audio) => sendAudio(ownEntityId, audio);
    const handleSendImage = (image) => sendImage(ownEntityId, image);

    const handleSendEmojiAction = (action) => {
        // An emoji action is a short substitution text plus its emotion effect.
        const content = action.substitution_text || action.emoji_native;
        sendText(ownEntityId, content, {
            additionalEffects: action.emotion_effect
                ? { emotion_effects: [{ emotion: action.emotion_effect, delta: 0.15 }] }
                : undefined,
        });
    };

    const handleEditSubmit = (value) => {
        if (editing && value) editMessage(ownEntityId, editing.id, value);
        setEditing(null);
    };

    const handleDelete = (message) => setConfirmDelete(message);
    const confirmDeleteYes = () => {
        if (confirmDelete) {
            deleteMessageLocal(confirmDelete.id);
            // Deletion still asks (ConfirmDialog above), but the destructive
            // action is confirmed non-modally once it has happened.
            toast.success(t('common:toast.messageDeleted'));
        }
        setConfirmDelete(null);
    };

    const handleRegenerate = () => {
        // Regenerate = resend the last outbound text; the engine produces a new reply.
        const lastOutbound = messages[lastOutboundIndex];
        if (lastOutbound?.content) sendText(ownEntityId, lastOutbound.content);
    };

    const prefsClass = `chat-detail chat-detail-font-${prefs.fontSize} chat-detail-spacing-${prefs.spacing}`;

    return (
        <div className={prefsClass}>
            {/* Header */}
            <div className="chat-detail-header">
                <button type="button" className="chat-detail-back" onClick={onBack}
                    aria-label={t('chat:conversation.back')}>
                    <ChevronRightIcon className="w-5 h-5 chat-detail-back-icon" />
                </button>
                <div className="chat-detail-headline">
                    <span className="chat-detail-title">
                        {threadName}
                        {threadRow.pinned && <span className="chat-detail-flag" role="img" aria-label={t('chat:list.statusPinned')}>📌</span>}
                        {threadRow.muted && <span className="chat-detail-flag" role="img" aria-label={t('chat:list.statusMuted')}>🔇</span>}
                        {aiDisabled && <span className="chat-detail-flag" role="img" aria-label={t('chat:list.statusDisabled')}>🚫</span>}
                    </span>
                    <span className={`chat-detail-status chat-detail-status-${connectionState}`}>
                        {t(`chat:conversation.connection.${connectionState === 'connected' ? 'connected'
                            : connectionState === 'reconnecting' ? 'reconnecting'
                                : connectionState === 'connecting' ? 'connecting' : 'offline'}`)}
                    </span>
                </div>
                {/* Thread actions — the SAME menu the list rows open, so every
                    action works identically from inside a thread. */}
                <Tooltip content={t('chat:menu.open')}>
                    <button
                        type="button"
                        className={`chat-detail-icon-btn ${menuPosition ? 'text-accent-primary' : ''}`}
                        aria-label={t('chat:menu.open')}
                        aria-haspopup="menu"
                        aria-expanded={!!menuPosition}
                        onClick={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            setMenuPosition(
                                menuPosition ? null : { x: rect.right - 4, y: rect.bottom + 4 }
                            );
                        }}
                    >
                        ⋯
                    </button>
                </Tooltip>
                <ImpersonationSelector personas={personas} value={ownEntityId} onChange={onOwnEntityChange} />
                {showWireInspector && (
                    <Tooltip content={t('chat:wire.toggle')}>
                        <button type="button"
                            className={`chat-detail-icon-btn ${showWire ? 'text-accent-primary' : ''}`}
                            onClick={() => setShowWire((v) => !v)}>
                            <TerminalIcon className="w-5 h-5" />
                        </button>
                    </Tooltip>
                )}
                <Tooltip content={t('chat:preferences.title')}>
                    <button type="button" className="chat-detail-icon-btn"
                        onClick={() => setShowPrefs((v) => !v)}>
                        <SettingsGearIcon className="w-5 h-5" />
                    </button>
                </Tooltip>
            </div>

            <div className={`chat-detail-body ${showWireInspector && showWire ? 'chat-detail-body-with-wire' : ''}`}>
                {/* Developer wire inspector (D7) — Dev mode only. */}
                {showWireInspector && showWire && (
                    <ChatWireInspector
                        frames={wireFrames}
                        onClear={clearWireFrames}
                        onClose={() => setShowWire(false)}
                    />
                )}

                <div className="chat-detail-main">
                {/* Timeline */}
                <div className="chat-timeline" ref={scrollRef} onScroll={handleScroll}>
                    {loadingOlder && (
                        <div className="chat-timeline-loading">
                            <RefreshIcon className="w-4 h-4 animate-spin" />
                            {t('chat:conversation.loadingMessages')}
                        </div>
                    )}
                    {hasMore && !loadingOlder && (
                        <button type="button" className="chat-timeline-load-older" onClick={loadOlderMessages}>
                            {t('chat:conversation.loadOlder')}
                        </button>
                    )}

                    {/* First page in flight: bubble-shaped placeholders. An
                        empty timeline and a not-yet-loaded one are otherwise
                        identical, so the first paint of a busy chat looked
                        like "this conversation has no messages". */}
                    {loadingMessages && messages.length === 0 && (
                        <div className="space-y-2" aria-busy="true">
                            {[62, 44, 74, 52, 38].map((width, index) => (
                                <div
                                    key={index}
                                    className={`flex ${index % 2 === 0 ? 'justify-end' : 'justify-start'}`}
                                >
                                    <Skeleton
                                        className="ui-skeleton-bubble"
                                        width={`${width}%`}
                                        height={index % 3 === 0 ? '3.25rem' : '2.25rem'}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {messages.length === 0 && !loadingOlder && !loadingMessages && (
                        <EmptyState
                            size="compact"
                            icon={MessageIcon}
                            title={t('chat:conversation.noMessages')}
                            description={t('chat:conversation.noMessagesHint')}
                        />
                    )}

                    {messages.map((message, index) => (
                        <div key={message.id}>
                            {index === firstUnreadIndex && <NewMessagesDivider />}
                            <ChatBubble
                                message={message}
                                ownEntityId={ownEntityId}
                                isLast={index === lastOutboundIndex}
                                onEdit={setEditing}
                                onDelete={handleDelete}
                                onRegenerate={handleRegenerate}
                                onReply={setReplyTo}
                                onReact={() => {}}
                                onOpenImage={(msg, url) => setLightbox({ open: true, url })}
                            />
                        </div>
                    ))}

                    {(isTyping || isRecording) && (
                        <TypingIndicator name={conversation.title || partnerId} recording={isRecording} />
                    )}
                    <div ref={bottomRef} />
                </div>

                {showJump && (
                    <button type="button" className="chat-jump-latest" onClick={() => scrollToBottom()}>
                        <ArrowDownIcon className="w-4 h-4" />
                        {t('chat:conversation.jumpToLatest')}
                    </button>
                )}

                {/* Reply banner */}
                {replyTo && (
                    <div className="chat-reply-banner">
                        <span>{t('chat:actions.replyingTo')}: {replyTo.content?.slice(0, 60)}</span>
                        <button type="button" onClick={() => setReplyTo(null)}>
                            {t('chat:actions.cancelReply')}
                        </button>
                    </div>
                )}

                {/* Input — replaced by a banner while the AI partner is
                    disabled (Android parity): a disabled partner cannot reply,
                    so offering a composer would be a lie. Re-enabling is one
                    click, and it is the same entity flag the menu writes. */}
                {aiDisabled ? (
                    <div className="chat-disabled-banner" role="status">
                        <span className="chat-disabled-banner-icon" role="img" aria-label={t('chat:list.statusDisabled')}>🚫</span>
                        <div className="chat-disabled-banner-body">
                            <span className="chat-disabled-banner-title">
                                {t('chat:disabled.title', { name: threadName })}
                            </span>
                            <span className="chat-disabled-banner-hint">
                                {t('chat:disabled.hint')}
                            </span>
                        </div>
                        <button
                            type="button"
                            className="btn-primary chat-disabled-banner-action"
                            onClick={() => setDisabled(partnerId, false)}
                        >
                            {t('chat:disabled.enable')}
                        </button>
                    </div>
                ) : (
                    <ChatInput
                        onSendText={handleSendText}
                        onSendAudio={handleSendAudio}
                        onSendImage={handleSendImage}
                        onSendEmojiAction={handleSendEmojiAction}
                        disabled={connectionState !== 'connected'}
                    />
                )}
                </div>
            </div>

            {/* Overlays */}
            <ChatPreferences
                isOpen={showPrefs}
                replyMode={prefs.replyMode}
                onReplyModeChange={(mode) => { setReplyMode(mode); prefs.setReplyMode(mode); }}
                prefs={prefs}
                onPrefsChange={prefs.updatePrefs}
                onClose={() => setShowPrefs(false)}
            />
            <ImageLightbox
                isOpen={lightbox.open}
                url={lightbox.url}
                onClose={() => setLightbox({ open: false, url: null })}
            />
            <ConfirmDialog
                isOpen={confirmDelete !== null}
                title={t('chat:actions.deleteConfirmTitle')}
                message={t('chat:actions.deleteConfirmMessage')}
                onConfirm={confirmDeleteYes}
                onCancel={() => setConfirmDelete(null)}
            />
            <InputDialog
                isOpen={editing !== null}
                title={t('chat:actions.editTitle')}
                message={t('chat:actions.editTitle')}
                defaultValue={editing?.content || ''}
                onConfirm={handleEditSubmit}
                onCancel={() => setEditing(null)}
            />
            {/* Thread actions. A successful delete drops the row AND closes the
                detail view — onDeleted is what removes the thread whose own
                header opened the menu. */}
            {menuPosition && (
                <ConversationMenu
                    conversation={threadRow}
                    position={menuPosition}
                    name={threadName}
                    onClose={() => setMenuPosition(null)}
                    onDeleted={() => {
                        setMenuPosition(null);
                        onBack?.();
                    }}
                />
            )}
        </div>
    );
};

export default ChatDetailView;
