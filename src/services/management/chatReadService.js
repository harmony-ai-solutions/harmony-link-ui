import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';
import { listEntities } from './entityService.js';
import { normalizeChatConversation, normalizeChatMessage } from '../../store/chatStoreUtils.js';

/**
 * Desktop Chat — REST history reads over the engine's parity chat surface
 * (task 3-1b / merge follow-up D3).
 *
 * The engine identifies a conversation by its **participant_key** — the sorted
 * participant set — and mints a NEW interaction whenever that set changes. So
 * every read here is keyed by `participant_key`; `interaction_id` rides along
 * only as a navigation handle (any id of the key group navigates to the same
 * conversation).
 *
 * Endpoints (all under the management API, admin-keyed):
 *   GET  /entities/:id/chat-list                                   → conversation rows
 *   GET  /entities/:id/conversations/:participantKey/messages      → message window (opaque cursor)
 *   GET  /entities/:id/emoji-actions                               → emoji actions
 *   GET  /entities                                                 → entities (partners + personas)
 *   GET  /messages/:id/audio | /messages/:id/image                 → media bytes
 *   POST /entities/:id/conversations/:participantKey/read          → mark read (participant_key scoped)
 *
 * This module normalises the parity wire shapes into the flat camel/snake shape
 * the chat store, list and bubbles already consume, so the UI stays unchanged
 * while the transport is the parity layer.
 *
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} entity_id
 * @property {string} sender_entity_id
 * @property {string} interaction_id
 * @property {string} content
 * @property {string} message_type
 * @property {number} audio_duration
 * @property {boolean} has_audio
 * @property {string} audio_mime_type
 * @property {boolean} has_image
 * @property {string} image_mime_type
 * @property {boolean} is_edited
 * @property {string} edit_of_message_id
 * @property {string} reply_to_message_id
 * @property {string} reactions_json
 * @property {boolean} is_pinned
 * @property {boolean|null} is_read
 * @property {string} created_at
 * @property {string} updated_at
 *
 * @typedef {Object} ChatConversation
 * @property {string} interaction_id    navigation handle only
 * @property {string} participant_key   the conversation identity
 * @property {string} entity_id         the POV (AI) entity that owns the thread
 * @property {string[]} participant_ids
 * @property {string} partner_entity_id the other participant (private threads)
 * @property {string} scope
 * @property {string} last_activity_at
 * @property {number} unread_count
 * @property {boolean} pinned
 * @property {boolean} archived
 * @property {string} reply_mode
 * @property {ChatMessage|null} last_message
 */

/** Build an authenticated management-API URL for `path`. */
function apiUrl(path) {
    return `${getManagementApiUrl()}${getApiPath()}${path}`;
}

/**
 * List the POV entity's conversations, newest-message first, one row per
 * participant_key.
 *
 * Follows `has_more`/`next_offset` until the list is exhausted so a busy entity
 * cannot silently lose whole conversations to the page cap (the retired
 * `/api/chat/conversations` had a hard LIMIT 200).
 *
 * @param {string} entityId - the AI entity whose threads to list.
 * @param {{ limit?: number }} [options] - page size (engine caps at 200).
 * @returns {Promise<ChatConversation[]>}
 */
export async function listConversations(entityId, { limit = 200 } = {}) {
    const out = [];
    let offset = 0;
    // Hard stop so a broken has_more can never loop forever.
    for (let page = 0; page < 20; page += 1) {
        const params = new URLSearchParams({ limit: String(limit) });
        if (offset) params.set('offset', String(offset));
        const resp = await fetch(
            apiUrl(`/entities/${encodeURIComponent(entityId)}/chat-list?${params.toString()}`),
            { headers: getAuthHeaders() }
        );
        await handleResponse(resp, 'Failed to list conversations');
        const data = await resp.json();
        const rows = data?.conversations || [];
        for (const row of rows) out.push(normalizeChatConversation(row, entityId));

        if (!data?.has_more || rows.length === 0) break;
        offset = Number.isFinite(data?.next_offset) ? data.next_offset : offset + rows.length;
    }
    return out;
}

