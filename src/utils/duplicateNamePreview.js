/**
 * Display-side mirror of the engine's copy-name rules (plan 03-3).
 *
 * ## Why this file exists at all
 *
 * Plan 03-3 step 3 is explicit: name de-duplication is **server-side and
 * authoritative**. The client must not compute the name it will *use* — it
 * must only *preview* it. So this module deliberately re-implements the
 * engine's rule rather than inventing a nicer one, and every function here is
 * a pure, side-effect-free mirror of Go source:
 *
 * | This module | Engine source |
 * |---|---|
 * | [`resolveNextCopyName`] | `controllers.ResolveAliasCopy` (entities) / `controllers.nextProfileCopyName` (profiles) |
 * | [`stripCopySuffix`] | `controllers.stripAliasCopySuffix` / `controllers.stripCopySuffix` |
 * | [`countCopiedMappings`] | `controllers.DuplicateEntity` (the 8 verbatim mapping slots) |
 *
 * If the two ever disagree, the preview lies. The server stays correct — the
 * copy lands under whatever the server chose — but the user sees a name that
 * does not match reality, which is exactly the bug 03-3 exists to prevent.
 * `duplicateNamePreview.test.js` pins the algorithm against the server's
 * documented examples.
 *
 * ## The rule (identical on both sides)
 *
 * 1. Strip ONE trailing copy-suffix from the source name. A suffix is a
 *    separator (space, `-`, `_`) followed by a run of digits: `"Aria 2"` →
 *    `"Aria"`. `"B2"` is untouched (no separator).
 * 2. The base name occupies slot **1**. Scan every LIVE sibling name and mark
 *    the slots they occupy.
 * 3. The first free slot at or above **2** is the next name: `"<base> <N>"`.
 *
 * Numbers are **NOT zero-padded** — the engine emits `"Max 2"`, never
 * `"Max 02"` (`nextProfileCopyName`'s doc comment says so outright). Plan
 * 03-3's acceptance text writes "`Aria 02` then `Aria 03`", but the shipped
 * server rule is `"Aria 2"` then `"Aria 3"`; the preview follows the SERVER,
 * because a preview that disagrees with the result is precisely the failure
 * mode the task is about. See the 03-3 notes in the plan doc.
 *
 * @module utils/duplicateNamePreview
 */

/**
 * Trailing copy-suffix: optional base, then one or more separators, then
 * digits to end-of-string. Mirrors `aliasCopySuffixPattern` /
 * `copySuffixPattern` (both `^(.*?)[\s-_]+(\d+)$`).
 */
export const COPY_SUFFIX_PATTERN = /^(.*?)[\s-_]+(\d+)$/;

/**
 * The eight module-mapping slots `DuplicateEntity` copies verbatim. Order
 * matches `models.EntityModuleMapping`.
 */
export const MODULE_MAPPING_SLOTS = [
    'backend',
    'cognition',
    'imagination',
    'movement',
    'rag',
    'stt',
    'tts',
    'vision',
];

/**
 * Remove ONE trailing copy-suffix to recover the true base name.
 *
 * `"Aria 2"` → `"Aria"`, `"Aria-02"` → `"Aria"`, `"Aria_ 3"` → `"Aria"`,
 * `"Aria"` → `"Aria"`, `"B2"` → `"B2"` (no separator, so no suffix).
 *
 * @param {*} name
 * @returns {string}
 */
export function stripCopySuffix(name) {
    if (typeof name !== 'string') return '';
    const trimmed = name.trim();
    const match = COPY_SUFFIX_PATTERN.exec(trimmed);
    if (!match) return trimmed;
    return match[1].trim();
}

/**
 * Resolve the next free name in a copy series.
 *
 * This is a faithful port of `controllers.ResolveAliasCopy` /
 * `controllers.nextProfileCopyName`, including the two details that are easy
 * to get wrong:
 *
 * - **Comparison is case-insensitive.** The engine lowercases both sides, so
 *   an existing `"max 2"` blocks `"Max 2"`.
 * - **Only a fully-suffixed live name occupies a slot.** `"Aria2"` (no
 *   separator) does not claim slot 2, matching the suffix regex.
 *
 * @param {string} sourceName - the source alias/name, suffix and all.
 * @param {Iterable<string>} [liveNames] - every LIVE sibling name. Must not
 *   contain tombstoned rows: the engine's partial unique index spans live
 *   rows only, so a soft-deleted name never blocks a slot.
 * @returns {string} `"<base> <N>"`, or `''` when `sourceName` is empty (the
 *   engine never invents an alias for a source that has none).
 */
