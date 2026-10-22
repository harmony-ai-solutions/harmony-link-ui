import { create } from 'zustand';
import * as chatReadService from '../services/management/chatReadService.js';
import { ChatSocketService, generateEventId } from '../services/chat/chatSocketService.js';
import {
    mergeMessages,
    prependOlderMessages,
    replaceMessage,
    removeMessage,
    upsertConversation,
    removeConversation,
    mergeConversationPages,
    filterConversationsForPersonas,
    partitionChatEntities,
    setEntityFlag,
    lastMessage,
} from './chatStoreUtils.js';

/**
 * Desktop Chat store (Phase 2-1).
 *
 * Holds the chat-list state, the open conversation's timeline, the live
 * connection state, typing/recording flags and the REST/WebSocket wiring. The
 * pure list logic lives in chatStoreUtils.js (unit-tested with `node --test`);
 * this store is the stateful, service-aware wrapper.
 *
 * Conversation identity: threads are keyed by `participant_key` (the sorted
 * participant set), matching the engine — a membership change mints a NEW
 * interaction, so `interactionId` is a NAVIGATION handle only and all history
 * reads address the participant key (they span every interaction of the key).
 *
 * Chat list: the desktop inbox mirrors the mobile app — it loads the
 * `/chat-list` page of EVERY enabled AI companion (in parallel), merges the
 * rows by `participant_key`, and names/avatars each row by the AI companion
 * that owns it (`conversation.entity_id`). `partner_entity_id` is the persona
 * "user" on a private companion thread and is deliberately NOT the row label.
 *
 * Message perspective: timelines are stored from the AI entity's perspective
 * (sender_entity_id === ownEntityId means "the user/persona spoke"), matching
 * the engine. The UI derives bubble side from messageDirection().
 */

/** Per-entity socket registry (module scope — not reactive state). */
const sockets = new Map();

