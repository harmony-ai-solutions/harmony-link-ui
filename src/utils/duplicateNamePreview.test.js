import test from 'node:test';
import assert from 'node:assert/strict';
import {
    COPY_SUFFIX_PATTERN,
    MODULE_MAPPING_SLOTS,
    stripCopySuffix,
    resolveNextCopyName,
    isAiEntity,
    duplicateCandidates,
    countCopiedMappings,
    entityDuplicateSourceName,
    duplicatePreview,
} from './duplicateNamePreview.js';

/**
 * These cases are copied from the ENGINE's own doc comments and tests, not
 * invented here:
 *   - `controllers.nextProfileCopyName` (`database/controllers/character_controller.go`)
 *   - `controllers.ResolveAliasCopy` (`database/controllers/entity_controller.go`)
 *   - `management/routes_entities_test.go` assertions ("X 2", "X 3", "Max 3")
 * If a case here starts failing, the client preview has drifted from the
 * server and the preview is what is wrong.
 */

const entity = (id, alias, extra = {}) => ({
    id,
    alias,
    entity_type: 'ai',
    modules: {},
    ...extra,
});

// ── stripCopySuffix ─────────────────────────────────────────────────────────

test('stripCopySuffix removes ONE trailing suffix, never two', () => {
    assert.equal(stripCopySuffix('Aria 2'), 'Aria');
    // Only one suffix is stripped — the engine's regex is lazy-anchored, so
    // "Aria 2 3" keeps "Aria 2".
    assert.equal(stripCopySuffix('Aria 2 3'), 'Aria 2');
    assert.equal(stripCopySuffix('Aria-02'), 'Aria');
    assert.equal(stripCopySuffix('Aria_ 3'), 'Aria');
    assert.equal(stripCopySuffix('  Aria 4  '), 'Aria');
});

test('stripCopySuffix leaves separator-less digits alone', () => {
    // "B2" has no separator before the digit run — it is a name, not a copy.
    assert.equal(stripCopySuffix('B2'), 'B2');
    assert.equal(stripCopySuffix('Aria'), 'Aria');
    assert.equal(stripCopySuffix('R2D2'), 'R2D2');
});

test('stripCopySuffix tolerates non-strings and whitespace', () => {
    assert.equal(stripCopySuffix(null), '');
    assert.equal(stripCopySuffix(undefined), '');
    assert.equal(stripCopySuffix(42), '');
    assert.equal(stripCopySuffix('   '), '');
});

// ── resolveNextCopyName — the server's documented series ────────────────────

test('the first copy of a name with no siblings is "<base> 2"', () => {
    // Engine test: duplicating "X" yields alias "X 2".
    assert.equal(resolveNextCopyName('Aria', []), 'Aria 2');
    assert.equal(resolveNextCopyName('Aria', ['Aria']), 'Aria 2');
    assert.equal(resolveNextCopyName('Aria', ['Someone Else']), 'Aria 2');
});

test('the series continues past every occupied slot', () => {
    // Engine test: a second duplicate of "X" yields "X 3".
    assert.equal(resolveNextCopyName('Aria', ['Aria', 'Aria 2']), 'Aria 3');
    assert.equal(resolveNextCopyName('Aria', ['Aria', 'Aria 2', 'Aria 3']), 'Aria 4');
});

test('duplicating a copy strips its suffix and keeps the series going', () => {
    // Engine doc: duplicating "Max 2" → "Max 3" (suffix stripped first).
    assert.equal(
        resolveNextCopyName('Aria 2', ['Aria', 'Aria 2']),
        'Aria 3'
    );
});

test('the smallest free slot wins, not the highest + 1', () => {
    // Slot 3 is free even though 4 is taken — the engine takes the smallest.
    assert.equal(
        resolveNextCopyName('Aria', ['Aria', 'Aria 2', 'Aria 4']),
        'Aria 3'
    );
});

