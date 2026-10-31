import test from 'node:test';
import assert from 'node:assert/strict';
import {
    EDITOR_TAB_SECTIONS,
    PERSONA_HIDDEN_SECTIONS,
    isSectionVisible,
    visibleSectionsForTab,
    tabHasNoVisibleSections,
    resolveEditorTabs,
    resolveActiveTabId,
} from './characterEditorSections.js';

/**
 * Tab list shaped like `CharacterProfileEditor`'s own `tabs` array. Kept
 * deliberately independent of the component so the test pins the RULES, not
 * today's JSX.
 */
const tabs = () => [
    { id: 'basic', minMode: 'simple' },
    { id: 'greeting', minMode: 'simple' },
    { id: 'lorebook', minMode: 'pro' },
    { id: 'behavior', minMode: 'pro' },
    { id: 'advanced', minMode: 'dev' },
    { id: 'images', minMode: 'simple' },
];

const ids = (list) => list.map((tab) => tab.id);

// ---------------------------------------------------------------------------
// Policy table
// ---------------------------------------------------------------------------

test('the persona-hidden list names exactly the generator/lifecycle sections', () => {
    assert.deepEqual([...PERSONA_HIDDEN_SECTIONS], [
        'aiPrompt',
        'voiceBehavior',
        'aiLifecycle',
        'rawCardData',
    ]);
});

test('every persona-hidden section belongs to at least one tab (no dead guard)', () => {
    const declared = new Set(
        Object.values(EDITOR_TAB_SECTIONS).flatMap((sections) => [...sections]),
    );
    PERSONA_HIDDEN_SECTIONS.forEach((sectionId) => {
        assert.ok(declared.has(sectionId), `${sectionId} is guarded but never rendered`);
    });
});

test('emoji actions never appear in the editor guard table (03-5c lives on the entity screen)', () => {
    const all = Object.values(EDITOR_TAB_SECTIONS).flatMap((sections) => [...sections]);
    assert.ok(!all.some((id) => id.toLowerCase().includes('emoji')));
    assert.ok(!PERSONA_HIDDEN_SECTIONS.some((id) => id.toLowerCase().includes('emoji')));
});

test('the tab map is frozen so a render cannot mutate the policy', () => {
    assert.throws(() => { EDITOR_TAB_SECTIONS.basic = []; }, TypeError);
    assert.throws(() => { PERSONA_HIDDEN_SECTIONS.push('identity'); }, TypeError);
});

// ---------------------------------------------------------------------------
// isSectionVisible
// ---------------------------------------------------------------------------

test('a non-persona profile sees every declared section', () => {
    Object.values(EDITOR_TAB_SECTIONS).flat().forEach((sectionId) => {
        assert.equal(isSectionVisible(sectionId, { personaMode: false }), true, sectionId);
    });
});

test('a persona hides behaviour, lifecycle and raw card sections', () => {
    assert.equal(isSectionVisible('identity', { personaMode: true }), true);
    assert.equal(isSectionVisible('cardInfo', { personaMode: true }), true);
    assert.equal(isSectionVisible('aiPrompt', { personaMode: true }), false);
    assert.equal(isSectionVisible('voiceBehavior', { personaMode: true }), false);
    assert.equal(isSectionVisible('aiLifecycle', { personaMode: true }), false);
    assert.equal(isSectionVisible('rawCardData', { personaMode: true }), false);
});

test('an unknown or empty section id is not renderable — a typo must not leak', () => {
    assert.equal(isSectionVisible('voiceBehvior'), false);
    assert.equal(isSectionVisible(''), false);
    assert.equal(isSectionVisible(null), false);
    assert.equal(isSectionVisible(undefined), false);
});

test('personaMode defaults to off', () => {
    assert.equal(isSectionVisible('aiLifecycle'), true);
});

// ---------------------------------------------------------------------------
// Per-tab section lists
// ---------------------------------------------------------------------------

test('the Identity tab keeps both sections for a persona (the acceptance criterion)', () => {
    assert.deepEqual(visibleSectionsForTab('basic', { personaMode: true }), ['identity', 'cardInfo']);
    assert.deepEqual(visibleSectionsForTab('basic'), ['identity', 'cardInfo']);
});

test('the behaviour tab loses every section for a persona and keeps all three otherwise', () => {
    assert.deepEqual(visibleSectionsForTab('behavior', { personaMode: true }), []);
    assert.deepEqual(visibleSectionsForTab('behavior'), ['aiPrompt', 'voiceBehavior', 'aiLifecycle']);
});

test('the advanced tab is card-only', () => {
    assert.deepEqual(visibleSectionsForTab('advanced', { personaMode: true }), []);
    assert.deepEqual(visibleSectionsForTab('advanced'), ['rawCardData']);
});