/**
 * Load the GLOBAL inbox: every active conversation across ALL companions in one
 * call (`GET /entities/chat-list`, Tasks 02-1/02-4). This replaces the
 * per-companion fan-out (one `listConversations` per partner, merged
 * client-side): the dedupe by `participant_key`, the unread count, the settings
 * join and the `pinned DESC, last_activity_at DESC` ordering all happen in SQL,
 * so the client must never re-sort the result.
 *
 * Each row already carries everything the inbox renders — its owning companion
 * (`entity_id`, plus the companion's display name / avatar id), the
 * `pinned` / `archived` / `muted` / `entity_disabled` flags and the last-message
 * preview — so naming a row costs no second request.
 *
 * Archived threads are EXCLUDED by default; with `includeArchived` they come
 * back in a SEPARATE `archived` array (bounded server-side), which the inbox
 * renders behind its collapsed "Archived (N)" section.
 *
 * @param {{ includeArchived?: boolean, limit?: number }} [options]
 * @returns {Promise<{conversations: object[], archived: object[], hasMore: boolean}>}
 */
export async function listInbox({ includeArchived = false, limit = 200 } = {}) {
    const conversations = [];
    const archived = [];
    let hasMore = false;
    let offset = 0;

    // Follow has_more/next_offset so a busy inbox cannot silently lose threads
    // to the page cap. Hard stop so a broken has_more can never loop forever.
    for (let page = 0; page < 20; page += 1) {
        const params = new URLSearchParams({ limit: String(limit) });
        if (offset) params.set('offset', String(offset));
        if (includeArchived) params.set('include_archived', '1');
        const resp = await fetch(
            apiUrl(`/entities/chat-list?${params.toString()}`),
            { headers: getAuthHeaders() }
        );
        await handleResponse(resp, 'Failed to load the inbox');
        const data = await resp.json();
        const rows = data?.conversations || [];
        // A global row names its OWNING companion — that is the POV the thread
        // is listed from and the entity the row is named/avatar'd by.
        for (const row of rows) {
            conversations.push(normalizeChatConversation(row, row?.entity_id || ''));
        }

        // The archived array is a bounded first page and is repeated verbatim on
        // every response — collect it once or pagination would duplicate rows.
        if (page === 0 && Array.isArray(data?.archived)) {
            for (const row of data.archived) {
                archived.push(normalizeChatConversation(row, row?.entity_id || ''));
            }
        }

        hasMore = !!data?.has_more;
        if (!hasMore || rows.length === 0) break;
        offset = Number.isFinite(data?.next_offset) ? data.next_offset : offset + rows.length;
    }

    return { conversations, archived, hasMore };
}

/**
 * Load one page of a conversation's messages, oldest-first. The conversation is
 * addressed by `participantKey`, so the window spans EVERY interaction of the
 * key (a membership change closes an interaction but must not truncate the
 * timeline).
 *
 * `before` is the engine's OPAQUE cursor (`next_cursor` from the previous
 * response, or any previously returned message's `created_at` verbatim). It is
 * the raw stored timestamp text — never re-format it client-side.
 *
 * @param {string} entityId
 * @param {string} participantKey
 * @param {{ before?: string|null, limit?: number }} [options]
 * @returns {Promise<{messages: ChatMessage[], hasMore: boolean, nextCursor: string|null}>}
 */
export async function listMessages(entityId, participantKey, { before, limit = 50 } = {}) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);
    const resp = await fetch(
        apiUrl(`/entities/${encodeURIComponent(entityId)}/conversations/${encodeURIComponent(participantKey)}/messages?${params.toString()}`),
        { headers: getAuthHeaders() }
    );
    await handleResponse(resp, 'Failed to list messages');
    const data = await resp.json();
    const messages = (data?.messages || [])
        .map(normalizeChatMessage)
        .filter(Boolean);
    return {
        messages,
        hasMore: !!data?.has_more,
        nextCursor: data?.next_cursor || null,
    };
}

/**
 * List the entities available for chat: AI entities to talk to and user
 * entities (personas) to talk as. Composed from `GET /entities`; the parity
 * chat surface needs no separate chat-scoped projection.
 *
 * @returns {Promise<Array<{id: string, entity_type: string, alias: string,
 *   display_name: string, character_profile_id: string, is_disabled: boolean}>>}
 */
