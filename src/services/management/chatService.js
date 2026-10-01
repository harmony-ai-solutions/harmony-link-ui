import { getManagementApiUrl, getApiPath, getAuthHeaders, handleResponse } from './baseService.js';

/**
 * Desktop Chat — REST history reads (Phase 2-1).
 *
 * The engine stores conversation messages from the AI entity's perspective
 * (entity_id = the character, sender_entity_id = whoever spoke). These helpers
 * only READ history; all live sending goes through the WebSocket event pipeline
 * (see chatSocketService.js) so the engine's AI processing stays authoritative.
 *
 * @typedef {Object} ChatMessagePreview
 * @property {string} id
 * @property {string} sender_entity_id
 * @property {string} content
 * @property {string} message_type
 * @property {string} created_at
 *
 * @typedef {Object} ChatConversation
 * @property {string} interaction_id
 * @property {string} entity_id
 * @property {string[]} participant_ids
 * @property {string} partner_entity_id
 * @property {string} scope
 * @property {string} participant_key
 * @property {string} status
 * @property {string} last_activity_at
 * @property {number} unread_count
 * @property {ChatMessagePreview} [last_message]
 *
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} entity_id
 * @property {string} sender_entity_id
 * @property {string} interaction_id
 * @property {string} content
 * @property {string} message_type
 * @property {number} [audio_duration]
 * @property {boolean} has_audio
 * @property {string} [audio_mime_type]
 * @property {boolean} has_image
 * @property {string} [image_mime_type]
 * @property {boolean} is_edited
 * @property {string} [edit_of_message_id]
 * @property {string} [reply_to_message_id]
 * @property {string} [reactions_json]
 * @property {boolean} is_pinned
 * @property {boolean} is_read
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * List the chat threads owned by an entity, most-recently active first.
 * Private threads are de-duplicated by participant_key engine-side.
 *
 * @param {string} entityId - The AI entity (character) whose threads to list.
 * @param {{ limit?: number }} [options]
 * @returns {Promise<ChatConversation[]>}
 */
export async function listConversations(entityId, { limit } = {}) {
    const params = new URLSearchParams({ entity_id: entityId });
    if (limit) params.set('limit', String(limit));
    const resp = await fetch(
        `${getManagementApiUrl()}${getApiPath()}/chat/conversations?${params.toString()}`,
        { headers: getAuthHeaders() }
    );
    await handleResponse(resp, 'Failed to list conversations');
    const data = await resp.json();
    return data?.conversations || [];
}

/**
 * Load one page of an interaction's messages, oldest-first.
 *
 * @param {string} interactionId
 * @param {{ before?: string, limit?: number }} [options] - `before` is a
 *   keyset cursor (RFC3339 timestamp); omit it for the newest page.
 * @returns {Promise<{messages: ChatMessage[], hasMore: boolean}>}
 */
export async function listMessages(interactionId, { before, limit } = {}) {
    const params = new URLSearchParams();
    if (before) params.set('before', before);
    if (limit) params.set('limit', String(limit));
    const query = params.toString();
    const resp = await fetch(
        `${getManagementApiUrl()}${getApiPath()}/chat/conversations/${encodeURIComponent(interactionId)}/messages${query ? `?${query}` : ''}`,
        { headers: getAuthHeaders() }
    );
    await handleResponse(resp, 'Failed to list messages');
    const data = await resp.json();
    return { messages: data?.messages || [], hasMore: !!data?.has_more };
}

/**
 * List the entities available for chat: AI entities to talk to and user
 * entities (personas) to talk as.
 *
 * @returns {Promise<Array<{id: string, entity_type: string, alias: string,
 *   display_name: string, character_profile_id?: string, is_disabled: boolean}>>}
 */
export async function listChatEntities() {
    const resp = await fetch(
        `${getManagementApiUrl()}${getApiPath()}/chat/entities`,
        { headers: getAuthHeaders() }
    );
    await handleResponse(resp, 'Failed to list chat entities');
    const data = await resp.json();
    return data?.entities || [];
}

/**
 * List an entity's emoji actions (F11). These emoji also shift the character's
 * mood, so the picker can mark them as "actions" rather than plain reactions.
 *
 * @param {string} entityId
 * @returns {Promise<Array<{id: string, emoji_native: string,
 *   substitution_text?: string, emotion_effect?: string}>>}
 */
export async function listEmojiActions(entityId) {
    const resp = await fetch(
        `${getManagementApiUrl()}${getApiPath()}/chat/entities/${encodeURIComponent(entityId)}/emoji-actions`,
        { headers: getAuthHeaders() }
    );
    await handleResponse(resp, 'Failed to list emoji actions');
    const data = await resp.json();
    return data?.emoji_actions || [];
}

/**
 * Build the URL for a message's audio blob. Audio is fetched on demand by the
 * shared audio player (never inlined in the timeline payload).
 *
 * @param {string} messageId
 * @returns {string}
 */
export function getMessageAudioUrl(messageId) {
    return `${getManagementApiUrl()}${getApiPath()}/chat/messages/${encodeURIComponent(messageId)}/audio`;
}

/**
 * Build the URL for a message's image blob, fetched on demand by the lightbox.
 *
 * @param {string} messageId
 * @returns {string}
 */
export function getMessageImageUrl(messageId) {
    return `${getManagementApiUrl()}${getApiPath()}/chat/messages/${encodeURIComponent(messageId)}/image`;
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
