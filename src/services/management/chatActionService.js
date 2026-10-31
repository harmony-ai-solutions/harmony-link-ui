import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';
import { getActivePersonaId } from './activePersona.js';

/**
 * Desktop Chat — user-intent WRITE actions (Task 02-5).
 *
 * Every call here writes **presentation state that belongs to the human user**
 * (pinned, archived, muted, read, deleted) — never a message. The AI pipeline
 * stays the only writer of conversation content, mirroring the engine's
 * `management/routes_chat_write.go` design rule.
 *
 * ── PARTICIPANT-KEYED, PERSONA-PIVOTED ───────────────────────────────────
 *
 * The engine's interaction-keyed write routes are gone. Every intent now has
 * exactly one address, keyed by `participant_key`, with `:id` = the ACTIVE
 * PERSONA (the POV the desktop chats as):
 *
 *   pin + archive   PUT  /entities/:persona/chat-settings/:participantKey
 *   mute            PUT  /entities/:persona              {"is_muted"}
 *   read/unread     POST /entities/:persona/conversations/:participantKey/read
 *   delete thread   DELETE /entities/:persona/conversations/:participantKey
 *
 * A thread's participant key spans every interaction of that key group, so no
 * caller needs an `interaction_id` any more (which a brand-new chat did not
 * have until `INIT_ENTITY` resolved it). The companion entity id is kept on
 * the target for display/row patching only.
 *
 * "Mark unread" uses the same participant-keyed read route with `{read:false}`
 * (set-to-1 semantics, the same the phone app uses).
 *
 * ── Errors ───────────────────────────────────────────────────────────────
 *
 * `handleResponse` surfaces the engine's `{"error": …}` body as the Error
 * message, which matters for delete: a `409` carries the human copy
 * "Close the conversation before deleting it." Callers show that verbatim.
 */

/** Build an authenticated management-API URL for `path`. */
function apiUrl(path) {
    return `${getManagementApiUrl()}${getApiPath()}${path}`;
}

/**
 * Resolve the identity a write needs from either shape the UI holds:
 * an inbox row (snake_case, `participant_key`) or the open conversation
 * (camelCase, `participantKey`).
 *
 * `personaId` is the POV every route addresses; it defaults to the single
 * active-persona seam so callers never embed a persona id. `companionEntityId`
 * is display/row-patching data only.
 *
 * @typedef {Object} ConversationTarget
 * @property {string} personaId
 * @property {string} participantKey
 * @property {string} companionEntityId
 *
 * @param {object|null|undefined} conversation
 * @returns {ConversationTarget}
 */
export function conversationTarget(conversation) {
    if (!conversation) {
        return { personaId: getActivePersonaId(), participantKey: '', companionEntityId: '' };
    }
    return {
        personaId: conversation.persona_id || conversation.personaId || getActivePersonaId(),
        participantKey: conversation.participant_key || conversation.participantKey || '',
        companionEntityId: conversation.entity_id || conversation.entityId || '',
    };
}

/** True when a target can address the participant-keyed write surface. */
export function canWriteConversation(conversation) {
    const target = conversationTarget(conversation);
    return !!(target.personaId && target.participantKey);
}

/**
 * Pin / unpin a conversation.
 *
 * Pin state lives on `chat_conversation_settings`, keyed by `participant_key`
 * (one row per conversation, not per interaction), under the persona POV.
 *
 * @param {object} conversation - inbox row or open conversation
 * @param {boolean} pinned
 * @returns {Promise<object>} the persisted settings row (or an ack)
 */
export async function setConversationPinned(conversation, pinned) {
    const { personaId, participantKey } = conversationTarget(conversation);
    if (!participantKey) throw new Error('This conversation cannot be pinned yet.');
    const resp = await fetch(
        apiUrl(`/entities/${encodeURIComponent(personaId)}/chat-settings/${encodeURIComponent(participantKey)}`),
        { method: 'PUT', headers: getJsonHeaders(), body: JSON.stringify({ pinned: !!pinned }) }
    );
    await handleResponse(resp, 'Failed to update the pin');
    return await resp.json();
}