test('tabs that declare no sections report an empty list, not "all sections"', () => {
    ['greeting', 'lorebook', 'images'].forEach((tabId) => {
        assert.deepEqual(visibleSectionsForTab(tabId), []);
        assert.deepEqual(visibleSectionsForTab(tabId, { personaMode: true }), []);
    });
    assert.deepEqual(visibleSectionsForTab('nope'), []);
});

// ---------------------------------------------------------------------------
// tabHasNoVisibleSections — the derived tab guard
// ---------------------------------------------------------------------------

test('a section-bearing tab empties out for a persona', () => {
    assert.equal(tabHasNoVisibleSections('behavior', { personaMode: true }), true);
    assert.equal(tabHasNoVisibleSections('advanced', { personaMode: true }), true);
    assert.equal(tabHasNoVisibleSections('behavior'), false);
});

test('a tab that declares no sections is never dropped by the guard', () => {
    ['greeting', 'lorebook', 'images', 'unknown-tab'].forEach((tabId) => {
        assert.equal(tabHasNoVisibleSections(tabId, { personaMode: true }), false, tabId);
    });
});

test('the identity tab is never dropped — a persona still needs Identity + Card Info', () => {
    assert.equal(tabHasNoVisibleSections('basic', { personaMode: true }), false);
});

// ---------------------------------------------------------------------------
// resolveEditorTabs
// ---------------------------------------------------------------------------

test('a persona at Developer mode sees only Identity, Greeting, Lorebook and Images', () => {
    assert.deepEqual(
        ids(resolveEditorTabs({ tabs: tabs(), mode: 'dev', personaMode: true })),
        ['basic', 'greeting', 'lorebook', 'images'],
    );
});

test('the same list at Developer mode keeps behaviour and advanced for a character', () => {
    assert.deepEqual(
        ids(resolveEditorTabs({ tabs: tabs(), mode: 'dev' })),
        ['basic', 'greeting', 'lorebook', 'behavior', 'advanced', 'images'],
    );
});

test('mode gating still applies — a persona in Simple mode looks exactly like a character', () => {
    assert.deepEqual(
        ids(resolveEditorTabs({ tabs: tabs(), mode: 'simple', personaMode: true })),
        ['basic', 'greeting', 'images'],
    );
});

test('a Pro persona sees no behaviour tab even though Pro would normally allow it', () => {
    const resolved = ids(resolveEditorTabs({ tabs: tabs(), mode: 'pro', personaMode: true }));
    assert.deepEqual(resolved, ['basic', 'greeting', 'lorebook', 'images']);
    assert.ok(!resolved.includes('behavior'));
});

test('an unsaved profile drops the Images tab through `hidden`, for both profile types', () => {
    const unsaved = tabs().map((tab) => (tab.id === 'images' ? { ...tab, hidden: true } : tab));
    assert.deepEqual(
        ids(resolveEditorTabs({ tabs: unsaved, mode: 'simple' })),
        ['basic', 'greeting'],
    );
    assert.deepEqual(
        ids(resolveEditorTabs({ tabs: unsaved, mode: 'simple', personaMode: true })),
        ['basic', 'greeting'],
    );
});

test('unknown modes fall back to Simple rather than showing everything', () => {
    assert.deepEqual(
        ids(resolveEditorTabs({ tabs: tabs(), mode: 'wizard' })),
        ['basic', 'greeting', 'images'],
    );
});

test('resolveEditorTabs never mutates the caller list and tolerates garbage', () => {
    const input = tabs();
    const snapshot = ids(input);
    resolveEditorTabs({ tabs: input, mode: 'dev', personaMode: true });
    assert.deepEqual(ids(input), snapshot);

    assert.deepEqual(resolveEditorTabs(), []);
    assert.deepEqual(resolveEditorTabs({ tabs: null }), []);
    assert.deepEqual(resolveEditorTabs({ tabs: [null, {}, { id: 'basic' }] }).length, 1);
});

// ---------------------------------------------------------------------------
// resolveActiveTabId
// ---------------------------------------------------------------------------

test('an active tab that survived stays active', () => {
    const visible = [{ id: 'basic' }, { id: 'greeting' }];
    assert.equal(resolveActiveTabId(visible, 'greeting'), 'greeting');
});

test('a tab removed by the guard falls back to Identity', () => {
    const visible = ids(resolveEditorTabs({ tabs: tabs(), mode: 'dev', personaMode: true }))
        .map((id) => ({ id }));
    assert.equal(resolveActiveTabId(visible, 'behavior'), 'basic');
    assert.equal(resolveActiveTabId(visible, 'advanced'), 'basic');
});

test('the fallback degrades to the first visible tab when Identity itself is gone', () => {
    assert.equal(resolveActiveTabId([{ id: 'greeting' }, { id: 'images' }], 'behavior'), 'greeting');
    assert.equal(resolveActiveTabId([], 'behavior'), 'basic');
    assert.equal(resolveActiveTabId(null, 'behavior'), 'basic');
});