export async function listChatEntities() {
    const entities = await listEntities();
    return (Array.isArray(entities) ? entities : []).map((entity) => {
        const profileId = entity?.character_profile_id || entity?.character_profile?.id || '';
        const profileName = entity?.character_profile?.name || '';
        return {
            id: entity?.id || '',
            entity_type: entity?.entity_type || 'ai',
            alias: entity?.alias || '',
            display_name: profileName || entity?.alias || entity?.id || '',
            character_profile_id: profileId,
            is_disabled: !!entity?.is_disabled,
            // Authored alternate greetings (Task 02-7 step 3). The `GET /entities`
            // payload nests them on `character_profile`, so they are lifted here
            // rather than at every call site; the raw JSON string is passed
            // through and parsed by `entityAlternateGreetings`.
            alternate_greetings: entity?.alternate_greetings
                ?? entity?.character_profile?.alternate_greetings
                ?? '',
        };
    }).filter((entity) => entity.id);
}

/**
 * List an entity's emoji actions (F11). These emoji also shift the character's
 * mood, so the picker marks them as actions rather than plain reactions.
 *
 * @param {string} entityId
 * @returns {Promise<Array<{id: string, emoji_native: string,
 *   substitution_text?: string, emotion_effect?: string}>>}
 */
export async function listEmojiActions(entityId) {
    const resp = await fetch(
        apiUrl(`/entities/${encodeURIComponent(entityId)}/emoji-actions`),
        { headers: getAuthHeaders() }
    );
    await handleResponse(resp, 'Failed to list emoji actions');
    const data = await resp.json();
    return data?.emoji_actions || [];
}

/**
 * Mark a conversation read (or reset the last message unread). Scoped by
 * participant_key, matching the chat-list badge's `CountUnreadByParticipantKeys`
 * scope — the two can never disagree.
 *
 * @param {string} entityId
 * @param {string} participantKey
 * @param {{ upToMessageId?: string, read?: boolean }} [options]
 * @returns {Promise<{status: string, updated: number}>}
 */
export async function markConversationRead(entityId, participantKey, { upToMessageId, read = true } = {}) {
    const body = { read };
    if (upToMessageId) body.up_to_message_id = upToMessageId;
    const resp = await fetch(
        apiUrl(`/entities/${encodeURIComponent(entityId)}/conversations/${encodeURIComponent(participantKey)}/read`),
        { method: 'POST', headers: getJsonHeaders(), body: JSON.stringify(body) }
    );
    await handleResponse(resp, 'Failed to mark conversation read');
    return await resp.json();
}

/**
 * Build the URL for a message's audio blob. Audio is fetched on demand by the
 * shared audio player (never inlined in the timeline payload).
 *
 * @param {string} messageId
 * @returns {string}
 */
export function getMessageAudioUrl(messageId) {
    return apiUrl(`/messages/${encodeURIComponent(messageId)}/audio`);
}

/**
 * Build the URL for a message's image blob, fetched on demand by the lightbox.
 *
 * @param {string} messageId
 * @returns {string}
 */
export function getMessageImageUrl(messageId) {
    return apiUrl(`/messages/${encodeURIComponent(messageId)}/image`);
}

/**
 * Fetch a message's audio blob as an object URL (bearer-free fetch so the API
 * key header is applied). The caller is responsible for revoking the URL.
 *
 * @param {string} messageId
 * @returns {Promise<string|null>} object URL, or null when no audio exists
 */
export async function fetchMessageAudioObjectUrl(messageId) {
    const resp = await fetch(getMessageAudioUrl(messageId), { headers: getAuthHeaders() });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
}

/**
 * Fetch a message's image blob as an object URL. Caller revokes it.
 *
 * @param {string} messageId
 * @returns {Promise<string|null>} object URL, or null when no image exists
 */
export async function fetchMessageImageObjectUrl(messageId) {
    const resp = await fetch(getMessageImageUrl(messageId), { headers: getAuthHeaders() });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
}
