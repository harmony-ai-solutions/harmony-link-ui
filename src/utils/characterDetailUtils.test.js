import test from 'node:test';
import assert from 'node:assert/strict';
import {
    parseStringArray,
    profileTagList,
    buildGreetingSlides,
    copySiblingProfiles,
    splitLinkedEntities,
    countLinkedEntities,
    resolveDetailTabs,
    rawCardJson,
} from './characterDetailUtils.js';

const profile = (id, name, extra = {}) => ({ id, name, ...extra });

// ── parseStringArray ────────────────────────────────────────────────────────

test('parseStringArray reads a JSON array and drops non-strings', () => {
    assert.deepEqual(parseStringArray('["a","b"]'), ['a', 'b']);
    assert.deepEqual(parseStringArray('["a",1,null,"b"]'), ['a', 'b']);
});

test('parseStringArray tolerates every non-array wire state', () => {
    // These are all real states for the synced JSON columns.
    assert.deepEqual(parseStringArray(''), []);
    assert.deepEqual(parseStringArray(null), []);
    assert.deepEqual(parseStringArray(undefined), []);
    assert.deepEqual(parseStringArray('null'), []);
    assert.deepEqual(parseStringArray('{}'), []);
    assert.deepEqual(parseStringArray('not json'), []);
});

test('parseStringArray passes an already-decoded array through', () => {
    assert.deepEqual(parseStringArray(['x', 'y']), ['x', 'y']);
});

// ── profileTagList ──────────────────────────────────────────────────────────

test('profileTagList trims and drops blank tags', () => {
    assert.deepEqual(profileTagList({ tags: '[" fantasy ", "", "  ", "mage"]' }), ['fantasy', 'mage']);
});

test('profileTagList is empty for a profile with no tags', () => {
    assert.deepEqual(profileTagList({}), []);
    assert.deepEqual(profileTagList(null), []);
});

// ── buildGreetingSlides ─────────────────────────────────────────────────────

test('buildGreetingSlides puts first_mes first, then the alternates in order', () => {
    const slides = buildGreetingSlides({
        first_mes: 'Hello there.',
        alternate_greetings: '["Good evening.","You again?"]',
    });
    assert.equal(slides.length, 3);
    assert.equal(slides[0].kind, 'default');
    assert.equal(slides[0].text, 'Hello there.');
    assert.deepEqual(slides.slice(1).map((s) => s.text), ['Good evening.', 'You again?']);
    assert.deepEqual(slides.slice(1).map((s) => s.kind), ['alternate', 'alternate']);
});

test('buildGreetingSlides works with alternates and no default greeting', () => {
    const slides = buildGreetingSlides({ first_mes: '', alternate_greetings: '["Only one"]' });
    assert.equal(slides.length, 1);
    assert.equal(slides[0].kind, 'alternate');
    assert.equal(slides[0].text, 'Only one');
});

test('buildGreetingSlides skips a blank default but keeps its alternates', () => {
    const slides = buildGreetingSlides({ first_mes: '   ', alternate_greetings: '["A","B"]' });
    assert.deepEqual(slides.map((s) => s.text), ['A', 'B']);
});

test('buildGreetingSlides drops blank alternates without renumbering the rest', () => {
    const slides = buildGreetingSlides({
        first_mes: 'Hi',
        alternate_greetings: '["", "Second", "  "]',
    });
    assert.deepEqual(slides.map((s) => s.text), ['Hi', 'Second']);
    // The surviving alternate keeps its 1-based position in the source array.
    assert.equal(slides[1].index, 2);
});

test('buildGreetingSlides returns nothing for a profile with no greetings', () => {
    assert.deepEqual(buildGreetingSlides({}), []);
    assert.deepEqual(buildGreetingSlides(null), []);
});

// ── copySiblingProfiles ─────────────────────────────────────────────────────

test('copySiblingProfiles matches the whole copy series and excludes itself', () => {
    const target = profile('p2', 'Aria 2');
    const siblings = copySiblingProfiles(target, [
        target,
        profile('p1', 'Aria'),
        profile('p3', 'Aria 3'),
        profile('p4', 'Boris'),
    ]);
    assert.deepEqual(siblings.map((s) => s.name), ['Aria', 'Aria 3']);
});

test('copySiblingProfiles is case-insensitive, like the engine name check', () => {
    const siblings = copySiblingProfiles(profile('a', 'ARIA 2'), [
        profile('b', 'aria'),
        profile('c', 'Aria 5'),
    ]);
    assert.deepEqual(siblings.map((s) => s.id), ['b', 'c']);
});

test('copySiblingProfiles sorts by slot, not lexicographically', () => {
    const siblings = copySiblingProfiles(profile('t', 'Aria'), [
        profile('ten', 'Aria 10'),
        profile('two', 'Aria 2'),
        profile('three', 'Aria 3'),
    ]);
    assert.deepEqual(siblings.map((s) => s.name), ['Aria 2', 'Aria 3', 'Aria 10']);
});