export const useChatStore = create((set, get) => ({
    // ── State ────────────────────────────────────────────────────────────
    /** Chat-list rows for the inbox (all companions, or one when filtered). */
    conversations: [],
    /**
     * Optional companion filter for the inbox. `null` = "All companions"
     * (the default, app-style merged list); a set id lists just that AI's
     * threads. The detail view is addressed by participant_key either way.
     */
    listEntityId: null,
    /** Chat-entity options: AI partners + personas (from the engine). */
    chatEntities: [],
    /** The open conversation or null. `interactionId` is navigation only. */
    activeConversation: null,
    /** The timeline for the open conversation (oldest → newest). */
    messages: [],
    /** True while an older page is being fetched. */
    loadingOlder: false,
    /** Whether an older page likely exists for the open conversation. */
    hasMore: false,
    /** Opaque engine scrollback cursor for the open conversation (next older page). */
    nextCursor: null,
    /** Connection state of the active socket: idle|connecting|connected|reconnecting|error. */
    connectionState: 'idle',
    /**
     * Rolling log of raw wire frames for the Developer-mode wire inspector
     * (Phase 3, D7). Each entry is `{ direction: 'in'|'out', at, frame }`.
     * Capped so a long session cannot grow without bound.
     */
    wireFrames: [],
    /** entityId → true while that AI entity is typing. */
    typingByEntity: {},
    /** entityId → true while that AI entity is recording audio. */
    recordingByEntity: {},
    /** Last error message, if any. */
    error: null,
    /**
     * Cross-view request: set by the "Start chatting" button on a character
     * card, consumed once by ChatView on mount to open a brand-new chat with
     * that AI partner. Mirrors characterProfileStore.createProfileRequested.
     */
    startChatRequest: null,

    // ── Chat list ────────────────────────────────────────────────────────

    /** Load the entities available for chat (partners + personas). */
    loadChatEntities: async () => {
        try {
            const chatEntities = await chatReadService.listChatEntities();
            set({ chatEntities });
            return chatEntities;
        } catch (error) {
            set({ error: error.message });
            return [];
        }
    },

    /**
     * Load the inbox rows. Without an `entityId` this loads the chat-list of
     * EVERY enabled AI companion in parallel and merges them (one row per
     * participant_key, named by its owning companion) — the app's chat-list
     * semantics. With an `entityId` it lists just that companion's threads
     * (the optional per-companion filter).
     *
     * A failing companion must not blank the inbox: pages settle independently
     * and the error is surfaced only when EVERY page failed.
     *
     * @param {string|null} [entityId] - optional companion filter
     * @returns {Promise<Array<object>>}
     */
    loadConversations: async (entityId = null) => {
        set({ listEntityId: entityId || null, error: null });
        const { partners, personas } = partitionChatEntities(get().chatEntities);
        const ids = entityId ? [entityId] : partners.map((entity) => entity.id);
        if (ids.length === 0) {
            set({ conversations: [] });
            return [];
        }

        const settled = await Promise.allSettled(
            ids.map((id) => chatReadService.listConversations(id))
        );
        const { conversations: merged, failures, total } = mergeConversationPages(settled);
        // Mirror the app inbox: only conversations the user's persona takes
        // part in (a per-companion merge also sees companion↔companion DMs).
        // Rows with an unparseable participant set are kept.
        const conversations = filterConversationsForPersonas(
            merged,
            personas.map((persona) => persona.id)
        );
        const firstFailure = settled.find((result) => result.status === 'rejected');
        set({
            conversations,
            error: total > 0 && failures === total
                ? firstFailure?.reason?.message || 'Failed to load conversations'
                : null,
        });
        return conversations;
    },

    /**
     * Ask the Chat tab to open a brand-new chat with `entityId`. Stashed here
     * (not passed through navigation) because switching tabs unmounts the
     * requesting view and remounts ChatView.
     * @param {string} entityId - the AI partner to talk to.
     */
    requestStartChat: (entityId) => set({ startChatRequest: { entityId } }),

    /** Clear the pending start-chat request (consumed once by ChatView). */
    clearRequestStartChat: () => set({ startChatRequest: null }),

    // ── Open conversation ────────────────────────────────────────────────

    /**
     * Open a conversation: reset the timeline, load the newest page by
     * `participantKey`, mark it read, then open the live socket.
     *
     * `interactionId` is carried for navigation/debug only — a brand-new chat
     * has none yet (the engine resolves it on INIT_ENTITY) and a re-keyed chat
     * resolves the CURRENT interaction for the same participant set.
     *
     * @param {{ interactionId?: string|null, participantKey?: string, entityId: string,
     *   participantIds: string[], replyMode?: string }} conversation
     */
    openConversation: async (conversation) => {
        get().closeSocket();
        set({
            activeConversation: conversation,
            messages: [],
            hasMore: false,
            nextCursor: null,
            typingByEntity: {},
            recordingByEntity: {},
            connectionState: 'idle',
            error: null,
        });

        if (conversation.participantKey) {
            await get().loadInitialMessages(conversation);
            // Badge hygiene: parity's read write is participant_key scoped, the
            // exact same scope as CountUnreadByParticipantKeys. Fire-and-forget
            // so a failed stamp never blocks opening the chat.
            get().markActiveConversationRead();
        }
        await get().connectSocket(conversation);
    },

    /**
     * Load the newest page of messages for the conversation's participant_key.
     * @param {{ entityId: string, participantKey?: string }} conversation
     */
    loadInitialMessages: async (conversation) => {
        const { entityId, participantKey } = conversation || {};
        if (!entityId || !participantKey) return;
        try {
            const { messages, hasMore, nextCursor } = await chatReadService.listMessages(
                entityId,
                participantKey,
                { limit: 50 }
            );
            set({ messages: mergeMessages([], messages), hasMore, nextCursor });
        } catch (error) {
            set({ error: error.message });
        }
    },

    /**
     * Load an older page (scroll-up) and prepend it without losing pages.
     *
     * The engine's `before` cursor is OPAQUE (the raw stored created_at text of
     * the oldest loaded row) — it is passed back verbatim from `nextCursor` and
     * never rebuilt from a parsed timestamp.
     */
    loadOlderMessages: async () => {
        const { activeConversation, messages, hasMore, loadingOlder, nextCursor } = get();
        if (!activeConversation?.participantKey || !activeConversation?.entityId) return;
        if (loadingOlder || !hasMore || !nextCursor) return;
        set({ loadingOlder: true });
        try {
            const { messages: older, hasMore: more, nextCursor: cursor } = await chatReadService.listMessages(
                activeConversation.entityId,
                activeConversation.participantKey,
                { before: nextCursor, limit: 50 }
            );
            set({
                messages: prependOlderMessages(messages, older),
                hasMore: more,
                nextCursor: cursor,
                loadingOlder: false,
            });
        } catch (error) {
            set({ error: error.message, loadingOlder: false });
        }
    },

    /**
     * Mark the open conversation read (participant_key scoped) and clear its
     * local unread badge optimistically. Re-reads converge on the next
     * loadConversations().
     */
    markActiveConversationRead: async ({ upToMessageId } = {}) => {
        const { activeConversation, conversations } = get();
        const { entityId, participantKey } = activeConversation || {};
        if (!entityId || !participantKey) return;
        const existing = conversations.find((c) => c.participant_key === participantKey);
        if (existing && existing.unread_count > 0) {
            set({ conversations: upsertConversation(conversations, { ...existing, unread_count: 0 }) });
        }
        try {
            await chatReadService.markConversationRead(entityId, participantKey, { upToMessageId });
        } catch (error) {
            // The badge re-syncs from the engine on the next list load.
            set({ error: error.message });
        }
    },

    // ── Live socket ──────────────────────────────────────────────────────

    /** Open the WebSocket for the open conversation and wire its events. */
    connectSocket: async (conversation) => {
        const key = conversation.entityId;
        const existing = sockets.get(key);
        if (existing) existing.disconnect();

        const socket = new ChatSocketService();
        socket.onEvent((type, payload) => get().handleSocketEvent(type, payload));
        // Raw-frame tap for the Developer wire inspector (D7) — captures every
        // frame (including heartbeat PONGs) verbatim.
        socket.onFrame((direction, frame) => get().pushWireFrame(direction, frame));
        sockets.set(key, socket);

        set({ connectionState: 'connecting' });
        try {
            await socket.connect({
                entityId: conversation.entityId,
                participantIds: conversation.participantIds?.length
                    ? conversation.participantIds
                    : [conversation.entityId],
                replyMode: conversation.replyMode || 'instant',
            });
            set({ connectionState: 'connected' });
        } catch (error) {
            set({ connectionState: 'error', error: error.message });
        }
    },

    /** Close the socket for the open conversation. */
    closeSocket: () => {
        const { activeConversation } = get();
        if (!activeConversation) return;
        const socket = sockets.get(activeConversation.entityId);
        if (socket) {
            socket.disconnect();
            sockets.delete(activeConversation.entityId);
        }
        set({ connectionState: 'idle' });
    },

    /** Record one raw wire frame for the Developer wire inspector (D7). */
    pushWireFrame: (direction, frame) => {
        const next = [...get().wireFrames, { direction, at: Date.now(), frame }];
        // Keep only the most recent 200 frames.
        set({ wireFrames: next.length > 200 ? next.slice(next.length - 200) : next });
    },

    /** Clear the captured wire frames. */
    clearWireFrames: () => set({ wireFrames: [] }),

    /** Route an inbound socket event into state. */
    handleSocketEvent: (type, payload) => {
        // NOTE: raw frames are captured by the socket's onFrame tap (D7), not
        // here — capturing 'event' frames in both places would duplicate them.
        if (type === 'connected') {
            set({ connectionState: 'connected' });
            return;
        }
        if (type === 'disconnected') {
            set({ connectionState: 'reconnecting' });
            return;
        }
        if (type === 'reconnecting') {
            set({ connectionState: 'reconnecting' });
            return;
        }
        if (type === 'error') {
            set({ error: payload?.message || 'Connection error' });
            return;
        }
        if (type !== 'event' || !payload) return;

        const eventType = payload.event_type;
        const data = payload.payload || {};

        // INIT_ENTITY resolves the canonical interaction id (critical for a new
        // chat, where we opened with interactionId = null). It is kept as a
        // NAVIGATION handle only — the timeline and scrollback are addressed by
        // the conversation's participant_key, never by the interaction id.
        if (eventType === 'INIT_ENTITY' && payload.status === 'SUCCESS' && data.interaction_id) {
            const current = get().activeConversation;
            if (current && current.interactionId !== data.interaction_id) {
                set({ activeConversation: { ...current, interactionId: data.interaction_id } });
            }
            return;
        }

        switch (eventType) {
            case 'AI_UTTERANCE':
            case 'AI_SPEECH':
            case 'ENTITY_UTTERANCE': {
                // The engine returns the persisted message with an id; append it.
                const message = normalizeIncomingMessage(data);
                if (message) {
                    set({ messages: mergeMessages(get().messages, message) });
                }
                // An inbound utterance clears the typing flag for that entity.
                if (data.entity_id) {
                    set({ typingByEntity: setEntityFlag(get().typingByEntity, data.entity_id, false) });
                }
                break;
            }
            case 'ENTITY_UTTERANCE_EDIT': {
                const edited = normalizeIncomingMessage(data);
                if (edited) {
                    set({ messages: replaceMessage(get().messages, edited) });
                }
                break;
            }
            case 'TYPING_INDICATOR': {
                const id = data.entity_id || get().activeConversation?.entityId;
                if (id) {
                    set({ typingByEntity: setEntityFlag(get().typingByEntity, id, !!data.is_typing) });
                }
                break;
            }
            case 'RECORDING_INDICATOR': {
                const id = data.entity_id || get().activeConversation?.entityId;
                if (id) {
                    set({ recordingByEntity: setEntityFlag(get().recordingByEntity, id, !!data.is_recording) });
                }
                break;
            }
            case 'STT_OUTPUT_TEXT': {
                // Transcribed voice note: patch the message's content in place.
                if (data.message_id) {
                    set({
                        messages: replaceMessage(get().messages, {
                            id: data.message_id,
                            content: data.content || '',
                        }),
                    });
                }
                break;
            }
            default:
                break;
        }
    },

    // ── Sending ──────────────────────────────────────────────────────────

    /**
     * Send a text message. `ownEntityId` is the persona to speak as.
     * @param {string} ownEntityId
     * @param {string} content
     * @param {{ replyToMessageId?: string, additionalEffects?: object }} [options]
     */
    sendText: (ownEntityId, content, { replyToMessageId, additionalEffects } = {}) => {
        const { activeConversation } = get();
        if (!activeConversation || !content?.trim()) return false;
        const socket = sockets.get(activeConversation.entityId);
        if (!socket) return false;

        // Optimistic append: the engine persists the user's message but does NOT
        // echo it back over the socket for web sessions, so the timeline must add
        // it locally or the sent message never appears. A later REST refresh
        // replaces this row with the engine's canonical copy.
        const messageId = generateEventId();
        const now = new Date().toISOString();
        const optimistic = {
            id: messageId,
            entity_id: activeConversation.entityId,
            sender_entity_id: ownEntityId,
            interaction_id: activeConversation.interactionId || '',
            content,
            message_type: 'text',
            has_audio: false,
            has_image: false,
            is_edited: false,
            is_pinned: false,
            is_read: true,
            reply_to_message_id: replyToMessageId || '',
            created_at: now,
            updated_at: now,
        };
        set({ messages: mergeMessages(get().messages, optimistic) });

        const ok = socket.sendText({
            entityId: ownEntityId,
            content,
            messageId,
            replyToMessageId,
            additionalEffects,
        });
        if (!ok) {
            // Socket was not open — roll back the optimistic row.
            set({ messages: removeMessage(get().messages, messageId) });
        }
        return ok;
    },

    /**
     * Send a voice note (base64 audio, no data-URL prefix).
     * @param {string} ownEntityId
     * @param {{ audioBase64: string, mimeType: string, duration?: number }} audio
     */
    sendAudio: (ownEntityId, { audioBase64, mimeType, duration }) => {
        const { activeConversation } = get();
        if (!activeConversation) return false;
        const socket = sockets.get(activeConversation.entityId);
        if (!socket) return false;
        return socket.sendAudio({ entityId: ownEntityId, audioBase64, mimeType, duration });
    },

    /**
     * Send an image message (base64, no data-URL prefix).
     * @param {string} ownEntityId
     * @param {{ imageBase64: string, mimeType: string, caption?: string }} image
     */
    sendImage: (ownEntityId, { imageBase64, mimeType, caption }) => {
        const { activeConversation } = get();
        if (!activeConversation) return false;
        const socket = sockets.get(activeConversation.entityId);
        if (!socket) return false;
        return socket.sendImage({ entityId: ownEntityId, imageBase64, mimeType, caption });
    },

    /**
     * Edit a previously sent message (F9).
     * @param {string} ownEntityId
     * @param {string} messageId
     * @param {string} content
     */
    editMessage: (ownEntityId, messageId, content) => {
        const { activeConversation } = get();
        if (!activeConversation) return false;
        const socket = sockets.get(activeConversation.entityId);
        if (!socket) return false;
        const ok = socket.sendEdit({ messageId, entityId: ownEntityId, content });
        if (ok) {
            set({ messages: replaceMessage(get().messages, { id: messageId, content, is_edited: true }) });
        }
        return ok;
    },

    /** Remove a message from the local timeline (soft delete / tombstone). */
    deleteMessageLocal: (messageId) => {
        set({ messages: removeMessage(get().messages, messageId) });
    },

    /** Change the conversation's reply mode (F10). */
    setReplyMode: (mode) => {
        const { activeConversation } = get();
        if (!activeConversation) return false;
        const socket = sockets.get(activeConversation.entityId);
        if (!socket) return false;
        return socket.setReplyMode(mode);
    },

    // ── Chat-list maintenance ────────────────────────────────────────────

    /**
     * Reorder/update a chat row when a message arrives for it.
     * @param {string} participantKey - the conversation identity
     */
    touchConversation: (participantKey, patch = {}) => {
        const existing = get().conversations.find((c) => c.participant_key === participantKey);
        if (!existing) return;
        set({ conversations: upsertConversation(get().conversations, { ...existing, ...patch }) });
    },

    /** Drop a conversation from the list (delete thread). */
    dropConversation: (participantKey) => {
        set({ conversations: removeConversation(get().conversations, participantKey) });
    },

    /** The newest message of the open timeline (helper for the UI). */
    latestMessage: () => lastMessage(get().messages),

    /** Reset all chat state (on leaving the chat tab). */
    reset: () => {
        get().closeSocket();
        set({
            conversations: [],
            listEntityId: null,
            activeConversation: null,
            messages: [],
            loadingOlder: false,
            hasMore: false,
            nextCursor: null,
            connectionState: 'idle',
            typingByEntity: {},
            recordingByEntity: {},
            wireFrames: [],
            error: null,
        });
    },
}));

