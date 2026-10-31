/**
 * Which persona the engine is currently chatting AS — the read side of the
 * persona screen's "Active" badge.
 *
 * The desktop's active persona is a single module-level value
 * (`services/management/activePersona.js`, default `'user'`), the same one the
 * chat read/write surfaces and the impersonation selector pivot on. This
 * helper keeps the comparison in one pure place so the badge rule is locked by
 * `node --test` (`personaActive.test.js`).
 */

/**
 * True when `personaId` is the entity the desktop currently speaks as.
 *
 * @param {string|undefined|null} personaId - the card's persona entity id
 * @param {string|undefined|null} activePersonaId - {@link getActivePersonaId}
 * @returns {boolean}
 */
export function isActivePersona(personaId, activePersonaId) {
    return !!personaId && !!activePersonaId && personaId === activePersonaId;
}
