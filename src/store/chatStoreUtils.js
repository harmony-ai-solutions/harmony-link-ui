/**
 * Desktop Chat — pure store logic (Phase 2-1).
 *
 * Every function here is side-effect free and free of external imports, so it
 * can be unit-tested with `node --test` (the store itself imports services that
 * touch `import.meta.env`, which is unavailable outside Vite). chatStore.js is a
 * thin stateful wrapper around these helpers.
 */

/** Parse a timestamp to epoch millis; unparseable values sort last. */
export function toTime(value) {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
}

/**
 * Merge an incoming batch of messages into the existing timeline.
 *
 * Smart-merge contract (Phase 2-3): never drop already-loaded pages, add new
 * messages, replace an existing row when a fresher copy arrives (edits / read
 * flags), then keep the whole list ordered oldest → newest.
 *
 * @param {Array<object>} existing
 * @param {Array<object>|object} incoming
 * @returns {Array<object>} a NEW array (never mutates the inputs)
 */
export function mergeMessages(existing, incoming) {
    const incomingList = Array.isArray(incoming) ? incoming : [incoming];
    const byId = new Map();
    for (const msg of existing || []) {
        if (msg && msg.id) byId.set(msg.id, msg);
    }
    for (const msg of incomingList) {
        if (!msg || !msg.id) continue;
        // Incoming wins — it carries the latest content/read/reaction state.
        byId.set(msg.id, { ...(byId.get(msg.id) || {}), ...msg });
    }
    return Array.from(byId.values()).sort((a, b) => toTime(a.created_at) - toTime(b.created_at));
}

/**
 * Prepend an older page of messages (the "load older" scroll). Same merge
 * semantics as {@link mergeMessages} — duplicate rows are collapsed.
 */
export function prependOlderMessages(existing, olderPage) {
    return mergeMessages(existing, olderPage);
}

/** Replace one message in place (by id) with an updated copy. */
export function replaceMessage(messages, updated) {
    if (!updated || !updated.id) return messages || [];
    const list = messages || [];
    const index = list.findIndex((m) => m.id === updated.id);
    if (index === -1) return mergeMessages(list, updated);
    const next = list.slice();
    next[index] = { ...next[index], ...updated };
    return next;
}

/** Remove a message from the timeline (soft delete / tombstone). */
export function removeMessage(messages, messageId) {
    return (messages || []).filter((m) => m.id !== messageId);
}

/**
 * Direction of a message relative to the entity we are chatting AS.
 * @returns {'out'|'in'}
 */
export function messageDirection(message, ownEntityId) {
    return message && message.sender_entity_id === ownEntityId ? 'out' : 'in';
}

/** True when an inbound message has not been read yet. */
export function isUnreadInbound(message, ownEntityId) {
    return messageDirection(message, ownEntityId) === 'in' && message?.is_read === false;
}

/** The newest message of a timeline (list is oldest → newest). */
export function lastMessage(messages) {
    if (!messages || messages.length === 0) return null;
    return messages[messages.length - 1];
}

/** Short, human preview line for a chat-list row. */
export function conversationPreview(message) {
    if (!message) return '';
    if (message.message_type === 'audio') {
        return message.content ? `🎤 ${message.content}` : '🎤 Voice message';
    }
    if (message.message_type === 'image') {
        return message.content ? `🖼️ ${message.content}` : '🖼️ Photo';
    }
    return message.content || '';
}

/** True when a message is a proactive (lifecycle "beat") outreach message (F16). */
export function isProactiveMessage(message) {
    return message?.message_type === 'outreach' || message?.message_type === 'dream';
}

/**
 * Parse a message's reactions_json into `[{emoji, count}]`. Malformed/absent
 * JSON degrades to an empty list (never throws).
 */
export function parseReactions(reactionsJson) {
    if (!reactionsJson) return [];
    try {
        const parsed = JSON.parse(reactionsJson);
        if (Array.isArray(parsed)) {
            return parsed
                .filter((r) => r && r.emoji)
                .map((r) => ({ emoji: r.emoji, count: Number(r.count) || 1 }));
        }
        if (parsed && typeof parsed === 'object') {
            return Object.entries(parsed).map(([emoji, count]) => ({ emoji, count: Number(count) || 1 }));
        }
        return [];
    } catch {
        return [];
    }
}

/**
 * Toggle a reaction on a reactions list, returning the new list plus its JSON
 * string form (ready for the `reactions_json` column).
 */
export function toggleReaction(reactions, emoji) {
    const list = (reactions || []).map((r) => ({ ...r }));
    const index = list.findIndex((r) => r.emoji === emoji);
    if (index === -1) {
        list.push({ emoji, count: 1 });
    } else if (list[index].count <= 1) {
        list.splice(index, 1);
    } else {
        list[index].count -= 1;
    }
    return { reactions: list, json: JSON.stringify(list) };
}