test('comparison is case-insensitive on every side', () => {
    assert.equal(resolveNextCopyName('Aria', ['ARIA']), 'Aria 2');
    assert.equal(resolveNextCopyName('ARIA', ['aria', 'aria 2']), 'ARIA 3');
});

test('numbers are NOT zero-padded (the server emits "2", not "02")', () => {
    assert.equal(resolveNextCopyName('Aria', ['Aria']), 'Aria 2');
    // A padded sibling still occupies its numeric slot.
    assert.equal(resolveNextCopyName('Aria', ['Aria', 'Aria 02']), 'Aria 3');
});

test('a separator-less lookalike does not occupy a slot', () => {
    // "Aria2" has no separator, so it is not the copy "Aria 2".
    assert.equal(resolveNextCopyName('Aria', ['Aria', 'Aria2']), 'Aria 2');
});

test('a dashed or underscored sibling occupies the same numeric slot', () => {
    assert.equal(resolveNextCopyName('Aria', ['Aria', 'Aria-2']), 'Aria 3');
    assert.equal(resolveNextCopyName('Aria', ['Aria', 'Aria_2']), 'Aria 3');
});

test('an empty or blank source name never invents an alias', () => {
    assert.equal(resolveNextCopyName('', ['Aria']), '');
    assert.equal(resolveNextCopyName('   ', ['Aria']), '');
    assert.equal(resolveNextCopyName(null, ['Aria']), '');
    assert.equal(resolveNextCopyName(undefined), '');
});

test('garbage in the sibling list is ignored, not fatal', () => {
    assert.equal(
        resolveNextCopyName('Aria', [null, undefined, 42, '', '   ', 'Aria']),
        'Aria 2'
    );
});

test('the acceptance sequence: twice in a row yields 2 then 3', () => {
    // Plan 03-3 acceptance, expressed the way the SERVER numbers it.
    const live = ['Aria'];

    const first = resolveNextCopyName('Aria', live);
    assert.equal(first, 'Aria 2');
    live.push(first); // the server created it

    const second = resolveNextCopyName('Aria', live);
    assert.equal(second, 'Aria 3');
    live.push(second);

    // A third duplicate keeps going, proving the series has no cap.
    assert.equal(resolveNextCopyName('Aria', live), 'Aria 4');
});

test('the preview of the SECOND duplicate already accounts for the first', () => {
    // This is the property the UI relies on: after duplicating once, the
    // refreshed entity list makes the next preview say "Aria 3" without any
    // client-side counter.
    const siblings = [entity('aria', 'Aria'), entity('aria-2', 'Aria 2')];
    assert.equal(duplicatePreview(entity('aria', 'Aria'), siblings).nextName, 'Aria 3');
});

test('the suffix pattern is anchored to the end of the string', () => {
    assert.equal(COPY_SUFFIX_PATTERN.test('Aria 2'), true);
    assert.equal(COPY_SUFFIX_PATTERN.test('Aria 2x'), false);
    assert.equal(COPY_SUFFIX_PATTERN.test('Aria'), false);
});

// ── isAiEntity / duplicateCandidates ────────────────────────────────────────

test('isAiEntity treats a missing entity_type as AI', () => {
    // The wire field is optional and defaults to 'ai' engine-side.
    assert.equal(isAiEntity({ id: 'x' }), true);
    assert.equal(isAiEntity({ id: 'x', entity_type: '' }), true);
    assert.equal(isAiEntity({ id: 'x', entity_type: 'ai' }), true);
    assert.equal(isAiEntity({ id: 'x', entity_type: 'user' }), false);
    assert.equal(isAiEntity(null), true);
});

test('duplicateCandidates drops personas and rows without an id', () => {
    const entities = [
        entity('aria', 'Aria'),
        { id: 'me', entity_type: 'user', alias: 'Me' },
        { alias: 'No id' },
        null,
        entity('max', 'Max'),
    ];
    assert.deepEqual(
        duplicateCandidates(entities).map((e) => e.id),
        ['aria', 'max']
    );
    assert.deepEqual(duplicateCandidates(null), []);
    assert.deepEqual(duplicateCandidates(undefined), []);
});

