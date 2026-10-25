/**
 * Pure helpers for the card-import review step (plan 03-5d).
 *
 * ## The problem this closes
 *
 * Desktop imports immediately: drop a PNG and a profile exists. There is no
 * chance to see what the card actually contains, and — worse — a second import
 * of a card whose name is already taken silently produces a SECOND profile with
 * the same `name`. `character_profiles.name` has no UNIQUE constraint, so the
 * engine happily stores the duplicate and the user is left with two
 * indistinguishable rows.
 *
 * The review step therefore needs three pure answers before anything is
 * written:
 *
 *   1. **What did we detect?** spec, name, sizes, counts — a truthful summary.
 *   2. **Does the name collide?** If so the import is BLOCKED and the only way
 *      forward is "Import as copy" (the engine's own copy-number rule).
 *   3. **What would be written vs. preserved?** A fresh profile is always a
 *      create; a copy is still a create but with a derived name, and NOTHING is
 *      ever overwritten — that is the acceptance criterion.
 *
 * @module utils/importReviewUtils
 */

import { EKMAN_EMOTIONS } from './emojiActionUtils.js';
import { COPY_SUFFIX_PATTERN } from './duplicateNamePreview.js';

/** Shapes the engine can emit in `spec` / `spec_version`. */
export const CARD_SPECS = ['v1', 'v2', 'v3'];

/**
 * Normalise the spec the engine reports into `'v1' | 'v2' | 'v3'`.
 *
 * The parser reports the RAW `spec` string (`chara_card_v2`,
 * `chara_card_v3`) and leaves `spec` empty for V1 cards, which it parses with a
 * fallback and reports as `chara_card_v2` with `spec_version: "2.0"`. So the
 * version has to be derived from both fields, and the V1 signal is
 * "no spec declared at all".
 *
 * @param {{spec?: string, spec_version?: string}|null|undefined} detection
 * @returns {'v1'|'v2'|'v3'}
 */
export function detectCardSpec(detection) {
    if (!detection) return 'v1';
    const spec = String(detection.spec || '').toLowerCase();
    const version = String(detection.spec_version || '').toLowerCase();
    if (spec.includes('v3') || version.startsWith('3.')) return 'v3';
    if (spec.includes('v2') || version.startsWith('2.')) return 'v2';
    return 'v1';
}

/**
 * Count characters the way a user reads them (code points, not UTF-16 units).
 * Shares the rationale documented in `greetingEditorUtils.greetingCharCount`.
 *
 * @param {string} text
 * @returns {number}
 */
export function textLength(text) {
    if (!text) return 0;
    return Array.from(String(text)).length;
}

/**
 * How many entries a lorebook JSON column describes.
 *
 * Returns 0 for every absent/invalid state — an unparseable column is not a
 * card with one entry, and over-reporting a lorebook is exactly the kind of
 * untrue summary this task exists to eliminate.
 *
 * @param {string|object|null|undefined} book
 * @returns {number}
 */
export function countLorebookEntries(book) {
    if (!book) return 0;
    let parsed = book;
    if (typeof book === 'string') {
        try {
            parsed = JSON.parse(book);
        } catch {
            return 0;
        }
    }
    if (!parsed || typeof parsed !== 'object') return 0;
    const entries = parsed.entries;
    return Array.isArray(entries) ? entries.length : 0;
}

/**
 * How many embedded images a card declares.
 *
 * The card's `assets` manifest is authoritative (V3 `assets[]`, filtered to
 * image types). A card with no manifest still ships its carrier PNG, which the
 * importer stores as the primary image, so the count is never below 1 — the
 * panel states what will exist in the profile, not what the manifest holds.
 *
 * @param {Array|string|null|undefined} assets
 * @param {number} [carrierImages=1] - the PNG the card itself provides
 * @returns {number}
 */
export function countEmbeddedImages(assets, carrierImages = 1) {
    let list = assets;
    if (typeof assets === 'string') {
        if (!assets.trim()) {
            list = [];
        } else {
            try {
                list = JSON.parse(assets);
            } catch {
                list = [];
            }
        }
    }
    const manifest = Array.isArray(list)
        ? list.filter((a) => a && typeof a === 'object' && String(a.type || '').startsWith('icon'))
        : [];
    const manifestCount = manifest.length;
    const carrier = Number.isFinite(Number(carrierImages)) ? Math.max(0, Number(carrierImages)) : 1;
    return Math.max(manifestCount, carrier);
}

