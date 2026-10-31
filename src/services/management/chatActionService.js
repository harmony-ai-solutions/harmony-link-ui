import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

/**
 * Desktop Chat — user-intent WRITE actions (Task 02-5).
 *
 * Every call here writes **presentation state that belongs to the human user**
 * (pinned, archived, muted, read, deleted) — never a message. The AI pipeline
 * stays the only writer of conversation content, mirroring the engine's
 * `management/routes_chat_write.go` design rule.
 *
 * ── Two addresses, one intent ────────────────────────────────────────────
 *
 * The engine exposes each intent twice, and they are NOT interchangeable:
 *
 *   interaction-keyed                        participant-key-keyed
 *   POST /entities/conversations/:iid/pin    PUT  /entities/:id/chat-settings/:key
 *   POST /entities/conversations/:iid/archive
 *   POST /entities/conversations/:iid/mute   PUT  /entities/:id {"is_muted"}
 *   POST /entities/conversations/:iid/read   POST /entities/:id/conversations/:key/read
 *   DELETE /entities/conversations/:iid      —
 *
 * The interaction-keyed routes are the accurate ones (a thread's *current*
 * interaction is what the inbox hands us) but they need an `interaction_id`,
 * which a brand-new chat does not have until `INIT_ENTITY` resolves it. The
 * participant-key routes need the owning `entity_id` + `participant_key`, which
 * every inbox row carries. Each helper therefore prefers the interaction route
 * and falls back to the participant-key one, so an action works both from the
 * list and from inside a freshly opened thread.
 *
 * "Mark unread" only exists on the participant-key route (`{read:false}` marks
 * the newest message unread — the same set-to-1 semantics the phone app uses),
 * because the interaction route is a read receipt that marks everything read.
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
 * @typedef {Object} ConversationTarget
 * @property {string} interactionId
 * @property {string} entityId
 * @property {string} participantKey
 *
 * @param {object|null|undefined} conversation
 * @returns {ConversationTarget}
 */
export function conversationTarget(conversation) {
    if (!conversation) return { interactionId: '', entityId: '', participantKey: '' };
    return {
        interactionId: conversation.interaction_id || conversation.interactionId || '',
        entityId: conversation.entity_id || conversation.entityId || '',
        participantKey: conversation.participant_key || conversation.participantKey || '',
    };
}

/** True when a target can address at least one of the two write surfaces. */
export function canWriteConversation(conversation) {
    const target = conversationTarget(conversation);
    return !!(target.interactionId || (target.entityId && target.participantKey));
}

/**
 * Pin / unpin a conversation.
 *
 * Pin state lives on `chat_conversation_settings`, keyed by `participant_key`
 * (one row per conversation, not per interaction) — resolving it from an
 * interaction is the engine's job on the interaction-keyed route.
 *
 * @param {object} conversation - inbox row or open conversation
 * @param {boolean} pinned
 * @returns {Promise<object>} the persisted settings row (or an ack)
 */
export async function setConversationPinned(conversation, pinned) {
    const { interactionId, entityId, participantKey } = conversationTarget(conversation);
    if (interactionId) {
        const resp = await fetch(
            apiUrl(`/entities/conversations/${encodeURIComponent(interactionId)}/pin`),
            { method: 'POST', headers: getJsonHeaders(), body: JSON.stringify({ pinned: !!pinned }) }
        );
        await handleResponse(resp, 'Failed to update the pin');
        return await resp.json();
    }
    if (entityId && participantKey) {
        const resp = await fetch(
            apiUrl(`/entities/${encodeURIComponent(entityId)}/chat-settings/${encodeURIComponent(participantKey)}`),
            { method: 'PUT', headers: getJsonHeaders(), body: JSON.stringify({ pinned: !!pinned }) }
        );
        await handleResponse(resp, 'Failed to update the pin');
        return await resp.json();
    }
    throw new Error('This conversation cannot be pinned yet.');
}

/**
 * Archive / unarchive a conversation. The row moves between the inbox's active
 * and archived arrays; the server keeps it out of the default list either way.
 *
 * @param {object} conversation
 * @param {boolean} archived
 */