// ── countCopiedMappings ─────────────────────────────────────────────────────

test('countCopiedMappings counts only slots with a config id', () => {
    assert.equal(countCopiedMappings({ modules: {} }), 0);
    assert.equal(countCopiedMappings(null), 0);
    assert.equal(
        countCopiedMappings({
            modules: {
                backend: { id: 'b1' },
                cognition: { id: 'c1' },
                // A disabled module resolves with NO id — it copies "nothing".
                tts: { provider: 'disabled' },
                rag: { id: '' },
                stt: null,
            },
        }),
        2
    );
});

test('countCopiedMappings can reach every one of the eight slots', () => {
    const modules = Object.fromEntries(
        MODULE_MAPPING_SLOTS.map((slot) => [slot, { id: `${slot}-id` }])
    );
    assert.equal(MODULE_MAPPING_SLOTS.length, 8);
    assert.equal(countCopiedMappings({ modules }), 8);
});

test('countCopiedMappings accepts numeric ids', () => {
    // Pre-UUID config rows can arrive as numbers from an old payload.
    assert.equal(countCopiedMappings({ modules: { backend: { id: 7 } } }), 1);
    assert.equal(countCopiedMappings({ modules: { backend: { id: 0 } } }), 1);
});

// ── entityDuplicateSourceName ───────────────────────────────────────────────

test('entityDuplicateSourceName prefers alias, then profile name, then id', () => {
    assert.equal(entityDuplicateSourceName({ alias: 'Aria', id: 'a' }), 'Aria');
    assert.equal(
        entityDuplicateSourceName({ alias: '', id: 'a', character_profile: { name: 'Aria' } }),
        'Aria'
    );
    assert.equal(entityDuplicateSourceName({ alias: '', id: 'aria-20260101' }), 'aria-20260101');
    assert.equal(entityDuplicateSourceName(null), '');
});

// ── duplicatePreview ────────────────────────────────────────────────────────

test('duplicatePreview assembles source, result name and mapping count', () => {
    const source = entity('aria', 'Aria', {
        modules: { backend: { id: 'b1' }, cognition: { id: 'c1' } },
    });
    const preview = duplicatePreview(source, [source]);

    assert.equal(preview.sourceName, 'Aria');
    assert.equal(preview.alias, 'Aria');
    assert.equal(preview.nextName, 'Aria 2');
    assert.equal(preview.mappingCount, 2);
    assert.equal(preview.hasAlias, true);
    assert.equal(preview.changesName, true);
});

test('an aliasless source previews the SHARED profile name unchanged', () => {
    // ResolveAliasCopy returns "" for an empty source alias, so the duplicate
    // keeps no alias and display falls through to the (shared) profile name.
    const source = {
        id: 'profiled',
        alias: '',
        entity_type: 'ai',
        character_profile: { name: 'Aria' },
        modules: {},
    };
    const preview = duplicatePreview(source, [source]);
    assert.equal(preview.hasAlias, false);
    assert.equal(preview.nextName, 'Aria');
    assert.equal(preview.changesName, false);
});

test('duplicatePreview with no siblings behaves like the server', () => {
    assert.equal(duplicatePreview(entity('aria', 'Aria')).nextName, 'Aria 2');
    assert.equal(duplicatePreview(entity('aria', 'Aria'), []).nextName, 'Aria 2');
    assert.equal(duplicatePreview(entity('aria', 'Aria'), null).nextName, 'Aria 2');
});

test('duplicatePreview tolerates a missing entity', () => {
    const preview = duplicatePreview(null, []);
    assert.equal(preview.sourceName, '');
    assert.equal(preview.nextName, '');
    assert.equal(preview.mappingCount, 0);
});