/** Count of alternate greetings in a JSON column or array. */
export function countAlternateGreetings(alternates) {
    if (!alternates) return 0;
    let list = alternates;
    if (typeof alternates === 'string') {
        try {
            list = JSON.parse(alternates);
        } catch {
            return 0;
        }
    }
    if (!Array.isArray(list)) return 0;
    return list.filter((g) => typeof g === 'string' && g.trim() !== '').length;
}

/**
 * Drop ONE trailing copy-suffix so a collision check compares BASE names.
 *
 * Mirrors `controllers.stripCopySuffix` (`^(.*?)[\s-_]+(\d+)$`). Importing
 * "Minato 2" when "Minato" exists is a *series* collision in spirit, but the
 * engine's duplicate-name rule is what generates "2", so stripping here would
 * block a legitimate copy of a copy. It is used for GROUPING the collision
 * report, never for the equality check itself.
 *
 * @param {string} name
 * @returns {string}
 */
export function stripCopySuffix(name) {
    const trimmed = String(name || '').trim();
    const match = COPY_SUFFIX_PATTERN.exec(trimmed);
    return match ? match[1].trim() : trimmed;
}

/** Case-insensitive name comparison — the engine's own convention for aliases. */
export function namesCollide(a, b) {
    return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
}

/**
 * Find the existing profile a card's name collides with, if any.
 *
 * Compares the EXACT name case-insensitively. Deliberately NOT suffix-stripped:
 * "Aria 2" is a different profile from "Aria" and re-importing it should
 * collide with "Aria 2" only.
 *
 * @param {string} cardName
 * @param {Array<{id: string, name: string}>} profiles
 * @returns {{id: string, name: string}|null}
 */
export function findNameCollision(cardName, profiles) {
    if (!cardName || !Array.isArray(profiles)) return null;
    return profiles.find((p) => p && namesCollide(p.name, cardName)) || null;
}

/**
 * The name an "Import as copy" would use, using the ENGINE's copy rule.
 *
 * This mirrors `controllers.nextProfileCopyName`:
 *
 *   - strip one trailing copy-suffix from the card name to get the base,
 *   - the base occupies slot 1,
 *   - every live profile named `<base> <N>` occupies slot N,
 *   - the first free slot ≥ 2 wins.
 *
 * Numbers are NOT zero-padded (`Aria 2`, not `Aria 02`) — the engine's doc
 * comment says so outright. The value produced here is a *prediction* for the
 * review panel; the engine call remains authoritative and the panel re-renders
 * from whatever the server actually created.
 *
 * @param {string} cardName
 * @param {Array<{name: string}>} profiles
 * @returns {string}
 */
export function nextCopyName(cardName, profiles) {
    const base = stripCopySuffix(cardName);
    if (!base) return '';
    const lowerBase = base.toLowerCase();
    const taken = new Set();

    for (const profile of Array.isArray(profiles) ? profiles : []) {
        const lower = String(profile?.name || '').trim().toLowerCase();
        if (!lower) continue;
        if (lower === lowerBase) {
            taken.add(1);
            continue;
        }
        if (lower.startsWith(lowerBase)) {
            // NOTE: the suffix is matched WITHOUT trimming first. The engine does
            // `suffix := lower[len(lowerBase):]` and hands that straight to
            // `copySuffixPattern` (`^(.*?)[\s-_]+(\d+)$`), which REQUIRES the
            // separator — trimming it to `"2"` makes the pattern unmatchable and
            // the slot is silently lost ("aria 2" would not collide).
            const match = COPY_SUFFIX_PATTERN.exec(lower.slice(lowerBase.length));
            if (match) {
                const num = Number.parseInt(match[2], 10);
                if (Number.isFinite(num) && num >= 1) taken.add(num);
            }
        }
    }

    let next = 2;
    while (taken.has(next)) next += 1;
    return `${base} ${next}`;
}