export function resolveNextCopyName(sourceName, liveNames = []) {
    if (typeof sourceName !== 'string') return '';
    const trimmed = sourceName.trim();
    if (trimmed === '') return '';

    const base = stripCopySuffix(trimmed);
    const lowerBase = base.toLowerCase();

    /** Slot → occupied. Slot 1 is the base name itself. */
    const taken = new Set();
    for (const raw of liveNames || []) {
        if (typeof raw !== 'string') continue;
        const lower = raw.trim().toLowerCase();
        if (lower === '') continue;
        if (lower === lowerBase) {
            taken.add(1);
            continue;
        }
        if (!lower.startsWith(lowerBase)) continue;
        // Only the remainder is tested against the suffix pattern — that is
        // exactly what the Go code does (`pattern.FindStringSubmatch(suffix)`).
        const suffix = lower.slice(lowerBase.length);
        const match = COPY_SUFFIX_PATTERN.exec(suffix);
        if (!match) continue;
        const num = Number.parseInt(match[2], 10);
        if (Number.isFinite(num) && num >= 1) taken.add(num);
    }

    let next = 2;
    while (taken.has(next)) next += 1;
    return `${base} ${next}`;
}

/**
 * True for an AI entity (anything that is not explicitly a persona).
 *
 * `entity_type` is optional on the wire and defaults to `'ai'` engine-side,
 * so a missing/empty value must read as AI rather than as "unknown".
 *
 * @param {Object|null|undefined} entity
 * @returns {boolean}
 */
export function isAiEntity(entity) {
    return (entity?.entity_type || 'ai') !== 'user';
}

/**
 * The entities the duplicate flow may operate on.
 *
 * `POST /entities/:id/duplicate` answers `400 persona entities cannot be
 * duplicated`, so personas are filtered out here rather than surfacing a
 * guaranteed error. Order is preserved (the engine list is id-ordered).
 *
 * @param {Array<Object>} [entities]
 * @returns {Array<Object>}
 */
export function duplicateCandidates(entities) {
    return (entities || []).filter((entity) => entity && entity.id && isAiEntity(entity));
}

/**
 * Count the module mappings that will be copied.
 *
 * `DuplicateEntity` copies all eight config-id slots **verbatim**, including
 * slots that are NULL in the source. A slot is only meaningful to the user
 * when it actually has a config attached, so this counts slots whose resolved
 * module object carries a non-empty `id` (a `disabled` provider has no id and
 * therefore copies "nothing" — saying so is more honest than counting 8).
 *
 * @param {Object|null|undefined} entity - an entity row from `GET /entities`
 * @returns {number} 0–8
 */
export function countCopiedMappings(entity) {
    const modules = entity?.modules || {};
    return MODULE_MAPPING_SLOTS.reduce((count, slot) => {
        const id = modules[slot]?.id;
        return count + (id === undefined || id === null || String(id).trim() === '' ? 0 : 1);
    }, 0);
}

/**
 * Resolve the display name an entity is shown under.
 *
 * Engine precedent (`DuplicateEntity` step 3 / chat reads): the alias wins,
 * then the linked profile's name, then the id. Kept local so the preview and
 * the "known siblings" list agree on what a row is called.
 *
 * @param {Object|null|undefined} entity
 * @returns {string}
 */
export function entityDuplicateSourceName(entity) {
    const alias = typeof entity?.alias === 'string' ? entity.alias.trim() : '';
    if (alias !== '') return alias;
    const profileName = entity?.character_profile?.name;
    if (typeof profileName === 'string' && profileName.trim() !== '') return profileName.trim();
    return typeof entity?.id === 'string' ? entity.id : '';
}

/**
 * Build the complete preview for one candidate.
 *
 * `nextName` mirrors what the SERVER will produce, given the sibling names
 * currently live. It is a preview only: the component must render whatever the
 * 201 body comes back with after the call (`result.alias`), not this value.
 *
 * @param {Object} entity - the focused AI entity row
 * @param {Array<Object>} [siblings] - all entities, for slot occupancy
 * @returns {{
 *   sourceName: string,
 *   alias: string,
 *   nextName: string,
 *   mappingCount: number,
 *   hasAlias: boolean,
 *   changesName: boolean,
 * }}
 */
export function duplicatePreview(entity, siblings = []) {
    const alias = typeof entity?.alias === 'string' ? entity.alias.trim() : '';
    const sourceName = entityDuplicateSourceName(entity);
    const liveAliases = (siblings || [])
        .map((row) => (typeof row?.alias === 'string' ? row.alias.trim() : ''))
        .filter((value) => value !== '');
    // An entity with NO alias keeps no alias after duplication
    // (`ResolveAliasCopy` returns "" for an empty source). Its display name
    // therefore falls through to the SHARED profile name — unchanged, because
    // the duplicate live-links the same profile.
    const nextName = alias === '' ? sourceName : resolveNextCopyName(alias, liveAliases);
    return {
        sourceName,
        alias,
        nextName,
        mappingCount: countCopiedMappings(entity),
        hasAlias: alias !== '',
        changesName: alias !== '' && nextName !== sourceName,
    };
}
