/**
 * Shared entity-id derivation helper (persona/AI entity "create from card").
 *
 * Entity ids follow the charset convention mirrored by PersonasView's
 * `validatePersonaName`: /^[a-zA-Z0-9_-]+$/, unique across ALL entities, with
 * the built-in 'user' reserved. Card names routinely violate this — a
 * duplicated card is named like "Max 2" (space) and could collide with an
 * existing entity id — so derive a safe id from the display name:
 *
 *   1. trim, then reject the reserved id case-insensitively;
 *   2. lowercase and replace every invalid character with '-';
 *   3. collapse repeated dashes and trim leading/trailing ones;
 *   4. dedupe against `existingIds` with a numeric suffix
 *      ("max-2" → "max-2-2" → …).
 *
 * The DISPLAY alias stays the profile's real name — only the id is derived.
 *
 * @param {string} baseName - display name to derive from (e.g. the duplicated
 *   card's name).
 * @param {string[]} [existingIds] - ids of ALL existing entities to dedupe
 *   against.
 * @param {{reservedMessage?: string, emptyMessage?: string}} [messages]
 *   Pre-translated error texts thrown on the reserved-id / unsalvageable-name
 *   cases (i18n stays at the view layer; both failure paths surface through
 *   the caller's existing error handling).
 * @returns {string} a valid, unused entity id.
 * @throws {Error} `messages.reservedMessage` when the name is the reserved id,
 *   `messages.emptyMessage` when nothing valid remains after sanitizing.
 */
export function deriveEntityId(baseName, existingIds = [], { reservedMessage, emptyMessage } = {}) {
    const trimmed = (baseName || '').trim();
    if (trimmed.toLowerCase() === 'user') {
        throw new Error(reservedMessage || '"user" is a reserved entity id');
    }
    const base = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (!base) {
        throw new Error(emptyMessage || 'Could not derive a valid entity id from the name');
    }
    const taken = new Set(existingIds);
    let candidate = base;
    let suffix = 2;
    while (taken.has(candidate)) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
    }
    return candidate;
}

/**
 * Derive a display alias for a new entity, deduped against the aliases that
 * already exist. Companion to {@link deriveEntityId}: the entity ID is
 * sanitized and unique by construction, but the alias keeps the card's pretty
 * name — and `entities.alias` carries a partial UNIQUE index (non-empty,
 * live entities), so a SECOND entity created from the same profile would
 * collide ("Max" twice → "UNIQUE constraint failed: entities.alias") and
 * abort the create flow mid-way, orphaning the half-created entity.
 *
 * Mirrors the RN app's convention (userEntities.ts:294-296): the alias is
 * deduped alongside the id, and when a copy-suffix is needed the alias
 * becomes the derived id — not the raw duplicated display name.
 *
 * The taken-check here is CASE-INSENSITIVE while the engine's atomic
 * `POST /entities` alias conflict (400 "entity alias is already in use") is
 * exact-match/case-sensitive: comparing more strictly on the client is a
 * deliberate safety margin (it also stays correct should the engine ever
 * tighten its index to case-insensitive).
 *
 * @param {string} displayName - desired pretty alias (e.g. the card's name);
 *   trimmed before use.
 * @param {string} entityId - the already-unique entity id; used as the
 *   fallback alias and as the suffix base.
 * @param {string[]} [existingAliases] - `alias` fields of ALL existing
 *   entities (undefined / empty entries are ignored).
 * @returns {string} a non-empty alias that case-insensitively matches no
 *   existing alias: the trimmed display name when it is free, otherwise a
 *   deduped fallback derived from `entityId` ("max" → "max-2" → …).
 */
export function deriveEntityAlias(displayName, entityId, existingAliases = []) {
    const trimmed = (displayName || '').trim();
    if (!trimmed) {
        return entityId;
    }
    const taken = new Set(
        (existingAliases || [])
            .filter(alias => typeof alias === 'string' && alias.trim() !== '')
            .map(alias => alias.toLowerCase())
    );
    if (!taken.has(trimmed.toLowerCase())) {
        return trimmed;
    }
    // Fallback: the id is unique among entity IDS, but another entity's alias
    // could still literally equal it — suffix until that candidate is free too.
    let candidate = entityId;
    let suffix = 2;
    while (taken.has(candidate.toLowerCase())) {
        candidate = `${entityId}-${suffix}`;
        suffix += 1;
    }
    return candidate;
}

/**
 * Bump a derived entity id past an id conflict the client could not foresee:
 * increment a trailing numeric suffix ("alleycat-annie" → "alleycat-annie-2"
 * → "alleycat-annie-3" → …).
 *
 * Used for the bounded from-card create retry. Entity deletion is a SOFT
 * delete (the row — and its primary key — is retained) while the entity list
 * only returns live rows (`deleted_at IS NULL`), so {@link deriveEntityId}
 * can dedupe against every visible id and still land on one held by a
 * soft-deleted row. The engine is the source of truth: it rejects the create
 * with 400 {"error":"entity id already exists"} and the caller retries with
 * the next candidate produced here.
 *
 * Ids passed here are always our own derivations, so trailing suffixes are
 * unpadded; the incremented number stays a plain int (no zero-padding to
 * preserve).
 *
 * @param {string} currentId - the entity id the engine just rejected.
 * @returns {string} the next candidate id.
 */
export function nextEntityIdCandidate(currentId) {
    const match = /^(.*-)(\d+)$/.exec(currentId || '');
    if (match) {
        return `${match[1]}${parseInt(match[2], 10) + 1}`;
    }
    return `${currentId}-2`;
}

/**
 * True when `error` is the engine rejecting the entity ID of an atomic
 * `POST /entities` create: either the clean 400 body
 * {"error":"entity id already exists"} surfaced verbatim by `handleResponse`,
 * or the legacy raw SQLite message ("UNIQUE constraint failed: entities.id")
 * an older engine leaks before the clean contract — matched defensively so
 * the bounded retry also works against it.
 *
 * Deliberately does NOT match the alias conflict ("entity alias is already
 * in use"): aliases are pre-deduped client-side against the visible live set
 * by {@link deriveEntityAlias}, and re-deriving them cannot resolve a
 * conflict the list could not see.
 *
 * @param {unknown} error - the caught error from the create call.
 * @returns {boolean} whether the create failed on the entity ID itself.
 */
export function isEntityIdConflictError(error) {
    const message = error?.message;
    if (typeof message !== 'string') {
        return false;
    }
    return message.includes('entity id already exists')
        || message.includes('UNIQUE constraint failed: entities.id');
}