/**
 * Build the full review model the panel renders.
 *
 * `mode` is derived, never chosen by the caller:
 *   - `'create'` — no name collision, a plain import is safe.
 *   - `'blocked'` — the name is taken; a plain import must be refused and only
 *     "Import as copy" remains. The panel uses this to DISABLE the primary
 *     button rather than to silently switch to copying, because the user must
 *     see that the original is being preserved.
 *
 * @param {{
 *   spec?: string, spec_version?: string, name?: string,
 *   description?: string, first_mes?: string,
 *   alternate_greetings?: string|string[],
 *   character_book?: string|object,
 *   assets?: string|Array,
 * }} detection - the engine's parse summary
 * @param {Array<{id: string, name: string}>} profiles - live profiles
 * @param {{carrierImages?: number}} [options]
 * @returns {{
 *   spec: 'v1'|'v2'|'v3',
 *   name: string,
 *   descriptionLength: number,
 *   alternateGreetingCount: number,
 *   lorebookEntryCount: number,
 *   embeddedImageCount: number,
 *   greetingPreview: string,
 *   collision: {id: string, name: string}|null,
 *   copyName: string,
 *   mode: 'create'|'blocked',
 * }}
 */
export function buildImportReview(detection, profiles, options = {}) {
    const source = detection || {};
    const name = String(source.name || '').trim();
    const collision = findNameCollision(name, profiles);
    const carrierImages = Number.isFinite(Number(options.carrierImages)) ? Number(options.carrierImages) : 1;

    return {
        spec: detectCardSpec(source),
        name,
        descriptionLength: textLength(source.description || ''),
        alternateGreetingCount: countAlternateGreetings(source.alternate_greetings),
        lorebookEntryCount: countLorebookEntries(source.character_book),
        embeddedImageCount: countEmbeddedImages(source.assets, carrierImages),
        greetingPreview: String(source.first_mes || '').trim(),
        collision,
        copyName: collision ? nextCopyName(name, profiles) : '',
        mode: collision ? 'blocked' : 'create',
    };
}

/**
 * Which fields the import would write.
 *
 * A fresh profile is a pure CREATE — nothing is overwritten, whatever the name
 * situation. This list exists so the panel can say "created" out loud instead
 * of leaving the user to guess, and so a future in-place "update existing"
 * path has one place to declare the difference.
 *
 * Empty fields are omitted: claiming to create a `nickname` that the card does
 * not have would be an untrue summary.
 *
 * @param {object} detection
 * @returns {string[]} dotted field keys, in the order the importer writes them
 */
export function createdFieldKeys(detection) {
    const source = detection || {};
    const keys = [];
    const add = (key, value) => {
        // A caller that already reduced the value to `hasContent` passes a
        // boolean. `false` must NOT be recorded as "this field will be created"
        // — that is exactly the untrue summary this panel exists to avoid.
        if (typeof value === 'boolean') {
            if (value) keys.push(key);
            return;
        }
        if (value === undefined || value === null) return;
        if (typeof value === 'string' && value.trim() === '') return;
        if (Array.isArray(value) && value.length === 0) return;
        if (typeof value === 'object' && Object.keys(value).length === 0) return;
        keys.push(key);
    };

    add('name', source.name);
    add('description', source.description);
    add('personality', source.personality);
    add('scenario', source.scenario);
    add('first_mes', source.first_mes);
    add('mes_example', source.mes_example);
    add('alternate_greetings', countAlternateGreetings(source.alternate_greetings) > 0);
    add('character_book', countLorebookEntries(source.character_book) > 0);
    add('creator', source.creator);
    add('character_version', source.character_version);
    add('nickname', source.nickname);
    add('tags', source.tags);
    add('group_only_greetings', source.group_only_greetings);
    add('assets', countEmbeddedImages(source.assets, 0) > 0);
    add('extensions', source.extensions);
    add('card_provenance', true); // always written (spec + source + dates)

    return keys;
}

/**
 * Fields that would be OVERWRITTEN in an existing profile.
 *
 * Always empty: 03-5d's rule is that an import never overwrites, and a name
 * collision is BLOCKED instead of routed into an update. Kept as an explicit
 * function so the panel's "overwritten: none" line is produced by a decision,
 * not by an omitted template branch.
 *
 * @returns {string[]}
 */
export function overwrittenFieldKeys() {
    return [];
}

/**
 * Is this emotion name acceptable in the emoji-actions editor?
 * Re-exported here so import-review tests can assert the shared Ekman set
 * without importing the emoji module directly.
 */
export const IMPORT_REVIEW_EKMAN = EKMAN_EMOTIONS;