/** Truncate a preview string to `max` characters with an ellipsis. */
export function truncatePreview(text, max = 80) {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Sort conversations by most-recent activity (descending). */
export function sortConversations(conversations) {
    return (conversations || []).slice().sort(
        (a, b) => toTime(b.last_activity_at) - toTime(a.last_activity_at)
    );
}

/**
 * The identity of a conversation: its `participant_key`.
 *
 * The engine mints a NEW interaction whenever the participant set changes, so
 * participant_key : interactions is 1:many — the interaction id is a
 * navigation handle only and must never identify a thread in the list.
 */
export function conversationKey(conversation) {
    return conversation?.participant_key || '';
}

/** Insert or replace a conversation (keyed by participant_key), keeping order. */
export function upsertConversation(conversations, conversation) {
    const key = conversationKey(conversation);
    if (!key) return conversations || [];
    const list = (conversations || []).filter((c) => conversationKey(c) !== key);
    list.push(conversation);
    return sortConversations(list);
}

/** Drop a conversation from the list by participant key. */
export function removeConversation(conversations, participantKey) {
    return (conversations || []).filter((c) => conversationKey(c) !== participantKey);
}

/**
 * Immutably set a boolean flag for an entity in a flag map (typing / recording).
 * Removing the key when value is false keeps the maps small and equality cheap.
 */
export function setEntityFlag(flagMap, entityId, value) {
    const next = { ...(flagMap || {}) };
    if (value) {
        next[entityId] = true;
    } else {
        delete next[entityId];
    }
    return next;
}

/** True when at least one entity is currently typing. */
export function isAnyTyping(flagMap) {
    return Object.keys(flagMap || {}).length > 0;
}

/** Resolve a display name for a chat entity option. */
export function entityDisplayName(entity) {
    if (!entity) return '';
    return entity.display_name || entity.alias || entity.id || '';
}

/**
 * Split the chat-entity options into AI partners (talk to) and personas
 * (talk as). Disabled AI entities are excluded from the partner list.
 */
export function partitionChatEntities(entities) {
    const partners = [];
    const personas = [];
    for (const entity of entities || []) {
        if (entity.entity_type === 'user') {
            personas.push(entity);
        } else if (!entity.is_disabled) {
            partners.push(entity);
        }
    }
    return { partners, personas };
}

/**
 * Parse the engine's `participant_ids` value. The chat-list row carries the raw
 * JSON array text (the interactions table stores it as a string); the
 * interaction/WS shapes carry a real array. Both are accepted, and anything
 * malformed degrades to an empty array (never throws).
 *
 * @param {string|string[]|null|undefined} raw
 * @returns {string[]}
 */
export function parseParticipantIds(raw) {
    if (Array.isArray(raw)) return raw.filter(Boolean);
    if (!raw || typeof raw !== 'string') return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
        return [];
    }
}

/**
 * The other participant of a private thread: the first participant that is not
 * the POV entity. Group/world threads may have none (the UI falls back to the
 * entity id).
 *
 * @param {string[]} participantIds
 * @param {string} entityId
 * @returns {string}
 */
export function derivePartnerEntityId(participantIds, entityId) {
    for (const id of participantIds || []) {
        if (id && id !== entityId) return id;
    }
    return '';
}

/**
 * Normalise one parity `ConversationMessageSync` row into the flat message
 * shape the store/bubbles consume.
 *
 * Parity carries media as mime-type presence rather than `has_audio` /
 * `has_image` booleans, so those are derived here. `is_read` is passed through
 * as-is (null when the projection omits it) — {@link isUnreadInbound} treats
 * anything but `false` as read.
 *
 * @param {object|null|undefined} msg
 * @returns {object|null}
 */
export function normalizeChatMessage(msg) {
    if (!msg || !msg.id) return null;
    const audioMime = msg.audio_mime_type || '';
    const imageMime = msg.image_mime_type || '';
    return {
        id: msg.id,
        entity_id: msg.entity_id || '',
        sender_entity_id: msg.sender_entity_id || msg.entity_id || '',
        interaction_id: msg.interaction_id || '',
        content: msg.content || '',
        message_type: msg.message_type || 'text',
        audio_duration: msg.audio_duration || 0,
        has_audio: !!audioMime,
        audio_mime_type: audioMime,
        has_image: !!imageMime,
        image_mime_type: imageMime,
        is_edited: !!msg.is_edited,
        edit_of_message_id: msg.edit_of_message_id || '',
        reply_to_message_id: msg.reply_to_message_id || '',
        reactions_json: msg.reactions_json || '',
        is_pinned: !!msg.is_pinned,
        is_read: typeof msg.is_read === 'boolean' ? msg.is_read : null,
        created_at: msg.created_at || '',
        updated_at: msg.updated_at || msg.created_at || '',
    };
}

/**
 * Normalise one parity chat-list row into the shape the chat list renders. The
 * POV entity id is not on the row (it is the request path parameter), so the
 * caller supplies it.
 *
 * @param {object} row
 * @param {string} entityId
 * @returns {object}
 */
export function normalizeChatConversation(row, entityId) {
    const participantIds = parseParticipantIds(row?.participant_ids);
    const lastMessage = normalizeChatMessage(row?.last_message);
    return {
        interaction_id: row?.interaction_id || '',
        participant_key: row?.participant_key || '',
        entity_id: entityId,
        participant_ids: participantIds,
        partner_entity_id: derivePartnerEntityId(participantIds, entityId),
        scope: row?.interaction_scope || 'private',
        last_activity_at: row?.last_message_at || lastMessage?.created_at || null,
        unread_count: row?.unread_count || 0,
        pinned: !!row?.pinned,
        archived: !!row?.archived,
        reply_mode: row?.reply_mode || 'realistic',
        last_message: lastMessage,
    };
}

/** Derive the deterministic participant_key for a private pair. */
export function deriveParticipantKey(participantIds, entityId, scope) {
    if (scope === 'private') {
        const other = (participantIds || []).find((id) => id !== entityId) || '';
        return [entityId, other].filter(Boolean).sort().join(':');
    }
    if (scope === 'group') {
        return 'group:' + (participantIds || []).slice().sort().join('+');
    }
    return 'world:' + (entityId || '');
}
