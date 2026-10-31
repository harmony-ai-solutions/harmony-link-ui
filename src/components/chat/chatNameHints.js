/**
 * Duplicate-name disambiguation for the chat list (rows + partner chips).
 *
 * The engine lets two entities share a display name (the same character
 * profile can be linked twice, and a copy keeps the profile's name). Two
 * identical rows are then indistinguishable in the inbox, so each one shows
 * the DISTINGUISHING bit in small print after the name:
 *
 *   - the entity ALIAS, when its alias differs from the display name
 *     ("Alleycat Annie (Annie RP)"), or
 *   - the part of the entity id that differs — the timestamp/copy suffix —
 *     when the alias IS the name or is empty
 *     ("Isabella (20260904230124)").
 *
 * An entity with NO display name renders its raw id ("Isabella-20260904230124").
 * For those the readable id prefix becomes the name and the suffix the hint,
 * so two such twins read "Isabella (20260904230124)" / "Isabella (…234327)"
 * instead of two near-identical id strings.
 *
 * Only names shared by two or more DISTINCT entities are touched; a name that
 * appears once stays clean. Pure functions (no React, no store) so the rule is
 * locked by `node --test` (`chatNameHints.test.js`).
 */

/** Case-insensitive comparison key for a display name. */
export function nameKey(name) {
    return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

/**
 * The suffix of an entity id that tells two same-named entities apart.
 *
 * The engine derives an id from the name plus a timestamp ("Isabella-
 * 20260904230124"), and a copy adds a trailing series number ("…-2"). The id
 * is therefore name-slug + suffix: strip the slug-derived prefix and what is
 * left is the difference.
 *
 * @param {string} entityId
 * @param {string} [displayName]
 * @returns {string} '' when the id is empty
 */
export function idDisambiguator(entityId, displayName = '') {
    const id = typeof entityId === 'string' ? entityId.trim() : '';
    if (!id) return '';

    const slug = nameKey(displayName).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    let rest = '';
    if (slug && nameKey(id).startsWith(slug)) {
        rest = id.slice(slug.length).replace(/^[-_.\s]+/, '');
    }

    if (!rest || rest === id) {
        // Not name-prefixed (or the name is the id): the LAST segment carries
        // the timestamp/copy suffix.
        const segments = id.split(/[-_]+/).filter(Boolean);
        if (segments.length > 1) rest = segments[segments.length - 1];
    }
    return rest;
}

/**
 * Split a raw entity id used AS the display name into a readable name and its
 * distinguishing suffix: "Isabella-20260904230124" → { name: 'Isabella',
 * hint: '20260904230124' }. Anything that is not the id (a real display name)
 * is returned untouched.
 *
 * @param {string} name
 * @param {string} entityId
 * @returns {{name: string, hint: string}}
 */
export function splitIdName(name, entityId) {
    const raw = typeof name === 'string' ? name.trim() : '';
    const id = typeof entityId === 'string' ? entityId.trim() : '';
    if (!raw || !id || nameKey(raw) !== nameKey(id)) return { name: raw, hint: '' };

    const segments = id.split(/[-_]+/).filter(Boolean);
    if (segments.length < 2) return { name: id, hint: '' };
    return {
        // `-`/`_` are slug separators, not part of a human name.
        name: segments.slice(0, -1).join(' '),
        hint: segments[segments.length - 1],
    };
}

/**
 * The displayed name and small-print hint for ONE chat partner.
 *
 * @param {{name?: string, entityId?: string, alias?: string}} entry
 * @returns {{name: string, hint: string}}
 */
export function resolveChatName(entry) {
    const rawName = typeof entry?.name === 'string' ? entry.name.trim() : '';
    const alias = typeof entry?.alias === 'string' ? entry.alias.trim() : '';
    const entityId = entry?.entityId || '';

    // An id used as the name carries its own suffix — the readable prefix is
    // the name, the suffix the hint.
    const idName = splitIdName(rawName, entityId);
    if (idName.hint) return idName;

    if (alias && nameKey(alias) !== nameKey(rawName)) return { name: rawName, hint: alias };
    return { name: rawName, hint: idDisambiguator(entityId, rawName) };
}

/**
 * Resolved names for the entries whose display name is shared by two or more
 * DISTINCT entities.
 *
 * If two colliding entries resolve to the SAME hint (both aliases identical),
 * the alias is not a differentiator — every entry in that group falls back to
 * its id suffix instead.
 *
 * @param {Array<{key: string, name: string, entityId?: string, alias?: string}>} entries
 * @returns {Map<string, {name: string, hint: string}>} key → resolved name/hint,
 *   for colliding keys only
 */
export function duplicateNameHints(entries) {
    const groups = new Map();
    for (const entry of entries || []) {
        if (!entry?.key || !nameKey(entry.name)) continue;
        const resolved = resolveChatName(entry);
        const key = nameKey(resolved.name);
        if (!key) continue;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ entry, resolved });
    }

    const resolvedByKey = new Map();
    for (const group of groups.values()) {
        const entityIds = new Set(group.map((item) => item.entry.entityId || item.entry.key));
        if (entityIds.size < 2) continue;

        const hintKeys = new Set(group.map((item) => nameKey(item.resolved.hint)).filter(Boolean));
        const ambiguous = hintKeys.size < group.filter((item) => item.resolved.hint).length;

        for (const { entry, resolved } of group) {
            const hint = ambiguous
                ? idDisambiguator(entry.entityId || '', resolved.name)
                : resolved.hint;
            resolvedByKey.set(entry.key, { name: resolved.name, hint });
        }
    }
    return resolvedByKey;
}
