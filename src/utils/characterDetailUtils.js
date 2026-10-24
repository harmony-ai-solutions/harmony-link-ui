/**
 * Pure helpers behind the character detail page (plan 03-4).
 *
 * Kept framework-free and side-effect free so `node --test` covers the rules
 * that are easy to get subtly wrong — greeting assembly, copy-sibling matching
 * and the per-mode tab set.
 *
 * ## Why the copy rule is IMPORTED, not re-derived
 *
 * `03-3` already mirrors the engine's copy-name algorithm in
 * [`duplicateNamePreview.js`](./duplicateNamePreview.js), and the memory-bank
 * note for this phase says so explicitly: the detail page must REUSE it. The
 * Copies tab therefore only needs the *inverse* direction — "which existing
 * names collapse to the same base" — which is `stripCopySuffix` applied to both
 * sides. If this file ever grows its own suffix regex, the page will disagree
 * with both the duplicate preview and the server.
 *
 * @module utils/characterDetailUtils
 */

import { stripCopySuffix } from './duplicateNamePreview.js';

/**
 * Defensively parse a JSON `[]string` column into a plain `string[]`.
 *
 * The engine may sync `''`, `'null'`, a malformed fragment, or a genuine
 * array — all four are normal states for these columns (see the same helper in
 * [`CharacterProfileEditor.jsx`](../components/characters/CharacterProfileEditor.jsx)),
 * so the detail page must not throw on any of them.
 *
 * @param {*} raw
 * @returns {string[]}
 */
export function parseStringArray(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter((value) => typeof value === 'string');
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
    } catch {
        return [];
    }
}

/**
 * Tags for the hero chip row.
 *
 * Empty / whitespace-only entries are dropped: a card exported from another
 * frontend can carry `["", "fantasy"]`, and an empty chip renders as a
 * mysterious blank pill.
 *
 * @param {Object|null|undefined} profile
 * @returns {string[]}
 */
export function profileTagList(profile) {
    return parseStringArray(profile?.tags)
        .map((tag) => tag.trim())
        .filter((tag) => tag !== '');
}

/**
 * The greeting slides the carousel shows: `first_mes` then every entry of
 * `alternate_greetings`.
 *
 * Order matters — the default greeting is slide 1 (`kind: 'default'`), which is
 * also the one the engine delivers on a truly-new chat, so the carousel mirrors
 * the chat's actual behaviour rather than listing alternates first.
 *
 * Blank greetings are skipped: an authored-but-empty `first_mes` must not
 * produce an empty first slide (the engine treats it as "no greeting" and the
 * chat opens without one), and an empty alternate string is a sync artefact.
 *
 * @param {Object|null|undefined} profile
 * @returns {Array<{key: string, kind: 'default'|'alternate', index: number, text: string}>}
 */
export function buildGreetingSlides(profile) {
    const slides = [];

    const first = typeof profile?.first_mes === 'string' ? profile.first_mes.trim() : '';
    if (first !== '') {
        slides.push({ key: 'default', kind: 'default', index: 0, text: profile.first_mes });
    }

    parseStringArray(profile?.alternate_greetings).forEach((text, position) => {
        if (typeof text !== 'string' || text.trim() === '') return;
        slides.push({
            key: `alternate-${position}`,
            kind: 'alternate',
            // 1-based position WITHIN the alternates array, so a skipped blank
            // entry does not renumber the labels of the ones that survive.
            index: position + 1,
            text,
        });
    });

    return slides;
}

/**
 * Other profiles that belong to the same copy series as `profile`.
 *
 * A series is every live name whose base (after stripping ONE trailing
 * ` N`/`-N`/`_N` suffix) equals this profile's base, compared
 * case-insensitively — the same normalisation the engine's unique-name check
 * uses. The profile itself is always excluded.
 *
 * Sorted with `numeric: true` so `Aria`, `Aria 2`, `Aria 10` read in slot order
 * instead of lexicographically (`Aria 10` before `Aria 2`).
 *
 * @param {Object|null|undefined} profile
 * @param {Array<Object>} [profiles] - every LIVE profile (tombstones must not
 *   appear: they are not listed by the engine at all)
 * @returns {Array<Object>}
 */
export function copySiblingProfiles(profile, profiles) {
    if (!profile || profile.id == null || typeof profile.name !== 'string') return [];
    const base = stripCopySuffix(profile.name).toLowerCase();
    if (base === '') return [];

    return (profiles || [])
        .filter((row) => row && row.id != null && row.id !== profile.id)
        .filter((row) => typeof row.name === 'string' && stripCopySuffix(row.name).toLowerCase() === base)
        .sort((a, b) => String(a.name).localeCompare(String(b.name), undefined, {
            numeric: true,
            sensitivity: 'base',
        }));
}

/**
 * Split the entities that reference a profile into chattable partners and
 * personas.
 *
 * `POST /entities/:id/duplicate` and the chat route both refuse personas, so
 * the detail page must show them in a DIFFERENT row shape (no Chat button)
 * rather than offering an action that is guaranteed to fail. `entity_type` is
 * optional on the wire and defaults to `'ai'` engine-side, so a missing value
 * is a partner, not "unknown".
 *
 * @param {Array<Object>} [entities]
 * @returns {{partners: Array<Object>, personas: Array<Object>}}
 */
export function splitLinkedEntities(entities) {
    const partners = [];
    const personas = [];

    (entities || []).forEach((entity) => {
        if (!entity || entity.id == null) return;
        if ((entity.entity_type || 'ai') === 'user') personas.push(entity);
        else partners.push(entity);
    });

    return { partners, personas };
}

/**
 * How many entities reference the profile — used by the hero summary and by the
 * delete warning, which must both agree.
 *
 * @param {Array<Object>} [entities]
 * @returns {number}
 */
export function countLinkedEntities(entities) {
    return (entities || []).filter((entity) => entity && entity.id != null).length;
}

/**
 * Tab ids the detail page may show.
 *
 * Simple is deliberately a SINGLE scroll page (hero + description + greeting +
 * Chat) with no tab strip at all: tabs above a 3-section page are chrome. Pro
 * adds gallery / copies / partners; Dev adds the raw card JSON.
 *
 * The caller passes booleans rather than reading the UI-mode store, so this
 * stays importable under `node --test` without zustand.
 *
 * @param {{isPro?: boolean, isDev?: boolean}} [modes]
 * @returns {string[]}
 */
export function resolveDetailTabs({ isPro = false, isDev = false } = {}) {
    const tabs = ['overview'];
    if (isPro) tabs.push('gallery', 'copies', 'partners');
    if (isDev) tabs.push('raw');
    return tabs;
}

/**
 * Pretty-print the profile for the Dev "Card JSON" tab.
 *
 * The raw COLUMN VALUES are shown as the engine stores them (JSON columns stay
 * strings) — that is the point of the tab: it lets a developer see what actually
 * round-trips instead of a re-serialised, prettified approximation.
 *
 * @param {Object|null|undefined} profile
 * @returns {string}
 */
export function rawCardJson(profile) {
    try {
        return JSON.stringify(profile ?? {}, null, 2);
    } catch {
        return '';
    }
}
