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
