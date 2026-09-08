import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePersonaName, RESERVED_PERSONA_NAMES } from './personaNameUtils.js';

// Fixture: live rows shaped like the FE entity list (id + optional alias).
const liveEntities = [
    { id: 'user', alias: 'Me' },
    { id: 'Isabella-20260905123514', alias: 'Isabella' },
    { id: 'max-2-20260905123515', alias: 'Max 2' },
    { id: 'legacy-claire', alias: null },
];

const ctx = { entities: liveEntities };

test('rejects empty and whitespace-only names', () => {
    assert.equal(validatePersonaName('', ctx), 'nameRequired');
    assert.equal(validatePersonaName('   ', ctx), 'nameRequired');
    assert.equal(validatePersonaName(null, ctx), 'nameRequired');
    assert.equal(validatePersonaName(undefined, ctx), 'nameRequired');
});

test('rejects BOTH reserved names case-insensitively (D33)', () => {
    assert.deepEqual(RESERVED_PERSONA_NAMES, ['user', 'deleted']);
    assert.equal(validatePersonaName('user', ctx), 'nameReservedUser');
    assert.equal(validatePersonaName('User', ctx), 'nameReservedUser');
    assert.equal(validatePersonaName(' USER ', ctx), 'nameReservedUser');
    assert.equal(validatePersonaName('deleted', ctx), 'nameReservedUser');
    assert.equal(validatePersonaName('Deleted', ctx), 'nameReservedUser');
});

test('display names keep spaces and punctuation — no charset validation', () => {
    assert.equal(validatePersonaName('Zoë !!', ctx), null);
    assert.equal(validatePersonaName('Anne-Marie O’Neil', ctx), null);
    assert.equal(validatePersonaName('a'.repeat(100), ctx), null);
});

test('uniqueness is case-insensitive ALIAS equality on live rows', () => {
    assert.equal(validatePersonaName('Isabella', ctx), 'nameExists');
    assert.equal(validatePersonaName('isabella', ctx), 'nameExists');
    assert.equal(validatePersonaName('  ISABELLA  ', ctx), 'nameExists');
    assert.equal(validatePersonaName('Max 2', ctx), 'nameExists');
    // Free names pass.
    assert.equal(validatePersonaName('Isabella 2', ctx), null);
    assert.equal(validatePersonaName('Bella', ctx), null);
});

test('rows with no alias never collide (partial-unique-index semantics)', () => {
    // 'legacy-claire' has alias null — the NAME 'legacy-claire' is not an
    // alias, so it cannot trip alias-equality.
    assert.equal(validatePersonaName('legacy-claire', ctx), null);
});

test('excludeId skips the entity being edited', () => {
    const isabella = liveEntities[1];
    assert.equal(
        validatePersonaName('Isabella', { entities: liveEntities, excludeId: isabella.id }),
        null
    );
    // Still collides against every OTHER live alias.
    assert.equal(
        validatePersonaName('Max 2', { entities: liveEntities, excludeId: isabella.id }),
        'nameExists'
    );
});

test('empty entity list → only empty/reserved checks apply', () => {
    assert.equal(validatePersonaName('Anyone', { entities: [] }), null);
    assert.equal(validatePersonaName('user', { entities: [] }), 'nameReservedUser');
    assert.equal(validatePersonaName('', { entities: [] }), 'nameRequired');
});

test('defaults: no context at all behaves like an empty list', () => {
    assert.equal(validatePersonaName('Anyone'), null);
    assert.equal(validatePersonaName('deleted'), 'nameReservedUser');
});
