/**
 * Persona section-visibility rules for the character/profile editor (plan 03-6).
 *
 * ## Why the guard is per SECTION, not per TAB
 *
 * The editor is organised into tabs, and each tab is a stack of collapsible
 * sections. Before 03-6 a persona hid two whole tabs (`behavior`, `advanced`),
 * which worked only while every section inside them happened to be persona-
 * irrelevant. That is a coincidence, not a rule: adding one persona-visible
 * section to `AI Behaviour` would have forced the tab back on for personas and
 * with it the lifecycle block Android deliberately hides.
 *
 * So the guard lives on the section, and tab visibility is **derived**:
 *
 *  - a tab that declares sections and has none left visible is dropped, and
 *  - a tab that declares no sections is never gated by this module at all
 *    (greeting / lorebook / images stay exactly as they were).
 *
 * That is the difference between "personas have no behaviour controls" (the
 * requirement) and "personas cannot reach the behaviour tab" (an implementation
 * detail that silently rots).
 *
 * ## What a persona must not see
 *
 * | Section          | Why a persona must not see it                                  |
 * |------------------|----------------------------------------------------------------|
 * | `aiPrompt`       | base prompt / post-history / scenario describe a GENERATOR. A  |
 * |                  | persona never generates — the engine explicitly refuses to     |
 * |                  | respond "as" a user entity, so these fields are dead data.     |
 * | `voiceBehavior`  | Voice & Behaviour (voice description, WPM, audio chance) is    |
 * |                  | the AI's own delivery settings — Android hides it for          |
 * |                  | personas, and a persona's replies come from the human.         |
 * | `aiLifecycle`    | Personas never run autonomous beats (no automation gate), so   |
 * |                  | `lifecycle_config` is meaningless. Android hides it.           |
 * | `rawCardData`    | Card-spec-only fields; personas are not character cards.       |
 *
 * Emoji actions (03-5c) do not appear in this editor at all — they live on the
 * **entity** screen, which already filters its rail to `entity_type === 'ai'`
 * (`aiEntities` in `EntitySettingsView`). A persona therefore cannot reach that
 * editor even with a stale selection, so no emoji guard is needed here; the
 * invariant is pinned by {@link PERSONA_HIDDEN_SECTIONS} never containing an
 * emoji id.
 *
 * ## Hidden ≠ deleted
 *
 * The editor's form state is still the FULL profile: a hidden section's value is
 * loaded and written back unchanged. This matters because the engine's profile
 * UPDATE writes every column — dropping a field from the payload would zero it.
 *
 * Everything here is pure so the rules are pinned by `node --test` instead of
 * being re-derived in the render.
 */

import { isModeAllowed } from '../store/uiModeStore.js';

/**
 * Section ids rendered by each editor tab, in render order.
 *
 * A tab missing from this map (or mapped to an empty array) is never gated on
 * section visibility — the tab shows whenever `hidden` / `minMode` allow it.
 */
export const EDITOR_TAB_SECTIONS = Object.freeze({
    basic: Object.freeze(['identity', 'cardInfo']),
    greeting: Object.freeze([]),
    lorebook: Object.freeze([]),
    behavior: Object.freeze(['aiPrompt', 'voiceBehavior', 'aiLifecycle']),
    advanced: Object.freeze(['rawCardData']),
    images: Object.freeze([]),
});

/**
 * Sections a persona must never show, wherever they are rendered.
 *
 * Kept as a flat list (not derived from the tab map) so the rule reads as a
 * policy. `characterEditorSections.test.js` asserts every entry belongs to at
 * least one tab, so a typo cannot silently disable a guard.
 */
export const PERSONA_HIDDEN_SECTIONS = Object.freeze([
    'aiPrompt',
    'voiceBehavior',
    'aiLifecycle',
    'rawCardData',
]);

const PERSONA_HIDDEN = new Set(PERSONA_HIDDEN_SECTIONS);

/**
 * Every section id this module knows about.
 *
 * Derived from the tab map so a section can never be "known" in one place and
 * unknown in another. Used to reject typos — see {@link isSectionVisible}.
 */
