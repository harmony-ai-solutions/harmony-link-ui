import test from 'node:test';
import assert from 'node:assert/strict';
import {
  nameKey,
  idDisambiguator,
  splitIdName,
  resolveChatName,
  duplicateNameHints,
} from './chatNameHints.js';

// ── nameKey ───────────────────────────────────────────────────────────────

test('nameKey compares names case-insensitively and tolerates non-strings', () => {
  assert.equal(nameKey('  Alleycat Annie '), 'alleycat annie');
  assert.equal(nameKey(null), '');
  assert.equal(nameKey(42), '');
});

// ── idDisambiguator ───────────────────────────────────────────────────────

test('idDisambiguator strips the name slug, leaving the timestamp/copy suffix', () => {
  assert.equal(idDisambiguator('Alleycat-Annie-20260904230124', 'Alleycat Annie'), '20260904230124');
  assert.equal(idDisambiguator('Isabella-20260904230124', 'Isabella'), '20260904230124');
  assert.equal(idDisambiguator('Alleycat-Annie-2-2026', 'Alleycat Annie'), '2-2026');
});

test('idDisambiguator tolerates empty and non-string ids', () => {
  assert.equal(idDisambiguator('', 'Name'), '');
  assert.equal(idDisambiguator(null, 'Name'), '');
  // A separator-less id carries no suffix to point at.
  assert.equal(idDisambiguator('singleword'), '');
});

// ── splitIdName ───────────────────────────────────────────────────────────

test('splitIdName turns a raw id into a readable name plus its suffix', () => {
  assert.deepEqual(
    splitIdName('Isabella-20260904230124', 'Isabella-20260904230124'),
    { name: 'Isabella', hint: '20260904230124' }
  );
  assert.deepEqual(
    splitIdName('Alleycat-Annie-2-2026', 'Alleycat-Annie-2-2026'),
    { name: 'Alleycat Annie 2', hint: '2026' }
  );
});

test('splitIdName leaves a real display name untouched', () => {
  assert.deepEqual(
    splitIdName('Alleycat Annie', 'Alleycat-Annie-2026'),
    { name: 'Alleycat Annie', hint: '' }
  );
  assert.deepEqual(splitIdName('', 'Isabella-1'), { name: '', hint: '' });
});

// ── resolveChatName ───────────────────────────────────────────────────────

test('resolveChatName prefers a distinct alias over the id suffix', () => {
  assert.deepEqual(
    resolveChatName({ name: 'Alleycat Annie', entityId: 'Alleycat-Annie-2026', alias: 'Annie RP' }),
    { name: 'Alleycat Annie', hint: 'Annie RP' }
  );
});

test('resolveChatName falls back to the id suffix when the alias IS the name', () => {
  assert.deepEqual(
    resolveChatName({ name: 'Alleycat Annie', entityId: 'Alleycat-Annie-2-2026', alias: 'Alleycat Annie' }),
    { name: 'Alleycat Annie', hint: '2-2026' }
  );
  assert.deepEqual(
    resolveChatName({ name: 'Isabella', entityId: 'Isabella-20260904234327', alias: '' }),
    { name: 'Isabella', hint: '20260904234327' }
  );
});

test('resolveChatName shortens an entity that renders its raw id', () => {
  assert.deepEqual(
    resolveChatName({
      name: 'Isabella-20260904230124',
      entityId: 'Isabella-20260904230124',
      alias: '',
    }),
    { name: 'Isabella', hint: '20260904230124' }
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

test('duplicateNameHints keeps the id-name twins readable and distinguishable', () => {
  const hints = duplicateNameHints([
    { key: 'i1', name: 'Isabella-20260904230124', entityId: 'Isabella-20260904230124', alias: '' },
    { key: 'i2', name: 'Isabella-20260904234327', entityId: 'Isabella-20260904234327', alias: '' },
  ]);
  assert.deepEqual(hints.get('i1'), { name: 'Isabella', hint: '20260904230124' });
  assert.deepEqual(hints.get('i2'), { name: 'Isabella', hint: '20260904234327' });
});

test('duplicateNameHints falls back to ids when the aliases collide too', () => {
  const hints = duplicateNameHints([
    { key: 'a', name: 'Alleycat Annie', entityId: 'Alleycat-Annie-2026', alias: 'Alleycat Annie' },
    { key: 'b', name: 'Alleycat Annie', entityId: 'Alleycat-Annie-2-2026', alias: 'Alleycat Annie' },
  ]);
  assert.equal(hints.get('a').hint, '2026');
  assert.equal(hints.get('b').hint, '2-2026');
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
