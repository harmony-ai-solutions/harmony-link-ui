import test from 'node:test';
import assert from 'node:assert/strict';
import { getActivePersonaId, setActivePersonaId, DEFAULT_PERSONA_ID } from '../../services/management/activePersona.js';
import { isActivePersona } from './personaActive.js';

test('the built-in user persona is active by default', () => {
  setActivePersonaId(null);
  assert.equal(DEFAULT_PERSONA_ID, 'user');
  assert.equal(getActivePersonaId(), 'user');
  assert.equal(isActivePersona('user', getActivePersonaId()), true);
  assert.equal(isActivePersona('persona-2', getActivePersonaId()), false);
});

test('the badge follows a swapped active persona', () => {
  setActivePersonaId('persona-2');
  assert.equal(isActivePersona('persona-2', getActivePersonaId()), true);
  assert.equal(isActivePersona('user', getActivePersonaId()), false);
  setActivePersonaId(null);
});

test('isActivePersona tolerates missing ids', () => {
  assert.equal(isActivePersona('', 'user'), false);
  assert.equal(isActivePersona('user', ''), false);
  assert.equal(isActivePersona(undefined, undefined), false);
});
