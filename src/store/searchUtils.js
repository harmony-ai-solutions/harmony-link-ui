/**
 * Message search — pure helpers (Task 02-9).
 *
 * Everything here is free of React, of the store and of any service import, so
 * it can be unit-tested with `node --test` (`searchUtils.test.js`). The store,
 * the search field and the result list all compose these rules rather than
 * re-deriving them, so the debounce floor, the minimum length, the result cap
 * and the snippet geometry are defined exactly once.
 *
 * ── What the engine gives us ─────────────────────────────────────────────
 *
 * `GET /api/entities/messages/search?q=&interaction_id=&limit=` answers
 * `{ query, count, results: [{ message, interaction_id, participant_key }] }`
 * (see `management/routes_chat_write.go`). Two fields are load-bearing and both
 * are easy to get wrong:
 *
 *  - **`message.entity_id` is the character that owns the thread** — the row's
 *    POV entity — so it is what names the partner in a result. It is NOT the
 *    sender (`sender_entity_id`).
 *  - **`participant_key`, not `interaction_id`, is the conversation identity.**
 *    The engine mints a new interaction whenever the participant set changes, so
 *    navigating by an interaction id from an old hit lands in the wrong thread.
 *
 * The engine already escapes LIKE metacharacters and rejects a blank `q`, so
 * this module never sanitises the query — it only trims what the user typed and
 * refuses to send a query that is shorter than {@link MIN_QUERY_LENGTH}.
 */

import {
    normalizeChatMessage,
    entityDisplayName,
} from './chatStoreUtils.js';

/** Shortest query the UI will send (the task's "minimum 2 characters"). */
export const MIN_QUERY_LENGTH = 2;

/** Debounce applied between the last keystroke and the request, in ms. */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * Hard cap on rendered results. Mirrors the engine's own `LIMIT 100` (the
 * handler clamps `limit` to 100), so the client can never believe it has more
 * rows than the server will return.
 */
export const SEARCH_RESULT_LIMIT = 100;

/** Characters of context kept on each side of a match inside a snippet. */
export const SNIPPET_CONTEXT = 40;

/** Longest snippet rendered for one hit. */
export const SNIPPET_MAX_LENGTH = 160;

/**
 * Trim the query as typed. Inner whitespace is deliberately preserved: the
 * engine matches the literal string, so collapsing it here would display a
 * snippet around a phrase the server did not search for.
 *
 * @param {*} raw
 * @returns {string}
 */
export function normalizeSearchTerm(raw) {
    if (raw === null || raw === undefined) return '';
    return String(raw).trim();
}

/** Length in CHARACTERS (code points), so an emoji counts as one. */
export function searchTermLength(raw) {
    return Array.from(normalizeSearchTerm(raw)).length;
}

/** True when a query is long enough to send to the engine. */
export function isSearchable(raw) {
    return searchTermLength(raw) >= MIN_QUERY_LENGTH;
}

/**
 * Everything the search UI needs to know about the current input.
 *
 * `tooShort` distinguishes "the user has typed something, but not enough" from
 * "the field is empty" — the two want different hints, and treating them the
 * same is why a 1-character search looks broken rather than guided.
 *
 * @param {*} raw
 * @returns {{term: string, length: number, empty: boolean, tooShort: boolean, canSearch: boolean}}
 */
export function searchQueryState(raw) {
    const term = normalizeSearchTerm(raw);
    const length = Array.from(term).length;
    return {
        term,
        length,
        empty: length === 0,
        tooShort: length > 0 && length < MIN_QUERY_LENGTH,
        canSearch: length >= MIN_QUERY_LENGTH,
    };
}

/**
 * Clip `content` around the first occurrence of `query` and report where the
 * match sits inside the result.
 *
 * Returns geometry rather than markup: the caller decides whether to render
 * `<mark>` elements, and the offsets stay assertable in a unit test.
 *
 * ── EVERYTHING HERE IS IN CODE POINTS, NOT UTF-16 UNITS ──────────────────
 *
 * `context` is "characters", and a character can be two code units. Slicing by
 * code-unit offset would cut a 4-byte emoji in half and render mojibake, and it
 * would also make `context: 40` mean 40 units — only 20 emoji — so a message of
 * emoji produced a snippet that was visibly shorter than the same-length text.
 * The string is therefore split with `Array.from` (code points) and joined back;
 * `truncateReplyPreview` on the Go side guards the same bug with `[]rune`.
 *
 * The match is located with a plain `toLowerCase().indexOf()` in code-unit
 * space, because that is where case folding is well-defined, and the hit is then
 * mapped back into code-point space exactly once.
 *
 * A query with no match in the content is not an error — the engine can match
 * across a collation the client does not reproduce — so the snippet then starts
 * at the beginning with `matchStart: -1`.
 *
 * @param {string} content
 * @param {string} query
 * @param {{context?: number, maxLength?: number}} [options]
 * @returns {{text: string, matchStart: number, matchLength: number,
 *   leadingEllipsis: boolean, trailingEllipsis: boolean}}
 */
