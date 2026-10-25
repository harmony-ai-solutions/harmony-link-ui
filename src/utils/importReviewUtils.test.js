import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CARD_SPECS,
    detectCardSpec,
    textLength,
    countLorebookEntries,
    countEmbeddedImages,
    countAlternateGreetings,
    stripCopySuffix,
    namesCollide,
    findNameCollision,
    nextCopyName,
    buildImportReview,
    createdFieldKeys,
    overwrittenFieldKeys,
} from './importReviewUtils.js';

const profile = (id, name) => ({ id, name });

// ── detectCardSpec ──────────────────────────────────────────────────────────

test('detectCardSpec reads the engine spec strings', () => {
    assert.equal(detectCardSpec({ spec: 'chara_card_v3', spec_version: '3.0' }), 'v3');
    assert.equal(detectCardSpec({ spec: 'chara_card_v2', spec_version: '2.0' }), 'v2');
    assert.equal(CARD_SPECS.includes(detectCardSpec({ spec: 'chara_card_v3' })), true);
});

test('detectCardSpec falls back to v1 when no spec is declared', () => {
    // The V1 parser path produces no `spec` value at all.
    assert.equal(detectCardSpec({}), 'v1');
    assert.equal(detectCardSpec({ spec: '' }), 'v1');
    assert.equal(detectCardSpec(null), 'v1');
    assert.equal(detectCardSpec(undefined), 'v1');
});

test('detectCardSpec trusts spec_version when spec is missing', () => {
    assert.equal(detectCardSpec({ spec_version: '3.0' }), 'v3');
    assert.equal(detectCardSpec({ spec_version: '2.0' }), 'v2');
});

// ── counts ──────────────────────────────────────────────────────────────────

test('textLength counts code points, not UTF-16 units', () => {
    assert.equal(textLength('abc'), 3);
    assert.equal(textLength('😀'), 1);
    assert.equal(textLength(''), 0);
    assert.equal(textLength(null), 0);
});

test('countLorebookEntries reads the character_book JSON column', () => {
    assert.equal(countLorebookEntries('{"entries":[{"content":"a"},{"content":"b"}]}'), 2);
    assert.equal(countLorebookEntries({ entries: [{}, {}, {}] }), 3);
    assert.equal(countLorebookEntries('{"entries":[]}'), 0);
});

test('countLorebookEntries reports 0 for every absent/invalid state', () => {
    for (const raw of ['', null, undefined, 'null', '{}', 'not json', { name: 'x' }]) {
        assert.equal(countLorebookEntries(raw), 0, `raw=${String(raw)}`);
    }
});

test('countEmbeddedImages counts the image manifest but never below the carrier', () => {
    const assets = JSON.stringify([
        { type: 'icon', uri: 'embeded://a.png' },
        { type: 'icon', uri: 'embeded://b.png' },
        { type: 'background', uri: 'embeded://c.png' },
    ]);
    assert.equal(countEmbeddedImages(assets, 1), 2, 'only icon-type assets count');
    // A card with no manifest still ships its own PNG.
    assert.equal(countEmbeddedImages('', 1), 1);
    assert.equal(countEmbeddedImages(null, 1), 1);
    assert.equal(countEmbeddedImages('not json', 1), 1);
    assert.equal(countEmbeddedImages('', 0), 0);
});

test('countAlternateGreetings ignores blank entries', () => {
    assert.equal(countAlternateGreetings('["a","","   ","b"]'), 2);
    assert.equal(countAlternateGreetings(['a', 'b', 'c']), 3);
    assert.equal(countAlternateGreetings(''), 0);
    assert.equal(countAlternateGreetings('not json'), 0);
    assert.equal(countAlternateGreetings('{}'), 0);
});

// ── copy-suffix helpers ─────────────────────────────────────────────────────

test('stripCopySuffix removes exactly one trailing copy suffix', () => {
    assert.equal(stripCopySuffix('Aria 2'), 'Aria');
    assert.equal(stripCopySuffix('Aria-3'), 'Aria');
    assert.equal(stripCopySuffix('Aria_4'), 'Aria');
    assert.equal(stripCopySuffix('Aria'), 'Aria');
    assert.equal(stripCopySuffix('B2'), 'B2', 'no separator means no suffix');
    // One suffix only — "Aria 2 3" is a copy of "Aria 2".
    assert.equal(stripCopySuffix('Aria 2 3'), 'Aria 2');
});

test('namesCollide is case-insensitive and whitespace tolerant', () => {
    assert.equal(namesCollide('Aria', 'aria'), true);
    assert.equal(namesCollide(' Aria ', 'aria'), true);
    assert.equal(namesCollide('Aria', 'Aria 2'), false);
    assert.equal(namesCollide('', ''), true);
});

// ── collision detection ─────────────────────────────────────────────────────

test('findNameCollision finds the existing profile by exact name', () => {
    const list = [profile('1', 'Aria'), profile('2', 'Bolt')];
    assert.deepEqual(findNameCollision('aria', list), { id: '1', name: 'Aria' });
    assert.equal(findNameCollision('Aria 2', list), null, 'a copy name is a different profile');
    assert.equal(findNameCollision('Nobody', list), null);
    assert.equal(findNameCollision('', list), null);
    assert.equal(findNameCollision('Aria', null), null);
});

// ── nextCopyName (mirror of nextProfileCopyName) ────────────────────────────