/**
 * Normalise a socket utterance payload into a timeline message. The engine
 * sends either the full persisted row (has `id`) or a lightweight utterance
 * (has `message_id`); both are mapped to the REST `chatMessage` shape.
 */
function normalizeIncomingMessage(data) {
    if (!data) return null;
    const id = data.id || data.message_id;
    if (!id) return null;
    const createdAt = data.created_at || new Date().toISOString();
    return {
        id,
        entity_id: data.entity_id || '',
        sender_entity_id: data.sender_entity_id || data.entity_id || '',
        interaction_id: data.interaction_id || '',
        content: data.content || '',
        message_type: data.message_type || 'text',
        audio_duration: data.audio_duration || 0,
        has_audio: !!(data.audio || data.audio_data),
        audio_mime_type: data.audio_type || data.audio_mime_type || '',
        has_image: !!(data.image_data || data.image_base64),
        image_mime_type: data.image_mime_type || '',
        is_edited: !!data.is_edited,
        edit_of_message_id: data.edit_of_message_id || '',
        reply_to_message_id: data.reply_to_message_id || '',
        reactions_json: data.reactions_json || '',
        is_pinned: !!data.is_pinned,
        is_read: data.is_read === true,
        created_at: createdAt,
        updated_at: data.updated_at || createdAt,
    };
}

export default useChatStore;
