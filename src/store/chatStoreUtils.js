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
 * The six quick reactions offered on every bubble (Task 02-6 step 1). They are
 * the wire-presence set, NOT `EmojiPicker.QUICK_EMOJI` (that one appends emoji
 * to the composer text and is a much wider palette).
 */
export const QUICK_REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🎉'];

/**
 * Parse a message's `reactions_json` into `[{emoji, count}]`, in the order the
 * emoji were first seen.
 *
 * ── THE CANONICAL SHAPE IS A STRING ARRAY ────────────────────────────────
 *
 * The engine stores `["❤️","😂"]` (see convrepo.ToggleConversationMessageReaction
 * — a plain JSON array of emoji strings, because `formatReactionsAnnotation` and
 * the like counters both depend on that form). This reader used to accept ONLY
 * `[{emoji,count}]` and a map, so a canonical row parsed to `[]` and the chips
 * silently vanished. All three shapes are now accepted:
 *
 *   ["❤️","😂"]                     — canonical (engine writes this)
 *   [{"emoji":"❤️","count":2}, …]   — app/desktop batch shape
 *   {"❤️": 2, …}                    — hypothetical per-user/count map
 *
 * A plain string element counts as ONE occurrence, so duplicates aggregate:
 * `["❤️","❤️"]` → `[{emoji:'❤️', count:2}]` — which is how "two people
 * reacted" will read once the phone syncs per-user rows. Malformed/absent JSON
 * degrades to an empty list (never throws).
 *
 * @param {string|object|null|undefined} reactionsJson
 * @returns {Array<{emoji: string, count: number}>}
 */
export function parseReactions(reactionsJson) {
    if (!reactionsJson) return [];

    let parsed = reactionsJson;
    if (typeof reactionsJson === 'string') {
        try {
            parsed = JSON.parse(reactionsJson);
        } catch {
            return [];
        }
    }

    const counts = new Map();
    const bump = (emoji, count) => {
        const key = typeof emoji === 'string' ? emoji.trim() : '';
        if (!key) return;
        const n = Number(count);
        counts.set(key, (counts.get(key) || 0) + (Number.isFinite(n) && n > 0 ? n : 1));
    };

    if (Array.isArray(parsed)) {
        for (const entry of parsed) {
            if (typeof entry === 'string') {
                bump(entry, 1);
            } else if (entry && typeof entry === 'object' && entry.emoji) {
                bump(entry.emoji, entry.count);
            }
        }
        return [...counts].map(([emoji, count]) => ({ emoji, count }));
    }

    if (parsed && typeof parsed === 'object') {
        for (const [emoji, count] of Object.entries(parsed)) {
            // A per-user map (emoji → sender ids) counts its senders; a plain
            // count map uses the number.
            if (Array.isArray(count)) bump(emoji, count.length);
            else bump(emoji, count);
        }
    }

    return [...counts].map(([emoji, count]) => ({ emoji, count }));
}

/**
 * Toggle a reaction on a reactions list, returning the new list plus its JSON
 * string form (ready for the `reactions_json` column).
 *
 * Adding PRESERVES POSITION (an existing chip is bumped, never moved) because a
 * re-ordered chip row reads as "the reaction jumped" even though the set is
 * identical. Removing an emoji whose count reaches zero drops the chip.
 *
 * @param {Array<{emoji: string, count: number}>} reactions
 * @param {string} emoji
 * @returns {{reactions: Array<{emoji: string, count: number}>, json: string}}
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

/**
 * True when the local user has already reacted with `emoji` — presence in the
 * canonical array already means "I reacted" (one local user), and a count > 0
 * means the same for the aggregated shapes.
 *
 * @param {string} reactionsJson
 * @param {string} emoji
 * @returns {boolean}
 */
export function hasReaction(reactionsJson, emoji) {
    return parseReactions(reactionsJson).some((r) => r.emoji === emoji && r.count > 0);
}

/**
 * The op to send for a chip tap: tapping an emoji you already reacted with
 * removes yours, anything else adds it. Mirrors the engine's add/remove verbs.
 *
 * @param {string} reactionsJson
 * @param {string} emoji
 * @returns {'add'|'remove'}
 */
export function nextReactionOp(reactionsJson, emoji) {
    return hasReaction(reactionsJson, emoji) ? 'remove' : 'add';
}

/**
 * The quoted-text line for a bubble: the server-computed `reply_preview`, or a
 * short excerpt of the parent message when the timeline still holds it (a
 * just-sent reply has no preview until the next page load).
 *
 * @param {object|null|undefined} message
 * @param {Array<object>} timeline - the loaded messages (lookup fallback)
 * @returns {string} empty when this is not a reply
 */