const KNOWN_SECTIONS = new Set(
    Object.values(EDITOR_TAB_SECTIONS).flatMap((sections) => [...sections]),
);

/**
 * May this section be rendered for the profile currently being edited?
 *
 * Unknown/empty ids are treated as "not renderable" — a section the guard table
 * does not know about is almost certainly a typo, and rendering it for a persona
 * is the exact bug this module exists to prevent. The check therefore runs even
 * for a character: a misspelt `sectionVisible('voiceBehvior')` must fail loudly
 * in review rather than quietly dropping a section from every editor.
 *
 * @param {string} sectionId
 * @param {{ personaMode?: boolean }} [options]
 * @returns {boolean}
 */
export function isSectionVisible(sectionId, { personaMode = false } = {}) {
    if (!sectionId || !KNOWN_SECTIONS.has(sectionId)) return false;
    if (!personaMode) return true;
    return !PERSONA_HIDDEN.has(sectionId);
}

/**
 * Sections of one tab that survive the persona guard, in render order.
 *
 * @param {string} tabId
 * @param {{ personaMode?: boolean }} [options]
 * @returns {string[]} empty for an unknown tab or a tab that declares none
 */
export function visibleSectionsForTab(tabId, { personaMode = false } = {}) {
    const sections = EDITOR_TAB_SECTIONS[tabId];
    if (!Array.isArray(sections)) return [];
    return sections.filter((id) => isSectionVisible(id, { personaMode }));
}

/**
 * Did this tab declare sections and lose every one of them to the persona guard?
 *
 * A tab that declares NO sections is not empty — it simply carries content this
 * module does not gate, so it must not be dropped.
 *
 * @param {string} tabId
 * @param {{ personaMode?: boolean }} [options]
 * @returns {boolean}
 */
export function tabHasNoVisibleSections(tabId, { personaMode = false } = {}) {
    const sections = EDITOR_TAB_SECTIONS[tabId];
    if (!Array.isArray(sections) || sections.length === 0) return false;
    return visibleSectionsForTab(tabId, { personaMode }).length === 0;
}

/**
 * The tabs an editor may actually show, for the active mode and profile type.
 *
 * Three independent filters, in this order:
 *  1. `tab.hidden`  — data availability (the Images tab needs a saved profile).
 *  2. persona guard — derived from sections (see {@link tabHasNoVisibleSections}).
 *  3. `minMode`     — Simple / Pro / Developer progressive disclosure.
 *
 * @param {{ tabs?: Object[], mode?: string, personaMode?: boolean }} [options]
 * @returns {Object[]} new array; the input list is never mutated
 */
export function resolveEditorTabs({ tabs, mode = 'simple', personaMode = false } = {}) {
    if (!Array.isArray(tabs)) return [];
    return tabs.filter((tab) => {
        if (!tab || !tab.id) return false;
        if (tab.hidden) return false;
        if (tabHasNoVisibleSections(tab.id, { personaMode })) return false;
        return isModeAllowed(mode, tab.minMode);
    });
}

/**
 * Which tab should be active after a mode switch / persona-mode change?
 *
 * The active tab can disappear in three ways — the mode dropped, persona mode
 * engaged, or a section guard emptied the tab — and rendering a hidden tab's
 * content would show exactly the controls the guard removed. Falling back to
 * `basic` (then to whatever is left) is what makes the guard safe.
 *
 * @param {Object[]} visibleTabs
 * @param {string} activeTabId
 * @param {string} [fallbackId]
 * @returns {string}
 */
export function resolveActiveTabId(visibleTabs, activeTabId, fallbackId = 'basic') {
    if (!Array.isArray(visibleTabs) || visibleTabs.length === 0) return fallbackId;
    if (visibleTabs.some((tab) => tab.id === activeTabId)) return activeTabId;
    const fallback = visibleTabs.find((tab) => tab.id === fallbackId);
    return fallback ? fallback.id : visibleTabs[0].id;
}
