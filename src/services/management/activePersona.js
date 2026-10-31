/**
 * The desktop's ACTIVE PERSONA — the one seam every chat request pivots on.
 *
 * The engine's chat surface is POV-scoped: a thread read, a search and every
 * conversation write address `:id` = the entity the human is speaking AS (the
 * same idea as the mobile app's `impersonatedEntityId`). In the desktop 1.0
 * there is exactly one persona, the built-in `user`, so v1 hard-codes it here.
 *
 * ── WHY THIS MODULE EXISTS ───────────────────────────────────────────────
 *
 * A persona selector is planned. When it lands, it changes THIS function (or
 * sets the value through the setter below) and nothing else: services, stores
 * and components all call {@link getActivePersonaId} instead of embedding
 * `'user'`. That is the single seam the plan asked for — a hard-coded persona
 * anywhere else would silently survive the selector and split the inbox.
 */

/** The built-in persona every fresh install speaks as. */
export const DEFAULT_PERSONA_ID = 'user';

/** The selector's future override; `null` means "use the default". */
let activePersonaId = null;

/**
 * The entity id the desktop chats AS.
 *
 * @returns {string} a persona entity id (`'user'` in v1)
 */
export function getActivePersonaId() {
    return activePersonaId || DEFAULT_PERSONA_ID;
}

/**
 * Swap the active persona (reserved for the selector UI).
 *
 * Not called anywhere yet — it exists so the selector can be added without
 * touching a single call site, and so tests can exercise a second persona.
 *
 * @param {string|null} entityId - persona entity id, or null to reset
 */
export function setActivePersonaId(entityId) {
    activePersonaId = entityId || null;
}
