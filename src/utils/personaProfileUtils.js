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

/**
 * The profile list the **Characters** grid is allowed to render (2-1).
 *
 * 03-6 verifies this survives the category work: categories are a local
 * organisation feature whose membership rows carry raw profile ids, so a
 * persona-owned profile CAN be a member of a character category (the card menu
 * of the Personas tab knows nothing about the Characters grid's exclusion).
 * Running the filter over the raw list would therefore resurface exactly the
 * cards 2-1 removed — the chip would count them, and `All` would show them.
 *
 * The exclusion must therefore be applied to the **list the toolbar receives**,
 * once, before any search/category/favourite filtering. `CharacterProfilesView`
 * uses this helper for `visibleProfiles`, which is what it passes to
 * `CategoryFilterDropdown`, `ManageCategoriesModal`, `CharacterDetailView` and
 * `filterCharacterProfiles` — so every downstream consumer inherits the guard
 * instead of each having to remember it.
 *
 * Order is preserved (the engine's list order is meaningful) and a new array is
 * always returned, so this is safe to hand straight to React / `useMemo`.
 *
 * @param {Array} profiles - every profile the store knows about
 * @param {Array} entities - entity list; `entity_type === 'user'` rows own cards
 * @returns {Array} profiles not owned by any persona
 */
export function excludePersonaOwnedProfiles(profiles, entities) {
    if (!Array.isArray(profiles)) return [];
    const owned = personaOwnedProfileIds(entities, profiles);
    if (owned.size === 0) return profiles.slice();
    return profiles.filter(profile => profile && !owned.has(profile.id));
}