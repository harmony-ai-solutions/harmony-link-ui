import { create } from 'zustand';
import * as chatReadService from '../services/management/chatReadService.js';
import * as chatActionService from '../services/management/chatActionService.js';
import { setEntityDisabled as setEntityDisabledRequest } from '../services/management/entityService.js';
import { ChatSocketService, generateEventId } from '../services/chat/chatSocketService.js';
import {
    mergeMessages,
    prependOlderMessages,
    replaceMessage,
    removeMessage,
    removeConversation,
    setEntityFlag,
    lastMessage,
} from './chatStoreUtils.js';
import { insertByInboxOrder, moveConversation } from './inboxUtils.js';
import { announceConversationAction } from './conversationActions.js';
import { toast } from './toastStore.js';
import { translate } from '../i18n/translate.js';

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
 * Chat list: the desktop inbox IS the mobile inbox — ONE request
 * (`GET /api/entities/chat-list`) returns every active thread across all
 * companions, already deduped by `participant_key`, flagged (pinned / archived
 * / muted / disabled) and ordered `pinned DESC, last_activity_at DESC` in SQL.
 * Each row is named and avatar'd by the AI companion that owns it
 * (`conversation.entity_id`); `partner_entity_id` is the persona "user" on a
 * private companion thread and is deliberately NOT the row label.
 *
 * Ordering is never recomputed here: live updates patch rows in place, so a
 * thread cannot jump under the pointer between loads.
 *
 * Message perspective: timelines are stored from the AI entity's perspective
 * (sender_entity_id === ownEntityId means "the user/persona spoke"), matching
 * the engine. The UI derives bubble side from messageDirection().
 */

/** Per-entity socket registry (module scope — not reactive state). */
const sockets = new Map();

/**
 * Patch one inbox row in place (by participant_key) across BOTH list arrays.
 *
 * The inbox is two arrays — `conversations` (active) and
 * `archivedConversations` — because the engine returns them separately, and a
 * row can move between them when it is archived/unarchived. Every mutation has
 * to address both or a flag change on an archived thread would be lost.
 *
 * The incoming order is preserved (no re-sort): the engine owns the ordering
 * (`pinned DESC, last_activity_at DESC`) and re-sorting here would make a row
 * jump while the user is reading it.
 *
 * @param {Array<object>} rows
 * @param {object} patch - the replacement row (matched by participant_key)
 * @returns {Array<object>} the same array when nothing matched
 */
function patchConversation(rows, patch) {
    const key = patch?.participant_key;
    if (!key) return rows;
    const index = (rows || []).findIndex((row) => row.participant_key === key);
    if (index === -1) return rows;
    const next = rows.slice();
    next[index] = { ...next[index], ...patch };
    return next;
}

/**
 * Snapshot the two inbox arrays before an optimistic mutation.
 *
 * Rollback restores the SNAPSHOT rather than flipping the flag back, because
 * archive/unarchive MOVES a row between arrays: "undo" has to put the row back
 * in the array it came from, with the flags it had, or the failure path becomes
 * a second mutation of its own.
 */
function snapshotInbox(state) {
    return {
        conversations: state.conversations,
        archivedConversations: state.archivedConversations,
    };
}

/** Restore an inbox snapshot taken by {@link snapshotInbox}. */
function restoreInbox(set, snapshot) {
    set({
        conversations: snapshot.conversations,
        archivedConversations: snapshot.archivedConversations,
    });
}

/**
 * True when `participantKey` is the OPEN thread.
 *
 * The open conversation arrives in camelCase from the list (`participantKey`)
 * but in snake_case once it mirrors an inbox row, so both are checked — a
 * delete must close the detail view either way.
 */
function isActiveConversation(activeConversation, participantKey) {
    if (!activeConversation || !participantKey) return false;
    return (activeConversation.participantKey || activeConversation.participant_key) === participantKey;
}

/**
 * Mirror an entity-level flag into `chatEntities` (mute / disable).
 *
 * `chatEntities` is what the New Chat picker and the composer's disabled banner
 * read, and it is a separate copy from the inbox rows. Patching both keeps them
 * from contradicting each other for the rest of the session.
 */
