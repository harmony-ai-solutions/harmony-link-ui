/**
 * Pure helpers for the alternate-greetings editor (plan 03-5a).
 *
 * ## Why this module exists
 *
 * The greeter is the one card field users actually judge a character by, and it
 * was only editable through raw card JSON. This module holds the *rules* so the
 * JSX component stays presentational and the rules can be pinned by
 * `node --test` (the component cannot be unit-tested in this repo — there is no
 * DOM test runner).
 *
 * ## The shape, and why it is two arrays and not one
 *
 * The card spec keeps `first_mes` (the DEFAULT greeting) and
 * `alternate_greetings` (a JSON array of strings) in **separate columns**.
 * [`CharacterProfileEditor`](../components/characters/CharacterProfileEditor.jsx)
 * therefore keeps them in separate state, and this module deliberately mirrors
 * that: `first_mes` is never index 0 of the alternates array. Merging them
 * would make "delete the third block" ambiguous and would silently rewrite the
 * profile's `first_mes` on every reorder.
 *
 * @module utils/greetingEditorUtils
 */

import { moveListItem } from './characterFilterUtils.js';

/**
 * Above this many characters a single greeting is flagged.
 *
 * `600` comes from the plan (03-5a). It is a *prompt-cost* warning, not a
 * limit: a long greeting is often intentional (a scene-setting opener), so the
 * editor warns and never blocks the save.
 */
export const GREETING_WARN_CHARS = 600;

/** Stable label used for the `first_mes` block. Not an `alternate_greetings` index. */
export const DEFAULT_GREETING_LABEL = 'default';

/**
 * Parse a JSON `[]string` column into a plain `string[]`.
 *
 * Accepts every state the synced column can actually be in: `''`/`null`/
 * `'null'` (absent — the engine's mapper stores absent values as `''`),
 * invalid JSON, a JSON object, and an already-decoded array. Non-string
 * entries are dropped rather than coerced, because `JSON.parse('["a",1]')`
 * would otherwise render a number into a textarea.
 *
 * @param {string|Array|null|undefined} raw
 * @returns {string[]}
 */
export function parseGreetingArray(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.filter((v) => typeof v === 'string');
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
    } catch {
        return [];
    }
}

/**
 * Count the characters a user perceives, not the UTF-16 code units.
 *
 * `'😀'.length === 2` but it is one character on screen. Greeting text is full
 * of emoji and CJK, so counting code units would report a count the user can
 * disprove by looking at the field. `Array.from` iterates code points.
 *
 * @param {string} text
 * @returns {number}
 */
export function greetingCharCount(text) {
    if (!text) return 0;
    return Array.from(String(text)).length;
}

/** True when this greeting crossed {@link GREETING_WARN_CHARS}. */
export function isGreetingTooLong(text) {
    return greetingCharCount(text) > GREETING_WARN_CHARS;
}

/**
 * Totals for one greeting block, ready to render under the textarea.
 *
 * @param {string} text
 * @returns {{chars: number, tooLong: boolean, overBy: number}}
 */
export function greetingStats(text) {
    const chars = greetingCharCount(text);
    return {
        chars,
        tooLong: chars > GREETING_WARN_CHARS,
        overBy: Math.max(0, chars - GREETING_WARN_CHARS),
    };
}

/**
 * How many of the given greetings are over the warning threshold.
 *
 * The editor shows a single summary line for the whole tab (the per-block count
 * is already visible on each block); this is what the summary counts.
 *
 * @param {string[]} firstMesAndAlternates - any mix of greeting texts
 * @returns {number}
 */
export function countLongGreetings(greetings) {
    if (!Array.isArray(greetings)) return 0;
    return greetings.filter((g) => isGreetingTooLong(g)).length;
}

/** Total characters across every greeting (the prompt-cost headline). */
export function totalGreetingChars(greetings) {
    if (!Array.isArray(greetings)) return 0;
    return greetings.reduce((sum, g) => sum + greetingCharCount(g), 0);
}

/**
 * Replace one alternate greeting's text.
 *
 * A no-op for an out-of-range index, so a stale click (the list shrank between
 * render and event) cannot throw.
 *
 * @param {string[]} alternates
 * @param {number} index
 * @param {string} text
 * @returns {string[]}
 */
export function updateAlternateGreeting(alternates, index, text) {
    if (!Array.isArray(alternates)) return [];
    if (!Number.isInteger(index) || index < 0 || index >= alternates.length) return alternates;
    const next = alternates.slice();
    next[index] = text;
    return next;
}

/** Append a blank (or provided) alternate greeting. */
export function addAlternateGreeting(alternates, text = '') {
    const list = Array.isArray(alternates) ? alternates : [];
    return [...list, text];
}

/**
 * Remove one alternate greeting.
 *
 * Deliberately does NOT trim or dedupe: two identical greetings are a mistake
 * the user can see and fix, whereas silently deleting one of them would lose
 * the text they meant to keep.
 *
 * @param {string[]} alternates
 * @param {number} index
 * @returns {string[]}
 */
export function removeAlternateGreeting(alternates, index) {
    if (!Array.isArray(alternates)) return [];
    if (!Number.isInteger(index) || index < 0 || index >= alternates.length) return alternates;
    return alternates.filter((_, i) => i !== index);
}

/**
 * Reorder an alternate greeting. Delegates to the ONE list-move implementation
 * already in the codebase (`characterFilterUtils.moveListItem`) instead of
 * writing a second splice.
 */
export function moveAlternateGreeting(alternates, fromIndex, toIndex) {
    return moveListItem(alternates, fromIndex, toIndex);
}

/**
 * The value written to the `alternate_greetings` column.
 *
 * Blank blocks are dropped: an empty textarea is not a greeting, and storing
 * `""` in the array would make the chat's greeting swiper offer an empty
 * bubble. Leading/trailing whitespace is preserved inside a non-blank greeting
 * (roleplay formatting matters) but an all-whitespace block is dropped.
 *
 * @param {string[]} alternates
 * @returns {string[]}
 */
export function serialiseAlternateGreetings(alternates) {
    if (!Array.isArray(alternates)) return [];
    return alternates.filter((g) => typeof g === 'string' && g.trim() !== '');
}

/**
 * Label for a greeting block in the editor.
 *
 * `first_mes` is not "Alternate greeting 1" — it is the default the engine
 * delivers on a truly-new chat, and mislabelling it is how users end up
 * editing the wrong block.
 *
 * @param {'default'|'alternate'} kind
 * @param {number} index - 0-based position among the ALTERNATES (ignored for default)
 * @returns {'default'|string}
 */
export function greetingBlockLabelKey(kind, index) {
    if (kind === DEFAULT_GREETING_LABEL) return DEFAULT_GREETING_LABEL;
    return `alternate:${index}`;
}
