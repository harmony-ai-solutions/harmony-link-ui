/**
 * Duplicate-name disambiguation for the chat list (rows + partner chips).
 *
 * The engine lets two entities share a display name (the same character
 * profile can be linked twice, and a copy keeps the profile's name). Two
 * identical rows are then indistinguishable in the inbox, so each one shows
 * the DISTINGUISHING bit in small print after the name — the entity ALIAS
 * and nothing else ("Alleycat Annie (Alleycat Annie 2)").
 *
 * Owner rule (2026-10-31): never fall back to the entity id or any part of
 * it. When an entity's alias is empty or equal to its display name (the
 * ORIGINAL of a duplicate pair typically carries name === alias), it simply
 * gets no hint — the pair is still tellable apart, because only the copy
 * carries the differing alias.
 *
 * Only names shared by two or more DISTINCT entities are touched; a name
 * that appears once stays clean. Pure functions (no React, no store) so the
 * rule is locked by `node --test` (`chatNameHints.test.js`).
 */

/** Case-insensitive comparison key for a display name. */
export function nameKey(name) {
    return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

/**
 * The displayed name and small-print hint for ONE chat partner. The hint is
 * the entity alias when it is a real differentiator (non-empty and different
 * from the shown name); anything else resolves to no hint.
 *
 * @param {{name?: string, alias?: string}} entry
 * @returns {{name: string, hint: string}}
 */
export function resolveChatName(entry) {
    const rawName = typeof entry?.name === 'string' ? entry.name.trim() : '';
    const alias = typeof entry?.alias === 'string' ? entry.alias.trim() : '';

    const hint = alias && nameKey(alias) !== nameKey(rawName) ? alias : '';
    return { name: rawName, hint };
}

/**
 * Resolved names for the entries whose display name is shared by two or more
 * DISTINCT entities. Entries in such a group whose alias does not
 * differentiate (empty, or equal to the display name) keep the plain name —
 * no id is ever shown.
 *
 * @param {Array<{key: string, name: string, entityId?: string, alias?: string}>} entries
 * @returns {Map<string, {name: string, hint: string}>} key → resolved name/hint,
 *   for colliding keys only
 */
export function duplicateNameHints(entries) {
    const groups = new Map();
    for (const entry of entries || []) {
        if (!entry?.key || !nameKey(entry.name)) continue;
        const key = nameKey(entry.name);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
    }

    const resolvedByKey = new Map();
    for (const group of groups.values()) {
        const entityIds = new Set(group.map((entry) => entry.entityId || entry.key));
        if (entityIds.size < 2) continue;

        for (const entry of group) {
            resolvedByKey.set(entry.key, resolveChatName(entry));
        }
    }
    return resolvedByKey;
}
