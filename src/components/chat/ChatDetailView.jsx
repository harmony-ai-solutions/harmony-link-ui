import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ChevronRightIcon, ArrowDownIcon, SettingsGearIcon, RefreshIcon, TerminalIcon,
} from '../../constants/icons.jsx';
import useChatStore from '../../store/chatStore.js';
import {
    messageDirection,
    isUnreadInbound,
    deriveParticipantKey,
    buildDayDividers,
    timelineWindow,
    slideWindowEnd,
    entityAlternateGreetings,
    isGreetingOpening,
    TIMELINE_RENDER_LIMIT,
    TIMELINE_PAGE,
} from '../../store/chatStoreUtils.js';
import useChatPrefsStore from '../../store/chatPrefsStore.js';
import ChatBubble from './ChatBubble.jsx';
import ChatInput from './ChatInput.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import NewMessagesDivider from './NewMessagesDivider.jsx';
import DayDivider from './DayDivider.jsx';
import GreetingAlternates from './GreetingAlternates.jsx';
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
    const deleteMessage = useChatStore((s) => s.deleteMessage);
    const toggleReaction = useChatStore((s) => s.toggleReaction);
    const setMessagePinned = useChatStore((s) => s.setMessagePinned);
    const requestForward = useChatStore((s) => s.requestForward);
    const setReplyMode = useChatStore((s) => s.setReplyMode);
    const loadOlderMessages = useChatStore((s) => s.loadOlderMessages);
    const sendGreetingAlternate = useChatStore((s) => s.sendGreetingAlternate);

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
    /**
     * Id of the NEWEST rendered message (Task 02-7 step 4). `null` = follow the
     * live tail.
     *
     * The timeline mounts at most `TIMELINE_RENDER_LIMIT` bubbles instead of
     * every loaded one, which is Android's own cap and costs nothing:
     * virtualization was deliberately not added (see the task note), because a
     * bounded window plus the scroll anchor below removes the stutter a
     * 500-message thread produced without a new dependency.
     */
    const [renderEndId, setRenderEndId] = useState(null);
    /**
     * Bumped at local midnight so "Today"/"Yesterday" labels re-evaluate even
     * when no message arrives. Without it a window left open overnight keeps
     * calling yesterday's messages "Today".
     */
    const [dayTick, setDayTick] = useState(0);

    const scrollRef = useRef(null);
    const bottomRef = useRef(null);
    /**
     * Scroll anchor for pagination (Task 02-7 step 5).
     *
     * `before` is captured AFTER every commit; on the next commit the same
     * message is located again and `scrollTop` is shifted by however far its
     * top moved. That keeps the reader's place when older pages PREPEND (the
     * whole reason "load older" used to jump) and also when the render window
     * slides in either direction.
     */
    const anchorRef = useRef({ firstId: '', lastId: '', firstTop: null, lastTop: null, scrollTop: 0 });
    const restoringAnchorRef = useRef(false);

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

    /**
     * The character's AUTHORED alternate greetings (Task 02-7 step 3).
     *
     * Read from `chatEntities`, which ChatView already loaded — the field rides on
     * the chat-entity option (`listChatEntities` lifts it from the nested
     * profile), so showing the control costs no extra request.
     */
    const alternateGreetings = useMemo(
        () => entityAlternateGreetings(chatEntities.find((item) => item.id === partnerId)),
        [chatEntities, partnerId]
    );

    /**
     * True while the thread is still in its opening state: the character greeted
     * and the user has not spoken. Only then is "try another greeting" meaningful
     * — once a turn has happened the greeting is history, and offering to replace
     * it would be a lie.
     */
    const greetingOpening = useMemo(
        () => isGreetingOpening(messages, ownEntityId),
        [messages, ownEntityId]
    );
    const showGreetingAlternates = greetingOpening
        && alternateGreetings.length > 1
        && !aiDisabled;

    /**
     * Scroll to the newest message.
     *
     * The render window is RESET first: while it is slid back the newest messages
     * are not mounted, so scrolling would land on the last MOUNTED row instead of
     * the real tail. Clearing it re-follows the live tail, which is also what the
     * "jump to latest" button means.
     */
    const scrollToBottom = useCallback((behavior = 'smooth') => {
        setRenderEndId(null);
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

    // ── Timeline window (Task 02-7 step 4) ───────────────────────────────

    /**
     * The slice of the loaded timeline that is actually mounted.
     *
     * `renderEndId === null` means "follow the tail", which is the normal state
     * for an open, live conversation. It is set to an id only when the user has
     * scrolled back past the window (see `handleScroll`), so browsing history
     * never unmounts the messages being read.
     */
    const renderWindow = useMemo(
        () => timelineWindow(messages, renderEndId, TIMELINE_RENDER_LIMIT),
        [messages, renderEndId]
    );
    const visibleMessages = useMemo(
        () => messages.slice(renderWindow.start, renderWindow.end),
        [messages, renderWindow.start, renderWindow.end]
    );
    /** Messages loaded but not mounted above the window. */
    const hiddenOlder = renderWindow.start;

    /**
     * One day-divider descriptor per VISIBLE message (index-aligned).
     *
     * Computing it over the visible slice — not the whole timeline — keeps the
     * first row of a slid window labelled even when its real predecessor is
     * mounted-out. `dayTick` is a dependency so a page left open across
     * midnight re-labels "Today" without waiting for a message.
     */
    const dayDividers = useMemo(
        () => buildDayDividers(visibleMessages, new Date()),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [visibleMessages, dayTick]
    );

    /**
     * Re-label at local midnight.
     *
     * A chat left open overnight would otherwise keep calling yesterday "Today"
     * until something else re-rendered the list. The timeout targets the NEXT
     * local midnight (+1s of slack) and reschedules itself, so it also survives
     * DST shifts correctly.
     */
    useEffect(() => {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 1, 0);
        const delay = Math.max(1000, midnight.getTime() - now.getTime());
        const timer = setTimeout(() => setDayTick((tick) => tick + 1), delay);
        return () => clearTimeout(timer);
    }, [dayTick]);

    /**
     * Scroll anchor (Task 02-7 step 5).
     *
     * Runs in `useLayoutEffect` — BEFORE the browser paints — so the correction
     * is never visible. Two things move the content under the reader:
     *
     *   1. an older page PREPENDS (scrollTop would stay put, so the whole list
     *      would appear to jump down by the height of the new page);
     *   2. the render window SLIDES (rows leave one edge and enter the other).
     *
     * Both are handled the same way: remember the first and last rendered
     * message with their `offsetTop`, then on the next commit find the same
     * message and apply the delta. Anchoring on TWO messages (not one) is what
     * makes it correct when the anchored message itself leaves the window — the
     * other end still resolves the shift.
     *
     * `restoringAnchorRef` guards the correction from re-entering this effect
     * through the scroll event it fires.
     */
    useLayoutEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const first = visibleMessages[0];
        const last = visibleMessages[visibleMessages.length - 1];

        /**
         * A message's offset INSIDE the scrolled content, in pixels.
         *
         * `offsetTop` is the obvious choice and the wrong one: it is measured
         * from the nearest POSITIONED ancestor, and `.chat-timeline` is not
         * positioned, so the value would jump whenever anything up the tree
         * changed. `rect.top - containerRect.top + scrollTop` is the same number
         * expressed in the scroll container's own coordinate space, which is
         * exactly what `scrollTop` is measured in.
         */
        const findTop = (id) => {
            if (!id) return null;
            const node = el.querySelector(`[data-message-id="${CSS.escape(id)}"]`);
            if (!node) return null;
            return node.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
        };

        const previous = anchorRef.current;

        if (!restoringAnchorRef.current && previous.firstId) {
            const prevFirstTop = findTop(previous.firstId);
            const prevLastTop = findTop(previous.lastId);
            let delta = null;
            if (prevFirstTop !== null && previous.firstTop !== null) {
                delta = prevFirstTop - previous.firstTop;
            } else if (prevLastTop !== null && previous.lastTop !== null) {
                delta = prevLastTop - previous.lastTop;
            }
            if (delta) {
                restoringAnchorRef.current = true;
                el.scrollTop += delta;
                restoringAnchorRef.current = false;
            }
        }

        anchorRef.current = {
            firstId: first?.id || '',
            lastId: last?.id || '',
            firstTop: findTop(first?.id),
            lastTop: findTop(last?.id),
            scrollTop: el.scrollTop,
        };
    }, [visibleMessages, renderWindow.start, renderWindow.end]);

    /**
     * Index (within the VISIBLE slice) of the first unread inbound message, for
     * the "new messages" divider. Indices are slice-relative because that is
     * what the render loop iterates — a timeline-relative index would place the
     * divider one screenful off once the window has slid.
     */
    const firstUnreadIndex = useMemo(() => {
        for (let i = 0; i < visibleMessages.length; i += 1) {
            if (isUnreadInbound(visibleMessages[i], ownEntityId)) return i;
        }
        return -1;
    }, [visibleMessages, ownEntityId]);

    const lastOutboundIndex = useMemo(() => {
        for (let i = visibleMessages.length - 1; i >= 0; i -= 1) {
            if (messageDirection(visibleMessages[i], ownEntityId) === 'out') return i;
        }
        return -1;
    }, [visibleMessages, ownEntityId]);

    /**
     * Scroll handler: pagination trigger, window sliding and the jump button.
     *
     * The render window SLIDES toward older messages when the reader reaches the
     * top of the mounted slice, so a long scrollback stays bounded. It slides
     * back toward the tail on the way down and drops to `null` (follow the live
     * tail) once the tail is inside the window, which is what re-arms the
     * auto-scroll for new messages.
     *
     * Sliding in `TIMELINE_PAGE` steps rather than per pixel matters: a per-pixel
     * slide would unmount and remount rows on every scroll event.
     */
    const handleScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        if (el.scrollTop < 120 && hasMore && !loadingOlder) {
            loadOlderMessages();
        }
        if (el.scrollTop < 48 && renderWindow.start > 0) {
            setRenderEndId((current) => slideWindowEnd(messages, current, -TIMELINE_PAGE));
        } else {
            const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            if (distanceToBottom < 48 && renderEndId) {
                setRenderEndId((current) => slideWindowEnd(messages, current, TIMELINE_PAGE));
            }
        }
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
        setShowJump(!nearBottom);
    };

    /**
     * Auto-scroll on a new message — only when the reader is already at the
     * bottom, and keyed on the MOUNTED length.
     *
     * `visibleMessages.length` rather than `messages.length` is the whole point:
     * prepending an older page changes the second and not the first, so
     * pagination in the background can no longer yank the view to the bottom
     * (which is what made "load older" jump before the anchor existed).
     */
    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
        if (nearBottom) scrollToBottom('smooth');
        else setShowJump(true);
    }, [visibleMessages.length]);

    const handleSendText = (text) => {
        sendText(ownEntityId, text, { replyToMessageId: replyTo?.id });
        setReplyTo(null);
    };

    /**
     * Send a chosen alternate greeting as the user's opening message.
     *
     * The chosen text goes through the ordinary text path, so the bubble appears
     * optimistically, the engine persists it and the partner answers it like any
     * first message. No engine greeting path is involved — see
     * `chatStore.sendGreetingAlternate` for why the authored alternates cannot be
     * delivered as a `message_type = 'greeting'` row.
     */
    const handleSendGreetingAlternate = (text) => sendGreetingAlternate(ownEntityId, text);

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

    /**
     * Delete a message: confirm, then ask the ENGINE, then drop the row.
     *
     * The store removes the message only after the engine accepted the
     * tombstone, so a failure leaves the timeline exactly as it was (and toasts
     * the reason). The confirm dialog is kept — this is still destructive.
     */
    const handleDelete = (message) => setConfirmDelete(message);
    const confirmDeleteYes = () => {
        if (confirmDelete) deleteMessage(confirmDelete.id);
        setConfirmDelete(null);
    };

    /**
     * Toggle one reaction on a message (menu strip or an existing chip).
     *
     * The emoji is REQUIRED — the old handler was `onReact={() => {}}` and the
     * bubble could not tell which emoji was tapped.
     */
    const handleReact = (message, emoji) => {
        if (!message?.id || !emoji) return;
        toggleReaction(message.id, emoji);
    };

    /** Pin/unpin one message. A pin shows a 📌 marker; the order is unchanged. */
    const handleTogglePin = (message, pinned) => {
        if (!message?.id) return;
        setMessagePinned(message.id, pinned);
    };

    /**
     * Start a forward: the picker lives in ChatView (it needs the partner list
     * and must survive this view unmounting when the target thread opens), so
     * this only records the intent in the store.
     */
    const handleForward = (message) => {
        const content = (message?.content || '').trim();
        if (!content) return;
        requestForward({ content, fromTitle: threadName });
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

                    {/* Loaded but not mounted: the render window has slid back.
                        Reveals another page worth of rows. The scroll anchor keeps
                        the reader's place across the swap, so this does not jump. */}
                    {hiddenOlder > 0 && (
                        <button
                            type="button"
                            className="chat-timeline-load-older chat-timeline-show-older"
                            onClick={() => setRenderEndId((current) => slideWindowEnd(
                                messages, current, -TIMELINE_PAGE
                            ))}
                        >
                            {t('chat:conversation.showOlder', { count: Math.min(TIMELINE_PAGE, hiddenOlder) })}
                        </button>
                    )}

                    {visibleMessages.map((message, index) => (
                        <div key={message.id} data-message-id={message.id}>
                            {dayDividers[index] && <DayDivider info={dayDividers[index]} />}
                            {index === firstUnreadIndex && <NewMessagesDivider />}
                            <ChatBubble
                                message={message}
                                ownEntityId={ownEntityId}
                                isLast={index === lastOutboundIndex}
                                /* The quote fallback needs the parent's text for
                                   a reply whose server preview has not arrived
                                   yet (a just-sent message). */
                                timeline={messages}
                                onEdit={setEditing}
                                onDelete={handleDelete}
                                onReply={setReplyTo}
                                onReact={handleReact}
                                onForward={handleForward}
                                onTogglePin={handleTogglePin}
                                onOpenImage={(msg, url) => setLightbox({ open: true, url })}
                            />
                        </div>
                    ))}

                    {/* "Try another greeting" (Task 02-7 step 3). Only while the
                        thread is still opening — the character has greeted and the
                        user has not spoken. It sits below the timeline rather than
                        attached to the bubble because it acts on the OPENING, not
                        on the message: sending one ends the opening for good. */}
                    {showGreetingAlternates && (
                        <GreetingAlternates
                            greetings={alternateGreetings}
                            onSend={handleSendGreetingAlternate}
                            disabled={connectionState !== 'connected'}
                        />
                    )}

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
