/**
 * Shared persona↔profile ownership helper (persona cards 2-1 / 2-2).
 *
 * A character profile is "persona-owned" when at least one user-type entity
 * (persona) references it via `character_profile_id`. Those cards live
 * exclusively in the Personas tab and must never surface in:
 *   - the Characters tab grid/search (2-1), or
 *   - AI-entity profile selectors (2-2).
 *
 * Persona ownership wins over AI linking (defensive only: the 1-1 guards make
 * dual references impossible going forward, decision 10).
 *
 * @param {Array} entities - entity list (useEntityStore state).
 * @param {Array} [profiles] - character profile list; when provided the id set
 *   is pruned to known profiles (stale references are ignored).
 * @returns {Set<string>} character profile ids owned by personas.
 */
export function personaOwnedProfileIds(entities, profiles = []) {
    const known = Array.isArray(profiles) && profiles.length > 0
        ? new Set(profiles.map(p => p && p.id).filter(Boolean))
        : null;
    const owned = new Set();
    (entities || []).forEach(entity => {
        if ((entity.entity_type || 'ai') !== 'user') return;
        const pid = entity.character_profile_id || entity.character_profile?.id;
        if (pid && (!known || known.has(pid))) owned.add(pid);
    });
    return owned;
}