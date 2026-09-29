import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ChevronRightIcon, ArrowDownIcon, SettingsGearIcon, RefreshIcon, TerminalIcon,
} from '../../constants/icons.jsx';
import useChatStore from '../../store/chatStore.js';
import { messageDirection, isUnreadInbound } from '../../store/chatStoreUtils.js';
import useChatPrefsStore from '../../store/chatPrefsStore.js';
import ChatBubble from './ChatBubble.jsx';
import ChatInput from './ChatInput.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import NewMessagesDivider from './NewMessagesDivider.jsx';
import ImageLightbox from './ImageLightbox.jsx';
import ChatPreferences from './ChatPreferences.jsx';
import ImpersonationSelector from './ImpersonationSelector.jsx';
import ChatWireInspector from './ChatWireInspector.jsx';
import ConfirmDialog from '../modals/ConfirmDialog.jsx';
import InputDialog from '../modals/InputDialog.jsx';
import useUIModeStore, { isModeAllowed } from '../../store/uiModeStore.js';

/**
 * Chat detail screen (F2): the scrolling message timeline, typing dots (F5),
 * the "new messages" divider (F6), the input box (F4) and the message action
 * flows (F9 / F13 / F14). Windowing keeps thousands of messages fast.
 */
const ChatDetailView = ({ conversation, ownEntityId, personas, onBack, onOwnEntityChange }) => {
    const { t } = useTranslation();
    const messages = useChatStore((s) => s.messages);
    const hasMore = useChatStore((s) => s.hasMore);
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

    const scrollRef = useRef(null);
    const bottomRef = useRef(null);

    const partnerId = conversation.entityId;
    const isTyping = !!typingByEntity[partnerId];
    const isRecording = !!recordingByEntity[partnerId];

    // Auto-scroll to the newest message.
    const scrollToBottom = useCallback((behavior = 'smooth') => {
        bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
    }, []);

    useEffect(() => {
        scrollToBottom('auto');
    }, [conversation.interactionId]);

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
        if (confirmDelete) deleteMessageLocal(confirmDelete.id);
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
                    <span className="chat-detail-title">{conversation.title || partnerId}</span>
                    <span className={`chat-detail-status chat-detail-status-${connectionState}`}>
                        {t(`chat:conversation.connection.${connectionState === 'connected' ? 'connected'
                            : connectionState === 'reconnecting' ? 'reconnecting'
                                : connectionState === 'connecting' ? 'connecting' : 'offline'}`)}
                    </span>
                </div>
                <ImpersonationSelector personas={personas} value={ownEntityId} onChange={onOwnEntityChange} />
                {showWireInspector && (
                    <button type="button"
                        className={`chat-detail-icon-btn ${showWire ? 'text-accent-primary' : ''}`}
                        title={t('chat:wire.toggle')}
                        onClick={() => setShowWire((v) => !v)}>
                        <TerminalIcon className="w-5 h-5" />
                    </button>
                )}
                <button type="button" className="chat-detail-icon-btn" title={t('chat:preferences.title')}
                    onClick={() => setShowPrefs((v) => !v)}>
                    <SettingsGearIcon className="w-5 h-5" />
                </button>
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

                    {messages.length === 0 && !loadingOlder && (
                        <p className="chat-timeline-empty">{t('chat:conversation.noMessages')}</p>
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

                {/* Input */}
                <ChatInput
                    onSendText={handleSendText}
                    onSendAudio={handleSendAudio}
                    onSendImage={handleSendImage}
                    onSendEmojiAction={handleSendEmojiAction}
                    disabled={connectionState !== 'connected'}
                />
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
        </div>
    );
};

export default ChatDetailView;
