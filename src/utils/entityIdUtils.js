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
