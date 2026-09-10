import test from 'node:test';
import assert from 'node:assert/strict';
import { getEntityAvatarLetter } from './entityDisplayUtils.js';

test('letter bubble takes the first alphanumeric character, uppercased', () => {
    assert.equal(getEntityAvatarLetter('Alleycat Annie 2'), 'A');
    assert.equal(getEntityAvatarLetter('claire'), 'C');
    assert.equal(getEntityAvatarLetter('max-2-20260905123515'), 'M');
});

test('leading punctuation/symbols are skipped', () => {
    // 6-1 §1 vector spirit: non-ASCII punctuation collapses away, the first
    // real letter wins.
    assert.equal(getEntityAvatarLetter('«Zoë»!!'), 'Z');
    assert.equal(getEntityAvatarLetter(' --__-- Isabella'), 'I');
});

test('no alphanumeric character yields the empty-string fallback', () => {
    assert.equal(getEntityAvatarLetter(''), '');
    assert.equal(getEntityAvatarLetter('   '), '');
    assert.equal(getEntityAvatarLetter('«»!!--__'), '');
    assert.equal(getEntityAvatarLetter(null), '');
    assert.equal(getEntityAvatarLetter(undefined), '');
    assert.equal(getEntityAvatarLetter(42), '');
});