export function buildSnippet(content, query, {
    context = SNIPPET_CONTEXT,
    maxLength = SNIPPET_MAX_LENGTH,
} = {}) {
    const text = content === null || content === undefined ? '' : String(content);
    const term = normalizeSearchTerm(query);
    const limit = Number.isFinite(maxLength) && maxLength > 0 ? Math.trunc(maxLength) : SNIPPET_MAX_LENGTH;
    const pad = Number.isFinite(context) && context >= 0 ? Math.trunc(context) : SNIPPET_CONTEXT;

    if (!text) {
        return { text: '', matchStart: -1, matchLength: 0, leadingEllipsis: false, trailingEllipsis: false };
    }

    const chars = Array.from(text);
    const foundUnit = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;

    if (foundUnit === -1) {
        const clipped = chars.slice(0, limit).join('');
        return {
            text: clipped,
            matchStart: -1,
            matchLength: 0,
            leadingEllipsis: false,
            trailingEllipsis: chars.length > limit,
        };
    }

    // Map the code-unit hit back into the code-point array.
    const matchIndex = Array.from(text.slice(0, foundUnit)).length;
    const matchLength = Array.from(text.slice(foundUnit, foundUnit + term.length)).length;

    let start = Math.max(0, matchIndex - pad);
    let end = Math.min(chars.length, matchIndex + matchLength + pad);

    // Keep the snippet inside the cap WITHOUT losing the match: the budget left
    // after the term itself is split across both sides.
    if (end - start > limit) {
        const budget = Math.max(0, limit - matchLength);
        const before = Math.floor(budget / 2);
        start = Math.max(0, matchIndex - before);
        end = Math.min(chars.length, start + limit);
    }

    return {
        text: chars.slice(start, end).join(''),
        matchStart: matchIndex - start,
        matchLength: Math.max(0, Math.min(matchLength, end - matchIndex)),
        leadingEllipsis: start > 0,
        trailingEllipsis: end < chars.length,
    };
}

/**
 * Split a snippet into `[{text, match}]` parts for rendering.
 *
 * The parts always JOIN back to `snippet.text` exactly — that invariant is what
 * lets a test assert the highlight without a DOM, and what keeps a `<mark>`
 * from silently swallowing a character.
 *
 * @param {{text: string, matchStart: number, matchLength: number}} snippet
 * @returns {Array<{text: string, match: boolean}>}
 */
export function highlightParts(snippet) {
    const text = snippet?.text || '';
    if (!text) return [];
    const start = Number.isFinite(snippet?.matchStart) ? snippet.matchStart : -1;
    const length = Number.isFinite(snippet?.matchLength) ? snippet.matchLength : 0;
    if (start < 0 || length <= 0) return [{ text, match: false }];

    const parts = [];
    if (start > 0) parts.push({ text: text.slice(0, start), match: false });
    parts.push({ text: text.slice(start, start + length), match: true });
    const rest = text.slice(start + length);
    if (rest) parts.push({ text: rest, match: false });
    return parts;
}

/**
 * Normalise one engine hit into the flat shape the search UI and the jump path
 * consume.
 *
 * @param {{message?: object, interaction_id?: string, participant_key?: string}} hit
 * @returns {object|null} null for a hit with no usable message
 */
export function normalizeSearchHit(hit) {
    const message = normalizeChatMessage(hit?.message || null);
    if (!message) return null;

    const participantKey = hit?.participant_key || '';
    // `participant_key` is the sorted participant set joined by "+" (see
    // `DeriveParticipantKey`), so the participant ids are recoverable from it —
    // a hit therefore carries everything a conversation object needs.
    const participantIds = participantKey
        ? participantKey.split('+').map((id) => id.trim()).filter(Boolean)
        : [];

    return {
        id: message.id,
        participant_key: participantKey,
        interaction_id: hit?.interaction_id || message.interaction_id || '',
        // The character that owns the thread — what names the partner.
        entity_id: hit?.message?.entity_id || message.entity_id || '',
        participant_ids: participantIds,
        content: message.content,
        message_type: message.message_type,
        sender_entity_id: message.sender_entity_id,
        created_at: message.created_at,
        message,
    };
}

/**
 * Normalise a result list: drop unusable hits, collapse duplicates by message
 * id and cap the length.
 *
 * The dedupe is not defensive decoration — a thread whose messages span several
 * interactions can legitimately produce the same row twice if the server ever
 * joins per interaction, and a duplicated row would render two identical
 * results that both jump to the same place.
 *
 * @param {Array<object>} rawResults
 * @param {number} [limit]
 * @returns {Array<object>}
 */
