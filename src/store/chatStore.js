import { create } from 'zustand';
import * as chatReadService from '../services/management/chatReadService.js';
import * as chatActionService from '../services/management/chatActionService.js';
import { setEntityDisabled as setEntityDisabledRequest } from '../services/management/entityService.js';
import { ChatSocketService, generateEventId, getDeviceId } from '../services/chat/chatSocketService.js';
import {
    chatParticipantSet,
    chatScopeKey,
    socketKey,
    shouldRelayUtterance,
} from '../services/chat/chatSessionUtils.js';
import {
    mergeMessages,
    prependOlderMessages,
    replaceMessage,
    removeMessage,
    removeConversation,
    setEntityFlag,
    lastMessage,
    parseReactions,
    toggleReaction,
    nextReactionOp,
    markMessagesRead,
    setMessagesReadFlag,
    unreadMessageIds,
    matchesRecentPerception,
} from './chatStoreUtils.js';
import { recordSessionError, clearSessionErrors, extractSessionErrorMessage, sessionErrorChip } from './chatSessionErrors.js';
import {
    SEARCH_RESULT_LIMIT,
    isSearchable,
    normalizeSearchTerm,
    jumpTargetFromHit,
    capSearchResults,
} from './searchUtils.js';
import { getActivePersonaId } from '../services/management/activePersona.js';
import { insertByInboxOrder, moveConversation } from './inboxUtils.js';
import { announceConversationAction } from './conversationActions.js';
import {
    TRANSCRIPTION_TIMEOUT_MS,
    TRANSCRIPTION_FAILED,
    TRANSCRIPTION_DONE,
    stampTranscriptionStates,
    markPendingTranscriptionsFailed,
    transcriptionPatchFromResponse,
    canRetranscribeMessage,
    transcriptionErrorMessage,
} from './transcriptionUtils.js';
import { markUserSend, resetUserSend } from '../services/chat/userActivity.js';
import {
    canPromoteToReconnecting,
    reconnectGraceElapsed,
    RECONNECT_STATUS_GRACE_MS,
} from '../services/chat/chatConnectionUtils.js';
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
 * / muted / disabled) and ordered `pinned DESC, last_message_at DESC` in SQL
 * (message time only; message-less threads sink to the bottom).
 * Each row is named and avatar'd by the AI companion that owns it
 * (`conversation.entity_id`); `partner_entity_id` is the persona "user" on a
 * private companion thread and is deliberately NOT the row label.
 *
 * Ordering is never recomputed here: live updates patch rows in place, so a
 * thread cannot jump under the pointer between loads.
 *
 * Message perspective: history is read from the PERSONA's point of view
 * (the engine stores one copy per participant), so `sender_entity_id ===
 * personaId` means "the user spoke" — the bubble side for an outgoing row.
 * The UI derives it from messageDirection(), never from `entity_id`.
 */

/**
 * Per-participant session registry (module scope — not reactive state).
 *
 * Keyed `${chatScopeKey}::${entityId}`: the participant set is part of the key
 * so a persona socket belongs to ONE chat. A shared `entity-user` slot made
 * two chats fight over the same session on the phone (EntitySessionService's
 * connection-id discriminator exists for exactly that race), so it is never
 * reused here either.
 *
 * ONE SESSION PER PARTICIPANT (N+1, phone D-18/D-21) is the subjective
 * perception ruling in practice: the partner's session lets cognition author
 * the partner-POV copy, and the persona's session lets the engine's Session
 * Utterance Recorder author the persona-POV copy — the POV the desktop reads.
 */
const sockets = new Map();

/** Socket registry key for one participant of the open chat. */
function scopedSocketKey(scopeKey, entityId) {
    return socketKey(scopeKey, entityId);
}

/** The entityId → socket map of ONE chat (empty when it has no session). */
function chatSockets(scopeKey) {
    const out = new Map();
    if (!scopeKey) return out;
    const prefix = `${scopeKey}::`;
    for (const [key, socket] of sockets) {
        if (key.startsWith(prefix)) out.set(key.slice(prefix.length), socket);
    }
    return out;
}

/** Close every participant session of one chat (leaving / switching threads). */
function closeChatSockets(scopeKey) {
    if (!scopeKey) return;
    for (const [entityId, socket] of chatSockets(scopeKey)) {
        socket.disconnect();
        sockets.delete(scopedSocketKey(scopeKey, entityId));
    }
}

/**
 * The participant sessions of the OPEN chat, persona (the speaker) first.
 *
 * `sessions` keeps the entityId → socket entries so a send can address every
 * participant: the persona's session is what makes the engine record the
 * persona-POV copy, and the partner's is what makes cognition answer. Neither
 * is optional at INIT (see connectSocket); at SEND time the phone's Chatroom
 * policy sends on every ACTIVE session, so one struggling sibling never
 * silences a working one.
 *
 * @param {object|null|undefined} activeConversation
 * @returns {{ personaId: string, scopeKey: string, sessions: Array<[string, object]> }}
 */
function openChatSessions(activeConversation) {
    const personaId = activeConversation?.personaId || getActivePersonaId();
    const scopeKey = chatScopeKey(activeConversation, personaId);
    const sessions = [...chatSockets(scopeKey)];
    sessions.sort((a, b) => (b[0] === personaId ? 1 : 0) - (a[0] === personaId ? 1 : 0));
    return { personaId, scopeKey, sessions };
}

/**
 * Write one frame on every participant session of the open chat.
 *
 * @param {Array<[string, object]>} sessions
 * @param {(socket: object, entityId: string) => boolean} write
 * @returns {boolean} true when at least one session accepted the frame
 */
function sendOnParticipantSessions(sessions, write) {
    let accepted = false;
    for (const [entityId, socket] of sessions) {
        if (write(socket, entityId)) accepted = true;
    }
    return accepted;
}

/**
 * Origin message ids already relayed on this device (bounded FIFO).
 *
 * Relaying is directional, but a duplicate delivery (engine retry, a second
 * tab's copy, a sync echo) must never forward the same origin twice — the
 * engine's recorder is idempotent, yet a relay loop is not something to rely
 * on it for. Mirrors the phone's `rememberRelayOrigin`.
 */
const relayedOrigins = new Set();
const relayedOriginOrder = [];
const RELAY_ORIGIN_LRU_MAX = 200;

/** Record `messageId` as relayed; false when it was already seen. */
function rememberRelayedOrigin(messageId) {
    if (!messageId) return false;
    if (relayedOrigins.has(messageId)) return false;
    relayedOrigins.add(messageId);
    relayedOriginOrder.push(messageId);
    if (relayedOriginOrder.length > RELAY_ORIGIN_LRU_MAX) {
        const oldest = relayedOriginOrder.shift();
        if (oldest) relayedOrigins.delete(oldest);
    }
    return true;
}

/**
 * Session keys (`scope::entity`) whose engine session is DEGRADED.
 *
 * A chat now has N sessions, so one failing must not be silently erased by a
 * sibling's healthy INIT: the header keeps saying Degraded until every session
 * of the chat has a successful INIT again. Mirrors the owner-approved
 * session-error model (the modal promises "a successful session wipes the
 * slate"), now per session.
 */
const degradedSessions = new Set();

