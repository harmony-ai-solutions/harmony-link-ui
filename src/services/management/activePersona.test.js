import test from 'node:test';
import assert from 'node:assert/strict';

import {
    DEFAULT_PERSONA_ID,
    getActivePersonaId,
    setActivePersonaId,
} from './activePersona.js';

/**
 * The single persona seam. V1 has one built-in persona, but the selector will
 * swap it here — so the contract the rest of the app relies on is simply
 * "getActivePersonaId always answers with a usable id".
 */

test('v1 defaults to the built-in user persona', () => {
    setActivePersonaId(null);
    assert.equal(DEFAULT_PERSONA_ID, 'user');
    assert.equal(getActivePersonaId(), 'user');
});

test('the future selector can swap the persona and reset to the default', () => {
    setActivePersonaId('persona-2');
    assert.equal(getActivePersonaId(), 'persona-2');

    setActivePersonaId('');
    assert.equal(getActivePersonaId(), DEFAULT_PERSONA_ID);

    setActivePersonaId('persona-3');
    setActivePersonaId(null);
    assert.equal(getActivePersonaId(), DEFAULT_PERSONA_ID);
});