export function normalizeSearchResults(rawResults, limit = SEARCH_RESULT_LIMIT) {
    const cap = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : SEARCH_RESULT_LIMIT;
    const seen = new Set();
    const out = [];
    for (const raw of rawResults || []) {
        const hit = normalizeSearchHit(raw);
        if (!hit || seen.has(hit.id)) continue;
        seen.add(hit.id);
        out.push(hit);
        if (out.length >= cap) break;
    }
    return out;
}

/** Cap a list of already-normalised hits (client-side scoping can only shrink). */
export function capSearchResults(results, limit = SEARCH_RESULT_LIMIT) {
    const cap = Number.isFinite(limit) && limit > 0 ? Math.trunc(limit) : SEARCH_RESULT_LIMIT;
    const list = results || [];
    return list.length > cap ? list.slice(0, cap) : list;
}

/**
 * Keep only hits belonging to one thread.
 *
 * In-conversation search reuses the GLOBAL endpoint and narrows client-side
 * rather than passing `interaction_id`: a thread's messages span every
 * interaction of its participant key, so an interaction filter would hide the
 * history the user is actually searching. The trade-off is documented on
 * `chatStore.searchMessages`: a thread whose matches exceed the global 100-hit
 * cap can show fewer than it has.
 *
 * @param {Array<object>} results
 * @param {string} participantKey
 * @returns {Array<object>}
 */
export function filterHitsByParticipant(results, participantKey) {
    const key = participantKey || '';
    const list = results || [];
    if (!key) return list;
    return list.filter((hit) => hit?.participant_key === key);
}

/**
 * The partner a hit belongs to: id, display name and avatar profile id.
 *
 * The name comes from the already-loaded `chatEntities` (no request); the raw
 * entity id is the fallback so a result is never blank.
 *
 * @param {object} hit
 * @param {Record<string, object>} [entityById]
 * @returns {{id: string, name: string, profileId: string}}
 */
export function searchHitPartner(hit, entityById) {
    const id = hit?.entity_id || '';
    const entity = id && entityById ? entityById[id] : null;
    return {
        id,
        name: entityDisplayName(entity) || id,
        profileId: entity?.character_profile_id || '',
    };
}

/**
 * The conversation object a hit jumps to.
 *
 * Shaped like the object `ChatView.handleOpenConversation` already accepts, so
 * the jump path is the SAME path a row click takes — the persona/participant
 * resolution must not fork for search.
 *
 * @param {object} hit
 * @returns {{interactionId: string|null, entityId: string, participantKey: string,
 *   participantIds: string[], partnerEntityId: string}}
 */
export function jumpTargetFromHit(hit) {
    const participantIds = hit?.participant_ids || [];
    const entityId = hit?.entity_id || '';
    return {
        interactionId: hit?.interaction_id || null,
        entityId,
        participantKey: hit?.participant_key || '',
        participantIds,
        partnerEntityId: participantIds.find((id) => id && id !== entityId) || '',
    };
}

/** True when a hit belongs to the currently open thread. */
export function hitMatchesConversation(hit, conversation) {
    if (!hit) return false;
    const key = conversation?.participantKey || conversation?.participant_key || '';
    return !!key && hit.participant_key === key;
}

/**
 * Group hits by conversation, preserving the engine's newest-first order.
 *
 * Not currently rendered as sections, but it is the shape the jump list needs
 * to show "3 results in Claire" and it keeps the grouping rule in one place.
 *
 * @param {Array<object>} results
 * @returns {Array<{participantKey: string, hits: Array<object>}>}
 */
export function groupHitsByConversation(results) {
    const order = [];
    const byKey = new Map();
    for (const hit of results || []) {
        const key = hit?.participant_key || '';
        if (!byKey.has(key)) {
            byKey.set(key, []);
            order.push(key);
        }
        byKey.get(key).push(hit);
    }
    return order.map((key) => ({ participantKey: key, hits: byKey.get(key) }));
}

/**
 * A trailing-edge debouncer with an injectable clock.
 *
 * `timers` exists so the unit test can drive it without wall-clock waits; the
 * browser path uses the real `setTimeout`.
 *
 * @param {Function} fn - called with the latest arguments, `delay` ms after the last call
 * @param {number} [delay]
 * @param {{set: Function, clear: Function}} [timers]
 * @returns {Function & {cancel: () => void, pending: () => boolean}}
 */
export function createDebouncer(fn, delay = SEARCH_DEBOUNCE_MS, timers = null) {
    const clock = timers || {
        set: (callback, ms) => setTimeout(callback, ms),
        clear: (handle) => clearTimeout(handle),
    };
    const wait = Number.isFinite(delay) && delay >= 0 ? delay : SEARCH_DEBOUNCE_MS;
    let handle = null;

    const debounced = (...args) => {
        if (handle !== null) clock.clear(handle);
        handle = clock.set(() => {
            handle = null;
            fn(...args);
        }, wait);
    };

    debounced.cancel = () => {
        if (handle !== null) clock.clear(handle);
        handle = null;
    };

    debounced.pending = () => handle !== null;

    return debounced;
}
