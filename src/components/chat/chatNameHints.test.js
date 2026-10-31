import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nameKey,
  resolveChatName,
  duplicateNameHints,
} from './chatNameHints.js';

// ── nameKey ───────────────────────────────────────────────────────────────

test('nameKey compares names case-insensitively and tolerates non-strings', () => {
  assert.equal(nameKey('  Alleycat Annie '), 'alleycat annie');
  assert.equal(nameKey(null), '');
  assert.equal(nameKey(42), '');
});

// ── resolveChatName ───────────────────────────────────────────────────────

test('resolveChatName shows a distinct alias as the hint', () => {
  assert.deepEqual(
    resolveChatName({ name: 'Alleycat Annie', entityId: 'Alleycat-Annie-2-2026', alias: 'Alleycat Annie 2' }),
    { name: 'Alleycat Annie', hint: 'Alleycat Annie 2' }
  );
});

test('resolveChatName NEVER falls back to the entity id (owner rule, 2026-10-31)', () => {
  // The ORIGINAL of a duplicate pair typically carries alias === name.
  assert.deepEqual(
    resolveChatName({ name: 'Alleycat Annie', entityId: 'Alleycat-Annie-20260902092847', alias: 'Alleycat Annie' }),
    { name: 'Alleycat Annie', hint: '' }
  );
  // No alias at all — still no id.
  assert.deepEqual(
    resolveChatName({ name: 'Isabella', entityId: 'Isabella-20260904234327', alias: '' }),
    { name: 'Isabella', hint: '' }
  );
});

test('resolveChatName leaves a raw-id display name unsplit', () => {
  // An entity without a character profile renders its id as the name. The
  // id is already unique, so it stays exactly as it is.
  assert.deepEqual(
    resolveChatName({ name: 'Isabella-20260904230124', entityId: 'Isabella-20260904230124', alias: '' }),
    { name: 'Isabella-20260904230124', hint: '' }
  );
});

// ── duplicateNameHints ────────────────────────────────────────────────────

test('duplicateNameHints labels BOTH entries of a duplicated name', () => {
  const hints = duplicateNameHints([
    { key: 'a', name: 'Alleycat Annie', entityId: 'Alleycat-Annie-2026', alias: 'Annie RP' },
    { key: 'b', name: 'Alleycat Annie', entityId: 'Alleycat-Annie-2-2026', alias: 'Annie AU' },
  ]);
  assert.deepEqual(hints.get('a'), { name: 'Alleycat Annie', hint: 'Annie RP' });
  assert.deepEqual(hints.get('b'), { name: 'Alleycat Annie', hint: 'Annie AU' });
  assert.equal(hints.size, 2);
});

test('duplicateNameHints alias-only: the original keeps a clean name, the copy shows its alias', () => {
  // The owner's live pair: the original's alias equals the name (no hint),
  // the import copy carries a differing alias — that alone tells them apart.
  const hints = duplicateNameHints([
    { key: 'orig', name: 'Alleycat Annie', entityId: 'Alleycat-Annie-20260902092847', alias: 'Alleycat Annie' },
    { key: 'copy', name: 'Alleycat Annie', entityId: 'Alleycat-Annie-2-20260903211838', alias: 'Alleycat Annie 2' },
  ]);
  assert.deepEqual(hints.get('orig'), { name: 'Alleycat Annie', hint: '' });
  assert.deepEqual(hints.get('copy'), { name: 'Alleycat Annie', hint: 'Alleycat Annie 2' });
});

test('duplicateNameHints shows no ids when neither alias differentiates', () => {
  const hints = duplicateNameHints([
    { key: 'a', name: 'Alleycat Annie', entityId: 'Alleycat-Annie-2026', alias: 'Alleycat Annie' },
    { key: 'b', name: 'Alleycat Annie', entityId: 'Alleycat-Annie-2-2026', alias: 'Alleycat Annie' },
  ]);
  assert.equal(hints.get('a').hint, '');
  assert.equal(hints.get('b').hint, '');
});

test('duplicateNameHints leaves unique names clean', () => {
  const hints = duplicateNameHints([
    { key: 'a', name: 'Claire', entityId: 'Claire-2026', alias: 'Claire' },
    { key: 'b', name: 'Max', entityId: 'Max-2026', alias: 'Max' },
  ]);
  assert.equal(hints.size, 0);
  assert.equal(hints.get('a'), undefined);
});

test('duplicateNameHints ignores two threads owned by the SAME entity', () => {
  const hints = duplicateNameHints([
    // A group thread and a private thread with the same companion are still
    // one entity — there is nothing ambiguous to point at.
    { key: 'a', name: 'Claire', entityId: 'Claire-2026', alias: 'Claire' },
    { key: 'b', name: 'Claire', entityId: 'Claire-2026', alias: 'Claire' },
  ]);
  assert.equal(hints.size, 0);
});

test('duplicateNameHints tolerates missing input and empty names', () => {
  assert.equal(duplicateNameHints(undefined).size, 0);
  assert.equal(duplicateNameHints([{ key: 'a', name: '   ' }]).size, 0);
});