test('copySiblingProfiles ignores lookalikes that carry no suffix separator', () => {
    // "Aria2" has no separator: the suffix regex does not strip it, so it is a
    // different base name — the same conclusion the duplicate preview reaches.
    const siblings = copySiblingProfiles(profile('x', 'Aria'), [
        profile('y', 'Aria2'),
        profile('z', 'Ariadne'),
    ]);
    assert.deepEqual(siblings, []);
});

test('copySiblingProfiles strips only ONE suffix on each side', () => {
    // "Aria 2 3" collapses to base "Aria 2" — so it is NOT a sibling of "Aria 4"
    // (base "Aria"), which is the same one-suffix rule the duplicate preview and
    // the engine use.
    assert.deepEqual(
        copySiblingProfiles(profile('a', 'Aria 4'), [profile('b', 'Aria 2 3')]),
        []
    );
    // …but it IS a sibling of ANOTHER two-level name.
    assert.deepEqual(
        copySiblingProfiles(profile('a', 'Aria 2 5'), [profile('b', 'Aria 2 3')]).map((s) => s.id),
        ['b']
    );
});

test('copySiblingProfiles skips malformed rows instead of throwing', () => {
    const siblings = copySiblingProfiles(profile('a', 'Aria'), [
        null,
        { id: 'x' },
        { id: null, name: 'Aria 2' },
        profile('good', 'Aria 5'),
    ]);
    assert.deepEqual(siblings.map((s) => s.id), ['good']);
});

test('copySiblingProfiles needs both an id and a name to work with', () => {
    assert.deepEqual(copySiblingProfiles(null, [profile('a', 'Aria')]), []);
    assert.deepEqual(copySiblingProfiles({ name: 'Aria' }, [profile('a', 'Aria')]), []);
    assert.deepEqual(copySiblingProfiles({ id: 'x' }, [profile('a', 'Aria')]), []);
});

// ── splitLinkedEntities / countLinkedEntities ───────────────────────────────

test('splitLinkedEntities separates partners from personas', () => {
    const { partners, personas } = splitLinkedEntities([
        { id: 'ai-1', entity_type: 'ai', alias: 'Aria' },
        { id: 'u-1', entity_type: 'user', alias: 'Me' },
        { id: 'ai-2', alias: 'No type means AI' },
    ]);
    assert.deepEqual(partners.map((e) => e.id), ['ai-1', 'ai-2']);
    assert.deepEqual(personas.map((e) => e.id), ['u-1']);
});

test('splitLinkedEntities drops rows without an id', () => {
    const { partners, personas } = splitLinkedEntities([null, { alias: 'x' }, { id: 'ok' }]);
    assert.deepEqual(partners.map((e) => e.id), ['ok']);
    assert.deepEqual(personas, []);
});

test('countLinkedEntities counts every usable reference', () => {
    assert.equal(countLinkedEntities([{ id: 'a' }, { id: 'b' }, null, {}]), 2);
    assert.equal(countLinkedEntities(undefined), 0);
});

// ── resolveDetailTabs ───────────────────────────────────────────────────────

test('resolveDetailTabs is overview-only in Simple mode', () => {
    // Simple has no tab strip at all — the page IS the overview.
    assert.deepEqual(resolveDetailTabs(), ['overview']);
    assert.deepEqual(resolveDetailTabs({ isPro: false, isDev: false }), ['overview']);
});

test('resolveDetailTabs adds gallery, copies and partners for Pro', () => {
    assert.deepEqual(resolveDetailTabs({ isPro: true }), ['overview', 'gallery', 'copies', 'partners']);
});

test('resolveDetailTabs adds the raw JSON tab for Dev only', () => {
    // Dev implies Pro at the call site (`isModeAllowed`), but the helper must
    // not assume it: the two flags are independent inputs.
    assert.deepEqual(resolveDetailTabs({ isDev: true }), ['overview', 'raw']);
    assert.deepEqual(resolveDetailTabs({ isPro: true, isDev: true }), [
        'overview',
        'gallery',
        'copies',
        'partners',
        'raw',
    ]);
});

// ── rawCardJson ─────────────────────────────────────────────────────────────

test('rawCardJson pretty-prints the profile as stored', () => {
    const text = rawCardJson({ id: 'x', tags: '["a"]' });
    assert.equal(text, '{\n  "id": "x",\n  "tags": "[\\"a\\"]"\n}');
});

test('rawCardJson never throws', () => {
    assert.equal(rawCardJson(null), '{}');
    const circular = {};
    circular.self = circular;
    assert.equal(rawCardJson(circular), '');
});