export async function setConversationArchived(conversation, archived) {
    const { interactionId, entityId, participantKey } = conversationTarget(conversation);
    if (interactionId) {
        const resp = await fetch(
            apiUrl(`/entities/conversations/${encodeURIComponent(interactionId)}/archive`),
            { method: 'POST', headers: getJsonHeaders(), body: JSON.stringify({ archived: !!archived }) }
        );
        await handleResponse(resp, 'Failed to update the archive');
        return await resp.json();
    }
    if (entityId && participantKey) {
        const resp = await fetch(
            apiUrl(`/entities/${encodeURIComponent(entityId)}/chat-settings/${encodeURIComponent(participantKey)}`),
            { method: 'PUT', headers: getJsonHeaders(), body: JSON.stringify({ archived: !!archived }) }
        );
        await handleResponse(resp, 'Failed to update the archive');
        return await resp.json();
    }
    throw new Error('This conversation cannot be archived yet.');
}

/**
 * Mute / unmute the AI partner behind a conversation.
 *
 * Mute is ENTITY-level (`entities.is_muted`) — there is no muted column on
 * `chat_conversation_settings`, because muting a partner mutes the partner, not
 * one thread with them. The interaction-keyed route resolves the companion and
 * delegates to the same flag the entity update writes.
 *
 * @param {object} conversation
 * @param {boolean} muted
 */
export async function setConversationMuted(conversation, muted) {
    const { interactionId, entityId } = conversationTarget(conversation);
    if (interactionId) {
        const resp = await fetch(
            apiUrl(`/entities/conversations/${encodeURIComponent(interactionId)}/mute`),
            { method: 'POST', headers: getJsonHeaders(), body: JSON.stringify({ muted: !!muted }) }
        );
        await handleResponse(resp, 'Failed to update mute');
        return await resp.json();
    }
    if (entityId) {
        // The entity update route carries is_muted beside is_disabled and
        // stamps updated_at, which is what the phone syncs on.
        const resp = await fetch(
            apiUrl(`/entities/${encodeURIComponent(entityId)}`),
            { method: 'PUT', headers: getJsonHeaders(), body: JSON.stringify({ is_muted: !!muted }) }
        );
        await handleResponse(resp, 'Failed to update mute');
        return await resp.json();
    }
    throw new Error('This conversation has no AI partner to mute.');
}

/**
 * Mark a conversation read (`read: true`) or bump its newest message back to
 * unread (`read: false`).
 *
 * Read prefers the interaction route: it marks every inbound message of the
 * CURRENT interaction, which is exactly "the thread I am looking at" and is what
 * retires the unread badge and the new-messages divider. Unread has no
 * interaction equivalent, so it always uses the participant-key route's
 * set-to-1 semantics.
 *
 * @param {object} conversation
 * @param {{ read?: boolean, upToMessageId?: string }} [options]
 * @returns {Promise<{updated?: number}>}
 */
export async function markConversationRead(conversation, { read = true, upToMessageId } = {}) {
    const { interactionId, entityId, participantKey } = conversationTarget(conversation);

    if (read && interactionId) {
        const resp = await fetch(
            apiUrl(`/entities/conversations/${encodeURIComponent(interactionId)}/read`),
            { method: 'POST', headers: getJsonHeaders(), body: JSON.stringify({}) }
        );
        await handleResponse(resp, 'Failed to mark the conversation read');
        return await resp.json();
    }

    if (entityId && participantKey) {
        const body = { read: !!read };
        if (upToMessageId) body.up_to_message_id = upToMessageId;
        const resp = await fetch(
            apiUrl(`/entities/${encodeURIComponent(entityId)}/conversations/${encodeURIComponent(participantKey)}/read`),
            { method: 'POST', headers: getJsonHeaders(), body: JSON.stringify(body) }
        );
        await handleResponse(resp, 'Failed to update the read state');
        return await resp.json();
    }

    if (interactionId) {
        // Read was already handled above; only an unreachable branch remains.
        throw new Error('This conversation has no participant key to update.');
    }
    throw new Error('This conversation cannot be marked read yet.');
}

/**
 * Soft-delete a whole thread (the interaction and every message in it).
 *
 * There is deliberately NO participant-key fallback: the engine has exactly one
 * thread-delete address, and it is interaction-keyed. A brand-new chat with no
 * interaction has nothing to delete, which is reported rather than faked.
 *
 * A `409` means the engine still has a live session for the entity ("Close the
 * conversation before deleting it."); the message is surfaced verbatim.
 *
 * @param {object} conversation
 * @returns {Promise<{interactions?: number, messages?: number}>}
 */
export async function deleteConversation(conversation) {
    const { interactionId } = conversationTarget(conversation);
    if (!interactionId) {
        throw new Error('Nothing has been saved for this conversation yet.');
    }
    const resp = await fetch(
        apiUrl(`/entities/conversations/${encodeURIComponent(interactionId)}`),
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
