/**
 * Per-entity session errors for the chat detail (owner-approved 2026-10-31).
 *
 * A failed entity session is not a socket drop, so its bookkeeping is pure:
 * classification, newest-first recording with a cap, the clear-on-success
 * rule and the mockup's timestamp format.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    SESSION_ERROR_CAP,
    classifySessionError,
    recordSessionError,
    clearSessionErrors,
    sessionErrorTime,
    extractSessionErrorMessage,
    sessionErrorChip,
} from './chatSessionErrors.js';

test('classifySessionError: configuration failures say "config"', () => {
    assert.equal(classifySessionError('provider openai has no API key configured'), 'config');
    assert.equal(classifySessionError('module not configured'), 'config');
    assert.equal(classifySessionError('missing configuration for backend'), 'config');
});

test('classifySessionError: unreachable failures say "network"', () => {
    assert.equal(classifySessionError('dial tcp connection refused'), 'network');
    assert.equal(classifySessionError('timeout'), 'network');
    assert.equal(classifySessionError('timed out after 30s'), 'network');
});

test('classifySessionError: everything else is a session failure', () => {
    assert.equal(classifySessionError('session state unavailable'), 'session');
    assert.equal(classifySessionError(''), 'session');
    assert.equal(classifySessionError(undefined), 'session');
});

test('recordSessionError prepends the newest error', () => {
    const first = recordSessionError([], { message: 'first', at: '2026-10-31T10:00:00Z' });
    const second = recordSessionError(first, { message: 'second', at: '2026-10-31T10:01:00Z' });
    assert.deepEqual(second.map((e) => e.message), ['second', 'first']);
    assert.equal(second[0].code, 'session');
    assert.equal(second[0].at, '2026-10-31T10:01:00Z');
});

test('recordSessionError caps the list and keeps the ten newest', () => {
    let list = [];
    for (let i = 0; i < 15; i += 1) {
        list = recordSessionError(list, { message: `error ${i}`, at: `2026-10-31T10:00:${String(i).padStart(2, '0')}Z` });
    }
    assert.equal(list.length, SESSION_ERROR_CAP);
    assert.equal(list[0].message, 'error 14');
    assert.equal(list[SESSION_ERROR_CAP - 1].message, 'error 5');
});

test('recordSessionError defaults a missing message to "Unknown error"', () => {
    const list = recordSessionError(null, {});
    assert.equal(list.length, 1);
    assert.equal(list[0].message, 'Unknown error');
    assert.equal(list[0].code, 'session');
    assert.equal(typeof list[0].at, 'string');
    assert.ok(!Number.isNaN(new Date(list[0].at).getTime()));
});

test('recordSessionError keeps an explicit code', () => {
    const list = recordSessionError([], { message: 'whatever', code: 'config' });
    assert.equal(list[0].code, 'config');
});

test('clearSessionErrors returns an empty list', () => {
    assert.deepEqual(clearSessionErrors(), []);
});

test('extractSessionErrorMessage reads every real payload shape', () => {
    // Engine D35 frame — the exact bytes the engine sent for a nonexistent
    // entity on 2026-10-31 (live probe).
    assert.equal(
        extractSessionErrorMessage({ error: 'entity_not_defined', error_code: 'entity_not_defined' }),
        'entity_not_defined',
    );
    // Socket-service emit shape (heartbeat timeout / terminal give-up).
    assert.equal(
        extractSessionErrorMessage({ message: 'Connection heartbeat timeout', code: 'HEARTBEAT_TIMEOUT' }),
        'Connection heartbeat timeout',
    );
    // Nested error object, bare string, code-only, and reason-less payloads.
    assert.equal(extractSessionErrorMessage({ error: { message: 'nested reason' } }), 'nested reason');
    assert.equal(extractSessionErrorMessage('plain text'), 'plain text');
    assert.equal(extractSessionErrorMessage({ error_code: 'entity_disabled' }), 'entity_disabled');
    assert.equal(extractSessionErrorMessage(undefined), 'Unknown error');
    assert.equal(extractSessionErrorMessage({ unrelated: true }), 'Unknown error');
});

test('sessionErrorChip maps pinned codes and classifies the rest', () => {
    // D35 entity gates → configuration territory (app parity).
    assert.equal(sessionErrorChip({ error: 'x', error_code: 'entity_disabled' }), 'config');
    assert.equal(sessionErrorChip({ error_code: 'entity_exists_deleted' }), 'config');
    assert.equal(sessionErrorChip('entity_not_defined'), 'config');
    // Socket-level codes the user resolves by checking the engine.
    assert.equal(sessionErrorChip({ message: 'x', code: 'HEARTBEAT_TIMEOUT' }), 'network');
    assert.equal(sessionErrorChip({ message: 'x', code: 'RECONNECT_GAVE_UP' }), 'network');
    // Unpinned codes fall back to free-text classification.
    assert.equal(sessionErrorChip({ error: 'dial tcp connection refused' }), 'network');
    assert.equal(sessionErrorChip({ error: 'session state unavailable' }), 'session');
});

test('sessionErrorTime: today shows the clock, older shows the date', () => {
    const now = new Date(2026, 9, 31, 12, 0, 0);
    const today = new Date(2026, 9, 31, 9, 5, 7);
    const older = new Date(2026, 8, 2, 9, 5, 7);
    assert.equal(sessionErrorTime(today.toISOString(), now), '09:05:07');
    assert.equal(sessionErrorTime(older.toISOString(), now), '02.09 09:05:07');
});

test('sessionErrorTime: garbage is empty, not "Invalid Date"', () => {
    assert.equal(sessionErrorTime('not-a-date'), '');
    assert.equal(sessionErrorTime(undefined), '');
});