/**
 * Archive / unarchive a conversation. The row moves between the inbox's active
 * and archived arrays; the server keeps it out of the default list either way.
 *
 * @param {object} conversation
 * @param {boolean} archived
 */
export async function setConversationArchived(conversation, archived) {
    const { personaId, participantKey } = conversationTarget(conversation);
    if (!participantKey) throw new Error('This conversation cannot be archived yet.');
    const resp = await fetch(
        apiUrl(`/entities/${encodeURIComponent(personaId)}/chat-settings/${encodeURIComponent(participantKey)}`),
        { method: 'PUT', headers: getJsonHeaders(), body: JSON.stringify({ archived: !!archived }) }
    );
    await handleResponse(resp, 'Failed to update the archive');
    return await resp.json();
}

/**
 * Mute / unmute a conversation.
 *
 * Mute is ENTITY-level (`entities.is_muted`) — muting a partner changes every
 * thread they own, not one thread. The route is the entity update itself, with
 * `:id` = the persona POV per the desktop's persona pivot.
 *
 * @param {object} conversation
 * @param {boolean} muted
 */
export async function setConversationMuted(conversation, muted) {
    const { companionEntityId } = conversationTarget(conversation);
    if (!companionEntityId) throw new Error('This conversation has no AI partner to mute.');
    // Mute is a property of the COMPANION entity, not a POV-scoped intent:
    // the phone app mutes the partner (PUT /entities/:companionId) and the
    // inbox row's muted flag reads the companion's entity state — so the
    // persona pivot deliberately does NOT apply here. The entity update
    // route carries is_muted beside is_disabled and stamps updated_at,
    // which is what the phone syncs on.
    const resp = await fetch(
        apiUrl(`/entities/${encodeURIComponent(companionEntityId)}`),
        { method: 'PUT', headers: getJsonHeaders(), body: JSON.stringify({ is_muted: !!muted }) }
    );
    await handleResponse(resp, 'Failed to update mute');
    return await resp.json();
}

/**
 * Mark a conversation read (`read: true`) or bump its newest message back to
 * unread (`read: false`).
 *
 * One participant-keyed route for both: `read:true` clears the whole key group
 * and `read:false` restores the phone app's set-to-1 "mark unread" semantics.
 *
 * @param {object} conversation
 * @param {{ read?: boolean, upToMessageId?: string }} [options]
 * @returns {Promise<{updated?: number}>}
 */
export async function markConversationRead(conversation, { read = true, upToMessageId } = {}) {
    const { personaId, participantKey } = conversationTarget(conversation);
    if (!personaId || !participantKey) {
        throw new Error('This conversation cannot be marked read yet.');
    }

    const body = { read: !!read };
    if (upToMessageId) body.up_to_message_id = upToMessageId;
    const resp = await fetch(
        apiUrl(`/entities/${encodeURIComponent(personaId)}/conversations/${encodeURIComponent(participantKey)}/read`),
        { method: 'POST', headers: getJsonHeaders(), body: JSON.stringify(body) }
    );
    await handleResponse(resp, 'Failed to update the read state');
    return await resp.json();
}

/**
 * Soft-delete a whole thread (every interaction of its participant key and
 * every message in it).
 *
 * A `409` means the engine still has a live session for the entity ("Close the
 * conversation before deleting it."); the message is surfaced verbatim.
 *
 * @param {object} conversation
 * @returns {Promise<{status?: string, interactions?: number, messages?: number}>}
 */
export async function deleteConversation(conversation) {
    const { personaId, participantKey } = conversationTarget(conversation);
    if (!participantKey) {
        throw new Error('Nothing has been saved for this conversation yet.');
    }
    const resp = await fetch(
        apiUrl(`/entities/${encodeURIComponent(personaId)}/conversations/${encodeURIComponent(participantKey)}`),
        { method: 'DELETE', headers: getAuthHeaders() }
    );
    await handleResponse(resp, 'Failed to delete the conversation');
    return await resp.json();
}