/**
 * Pending "the drop is real" deadline (module scope — a timer, not a rendered
 * value).
 *
 * A socket drop is NOT admitted immediately: the first reconnect attempt is
 * 2 s away and usually succeeds, so flipping the header to "Reconnecting…" on
 * every blip is the flicker the owner reported. The drop is only surfaced once
 * {@link RECONNECT_STATUS_GRACE_MS} has elapsed without a `connected`; a
 * successful reconnect clears the timer and the label never changes.
 */
let reconnectStatusTimer = null;

/** Cancel the pending drop-status admission (reconnect, or thread closed). */
function clearReconnectStatusTimer() {
    if (reconnectStatusTimer) {
        clearTimeout(reconnectStatusTimer);
        reconnectStatusTimer = null;
    }
}

/**
 * Arm the one-shot promotion to `reconnecting`.
 *
 * Idempotent: a drop emits `disconnected` AND the first `reconnecting`
 * (attempt scheduled) event, and a retry storm emits the second repeatedly —
 * only the first arms the timer, so the header can flip at most once.
 *
 * @param {(patch: object) => void} set
 * @param {() => object} get
 */
function armReconnectStatus(set, get) {
    if (reconnectStatusTimer) return;
    const dropSince = get().connectionDropSince;
    if (dropSince === null || dropSince === undefined) return;
    if (!canPromoteToReconnecting(get().connectionState)) return;
    reconnectStatusTimer = setTimeout(() => {
        reconnectStatusTimer = null;
        if (!reconnectGraceElapsed({ dropSince: get().connectionDropSince, now: Date.now() })) return;
        if (!get().activeConversation) return;
        // A reconnect may have landed while the timer was queued: never
        // overwrite a live `connected` (or an honest `error`) with a stale
        // "reconnecting".
        if (!canPromoteToReconnecting(get().connectionState)) return;
        set({ connectionState: 'reconnecting' });
    }, RECONNECT_STATUS_GRACE_MS);
    // Node's test runner (and any non-browser host) must not be held open by
    // the grace window; browsers return a number and ignore this branch.
    if (reconnectStatusTimer && typeof reconnectStatusTimer.unref === 'function') {
        reconnectStatusTimer.unref();
    }
}

/**
 * Open transcription attempt windows, keyed by message id (Task 04-3).
 *
 * Module scope rather than store state because these are TIMERS, not rendered
 * values: the bubble renders `message.transcription`, which is stamped from this
 * map. Keeping them out of state also means a timeout firing does not itself
 * look like a state change to any subscriber.
 *
 * Two entries per attempt are needed:
 *   - `since` — the epoch ms the attempt began (audio sent, or Retry pressed),
 *   - `timer` — the 20 s deadline that flips an unfulfilled attempt to failed.
 */
const transcriptionAttempts = new Map();

/**
 * Begin (or restart) the transcription window for `messageId`.
 *
 * Restarting is the retry case: a second press must give the attempt a fresh
 * 20 s, otherwise a retry pressed at t=19 s would be declared failed a second
 * later and the button would reappear instantly.
 *
 * @param {string} messageId
 * @param {() => void} onTimeout called when the deadline passes unfulfilled
 */
function openTranscriptionAttempt(messageId, onTimeout) {
    if (!messageId) return;
    clearTranscriptionAttempt(messageId);
    const since = Date.now();
    const timer = setTimeout(() => {
        transcriptionAttempts.delete(messageId);
        onTimeout();
    }, TRANSCRIPTION_TIMEOUT_MS);
    // Node's test runner (and any non-browser host) must not be held open by a
    // 20 s deadline; browsers return a number and ignore this branch.
    if (timer && typeof timer.unref === 'function') timer.unref();
    transcriptionAttempts.set(messageId, { since, timer });
}

/** Close the window for `messageId`, cancelling its deadline. */
function clearTranscriptionAttempt(messageId) {
    const entry = transcriptionAttempts.get(messageId);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    transcriptionAttempts.delete(messageId);
}

/** Close every open window (conversation switch / store reset). */
function clearAllTranscriptionAttempts() {
    for (const [, entry] of transcriptionAttempts) {
        if (entry.timer) clearTimeout(entry.timer);
    }
    transcriptionAttempts.clear();
}

/**
 * The window opened by the most recent SENT voice note, or null.
 *
 * ── WHY A SECOND KIND OF WINDOW ──────────────────────────────────────────
 *
 * A retry addresses a message id we already hold, so it can be tracked per id in
 * {@link transcriptionAttempts}. A freshly sent voice note cannot: the engine
 * mints the message id server-side (modules/cognition.go overrides the client's
 * id deliberately, so two entities never collide), so at send time there is no
 * id to key anything by. This window therefore records only WHEN the send
 * happened, and the row is recognised as belonging to it by its `created_at`
 * falling inside the window — see deriveTranscriptionState.
 */
let pendingAudioSend = null;

/**
 * Arm the 20 s deadline for a just-sent voice note.
 *
 * The deadline is what turns "the engine never answered" into an actionable
 * bubble: nothing else in the client knows the attempt is over, because a
 * silent failure produces no event at all on this path.
 *
 * @param {() => object} get
 * @param {(patch: object) => void} set
 */
function armAudioSendWindow(get, set) {
    if (pendingAudioSend?.timer) clearTimeout(pendingAudioSend.timer);
    const since = Date.now();
    const timer = setTimeout(() => {
        pendingAudioSend = null;
        // Every row still awaiting a transcription is now failed. Rows with text
        // are `done` and untouched; older audio-only rows were already failed, so
        // this is a no-op for them.
        set({ messages: markPendingTranscriptionsFailed(get().messages) });
    }, TRANSCRIPTION_TIMEOUT_MS);
    if (timer && typeof timer.unref === 'function') timer.unref();
    pendingAudioSend = { since, timer };
}

/**
 * The epoch-ms at which the newest attempt for ANY message began, or null.
 *
 * This is the value {@link stampTranscriptionStates} needs: rows are stamped
 * against it, so an audio-only message is `pending` only while it belongs to the
 * attempt currently in flight. Returning null when nothing is in flight is what
 * keeps OLD untranscribed notes at `failed` instead of animating them all again
 * on every load.
 */
function latestTranscriptionAttemptSince() {
    let latest = pendingAudioSend ? pendingAudioSend.since : null;
    for (const [, entry] of transcriptionAttempts) {
        if (latest === null || entry.since > latest) latest = entry.since;
    }
    return latest;
}

/** Stamp the current timeline with transcription states. */
function stampMessagesWithTranscription(messages) {
    return stampTranscriptionStates(messages, { expectSinceMs: latestTranscriptionAttemptSince() });
}

