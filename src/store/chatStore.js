import { create } from 'zustand';
import * as chatService from '../services/management/chatService.js';
import { ChatSocketService, generateEventId } from '../services/chat/chatSocketService.js';
import {
    mergeMessages,
    prependOlderMessages,
    replaceMessage,
    removeMessage,
    upsertConversation,
    removeConversation,
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
 * Message perspective: timelines are stored from the AI entity's perspective
 * (sender_entity_id === ownEntityId means "the user/persona spoke"), matching
 * the engine. The UI derives bubble side from messageDirection().
 */

/** Per-entity socket registry (module scope — not reactive state). */
const sockets = new Map();

export const useChatStore = create((set, get) => ({
    // ── State ────────────────────────────────────────────────────────────
    /** Chat-list rows for the selected AI entity. */
    conversations: [],
    /** Entity id whose threads are currently listed. */
    listEntityId: null,
    /** Chat-entity options: AI partners + personas (from the engine). */
    chatEntities: [],
    /** The open conversation (interaction) or null. */
    activeConversation: null,
    /** The timeline for the open conversation (oldest → newest). */
    messages: [],
    /** True while an older page is being fetched. */
    loadingOlder: false,
    /** Whether an older page likely exists for the open conversation. */
    hasMore: false,
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

    // ── Chat list ────────────────────────────────────────────────────────

    /** Load the entities available for chat (partners + personas). */
    loadChatEntities: async () => {
        try {
            const chatEntities = await chatService.listChatEntities();
            set({ chatEntities });
            return chatEntities;
        } catch (error) {
            set({ error: error.message });
            return [];
        }
    },

    /** Load the chat-list rows for an AI entity. */
    loadConversations: async (entityId) => {
        set({ listEntityId: entityId, error: null });
        try {
            const conversations = await chatService.listConversations(entityId);
            set({ conversations });
            return conversations;
        } catch (error) {
            set({ error: error.message });
            return [];
        }
    },

    // ── Open conversation ────────────────────────────────────────────────

    /**
     * Open a conversation: reset the timeline, load the newest page, then open
     * the live socket.
     *
     * @param {{ interactionId: string, entityId: string, participantIds: string[],
     *   replyMode?: string }} conversation
     */
    openConversation: async (conversation) => {
        get().closeSocket();
        set({
            activeConversation: conversation,
            messages: [],
            hasMore: false,
            typingByEntity: {},
            recordingByEntity: {},
            connectionState: 'idle',
            error: null,
        });

        if (conversation.interactionId) {
            await get().loadInitialMessages(conversation.interactionId);
        }
        await get().connectSocket(conversation);
    },

    /** Load the newest page of messages for an interaction. */
    loadInitialMessages: async (interactionId) => {
        try {
            const { messages, hasMore } = await chatService.listMessages(interactionId, { limit: 50 });
            set({ messages: mergeMessages([], messages), hasMore });
        } catch (error) {
            set({ error: error.message });
        }
    },

    /** Load an older page (scroll-up) and prepend it without losing pages. */
    loadOlderMessages: async () => {
        const { activeConversation, messages, hasMore, loadingOlder } = get();
        if (!activeConversation?.interactionId || loadingOlder || !hasMore) return;
        const oldest = messages[0];
        if (!oldest) return;
        set({ loadingOlder: true });
        try {
            const { messages: older, hasMore: more } = await chatService.listMessages(
                activeConversation.interactionId,
                { before: oldest.created_at, limit: 50 }
            );
            set({ messages: prependOlderMessages(messages, older), hasMore: more, loadingOlder: false });
        } catch (error) {
            set({ error: error.message, loadingOlder: false });
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
        // chat, where we opened with interactionId = null). Persist it so later
        // REST refreshes and pagination target the right thread.
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

    /** Reorder/update the chat list when a message arrives for a thread. */
    touchConversation: (interactionId, patch = {}) => {
        const existing = get().conversations.find((c) => c.interaction_id === interactionId);
        if (!existing) return;
        set({ conversations: upsertConversation(get().conversations, { ...existing, ...patch }) });
    },

    /** Drop a conversation from the list (delete thread). */
    dropConversation: (interactionId) => {
        set({ conversations: removeConversation(get().conversations, interactionId) });
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
