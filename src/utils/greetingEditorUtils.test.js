import test from 'node:test';
import assert from 'node:assert/strict';
import {
    GREETING_WARN_CHARS,
    DEFAULT_GREETING_LABEL,
    parseGreetingArray,
    greetingCharCount,
    isGreetingTooLong,
    greetingStats,
    countLongGreetings,
    totalGreetingChars,
    updateAlternateGreeting,
    addAlternateGreeting,
    removeAlternateGreeting,
    moveAlternateGreeting,
    serialiseAlternateGreetings,
    greetingBlockLabelKey,
} from './greetingEditorUtils.js';

// ── parseGreetingArray ──────────────────────────────────────────────────────

test('parseGreetingArray reads the column JSON and drops non-strings', () => {
    assert.deepEqual(parseGreetingArray('["hi","there"]'), ['hi', 'there']);
    assert.deepEqual(parseGreetingArray('["a",1,null,"b"]'), ['a', 'b']);
});

test('parseGreetingArray tolerates every absent/invalid wire state', () => {
    for (const raw of ['', null, undefined, 'null', '{}', 'not json', '"a string"']) {
        assert.deepEqual(parseGreetingArray(raw), [], `raw=${String(raw)}`);
    }
});

test('parseGreetingArray passes an already-decoded array through', () => {
    assert.deepEqual(parseGreetingArray(['x', 'y']), ['x', 'y']);
});

// ── character counting ──────────────────────────────────────────────────────

test('greetingCharCount counts code points, so one emoji is one character', () => {
    assert.equal(greetingCharCount('abc'), 3);
    // UTF-16 length is 2 here; the user sees one emoji.
    assert.equal('😀'.length, 2);
    assert.equal(greetingCharCount('😀'), 1);
    assert.equal(greetingCharCount('a😀b'), 3);
    assert.equal(greetingCharCount(''), 0);
    assert.equal(greetingCharCount(null), 0);
    assert.equal(greetingCharCount(undefined), 0);
});

test('isGreetingTooLong triggers STRICTLY above the threshold', () => {
    assert.equal(GREETING_WARN_CHARS, 600);
    assert.equal(isGreetingTooLong('a'.repeat(600)), false);
    assert.equal(isGreetingTooLong('a'.repeat(601)), true);
});

test('greetingStats reports the character count and the overflow', () => {
    assert.deepEqual(greetingStats('hello'), { chars: 5, tooLong: false, overBy: 0 });
    assert.deepEqual(greetingStats('a'.repeat(605)), { chars: 605, tooLong: true, overBy: 5 });
});

test('countLongGreetings and totalGreetingChars cover a mixed list', () => {
    const list = ['short', 'a'.repeat(601), '', 'b'.repeat(700)];
    assert.equal(countLongGreetings(list), 2);
    assert.equal(totalGreetingChars(list), 5 + 601 + 0 + 700);
    assert.equal(countLongGreetings(null), 0);
    assert.equal(totalGreetingChars(undefined), 0);
});

// ── mutation helpers ────────────────────────────────────────────────────────

test('updateAlternateGreeting replaces one entry and never mutates the input', () => {
    const list = ['a', 'b', 'c'];
    const next = updateAlternateGreeting(list, 1, 'B');
    assert.deepEqual(next, ['a', 'B', 'c']);
    assert.deepEqual(list, ['a', 'b', 'c'], 'input must be untouched');
});

test('updateAlternateGreeting ignores out-of-range indices and bad input', () => {
    const list = ['a', 'b'];
    assert.equal(updateAlternateGreeting(list, 5, 'x'), list);
    assert.equal(updateAlternateGreeting(list, -1, 'x'), list);
    assert.deepEqual(updateAlternateGreeting(null, 0, 'x'), []);
});

test('addAlternateGreeting appends after the existing alternates', () => {
    assert.deepEqual(addAlternateGreeting(['a'], 'b'), ['a', 'b']);
    assert.deepEqual(addAlternateGreeting(['a']), ['a', '']);
    assert.deepEqual(addAlternateGreeting(null), ['']);
});

test('removeAlternateGreeting drops exactly one entry', () => {
    assert.deepEqual(removeAlternateGreeting(['a', 'b', 'c'], 1), ['a', 'c']);
    const list = ['a', 'b'];
    assert.equal(removeAlternateGreeting(list, 9), list, 'out of range is a no-op');
    assert.deepEqual(removeAlternateGreeting(null, 0), []);
});

test('moveAlternateGreeting reorders in both directions', () => {
    assert.deepEqual(moveAlternateGreeting(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
    assert.deepEqual(moveAlternateGreeting(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
    const list = ['a', 'b'];
    assert.equal(moveAlternateGreeting(list, 0, 5), list, 'out of range keeps the order');
});

// ── serialisation ───────────────────────────────────────────────────────────

test('serialiseAlternateGreetings drops blank blocks but keeps inner whitespace', () => {
    const list = ['  *she waves*  ', '', '   ', 'second'];
    assert.deepEqual(serialiseAlternateGreetings(list), ['  *she waves*  ', 'second']);
    assert.deepEqual(serialiseAlternateGreetings(null), []);
});

test('serialiseAlternateGreetings never emits the default greeting', () => {
    // The default lives in `first_mes`; the editor passes only alternates.
    assert.deepEqual(serialiseAlternateGreetings(['alt one']), ['alt one']);
});

// ── labels ──────────────────────────────────────────────────────────────────

test('greetingBlockLabelKey keeps the default distinct from the alternates', () => {
    assert.equal(greetingBlockLabelKey(DEFAULT_GREETING_LABEL, 0), 'default');
    assert.equal(greetingBlockLabelKey('alternate', 0), 'alternate:0');
    assert.equal(greetingBlockLabelKey('alternate', 3), 'alternate:3');
});