/**
 * Patch one inbox row in place (by participant_key) across BOTH list arrays.
 *
 * The inbox is two arrays — `conversations` (active) and
 * `archivedConversations` — because the engine returns them separately, and a
 * row can move between them when it is archived/unarchived. Every mutation has
 * to address both or a flag change on an archived thread would be lost.
 *
 * The incoming order is preserved (no re-sort): the engine owns the ordering
 * (`pinned DESC, last_message_at DESC`) and re-sorting here would make a row
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
     * Epoch ms of the FIRST unexpected drop since the last `connected`, or null.
     *
     * Kept separate from `connectionState` so the label can stay calm: a drop
     * inside the grace window is recorded here (and retried) without the header
     * admitting it yet. {@link RECONNECT_STATUS_GRACE_MS} decides when it
     * becomes visible.
     */
    connectionDropSince: null,
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
    /** Session errors of the ACTIVE conversation, newest first (owner-approved
     *  error modal; cleared on the next successful INIT_ENTITY). */
    sessionErrors: [],
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
     * Cross-conversation FORWARD request (Task 02-6 step 4).
     *
     * `{ content, fromTitle }` while the partner picker is up, else null. A
     * forward in 1.0 is "copy the text as a new message in another thread" —
     * there is no engine forward primitive, and inventing one would require a
     * new message type the pipeline does not understand. The content is carried
     * here (not as a prop) because choosing a partner makes ChatView swap the
     * open conversation, which unmounts the detail view that started it.
     */
    forwardRequest: null,
    /**
     * Bumped when {@link deleteConversation} removes the thread that was open.
     *
     * The open conversation is ChatView's LOCAL state, so clearing the store's
     * `activeConversation` cannot unmount the detail view by itself. ChatView
     * watches this counter and drops back to the list when it changes — an
     * explicit one-shot signal rather than a boolean the consumer must reset.
     */
    detailCloseTick: 0,

    // ── Message search (Task 02-9) ───────────────────────────────────────
    /**
     * The query the CURRENT results were produced by — not what is in the input.
     *
     * The field keeps its own local text so typing stays instant, and only the
     * debounced, committed term lands here. That distinction is what lets the
     * result list say "No matches for 'ocean'" about the results on screen
     * instead of about a half-typed word.
     */
    searchTerm: '',
    /** Normalised search hits, newest first (engine order), capped at 100. */
    searchResults: [],
    /** True while a search request is in flight. */
    searching: false,
    /** The last search failure, or null. Shown in the search surface. */
    searchError: null,
    /**
     * `null` for the GLOBAL search (every partner), or `{ participantKey }` for
     * the in-conversation field. Kept in the store because both surfaces read
     * the same result list and only one may be open at a time.
     */
    searchScope: null,
    /**
     * A hit the user asked to jump to, and the message to land on.
     *
     * Two fields, not one, because the jump crosses two components: ChatView
     * owns opening a conversation (and unmounts the list when it does), while
     * the scroll happens inside ChatDetailView once the timeline is mounted.
     * `searchJump` is consumed by ChatView; `focusMessage` survives into the
     * detail view and is consumed by the timeline.
     */
    searchJump: null,
    /** `{ id, participantKey }` of the message to scroll to and flash. */
    focusMessage: null,

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
     * orders `pinned DESC, last_message_at DESC` — all in SQL. The returned
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

    /**
     * Start a forward: remember the content and open the partner picker.
     *
     * @param {{ content: string, fromTitle?: string }} request
     */
    requestForward: (request) => {
        const content = (request?.content || '').trim();
        if (!content) return;
        set({ forwardRequest: { content, fromTitle: request?.fromTitle || '' } });
    },

    /** Clear the pending forward (consumed once by the picker, or cancelled). */
    clearForwardRequest: () => set({ forwardRequest: null }),

    // ── Open conversation ────────────────────────────────────────────────

    /**
     * Open a conversation: reset the timeline, load the newest page by
     * `participantKey`, mark it read, then open the chat's participant
     * sessions (N+1 — persona and partner).
     *
     * `interactionId` is carried for navigation/debug only — a brand-new chat
     * has none yet (the engine resolves it on INIT_ENTITY) and a re-keyed chat
     * resolves the CURRENT interaction for the same participant set.
     *
     * @param {{ interactionId?: string|null, participantKey?: string, entityId: string,
     *   participantIds: string[], replyMode?: string }} conversation
     */
    openConversation: async (conversation) => {
        // A drop status armed for the PREVIOUS thread must not surface over the
        // one being opened.
        clearReconnectStatusTimer();
        get().closeSocket();
        // Transcript attempt windows belong to the thread that was open; carrying
        // them across would show the new thread's voice notes as pending.
        clearAllTranscriptionAttempts();
        pendingAudioSend = null;
        // The autoplay window belongs to the thread the user was watching.
        // Carrying it across would let a voice note in a thread they just opened
        // play on its own because they sent something in the PREVIOUS one.
        resetUserSend();
        // History reads and every write pivot on the PERSONA, so it is resolved
        // once here and carried on the open conversation. `entityId` stays the
        // companion: it names the row and identifies the partner session;
        // `personaId` identifies the persona session (N+1 — both are opened).
        const active = {
            ...conversation,
            personaId: conversation.personaId || getActivePersonaId(),
        };
        set({
            activeConversation: active,
            messages: [],
            loadingMessages: false,
            hasMore: false,
            nextCursor: null,
            typingByEntity: {},
            recordingByEntity: {},
            connectionState: 'idle',
            connectionDropSince: null,
            error: null,
            sessionErrors: [],
        });

        if (active.participantKey) {
            await get().loadInitialMessages(active);
            // Badge hygiene: parity's read write is participant_key scoped, the
            // exact same scope as CountUnreadByParticipantKeys. Fire-and-forget
            // so a failed stamp never blocks opening the chat.
            get().markActiveConversationRead();
        }
        await get().connectSocket(active);
    },

    /**
     * Load the newest page of messages for the conversation's participant_key.
     *
     * `:id` is the ACTIVE PERSONA (`conversation.personaId`), not the
     * companion — the engine's read is POV-scoped, and the persona-POV copies
     * are written by the persona session opened alongside the partner's. The
     * companion id stays on the conversation for naming and for identifying
     * which of the two participant sessions is the partner's.
     *
     * @param {{ entityId: string, personaId?: string, participantKey?: string }} conversation
     */
    loadInitialMessages: async (conversation) => {
        const { entityId, participantKey } = conversation || {};
        if (!entityId || !participantKey) return;
        const personaId = conversation.personaId || getActivePersonaId();
        set({ loadingMessages: true });
        try {
            const { messages, hasMore, nextCursor } = await chatReadService.listMessages(
                personaId,
                participantKey,
                { limit: 50 }
            );
            // Stamp on the way in: an audio row with no text and no live attempt
            // is `failed` (Retry offered), never a phantom `pending`. This is why
            // opening a thread full of old voice notes does not animate them all.
            set({
                messages: stampMessagesWithTranscription(mergeMessages([], messages)),
                hasMore,
                nextCursor,
                loadingMessages: false,
            });
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
                activeConversation.personaId || getActivePersonaId(),
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
     * Re-read the newest page after a reconnect and MERGE it into the timeline.
     *
     * The engine keeps no replay queue for web sessions (only phone sessions are
     * suspended/resumed), so anything the AI said while the socket was down is
     * not delivered on reconnect — a REST tail read is the only way to catch up.
     *
     * It MERGES rather than replaces: `loadInitialMessages` would throw away the
     * older pages the reader scrolled back through, and drop them out from under
     * the scroll anchor. `hasMore`/`nextCursor` are untouched for the same
     * reason (the tail read says nothing about the older history).
     *
     * This deliberately does NOT scroll. The detail view only auto-scrolls while
     * the reader is already at the bottom, so catching up cannot yank someone
     * who was reading history (the second half of the owner's complaint).
     *
     * @returns {Promise<boolean>} true when the tail was applied
     */
    refreshNewestMessages: async () => {
        const active = get().activeConversation;
        const key = active?.participantKey || active?.participant_key;
        if (!active?.entityId || !key) return false;
        const personaId = active.personaId || getActivePersonaId();
        try {
            const { messages: newest } = await chatReadService.listMessages(
                personaId,
                key,
                { limit: 50 }
            );
            // The thread may have changed while the request was in flight; the
            // rows belong to the OLD conversation and must not be merged in.
            const current = get().activeConversation;
            if (!current || (current.participantKey || current.participant_key) !== key) return false;
            /**
             * A REST tail read is PERSONA-POV, while a live bubble may hold the
             * PARTNER-POV row of the same logical message — different ids, same
             * perception (see matchesRecentPerception). Keep the live bubble and
             * drop the redundant POV copy; rows already known by id still merge
             * so their fields (read flags, edits) are refreshed.
             */
            const liveMessages = get().messages;
            const freshRows = (newest || []).filter((row) => {
                if (!row) return false;
                if (liveMessages.some((message) => message && message.id === row.id)) return true;
                return !matchesRecentPerception(liveMessages, row);
            });
            set({ messages: stampMessagesWithTranscription(mergeMessages(liveMessages, freshRows)) });
            return true;
        } catch (error) {
            set({ error: error.message });
            return false;
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
        /**
         * The badge and the TIMELINE are two copies of the same fact.
         *
         * Until Task 02-7 only the inbox row was cleared, so the "new messages"
         * divider kept sitting in the open thread until the next page load —
         * the receipt had landed, yet the UI still claimed there were new
         * messages. The loaded `is_read = false` rows are flipped locally in the
         * same beat, and the ids are snapshotted first so a failure restores
         * exactly those rows and nothing else.
         *
         * NOTE the flip is NOT restricted to inbound rows: the engine writes
         * `entity_id = <the character>` on EVERY message, so its read receipt
         * selects the user's own rows and leaves the AI's rows unread forever.
         * `markMessagesRead` documents why the local rule has to be broader.
         */
        const previousUnreadIds = read ? unreadMessageIds(get().messages) : [];
        if (participantKey) {
            get().patchConversation(participantKey, { unread_count: read ? 0 : 1 });
        }
        if (previousUnreadIds.length > 0) {
            set({ messages: markMessagesRead(get().messages) });
        }
        try {
            await chatActionService.markConversationRead(conversation, { read, upToMessageId });
            return true;
        } catch (error) {
            restoreInbox(set, snapshot);
            if (previousUnreadIds.length > 0) {
                set({ messages: setMessagesReadFlag(get().messages, previousUnreadIds, false) });
            }
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

    // ── Message search (Task 02-9) ───────────────────────────────────────

    /**
     * Run a message search and publish the hits.
     *
     * The DEBOUNCE lives in the component, not here: the field owns the timing
     * (250 ms after the last keystroke) and this action is the "commit" step, so
     * a caller can also run a search immediately (Enter, a retry) without
     * waiting. Duplicating the timer in both layers would either double-fire or
     * make the immediate path impossible.
     *
     * A term shorter than two characters NEVER reaches the network. It clears
     * the results instead of leaving the previous ones on screen, because stale
     * results under a new query read as matches for it.
     *
     * `scope` narrows the results to one thread SERVER-side: its participant
     * key is sent as `participant_key`, so the engine matches the whole key
     * group (every interaction of the thread) rather than the current
     * interaction. Passing no scope searches every partner.
     *
     * @param {string} rawTerm
     * @param {{ scope?: {participantKey: string}|null }} [options]
     * @returns {Promise<Array<object>>} the hits that were published
     */
    searchMessages: async (rawTerm, { scope = null } = {}) => {
        const term = normalizeSearchTerm(rawTerm);
        if (!isSearchable(term)) {
            // Publishing an EMPTY result set is deliberate: "type two more
            // characters" must not sit above the previous query's hits.
            set({
                searchTerm: '',
                searchResults: [],
                searching: false,
                searchError: null,
                searchScope: scope || null,
            });
            return [];
        }

        set({ searching: true, searchError: null, searchTerm: term, searchScope: scope || null });
        try {
            const hits = await chatReadService.searchMessages(term, {
                limit: SEARCH_RESULT_LIMIT,
                participantKey: scope?.participantKey || '',
            });
            const visible = capSearchResults(hits, SEARCH_RESULT_LIMIT);
            // A SLOWER response must not overwrite the results of a newer query:
            // the debounce reduces, but cannot eliminate, overlapping requests.
            if (get().searchTerm !== term) return get().searchResults;
            set({ searchResults: visible, searching: false });
            return visible;
        } catch (error) {
            if (get().searchTerm === term) {
                set({ searchResults: [], searching: false, searchError: error.message });
            }
            return [];
        }
    },

    /** Drop the results and the committed term (closing the search surface). */
    clearSearch: () => set({
        searchTerm: '',
        searchResults: [],
        searching: false,
        searchError: null,
        searchScope: null,
    }),

    /**
     * Ask the chat container to open a hit's thread and land on the message.
     *
     * `searchJump` is the cross-component request (ChatView opens the
     * conversation); `focusMessage` is what the timeline consumes once it has
     * mounted. `searchJump` is cleared by its consumer exactly once — the same
     * one-shot handoff `openConversationRequest` uses.
     *
     * `focusMessage` is published in BOTH branches, because landing on a message
     * is the whole point of a jump; only the "open a different thread" half is
     * conditional.
     *
     * @param {object} hit - a normalised search hit
     * @param {{ query?: string }} [options] - the term the results belong to.
     *   The caller passes it because choosing a hit clears `searchTerm`, so
     *   reading it here would record an empty query.
     * @returns {boolean} true when the hit could be turned into a jump
     */
    jumpToSearchHit: (hit, { query } = {}) => {
        const target = jumpTargetFromHit(hit);
        if (!target.entityId || !target.participantKey) return false;

        const active = get().activeConversation;
        const activeKey = active?.participantKey || active?.participant_key || '';
        const focusMessage = { id: hit.id, participantKey: target.participantKey };

        // A hit INSIDE the open thread must NOT re-open it. `openConversation`
        // resets the timeline, tears the socket down and re-fetches the newest
        // page — for a message that is already on screen that is a visible
        // reload, and for an older hit it throws away the pages the jump itself
        // paged in. Only the scroll target is published.
        if (activeKey && activeKey === target.participantKey) {
            set({ focusMessage });
            return true;
        }

        set({
            // `query` is the term the results belong to, passed by the caller:
            // the search panel resets itself when a hit is chosen, so reading
            // `searchTerm` here would race that reset.
            searchJump: {
                ...target,
                messageId: hit.id,
                query: query !== undefined ? query : get().searchTerm,
            },
            focusMessage,
        });
        return true;
    },

    /** Clear the pending jump (consumed once by ChatView). */
    clearSearchJump: () => set({ searchJump: null }),

    /** Clear the pending scroll target (consumed once by the timeline). */
    clearFocusMessage: () => set({ focusMessage: null }),

    /**
     * Page BACKWARDS until `messageId` is in the timeline.
     *
     * A search hit can be arbitrarily old, while `openConversation` loads only
     * the newest page (50 rows). Jumping without this lands on a timeline that
     * does not contain the message at all — the scroll then silently does
     * nothing, which reads as a broken search.
     *
     * Bounded on purpose: `maxPages` caps the loop (a lifetime of history is not
     * worth an unbounded request chain), and it stops as soon as the engine says
     * there is nothing older, so a message that genuinely is not there (deleted
     * between the search and the click) resolves to `false` instead of hanging.
     *
     * @param {string} messageId
     * @param {{ maxPages?: number }} [options]
     * @returns {Promise<boolean>} true when the message is loaded
     */
    loadUntilMessage: async (messageId, { maxPages = 20 } = {}) => {
        if (!messageId) return false;
        const isLoaded = () => get().messages.some((message) => message?.id === messageId);
        if (isLoaded()) return true;

        const pages = Number.isFinite(maxPages) && maxPages > 0 ? Math.trunc(maxPages) : 20;
        for (let page = 0; page < pages; page += 1) {
            const { hasMore, loadingOlder, nextCursor, activeConversation } = get();
            if (!activeConversation?.participantKey || loadingOlder) break;
            if (!hasMore || !nextCursor) break;
            await get().loadOlderMessages();
            if (isLoaded()) return true;
        }
        return isLoaded();
    },

    // ── Live sockets ─────────────────────────────────────────────────────

    /**
     * Open ONE engine session per participant of the open conversation.
     *
     * N+1 (phone D-18/D-21): the persona's session AND the partner's, for THIS
     * chat. Each session resolves its own entity's interaction row and authors
     * that entity's POV copy — see chatSocketService.js's design note. The
     * persona socket is not optional: without it the persona-POV copy is never
     * written and the persona-pivoted timeline loses the message on reload.
     *
     * Sessions are created in PARALLEL (phone parity: total wall clock is the
     * slowest handshake, not the sum). Each keeps its own reconnect ladder,
     * heartbeat and terminal give-up; the store only aggregates their state.
     *
     * A call for a participant set that already has sockets (Retry, or an
     * effect re-entry) REPLACES them — a socket is superseded, not layered.
     *
     * @param {{ entityId: string, personaId?: string, participantIds?: string[],
     *   participantKey?: string, replyMode?: string }} conversation
     */
    connectSocket: async (conversation) => {
        const personaId = conversation?.personaId || getActivePersonaId();
        const scopeKey = chatScopeKey(conversation, personaId);
        if (!scopeKey) return;

        closeChatSockets(scopeKey);
        for (const key of [...degradedSessions]) {
            if (key.startsWith(`${scopeKey}::`)) degradedSessions.delete(key);
        }

        const participantIds = chatParticipantSet(conversation, personaId);
        // EVERY session of the chat shares this desktop's device id — they
        // are the same client, just different POVs.
        const deviceId = getDeviceId();
        const replyMode = conversation.replyMode || 'instant';

        // A fresh open is not a "reconnecting" situation, whatever happened to
        // the thread that was open before.
        clearReconnectStatusTimer();
        set({ connectionState: 'connecting', connectionDropSince: null });

        const failures = [];
        await Promise.all(participantIds.map(async (entityId) => {
            const socket = new ChatSocketService();
            sockets.set(scopedSocketKey(scopeKey, entityId), socket);
            socket.onEvent((type, payload) => get().handleSocketEvent(type, payload, {
                entityId,
                scopeKey,
                socket,
            }));
            // Raw-frame tap for the Developer wire inspector (D7) — captures
            // every frame (including heartbeat PONGs) verbatim, from every
            // participant session.
            socket.onFrame((direction, frame) => get().pushWireFrame(direction, frame));

            try {
                await socket.connect({
                    entityId,
                    // The SAME participant set (including the persona) on every
                    // session: the engine resolves each one's interaction for
                    // that set (D-21).
                    participantIds,
                    replyMode,
                    deviceId,
                });
            } catch (error) {
                failures.push({ entityId, error });
                degradedSessions.add(scopedSocketKey(scopeKey, entityId));
                set({
                    error: error.message,
                    sessionErrors: recordSessionError(get().sessionErrors, { message: error.message }),
                });
            }
        }));

        // A sibling session's `connected` can land before a failing one's
        // rejection settles, so the aggregate is reasserted LAST: one failed
        // participant means the chat is Degraded, never silently "connected".
        if (failures.length > 0) {
            set({ connectionState: 'error' });
        } else {
            set({ connectionState: 'connected' });
        }
    },

    /** Close EVERY participant session of the open conversation. */
    closeSocket: () => {
        // The engine cannot answer for this thread once the socket is gone, so an
        // open attempt window could only expire into a false failure.
        clearAllTranscriptionAttempts();
        pendingAudioSend = null;
        // A pending "admit the drop" deadline belongs to the thread being closed.
        clearReconnectStatusTimer();
        const { activeConversation } = get();
        const personaId = activeConversation?.personaId || getActivePersonaId();
        const scopeKey = chatScopeKey(activeConversation, personaId);
        if (!scopeKey) {
            set({ connectionDropSince: null });
            return;
        }
        for (const key of [...degradedSessions]) {
            if (key.startsWith(`${scopeKey}::`)) degradedSessions.delete(key);
        }
        closeChatSockets(scopeKey);
        set({ connectionState: 'idle', connectionDropSince: null });
    },

    /** Record one raw wire frame for the Developer wire inspector (D7). */
    pushWireFrame: (direction, frame) => {
        const next = [...get().wireFrames, { direction, at: Date.now(), frame }];
        // Keep only the most recent 200 frames.
        set({ wireFrames: next.length > 200 ? next.slice(next.length - 200) : next });
    },

    /** Clear the captured wire frames. */
    clearWireFrames: () => set({ wireFrames: [] }),

    /**
     * Route an inbound socket event into state.
     *
     * `meta` identifies the participant session that emitted it (`entityId`,
     * `scopeKey`, `socket`). It is optional so state transitions can be driven
     * directly (tests, and any caller that predates the N+1 model); when it IS
     * present the store can keep the aggregate honest across N sessions and
     * tell a partner's utterance from the persona's own.
     */
    handleSocketEvent: (type, payload, meta = {}) => {
        // NOTE: raw frames are captured by the socket's onFrame tap (D7), not
        // here — capturing 'event' frames in both places would duplicate them.
        if (type === 'connected') {
            /**
             * A reconnect after a gap may have missed messages. The engine has
             * no replay queue for web sessions, so the tail is re-read over
             * REST — merged, never scrolled (see refreshNewestMessages). The
             * FIRST connect of a thread has no drop recorded, so opening a chat
             * still costs exactly the initial page it always did.
             *
             * NOTE: `connected` is the WS HANDSHAKE, not a live session. A
             * session that is still degraded (its INIT was rejected) keeps the
             * chat Degraded until THIS socket's INIT_ENTITY succeeds.
             */
            const dropped = get().connectionDropSince !== null;
            const scopeKey = meta?.scopeKey || '';
            const degraded = scopeKey
                ? [...degradedSessions].some((key) => key.startsWith(`${scopeKey}::`))
                : degradedSessions.size > 0;
            if (!degraded) clearReconnectStatusTimer();
            set({
                connectionState: degraded ? 'error' : 'connected',
                connectionDropSince: null,
            });
            if (dropped) get().refreshNewestMessages();
            return;
        }
        if (type === 'disconnected' || type === 'reconnecting') {
            /**
             * A drop is only ADMITTED after the grace window. The event is
             * still recorded immediately (`connectionDropSince`), because the
             * timer needs to know it happened; what changes is that the header
             * keeps saying "Connected" through the 2 s first retry, and only
             * says "Reconnecting…" if the drop outlives it. This is the phone
             * app's rule: transient reconnects do not endlessly flash.
             */
            if (!get().activeConversation) return;
            if (get().connectionDropSince === null) {
                set({ connectionDropSince: Date.now() });
            }
            armReconnectStatus(set, get);
            return;
        }
        if (type === 'error') {
            /**
             * Engine ERROR frames arrive as `{error, error_code}` (D35 —
             * live-verified: `{"error":"entity_not_defined","error_code":"entity_not_defined"}`)
             * and the socket service emits `{message, code}`. Extract the
             * verbatim text whichever shape arrives (app parity: the phone
             * reads the same `error` string); the pinned code picks the chip.
             */
            const message = extractSessionErrorMessage(payload);
            if (meta?.scopeKey && meta?.entityId) {
                degradedSessions.add(scopedSocketKey(meta.scopeKey, meta.entityId));
            }
            set({
                error: message,
                // An ERROR frame is a SESSION-level failure — the socket itself may
                // still be live. The header says Degraded (never "offline"), and the
                // failure joins the modal's list.
                connectionState: 'error',
                sessionErrors: recordSessionError(get().sessionErrors, {
                    message,
                    code: sessionErrorChip(payload),
                }),
            });
            return;
        }
        if (type !== 'event' || !payload) return;

        const eventType = payload.event_type;
        const data = payload.payload || {};

        // INIT_ENTITY resolves the canonical interaction id (critical for a new
        // chat, where we opened with interactionId = null). It is kept as a
        // NAVIGATION handle only — the timeline and scrollback are addressed by
        // the conversation's participant_key, never by the interaction id.
        //
        // EACH participant session resolves ITS OWN entity's interaction row, so
        // the two ids differ by design. The handle stays DETERMINISTICALLY the
        // partner's (the row's owning companion, as before): reads are
        // participant_key-addressed, so either id navigates to the same thread
        // and letting the last INIT win would make the handle flicker.
        if (eventType === 'INIT_ENTITY' && payload.status === 'SUCCESS') {
            const current = get().activeConversation;
            const patches = { sessionErrors: clearSessionErrors() };
            if (meta?.scopeKey && meta?.entityId) {
                degradedSessions.delete(scopedSocketKey(meta.scopeKey, meta.entityId));
                const stillDegraded = [...degradedSessions]
                    .some((key) => key.startsWith(`${meta.scopeKey}::`));
                if (stillDegraded) {
                    // One session recovered; a sibling may still be degraded, and
                    // its failure must stay visible until IT succeeds too.
                    patches.sessionErrors = get().sessionErrors;
                } else if (get().connectionState === 'error') {
                    // The last failed participant is live again — leave the
                    // Degraded header instead of waiting for an unrelated event.
                    patches.connectionState = 'connected';
                }
            }
            const isPartnerSession = !meta?.entityId
                || !current
                || meta.entityId === current.entityId;
            if (data.interaction_id && isPartnerSession
                && current && current.interactionId !== data.interaction_id) {
                patches.activeConversation = { ...current, interactionId: data.interaction_id };
            }
            set(patches);
            return;
        }

        switch (eventType) {
            /**
             * Both event types name the same logical message. With one session
             * per participant the SAME utterance may reach the store twice
             * (e.g. AI_UTTERANCE on the partner session and ENTITY_UTTERANCE on
             * a relayed copy), so they share one branch and `mergeMessages`
             * collapses the duplicate by message id — one bubble, not two.
             */
            case 'AI_UTTERANCE':
            case 'AI_SPEECH':
            case 'ENTITY_UTTERANCE': {
                // The engine returns the persisted message with an id; append it.
                const message = normalizeIncomingMessage(data);
                if (message) {
                    const liveMessages = get().messages;
                    const knownById = liveMessages.some((row) => row && row.id === message.id);
                    /**
                     * PERCEPTION DEDUPE (the N+1 seam). The engine stores one
                     * row PER POV with its own id and fans each row out to that
                     * entity's sessions, so the SAME logical message can arrive
                     * on both participant sockets with DIFFERENT ids — `merge`
                     * by id would render two bubbles. When the id is new but the
                     * perception (sender/type/content/time) is already on
                     * screen, the existing bubble stands. A same-id delivery is
                     * NEVER skipped here: `mergeMessages` must keep applying
                     * edits/read updates to that row.
                     */
                    if (knownById || !matchesRecentPerception(liveMessages, message)) {
                        const merged = mergeMessages(liveMessages, message);
                        // Task 04-3: a freshly arrived voice note is born `pending`,
                        // and a text message is born `done`. Stamping HERE rather
                        // than at the bubble keeps the state on the row, so it
                        // survives the render-window cap and re-mounts.
                        set({ messages: stampMessagesWithTranscription(merged) });
                    }
                }
                // An inbound utterance clears the typing flag for that entity.
                if (data.entity_id) {
                    set({ typingByEntity: setEntityFlag(get().typingByEntity, data.entity_id, false) });
                }
                /**
                 * Participant broadcast (phone ChatroomPolicy.routeIncoming):
                 * a cognition-bearing partner authored ITS POV copy; mirror the
                 * SAME payload onto the other local participant sessions — in
                 * particular the persona's, where the engine's Session
                 * Utterance Recorder writes the persona-POV copy. Without this
                 * the persona-pivoted timeline (the one the desktop reads)
                 * loses the AI's messages on reload.
                 *
                 * Directional + idempotent: only the persona's OWN session is
                 * excluded (relaying it would re-enter cognition and produce a
                 * second reply), and each origin id is relayed at most once.
                 * This branch is a FALLBACK recorder sink, never a UI event:
                 * the engine does not echo it back (no-echo invariant), so the
                 * bubble above is not duplicated.
                 */
                if (eventType === 'ENTITY_UTTERANCE' && payload.status === 'NEW'
                    && meta?.scopeKey && meta?.entityId) {
                    const active = get().activeConversation;
                    const personaId = active?.personaId || getActivePersonaId();
                    const capabilities = meta.socket?.capabilities || [];
                    const originMessageId = data.message_id || data.id || '';
                    if (shouldRelayUtterance({
                        originEntityId: meta.entityId,
                        originCapabilities: capabilities,
                        personaId,
                    }) && rememberRelayedOrigin(originMessageId)) {
                        for (const [entityId, sibling] of chatSockets(meta.scopeKey)) {
                            if (entityId === meta.entityId || !sibling.connected) continue;
                            sibling.sendEvent('ENTITY_UTTERANCE', data);
                        }
                    }
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
                // Transcribed voice note: patch the message's content in place
                // (Task 04-3 step 1: `done`).
                //
                // The engine's STT_OUTPUT_TEXT carries an `events.Utterance`, so
                // both `message_id` and `content` are at the top level. The
                // attempt window closes here: a late answer still lands, and the
                // content alone is enough for the state to derive `done`.
                if (data.message_id) {
                    clearTranscriptionAttempt(data.message_id);
                    const patched = replaceMessage(get().messages, {
                        id: data.message_id,
                        content: data.content || '',
                    });
                    set({ messages: stampMessagesWithTranscription(patched) });
                }
                break;
            }
            case 'STT_ERROR': {
                // An explicit STT failure. Nothing in the engine emits this today
                // (the direct-audio path only logs), but the state machine has to
                // honour it if it ever does — and the 20 s timeout covers the
                // silent case, which is the one that actually happens.
                clearAllTranscriptionAttempts();
                set({ messages: markPendingTranscriptionsFailed(get().messages) });
                break;
            }
            default:
                break;
        }
    },

    // ── Sending ──────────────────────────────────────────────────────────

    /**
     * Send a text message. `ownEntityId` is the persona to speak as.
     *
     * The frame goes out on EVERY participant session of the open chat (phone
     * Chatroom policy): the partner's cognition answers it, and the persona's
     * session is the one where the engine's Session Utterance Recorder authors
     * the persona-POV copy — the copy this UI reads back. `entity_id` always
     * names the SPEAKER (the persona), whichever session carries it.
     *
     * @param {string} ownEntityId
     * @param {string} content
     * @param {{ replyToMessageId?: string, additionalEffects?: object }} [options]
     */
    sendText: (ownEntityId, content, { replyToMessageId, additionalEffects } = {}) => {
        const { activeConversation } = get();
        if (!activeConversation || !content?.trim()) return false;
        const { personaId, sessions } = openChatSessions(activeConversation);
        if (sessions.length === 0) return false;
        const speakerId = ownEntityId || personaId;

        /**
         * Optimistic append. A session NEVER receives its own utterance back:
         * that is the engine's no-echo invariant (cognition only emits the AI's
         * response, and the Session Utterance Recorder never re-emits), so
         * nothing on the socket will render this row. The engine also mints its
         * own row id per POV, so the next REST read converges on the canonical
         * copy and `mergeMessages` keeps the timeline stable meanwhile.
         */
        const messageId = generateEventId();
        const now = new Date().toISOString();
        const optimistic = {
            id: messageId,
            entity_id: activeConversation.entityId,
            sender_entity_id: speakerId,
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
        // Task 04-4 step 4: the user is demonstrably watching this thread, so an
        // AI voice reply within the next 30 s may play on its own.
        markUserSend();

        const ok = sendOnParticipantSessions(sessions, (socket) => socket.sendText({
            entityId: speakerId,
            content,
            messageId,
            replyToMessageId,
            additionalEffects,
        }));
        if (!ok) {
            // No session was open — roll back the optimistic row.
            set({ messages: removeMessage(get().messages, messageId) });
        }
        return ok;
    },

    /**
     * Send a voice note (base64 audio, no data-URL prefix).
     *
     * ONE message id is minted here and replayed on every participant session:
     * the id is the cross-POV idempotency key (`origin_message_id`) the engine's
     * recorder dedupes on, so the two POV copies must agree on it.
     *
     * @param {string} ownEntityId
     * @param {{ audioBase64: string, mimeType: string, duration?: number }} audio
     */
    sendAudio: (ownEntityId, { audioBase64, mimeType, duration }) => {
        const { activeConversation } = get();
        if (!activeConversation) return false;
        const { personaId, sessions } = openChatSessions(activeConversation);
        if (sessions.length === 0) return false;
        const messageId = generateEventId();

        /**
         * Optimistic `pending` (Task 04-3 step 1).
         *
         * Unlike sendText, the row here has NO local id yet: the engine mints the
         * message id server-side (modules/cognition.go assigns
         * utils.GenerateMessageID(), deliberately ignoring the client's), so
         * there is nothing to append optimistically. The attempt window is
         * therefore keyed by the local event id and is used only to arm the
         * 20 s deadline; the PENDING state that matters visually is stamped once
         * the engine's row arrives — {@link handleSocketEvent} stamps every
         * incoming batch, so the row is born pending, without a second request.
         *
         * When it arrives it is stamped `pending`, its window expires into
         * `failed` and the bubble offers Retry. That is exactly the acceptance
         * path ("a forced STT failure shows Retry").
         */
        const ok = sendOnParticipantSessions(sessions, (socket) => socket.sendAudio({
            entityId: ownEntityId || personaId,
            audioBase64,
            mimeType,
            duration,
            messageId,
        }));
        if (ok) {
            armAudioSendWindow(get, set);
            markUserSend();
        }
        return ok;
    },

    /**
     * Re-run speech-to-text for one voice note WITHOUT creating a second message
     * (Task 04-3 step 3, option b).
     *
     * The endpoint re-reads the stored blob server-side, so no audio is sent and
     * the row is patched in place. On success the returned content and
     * `message_type` are applied verbatim — the engine promotes an audio row to
     * 'combined', which is what keeps the audio bubble (and the "this was a voice
     * note" affordance) alongside the new text.
     *
     * @param {string} messageId
     * @returns {Promise<boolean>} true when the text landed
     */
    retranscribeMessage: async (messageId) => {
        const target = get().messages.find((message) => message.id === messageId);
        if (!target || !canRetranscribeMessage(target)) return false;

        // Optimistic `pending`: the button disappears and a spinner takes its
        // place, so a second press is impossible while the request is in flight.
        set({
            messages: replaceMessage(get().messages, {
                id: messageId,
                transcription: 'pending',
            }),
        });
        openTranscriptionAttempt(messageId, () => {
            set({
                messages: markPendingTranscriptionsFailed(get().messages),
            });
        });

        try {
            const response = await chatActionService.retranscribeMessage(messageId);
            clearTranscriptionAttempt(messageId);
            set({
                messages: replaceMessage(
                    get().messages,
                    transcriptionPatchFromResponse(messageId, response),
                ),
            });
            return true;
        } catch (error) {
            clearTranscriptionAttempt(messageId);
            // Failed retry → back to `failed` so Retry is pressable again, plus
            // the provider's message verbatim: it is the whole diagnostic value
            // of the feature (a bad key, a missing model, an unsupported audio
            // container all read differently).
            set({
                messages: replaceMessage(get().messages, {
                    id: messageId,
                    transcription: TRANSCRIPTION_FAILED,
                }),
            });
            // The engine's body is surfaced VERBATIM, matching every other write
            // in this store (`error.message || translate(...)`). That is also what
            // makes the provider's own words ("401 invalid api key", "unsupported
            // audio container") visible — the entire diagnostic value of the
            // feature — without interpolating them through a translation, which
            // would mangle a message that is not a template.
            toast.error(transcriptionErrorMessage(error) || translate('chat:bubble.retryTranscriptionFailed'));
            return false;
        }
    },

    /**
     * Send an image message (base64, no data-URL prefix).
     *
     * Like sendAudio, ONE message id rides every participant session so both
     * POV copies share the engine's idempotency key.
     *
     * @param {string} ownEntityId
     * @param {{ imageBase64: string, mimeType: string, caption?: string }} image
     */
    sendImage: (ownEntityId, { imageBase64, mimeType, caption }) => {
        const { activeConversation } = get();
        if (!activeConversation) return false;
        const { personaId, sessions } = openChatSessions(activeConversation);
        if (sessions.length === 0) return false;
        const messageId = generateEventId();
        const ok = sendOnParticipantSessions(sessions, (socket) => socket.sendImage({
            entityId: ownEntityId || personaId,
            imageBase64,
            mimeType,
            caption,
            messageId,
        }));
        // An image send also counts as "the user is watching" for the autoplay
        // window: they are in the composer, and an AI voice reply is expected.
        if (ok) markUserSend();
        return ok;
    },

    /**
     * Edit a previously sent message (F9).
     *
     * Every participant copy of the message is that session's own row, so the
     * edit is written on every session of the chat.
     *
     * @param {string} ownEntityId
     * @param {string} messageId
     * @param {string} content
     */
    editMessage: (ownEntityId, messageId, content) => {
        const { activeConversation } = get();
        if (!activeConversation) return false;
        const { personaId, sessions } = openChatSessions(activeConversation);
        if (sessions.length === 0) return false;
        const ok = sendOnParticipantSessions(sessions, (socket) => socket.sendEdit({
            messageId,
            entityId: ownEntityId || personaId,
            content,
        }));
        if (ok) {
            set({ messages: replaceMessage(get().messages, { id: messageId, content, is_edited: true }) });
        }
        return ok;
    },

    // ── Message actions (Task 02-6) ──────────────────────────────────────
    //
    // Every action here is scoped to ONE message and follows the same beats as
    // the conversation actions: patch the timeline locally, call the engine,
    // then reconcile (reaction) or roll back + toast (pin / delete).

    /**
     * Toggle one emoji reaction on a message.
     *
     * The ENGINE is the authority on `reactions_json`: it reads, mutates and
     * re-marshals the column inside one transaction, so two rapid taps cannot
     * lose an update. The local patch exists only so the chip appears before the
     * round-trip; the response then REPLACES it. On failure the bubble goes back
     * to what the engine last told us.
     *
     * @param {string} messageId
     * @param {string} emoji
     * @returns {Promise<boolean>} true when the engine accepted the change
     */
    toggleReaction: async (messageId, emoji) => {
        const { messages } = get();
        const target = messages.find((m) => m.id === messageId);
        if (!target || !emoji) return false;

        const op = nextReactionOp(target.reactions_json, emoji);
        const optimistic = toggleReaction(parseReactions(target.reactions_json), emoji);

        set({
            messages: replaceMessage(messages, {
                id: messageId,
                reactions_json: optimistic.reactions.length ? optimistic.json : '',
            }),
        });

        try {
            const resp = await chatActionService.setMessageReaction(messageId, emoji, op);
            // Prefer the engine's encoded column; fall back to its parsed array
            // (the handler emits `reactions_json: null` for an empty set).
            const encoded = resp?.reactions_json
                || (Array.isArray(resp?.reactions) && resp.reactions.length
                    ? JSON.stringify(resp.reactions)
                    : '');
            set({ messages: replaceMessage(get().messages, { id: messageId, reactions_json: encoded }) });
            return true;
        } catch (error) {
            set({
                messages: replaceMessage(get().messages, {
                    id: messageId,
                    reactions_json: target.reactions_json || '',
                }),
                error: error.message,
            });
            toast.error(error.message || translate('chat:errors.generic'));
            return false;
        }
    },

    /**
     * Pin / unpin one message.
     *
     * A pinned message shows a 📌 marker only — the timeline order does NOT
     * change in 1.0. Reordering a live list to float a pin would move every
     * message under the reader's pointer, and the marker is enough to find it.
     *
     * @param {string} messageId
     * @param {boolean} pinned
     * @returns {Promise<boolean>}
     */
    setMessagePinned: async (messageId, pinned) => {
        const target = get().messages.find((m) => m.id === messageId);
        if (!target) return false;

        set({ messages: replaceMessage(get().messages, { id: messageId, is_pinned: !!pinned }) });
        try {
            await chatActionService.setMessagePinned(messageId, !!pinned);
            toast.success(translate(pinned ? 'chat:toast.messagePinned' : 'chat:toast.messageUnpinned'));
            return true;
        } catch (error) {
            set({
                messages: replaceMessage(get().messages, {
                    id: messageId,
                    is_pinned: !!target.is_pinned,
                }),
                error: error.message,
            });
            toast.error(error.message || translate('chat:errors.generic'));
            return false;
        }
    },

    /**
     * Delete one message: the engine tombstones it, then it leaves the timeline.
     *
     * The local removal happens ONLY on success — unlike a pin, a failed delete
     * must not briefly show the message as gone, because the user would have no
     * way to tell whether it actually disappeared.
     *
     * @param {string} messageId
     * @returns {Promise<boolean>}
     */
    deleteMessage: async (messageId) => {
        const target = get().messages.find((m) => m.id === messageId);
        if (!target) return false;
        try {
            await chatActionService.deleteMessage(messageId);
            set({ messages: removeMessage(get().messages, messageId) });
            toast.success(translate('common:toast.messageDeleted'));
            return true;
        } catch (error) {
            set({ error: error.message });
            toast.error(error.message || translate('chat:errors.generic'));
            return false;
        }
    },

    /**
     * Remove a message from the LOCAL timeline only (no engine call).
     *
     * Kept because the optimistic send path uses it to roll back a message that
     * never reached the socket. Deleting a real message goes through
     * {@link deleteMessage}, which asks the engine first.
     */
    deleteMessageLocal: (messageId) => {
        set({ messages: removeMessage(get().messages, messageId) });
    },

    /**
     * Send one of the character's authored greetings as the opening line.
     *
     * ── WHY THIS IS A NORMAL MESSAGE ───────────────────────────────────────
     *
     * The engine CAN replace a greeting (`GENERATE_GREETING`) but only while the
     * greeting is the interaction's sole message, and it REPLACES the row rather
     * than letting the user pick which text it becomes — the alternates are
     * authored card data, not something the engine can be told to select. What
     * the user wants from "try another greeting" is the same text the app
     * delivers as a first message, so this sends it through the ordinary
     * `ENTITY_UTTERANCE` path: the pipeline persists it, the bubble appears
     * optimistically, and the AI answers it like any other opening.
     *
     * The text is treated as the USER's first message (never the character's):
     * the persona speaks it, so a picker can never be mistaken for the AI having
     * said something it did not.
     *
     * @param {string} ownEntityId - the persona we chat as
     * @param {string} text - the chosen greeting text
     * @returns {boolean} true when the socket accepted it
     */
    sendGreetingAlternate: (ownEntityId, text) => {
        const content = (text || '').trim();
        if (!content) return false;
        return get().sendText(ownEntityId, content);
    },

    /**
     * Change the conversation's reply mode (F10).
     *
     * Phone parity: the mode is remembered on EVERY session (so a reconnect
     * replays it in INIT_ENTITY) but only the PARTNER sessions are told to
     * switch — the persona has no reply pacing. The payload names the persona
     * as the entity whose mode is changing, exactly like the phone.
     */
    setReplyMode: (mode) => {
        const { activeConversation } = get();
        if (!activeConversation) return false;
        const { personaId, sessions } = openChatSessions(activeConversation);
        if (sessions.length === 0) return false;
        let sent = false;
        for (const [entityId, socket] of sessions) {
            socket.applyReplyMode(mode);
            if (entityId === personaId) continue;
            if (socket.sendEvent('SET_REPLY_MODE', { entity_id: personaId, reply_mode: mode })) {
                sent = true;
            }
        }
        return sent;
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
        clearReconnectStatusTimer();
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
            connectionDropSince: null,
            typingByEntity: {},
            recordingByEntity: {},
            wireFrames: [],
            detailCloseTick: 0,
            openConversationRequest: null,
            forwardRequest: null,
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