function syncChatEntityFlag(set, get, entityId, field, value) {
    if (!entityId) return;
    const chatEntities = (get().chatEntities || []).map((entity) => (
        entity.id === entityId ? { ...entity, [field]: value } : entity
    ));
    set({ chatEntities });
}

export const useChatStore = create((set, get) => ({
    // ── State ────────────────────────────────────────────────────────────
    /** Inbox rows for ACTIVE threads — every companion in one list. */
    conversations: [],
    /**
     * Inbox rows for ARCHIVED threads, kept in their own array because that is
     * how the engine returns them (a separate, bounded `archived` array under
     * `?include_archived=1`). The inbox hides these behind a collapsed
     * "Archived (N)" section; they are loaded by {@link loadInbox} so the count
     * is real without a second request.
     */
    archivedConversations: [],
    /** True when the last inbox load included the archived array. */
    archivedLoaded: false,
    /**
     * True while the inbox is being fetched (or while the chat entities that
     * the inbox is derived from are still loading). Presentation-only: the
     * list renders row-shaped skeletons for this window, because an empty
     * inbox and a still-loading inbox looked identical otherwise.
     */
    loadingConversations: false,
    /**
     * Optional companion filter for the already-loaded inbox. `null` = "All
     * companions" (the default). A set id narrows the rendered list to that
     * AI's threads via the partner chips — it is presentation state only, never
     * a requirement of the query. The detail view is addressed by
     * participant_key either way.
     */
    listEntityId: null,
    /** Chat-entity options: AI partners + personas (from the engine). */
    chatEntities: [],
    /** The open conversation or null. `interactionId` is navigation only. */
    activeConversation: null,
    /** The timeline for the open conversation (oldest → newest). */
    messages: [],
    /**
     * True while the FIRST page of the open conversation is being fetched.
     * Presentation-only: the detail view renders message-shaped skeletons for
     * this window instead of an empty timeline (which is indistinguishable
     * from "this chat genuinely has no messages"). Older pages use
     * `loadingOlder`.
     */
    loadingMessages: false,
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
    /**
     * Cross-view request: set by the Archived screen (Task 02-5), consumed once
     * by ChatView, which owns the persona/participant resolution. Same handoff
     * pattern as {@link startChatRequest} — navigating to the Chat tab unmounts
     * the requester, so the request cannot travel as a prop.
     */
    openConversationRequest: null,
    /**
     * Bumped when {@link deleteConversation} removes the thread that was open.
     *
     * The open conversation is ChatView's LOCAL state, so clearing the store's
     * `activeConversation` cannot unmount the detail view by itself. ChatView
     * watches this counter and drops back to the list when it changes — an
     * explicit one-shot signal rather than a boolean the consumer must reset.
     */
    detailCloseTick: 0,

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
     * Load the GLOBAL inbox (Task 02-4): every active thread across ALL AI
     * companions in ONE request (`GET /api/entities/chat-list`).
     *
     * This replaces the old per-entity fan-out (`loadConversations(entityId)`),
     * which listed one companion at a time and could not be scanned. The engine
     * now dedupes by `participant_key`, joins the settings and mute state and
     * orders `pinned DESC, last_activity_at DESC` — all in SQL. The returned
     * order is therefore AUTHORITATIVE: it is stored as-is and never re-sorted
     * client-side, because re-sorting on each live update makes rows jump.
     *
     * `listEntityId` survives as an OPTIONAL filter: it is presentation state
     * the inbox chip row owns (`setListEntityFilter`), applied client-side over
     * the already-loaded rows — never a required argument to this call.
     *
     * @param {{ includeArchived?: boolean }} [options] - `includeArchived` also
     *   fetches the archived array, so the collapsed section can show a real
     *   count; the default payload stays small.
     * @returns {Promise<Array<object>>} the active rows
     */
    loadInbox: async ({ includeArchived = true } = {}) => {
        set({ error: null, loadingConversations: true });
        try {
            const { conversations, archived } = await chatReadService.listInbox({ includeArchived });
            set({
                conversations,
                archivedConversations: archived,
                archivedLoaded: includeArchived,
                loadingConversations: false,
            });
            return conversations;
        } catch (error) {
            // Keep whatever was already on screen: a failed refresh must not
            // blank a list the user is reading.
            set({ loadingConversations: false, error: error.message });
            return get().conversations;
        }
    },

    /**
     * Set the optional partner filter for the inbox (`null` = All partners).
     *
     * Purely presentation state — the list is already loaded, so filtering
     * costs no request and the unread totals stay whole.
     *
     * @param {string|null} entityId
     */
    setListEntityFilter: (entityId) => set({ listEntityId: entityId || null }),

    /**
     * Apply an optimistic flag patch to one inbox row (pin / archive / mute /
     * disable). Matches by `participant_key` in BOTH arrays and preserves the
     * server's ordering; the next {@link loadInbox} converges on the truth.
     *
     * @param {string} participantKey
     * @param {object} patch
     */
    patchConversation: (participantKey, patch) => {
        const target = { participant_key: participantKey, ...patch };
        set({
            conversations: patchConversation(get().conversations, target),
            archivedConversations: patchConversation(get().archivedConversations, target),
        });
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

    /**
     * Ask the Chat tab to open an EXISTING conversation (Task 02-5).
     *
     * Same handoff as {@link requestStartChat}: the Archived screen navigates to
     * the Chat tab, which unmounts the requester, so the request cannot travel
     * as a prop. ChatView owns the persona/participant resolution, so it must be
     * the one that opens the thread.
     *
     * @param {object} conversation - an inbox row (snake_case) or a
     *   ChatView-shaped conversation object.
     */
    requestOpenConversation: (conversation) => set({ openConversationRequest: conversation }),

    /** Clear the pending open-conversation request (consumed once by ChatView). */
    clearRequestOpenConversation: () => set({ openConversationRequest: null }),

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
            loadingMessages: false,
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
        set({ loadingMessages: true });
        try {
            const { messages, hasMore, nextCursor } = await chatReadService.listMessages(
                entityId,
                participantKey,
                { limit: 50 }
            );
            set({ messages: mergeMessages([], messages), hasMore, nextCursor, loadingMessages: false });
        } catch (error) {
            set({ error: error.message, loadingMessages: false });
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
     * Mark the open conversation read and clear its local unread badge
     * optimistically. Re-reads converge on the next `loadInbox()`.
     *
     * The badge is cleared IN PLACE (never by re-inserting and re-sorting the
     * row): the engine owns the inbox order, and re-sorting here would move the
     * thread the user just opened.
     */
    markActiveConversationRead: async ({ upToMessageId } = {}) => {
        const { activeConversation } = get();
        if (!activeConversation) return;
        await get().markRead(activeConversation, { upToMessageId });
    },

    // ── Conversation actions (Task 02-5) ─────────────────────────────────
    //
    // Every action below follows the same three beats, matching the optimistic
    // send path already in this store:
    //
    //   1. patch the inbox row(s) LOCALLY first, so the UI is instant;
    //   2. call the engine;
    //   3. on failure, restore the previous row(s) and toast the reason.
    //
    // The row is restored from a SNAPSHOT rather than by flipping the flag back:
    // an archive moves the row between arrays, so "undo" has to put it back
    // where it was, with the flags it had.

    /**
     * Pin / unpin a conversation.
     *
     * Pin lives on `chat_conversation_settings` (participant-key scoped), and it
     * only affects the row's flag — the engine re-ranks on the next load, and
     * the row is deliberately NOT moved here: a pin that instantly reorders the
     * list would jump the thread away from the pointer that just pinned it.
     *
     * @param {object} conversation - inbox row or open conversation
     * @param {boolean} pinned
     * @returns {Promise<boolean>} true when the engine accepted the change
     */
    setPinned: async (conversation, pinned) => {
        const { participantKey } = chatActionService.conversationTarget(conversation);
        if (!participantKey) return false;
        const snapshot = snapshotInbox(get());
        get().patchConversation(participantKey, { pinned: !!pinned });
        try {
            await chatActionService.setConversationPinned(conversation, !!pinned);
            announceConversationAction('pin', !!pinned, translate);
            return true;
        } catch (error) {
            restoreInbox(set, snapshot);
            set({ error: error.message });
            toast.error(error.message || translate('chat:errors.generic'));
            return false;
        }
    },

    /**
     * Archive / unarchive a conversation.
     *
     * This is a MOVE between the two inbox arrays, not a flag flip: the engine
     * returns archived threads in their own array, so patching in place would
     * leave the row in the wrong section. {@link moveConversation} slots it into
     * the target array without re-ranking anything else.
     *
     * @param {object} conversation
     * @param {boolean} archived
     * @returns {Promise<boolean>}
     */
    setArchived: async (conversation, archived) => {
        const { participantKey } = chatActionService.conversationTarget(conversation);
        if (!participantKey) return false;
        const snapshot = snapshotInbox(get());
        const moved = moveConversation(
            get().conversations, get().archivedConversations, participantKey, !!archived
        );
        set({
            conversations: moved.conversations,
            archivedConversations: moved.archivedConversations,
        });
        // The open thread's own header flag follows the row.
        const active = get().activeConversation;
        if (active && (active.participant_key || active.participantKey) === participantKey) {
            set({ activeConversation: { ...active, archived: !!archived } });
        }
        try {
            await chatActionService.setConversationArchived(conversation, !!archived);
            announceConversationAction('archive', !!archived, translate);
            return true;
        } catch (error) {
            restoreInbox(set, snapshot);
            set({ error: error.message });
            toast.error(error.message || translate('chat:errors.generic'));
            return false;
        }
    },

    /**
     * Mute / unmute the AI partner behind a conversation.
     *
     * Mute is ENTITY-level (`entities.is_muted`), so EVERY thread owned by that
     * companion changes, not just the one that was clicked — patching only the
     * clicked row would leave the others contradicting the engine. The unread
     * badge is cleared as well because a muted thread never shows one.
     *
     * @param {object} conversation
     * @param {boolean} muted
     * @returns {Promise<boolean>}
     */
    setMuted: async (conversation, muted) => {
        const { participantKey } = chatActionService.conversationTarget(conversation);
        const entityId = conversation?.entity_id || conversation?.entityId || '';
        if (!participantKey && !entityId) return false;

        const snapshot = snapshotInbox(get());
        const patchOwned = (rows) => (rows || []).map((row) => (
            row.entity_id === entityId ? { ...row, muted: !!muted } : row
        ));
        set({
            conversations: patchOwned(get().conversations),
            archivedConversations: patchOwned(get().archivedConversations),
        });
        try {
            await chatActionService.setConversationMuted(conversation, !!muted);
            announceConversationAction('mute', !!muted, translate);
            // The entity flag also drives the detail view's status column.
            syncChatEntityFlag(set, get, entityId, 'is_muted', !!muted);
            return true;
        } catch (error) {
            restoreInbox(set, snapshot);
            set({ error: error.message });
            toast.error(error.message || translate('chat:errors.generic'));
            return false;
        }
    },

    /**
     * Mark a conversation read, or bump its newest message back to unread.
     *
     * `read: true` is the badge-clearing path and is idempotent engine-side.
     * `read: false` restores the phone app's "mark unread" affordance (the
     * engine sets exactly ONE message unread), so the local badge becomes 1.
     *
     * @param {object} conversation
     * @param {{ read?: boolean, upToMessageId?: string }} [options]
     * @returns {Promise<boolean>}
     */
    markRead: async (conversation, { read = true, upToMessageId } = {}) => {
        const { participantKey } = chatActionService.conversationTarget(conversation);
        if (!participantKey && !chatActionService.canWriteConversation(conversation)) return false;

        const snapshot = snapshotInbox(get());
        if (participantKey) {
            get().patchConversation(participantKey, { unread_count: read ? 0 : 1 });
        }
        try {
            await chatActionService.markConversationRead(conversation, { read, upToMessageId });
            return true;
        } catch (error) {
            restoreInbox(set, snapshot);
            set({ error: error.message });
            toast.error(error.message || translate('chat:errors.generic'));
            return false;
        }
    },

    /**
     * Delete a conversation.
     *
     * The row is removed optimistically from BOTH arrays, and the timeline is
     * cleared when the deleted thread was the open one. `detailCloseTick` is
     * bumped in that case so the chat container can drop back to the list — the
     * detail view is mounted with local state, so a store flag alone cannot
     * unmount it.
     *
     * A `409` (an entity session is still live) restores everything and shows
     * the engine's copy verbatim: "Close the conversation before deleting it."
     *
     * @param {object} conversation
     * @returns {Promise<boolean>}
     */
    deleteConversation: async (conversation) => {
        const { participantKey } = chatActionService.conversationTarget(conversation);
        if (!participantKey) return false;

        const snapshot = snapshotInbox(get());
        const previousActive = get().activeConversation;
        const previousMessages = get().messages;
        const wasOpen = isActiveConversation(previousActive, participantKey);
        get().dropConversation(participantKey);
        if (wasOpen) {
            get().closeSocket();
            set({ activeConversation: null, messages: [] });
        }
        try {
            await chatActionService.deleteConversation(conversation);
            toast.success(translate('chat:toast.conversationDeleted'));
            if (wasOpen) set({ detailCloseTick: get().detailCloseTick + 1 });
            return true;
        } catch (error) {
            restoreInbox(set, snapshot);
            if (wasOpen) {
                // Restore the EXACT previous objects, not the row we passed in:
                // the open conversation carries navigation state (title,
                // interactionId) that a generic inbox row does not.
                set({ activeConversation: previousActive, messages: previousMessages });
            }
            set({ error: error.message });
            toast.error(error.message || translate('chat:errors.generic'));
            return false;
        }
    },

    /**
     * Enable / disable an AI partner.
     *
     * Delegates to the EXISTING entity `is_disabled` update — this is the same
     * synced flag the phone app's Disabled-AIs screen reads and the automation
     * gates honour, so there is deliberately no second write path.
     *
     * Locally the flag is patched on every thread the entity owns (the inbox
     * renders 🚫 per row) and on `chatEntities`, which is what the composer's
     * disabled banner reads.
     *
     * @param {string} entityId
     * @param {boolean} disabled
     * @returns {Promise<boolean>}
     */
    setDisabled: async (entityId, disabled) => {
        if (!entityId) return false;

        const snapshot = snapshotInbox(get());
        const patchOwned = (rows) => (rows || []).map((row) => (
            row.entity_id === entityId ? { ...row, entity_disabled: !!disabled } : row
        ));
        set({
            conversations: patchOwned(get().conversations),
            archivedConversations: patchOwned(get().archivedConversations),
        });
        syncChatEntityFlag(set, get, entityId, 'is_disabled', !!disabled);

        try {
            await setEntityDisabledRequest(entityId, !!disabled);
            toast.success(translate(disabled
                ? 'chat:toast.aiDisabled'
                : 'chat:toast.aiEnabled'));
            return true;
        } catch (error) {
            restoreInbox(set, snapshot);
            syncChatEntityFlag(set, get, entityId, 'is_disabled', !disabled);
            set({ error: error.message });
            toast.error(error.message || translate('chat:errors.generic'));
            return false;
        }
    },

    /** Clear the pending "close the detail view" request (consumed once). */
    clearDetailCloseTick: () => set({ detailCloseTick: 0 }),

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
     * Update a chat row when a message arrives for it.
     *
     * The row is patched IN PLACE rather than re-inserted, so the server's
     * order is preserved — a thread must not jump to the top on a live update
     * that the engine has not ranked yet. The next `loadInbox()` re-ranks it.
     *
     * @param {string} participantKey - the conversation identity
     */
    touchConversation: (participantKey, patch = {}) => {
        get().patchConversation(participantKey, patch);
    },

    /** Drop a conversation from both inbox arrays (delete thread). */
    dropConversation: (participantKey) => {
        set({
            conversations: removeConversation(get().conversations, participantKey),
            archivedConversations: removeConversation(get().archivedConversations, participantKey),
        });
    },

    /** The newest message of the open timeline (helper for the UI). */
    latestMessage: () => lastMessage(get().messages),

    /** Reset all chat state (on leaving the chat tab). */
    reset: () => {
        get().closeSocket();
        set({
            conversations: [],
            archivedConversations: [],
            archivedLoaded: false,
            listEntityId: null,
            activeConversation: null,
            messages: [],
            loadingMessages: false,
            loadingOlder: false,
            hasMore: false,
            nextCursor: null,
            connectionState: 'idle',
            typingByEntity: {},
            recordingByEntity: {},
            wireFrames: [],
            detailCloseTick: 0,
            openConversationRequest: null,
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