test('nextCopyName: no copies yet means " 2"', () => {
    assert.equal(nextCopyName('Aria', [profile('1', 'Aria')]), 'Aria 2');
});

test('nextCopyName skips taken slots', () => {
    const list = [profile('1', 'Aria'), profile('2', 'Aria 2')];
    assert.equal(nextCopyName('Aria', list), 'Aria 3');

    const gap = [profile('1', 'Aria'), profile('2', 'Aria 3')];
    assert.equal(nextCopyName('Aria', gap), 'Aria 2', 'the first FREE slot wins');
});

test('nextCopyName strips one suffix so the series continues', () => {
    const list = [profile('1', 'Aria'), profile('2', 'Aria 2')];
    assert.equal(nextCopyName('Aria 2', list), 'Aria 3');
});

test('nextCopyName counts a zero-padded copy as occupying its slot', () => {
    const list = [profile('1', 'Aria'), profile('2', 'Aria 02')];
    assert.equal(nextCopyName('Aria', list), 'Aria 3');
});

test('nextCopyName is case-insensitive, like the engine', () => {
    assert.equal(nextCopyName('Aria', [profile('1', 'ARIA'), profile('2', 'aria 2')]), 'Aria 3');
});

test('nextCopyName never zero-pads', () => {
    assert.equal(nextCopyName('Aria', [profile('1', 'Aria')]), 'Aria 2');
    assert.notEqual(nextCopyName('Aria', [profile('1', 'Aria')]), 'Aria 02');
});

test('nextCopyName returns empty for a blank name', () => {
    assert.equal(nextCopyName('', []), '');
    assert.equal(nextCopyName(null, null), '');
});

// ── buildImportReview ───────────────────────────────────────────────────────

test('buildImportReview summarises a V3 card truthfully', () => {
    const detection = {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        name: 'Aria',
        description: 'A wandering scholar.',
        first_mes: '*she looks up* Oh — hello.',
        alternate_greetings: ['"Hi."', '"You again."'],
        character_book: JSON.stringify({ entries: [{ content: 'a' }] }),
        assets: JSON.stringify([{ type: 'icon', uri: 'embeded://a.png' }]),
    };
    const review = buildImportReview(detection, []);
    assert.equal(review.spec, 'v3');
    assert.equal(review.name, 'Aria');
    assert.equal(review.descriptionLength, 20);
    assert.equal(review.alternateGreetingCount, 2);
    assert.equal(review.lorebookEntryCount, 1);
    assert.equal(review.embeddedImageCount, 1);
    assert.equal(review.greetingPreview, '*she looks up* Oh — hello.');
    assert.equal(review.collision, null);
    assert.equal(review.copyName, '');
    assert.equal(review.mode, 'create');
});

test('buildImportReview BLOCKS on a name collision and predicts the copy name', () => {
    const detection = { spec: 'chara_card_v2', name: 'Aria', first_mes: 'hi' };
    const review = buildImportReview(detection, [profile('1', 'Aria')]);
    assert.equal(review.mode, 'blocked');
    assert.deepEqual(review.collision, { id: '1', name: 'Aria' });
    assert.equal(review.copyName, 'Aria 2');
    assert.notEqual(review.mode, 'create');
});

test('buildImportReview survives a completely empty detection', () => {
    const review = buildImportReview(null, null);
    assert.equal(review.spec, 'v1');
    assert.equal(review.name, '');
    assert.equal(review.descriptionLength, 0);
    assert.equal(review.alternateGreetingCount, 0);
    assert.equal(review.lorebookEntryCount, 0);
    assert.equal(review.embeddedImageCount, 1, 'the carrier PNG still exists');
    assert.equal(review.greetingPreview, '');
    assert.equal(review.collision, null);
    assert.equal(review.mode, 'create');
});

// ── create vs overwrite ─────────────────────────────────────────────────────

test('createdFieldKeys lists only the fields the card actually carries', () => {
    const keys = createdFieldKeys({
        name: 'Aria',
        description: 'Scholar.',
        first_mes: 'hi',
        personality: '',
        scenario: null,
        alternate_greetings: [],
        character_book: '{"entries":[]}',
        creator: 'me',
    });
    assert.ok(keys.includes('name'));
    assert.ok(keys.includes('description'));
    assert.ok(keys.includes('first_mes'));
    assert.ok(keys.includes('creator'));
    assert.ok(keys.includes('card_provenance'), 'provenance is always written');
    assert.equal(keys.includes('personality'), false, 'empty fields are not claimed');
    assert.equal(keys.includes('scenario'), false);
    assert.equal(keys.includes('alternate_greetings'), false);
    assert.equal(keys.includes('character_book'), false);
});

test('createdFieldKeys includes arrays and lorebooks only when non-empty', () => {
    const keys = createdFieldKeys({
        name: 'Aria',
        alternate_greetings: ['one'],
        character_book: '{"entries":[{"content":"x"}]}',
        tags: ['mage'],
    });
    assert.ok(keys.includes('alternate_greetings'));
    assert.ok(keys.includes('character_book'));
    assert.ok(keys.includes('tags'));
});

test('overwrittenFieldKeys is always empty — an import never overwrites', () => {
    assert.deepEqual(overwrittenFieldKeys(), []);
    // Regardless of the collision situation, the answer is the same.
    assert.deepEqual(overwrittenFieldKeys(), overwrittenFieldKeys());
});