export function replyQuoteText(message, timeline) {
    if (!message?.reply_to_message_id) return '';
    if (message.reply_preview) return message.reply_preview;
    const parent = (timeline || []).find((m) => m.id === message.reply_to_message_id);
    return truncatePreview((parent?.content || '').trim(), 80);
}

/** Truncate a preview string to `max` characters with an ellipsis. */
export function truncatePreview(text, max = 80) {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Sort conversations the way the app's inbox does: pinned threads first, then
 * most-recent activity (descending). Sorting is stable, so rows with the same
 * timestamp keep their incoming order.
 */
export function sortConversations(conversations) {
    return (conversations || []).slice().sort((a, b) => {
        if (!!a?.pinned !== !!b?.pinned) return a?.pinned ? -1 : 1;
        return toTime(b.last_activity_at) - toTime(a.last_activity_at);
    });
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
 * Merge per-companion chat-list pages into ONE inbox list (the app's chat-list
 * semantics).
 *
 * The engine lists conversations from a POV entity's perspective, so a private
 * thread between companion A and the persona appears only in A's list — the
 * desktop inbox therefore fetches one page per AI partner and merges them.
 * Group/world participant sets can legitimately appear in more than one
 * partner's page under the SAME participant_key, so rows are deduped by that
 * key: the freshest copy wins and the unread badges are combined with max() so
 * a duplicate can never hide unread messages.
 *
 * @param {Array<Array<object>>} pages - one array of conversation rows per partner
 * @returns {Array<object>} deduped, sorted rows (pinned first, then recency)
 */
export function mergeConversations(pages) {
    const byKey = new Map();
    for (const page of pages || []) {
        for (const row of page || []) {
            const key = conversationKey(row);
            if (!key) continue;
            const existing = byKey.get(key);
            if (!existing) {
                byKey.set(key, row);
                continue;
            }
            const rowIsFresher = toTime(row.last_activity_at) >= toTime(existing.last_activity_at);
            const fresher = rowIsFresher ? row : existing;
            byKey.set(key, {
                ...fresher,
                unread_count: Math.max(existing.unread_count || 0, row.unread_count || 0),
            });
        }
    }
    return sortConversations([...byKey.values()]);
}

/**
 * Fold `Promise.allSettled`-style results from the per-partner chat-list
 * loads into one inbox. A single failing partner must not blank the list: its
 * page is skipped and only the failure count is reported.
 *
 * @param {Array<{status: 'fulfilled'|'rejected', value?: object[], reason?: any}>} results
 * @returns {{ conversations: object[], failures: number, total: number }}
 */
export function mergeConversationPages(results) {
    const pages = [];
    let failures = 0;
    for (const result of results || []) {
        if (result?.status === 'fulfilled') {
            pages.push(result.value);
        } else {
            failures += 1;
        }
    }
    return {
        conversations: mergeConversations(pages),
        failures,
        total: (results || []).length,
    };
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
 * The companion that OWNS a chat-list row: the AI entity whose `/chat-list`
 * page produced it (`conversation.entity_id`). Rows must be named and
 * avatar'd by this entity — `partner_entity_id` is the row's POV partner (the
 * persona "user" for a private companion thread), never the companion.
 *
 * @param {object|null|undefined} conversation
 * @param {Record<string, object>} entityById
 * @returns {object|null}
 */
export function conversationCompanion(conversation, entityById) {
    const id = conversation?.entity_id;
    return (id && entityById && entityById[id]) || null;
}

/**
 * Display name for a chat-list row — always the owning AI companion.
 *
 * The GLOBAL inbox row states the companion's name itself
 * (`partner_display_name`), so a row can be named before (or without) the
 * entity list. That server name wins; `entityById` is the fallback for the
 * per-entity surface, which leaves the global fields zero-valued.
 */
export function conversationDisplayName(conversation, entityById) {
    return conversation?.companion_display_name
        || entityDisplayName(conversationCompanion(conversation, entityById))
        || conversation?.entity_id
        || '';
}

/** Linked character-profile id for a chat-list row's companion (avatar). */
export function conversationAvatarProfileId(conversation, entityById) {
    return conversation?.companion_profile_id
        || conversationCompanion(conversation, entityById)?.character_profile_id
        || '';
}

/**
 * The persona (entity_type 'user') participating in a conversation, or '' when
 * the row does not expose a persona participant. Used for "You" direction and
 * for keeping the inbox to conversations the user is actually part of.
 *
 * @param {object|null|undefined} conversation
 * @param {Record<string, object>} entityById
 * @returns {string}
 */
export function conversationPersonaEntityId(conversation, entityById) {
    for (const id of conversation?.participant_ids || []) {
        if (entityById?.[id]?.entity_type === 'user') return id;
    }
    return '';
}

/**
 * Keep only conversations that include one of the known personas. The app's
 * inbox is the persona's perspective; a per-companion merge can also surface
 * companion↔companion DMs, which are not the user's threads (and opening one
 * would force the persona into the participant set, minting a new interaction).
 *
 * Rows with an empty/malformed participant set are kept — an unknown set must
 * never be hidden.
 *
 * @param {Array<object>} conversations
 * @param {Iterable<string>} personaIds
 * @returns {Array<object>}
 */
export function filterConversationsForPersonas(conversations, personaIds) {
    const ids = personaIds instanceof Set ? personaIds : new Set(personaIds || []);
    if (ids.size === 0) return conversations || [];
    return (conversations || []).filter((conversation) => {
        const participantIds = Array.isArray(conversation?.participant_ids)
            ? conversation.participant_ids
            : [];
        if (participantIds.length === 0) return true;
        return participantIds.some((id) => ids.has(id));
    });
}

/**
 * Whether a chat-list row's last message was sent by the persona we chat AS
 * ("You").
 *
 * Rows are listed from the AI companion's POV, so `sender_entity_id ===
 * conversation.entity_id` is the COMPANION speaking (incoming), not the user.
 * The persona sender is resolved from `participant_ids` (preferred, correct in
 * groups too), then `partner_entity_id`. Matches the app inbox, which prefixes
 * "You" when the sender is the impersonated persona.
 *
 * @param {object|null|undefined} conversation
 * @param {Record<string, object>} [entityById]
 * @returns {boolean}
 */
export function isConversationLastMessageOutgoing(conversation, entityById) {
    const sender = conversation?.last_message?.sender_entity_id;
    if (!sender) return false;
    const personaId = conversationPersonaEntityId(conversation, entityById);
    if (personaId) return sender === personaId;
    if (conversation?.partner_entity_id) return sender === conversation.partner_entity_id;
    return sender !== conversation?.entity_id;
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
        // Server-computed quote text (Task 02-6). Empty for a non-reply; the
        // bubble falls back to a timeline lookup for a just-sent reply.
        reply_preview: msg.reply_preview || '',
        reactions_json: msg.reactions_json || '',
        is_pinned: !!msg.is_pinned,
        is_read: typeof msg.is_read === 'boolean' ? msg.is_read : null,
        created_at: msg.created_at || '',
        updated_at: msg.updated_at || msg.created_at || '',
    };
}

/**
 * Normalise one parity chat-list row into the shape the chat list renders.
 *
 * The POV entity id is the per-entity route's path parameter, so it is supplied
 * by the caller for that surface. The GLOBAL inbox (Task 02-4) states it on the
 * row (`entity_id`), along with everything needed to name and badge it without
 * a second request — those fields are read here and `entityId` merely fills in
 * for a row that omits one (the per-entity route emits them zero-valued).
 *
 * @param {object} row
 * @param {string} [entityId] - fallback POV/owning entity id
 * @returns {object}
 */
export function normalizeChatConversation(row, entityId = '') {
    const participantIds = parseParticipantIds(row?.participant_ids);
    const lastMessage = normalizeChatMessage(row?.last_message);
    const owningEntityId = row?.entity_id || entityId || '';
    return {
        interaction_id: row?.interaction_id || '',
        participant_key: row?.participant_key || '',
        entity_id: owningEntityId,
        participant_ids: participantIds,
        partner_entity_id: row?.partner_entity_id || derivePartnerEntityId(participantIds, owningEntityId),
        scope: row?.interaction_scope || 'private',
        last_activity_at: row?.last_activity_at || row?.last_message_at || lastMessage?.created_at || null,
        unread_count: row?.unread_count || 0,
        pinned: !!row?.pinned,
        archived: !!row?.archived,
        // Global-inbox flags (entities.is_muted / is_disabled). The unread badge
        // is suppressed for a muted thread, matching the Android rule.
        muted: !!row?.muted,
        entity_disabled: !!row?.entity_disabled,
        // Companion identity as stated by the server, so naming a row costs no
        // entity lookup (and works before chatEntities has loaded).
        companion_display_name: row?.partner_display_name || '',
        companion_profile_id: row?.partner_profile_id || '',
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
