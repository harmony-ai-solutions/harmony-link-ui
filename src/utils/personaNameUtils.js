/**
 * Persona display-name validation (2-3; D14/D33/D59).
 *
 * Post-D23 the entity id is server-derived from the name — the display name
 * itself never becomes the id, so it is NEVER charset-validated. Validation
 * is exactly:
 *
 *   1. non-empty (trimmed);
 *   2. not one of the reserved names 'user' / 'deleted' (D33 — checked
 *      case-insensitively);
 *   3. unique among LIVE entities by case-insensitive ALIAS equality —
 *      mirroring the engine's partial unique index on `entities.alias`.
 *      (D59 deleted the client-side alias deriver: ids AND aliases are
 *      server-owned, so the comparison rule is stated directly here rather
 *      than by reference to a util.)
 *
 * Pure util (no i18n, no store access): returns a translation KEY for the
 * first failure or null; the view translates via
 * `t('personas:validation.' + key)`. `entities` must be LIVE rows (the FE
 * entity list is live-only already — tombstones never block a name).
 */

export const RESERVED_PERSONA_NAMES = ['user', 'deleted'];

/**
 * @param {string} name - Proposed persona display name (spaces allowed).
 * @param {{ entities?: Array<{id?: string, alias?: string|null}>, excludeId?: string|null }} [context]
 *   `entities`: live entity rows to uniqueness-check against;
 *   `excludeId`: id of the entity being edited — its own row is skipped so
 *   an edit that keeps the current name never trips the uniqueness check.
 * @returns {string|null} 'nameRequired' | 'nameReservedUser' | 'nameExists',
 *   or null when the name is valid.
 */
export function validatePersonaName(name, { entities = [], excludeId = null } = {}) {
    const trimmed = (name || '').trim();
    if (!trimmed) {
        return 'nameRequired';
    }
    if (RESERVED_PERSONA_NAMES.includes(trimmed.toLowerCase())) {
        return 'nameReservedUser';
    }
    const candidate = trimmed.toLowerCase();
    const taken = (entities || []).some(entity => {
        if (!entity || entity.id === excludeId) {
            return false;
        }
        const alias = typeof entity.alias === 'string' ? entity.alias.trim() : '';
        return alias !== '' && alias.toLowerCase() === candidate;
    });
    if (taken) {
        return 'nameExists';
    }
    return null;
}