// ── Message-level user intent (Task 02-6) ────────────────────────────────
//
// These act on ONE message, not on a thread, so they live under /messages/:id
// (the address Task 02-3 added beside the existing PATCH/DELETE pair). There is
// deliberately no participant-key fallback: a message id is globally unique and
// is the only handle these endpoints need.
//
// NOTE ON OPTIMISM. Unlike the conversation actions above, the CALLER decides
// whether to patch first. The engine is the authority on the resulting
// `reactions_json` (it is a read-modify-write inside one transaction), so a
// reaction is patched optimistically and then REPLACED by the server's answer —
// see chatStore.toggleReaction.

/**
 * Add or remove one emoji reaction on a message.
 *
 * The engine stores `reactions_json` as a JSON array of emoji strings and
 * returns the whole re-marshalled column plus its parsed form, so the caller
 * never has to reconstruct it (and can never lose a concurrent update).
 *
 * @param {string} messageId
 * @param {string} emoji
 * @param {'add'|'remove'} op
 * @returns {Promise<{reactions_json: string|null, reactions: string[]}>}
 */
export async function setMessageReaction(messageId, emoji, op = 'add') {
    if (!messageId) throw new Error('This message has not been saved yet.');
    if (!emoji) throw new Error('Pick a reaction first.');
    const resp = await fetch(
        apiUrl(`/messages/${encodeURIComponent(messageId)}/reactions`),
        {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify({ emoji, op: op === 'remove' ? 'remove' : 'add' }),
        }
    );
    await handleResponse(resp, 'Failed to update the reaction');
    return await resp.json();
}

/**
 * Pin or unpin one message.
 *
 * Pinning a MESSAGE is unrelated to pinning a CONVERSATION (that one lives on
 * `chat_conversation_settings`). In 1.0 a pinned message only shows a 📌
 * marker — it is deliberately not lifted to the top of the timeline, because
 * reordering on a live-updating list makes rows jump under the pointer.
 *
 * @param {string} messageId
 * @param {boolean} pinned
 * @returns {Promise<{is_pinned: boolean}>}
 */
export async function setMessagePinned(messageId, pinned) {
    if (!messageId) throw new Error('This message has not been saved yet.');
    const resp = await fetch(
        apiUrl(`/messages/${encodeURIComponent(messageId)}/pin`),
        {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify({ pinned: !!pinned }),
        }
    );
    await handleResponse(resp, 'Failed to update the pin');
    return await resp.json();
}

/**
 * Re-run speech-to-text on a voice note's STORED audio and patch the same row
 * (Task 04-3).
 *
 * Deliberately NOT a re-sent `STT_INPUT_AUDIO`: on this engine the inbound
 * utterance path mints a new server-side message id and persists a new row, so
 * retrying that way would fork the voice note into a second bubble and leave the
 * original untranscribed. The engine re-reads the stored `audio_data` instead,
 * which is why no audio crosses this wire.
 *
 * The body is optional and only carries STT overrides; with no body the engine
 * uses the conversation's mapped STT config — the same one the live path would
 * have used.
 *
 * @param {string} messageId
 * @param {{ stt_config_id?: string, provider?: string, provider_account_id?: string }} [options]
 * @returns {Promise<{status: string, id: string, content: string,
 *   message_type: string, updated_at: string}>}
 */
export async function retranscribeMessage(messageId, options = {}) {
    if (!messageId) throw new Error('This message has not been saved yet.');
    const body = JSON.stringify(options || {});
    const resp = await fetch(
        apiUrl(`/messages/${encodeURIComponent(messageId)}/retranscribe`),
        { method: 'POST', headers: getJsonHeaders(), body }
    );
    await handleResponse(resp, 'Failed to transcribe this voice note');
    return await resp.json();
}

/**
 * Soft-delete one message (a tombstone — the row is never hard-deleted, because
 * the phone learns about a deletion by seeing `deleted_at`).
 *
 * @param {string} messageId
 * @returns {Promise<{status: string}>}
 */
export async function deleteMessage(messageId) {
    if (!messageId) throw new Error('This message has not been saved yet.');
    const resp = await fetch(
        apiUrl(`/messages/${encodeURIComponent(messageId)}`),
        { method: 'DELETE', headers: getAuthHeaders() }
    );
    await handleResponse(resp, 'Failed to delete the message');
    return await resp.json();
}
