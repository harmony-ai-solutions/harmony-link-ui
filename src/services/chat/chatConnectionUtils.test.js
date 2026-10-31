/**
 * Chat connection status (phone parity).
 *
 * The store's states are an implementation detail; these helpers decide what
 * the header may claim and when a drop is old enough to admit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    canPromoteToReconnecting,
    connectionStatusKey,
    reconnectGraceElapsed,
    RECONNECT_STATUS_GRACE_MS,
} from './chatConnectionUtils.js';

test('the grace window outlives the first reconnect rung', () => {
    // The first retry is 2 s away; admitting the drop before it lands is the
    // flicker this window exists to prevent.
    assert.ok(RECONNECT_STATUS_GRACE_MS > 2000);
});

test('connectionStatusKey maps every store state onto a header label', () => {
    assert.equal(connectionStatusKey('connected'), 'connected');
    assert.equal(connectionStatusKey('connecting'), 'connecting');
    assert.equal(connectionStatusKey('reconnecting'), 'reconnecting');
    assert.equal(connectionStatusKey('idle'), 'offline');
    assert.equal(connectionStatusKey('error'), 'offline');
    assert.equal(connectionStatusKey('anything-else'), 'offline');
});

test('only a socket that WAS live can be promoted to reconnecting', () => {
    assert.equal(canPromoteToReconnecting('connected'), true);
    assert.equal(canPromoteToReconnecting('connecting'), true);
});

test('an offline/idle/error state is never overwritten by the drop timer', () => {
    assert.equal(canPromoteToReconnecting('error'), false);
    assert.equal(canPromoteToReconnecting('idle'), false);
    assert.equal(canPromoteToReconnecting('reconnecting'), false);
});

test('reconnectGraceElapsed stays false until the window has fully passed', () => {
    const dropSince = 1000;
    assert.equal(reconnectGraceElapsed({ dropSince, now: 1000 }), false);
    assert.equal(reconnectGraceElapsed({ dropSince, now: 1000 + RECONNECT_STATUS_GRACE_MS - 1 }), false);
    assert.equal(reconnectGraceElapsed({ dropSince, now: 1000 + RECONNECT_STATUS_GRACE_MS }), true);
});

test('reconnectGraceElapsed has no opinion when no drop was recorded', () => {
    assert.equal(reconnectGraceElapsed({ dropSince: null, now: 99999 }), false);
    assert.equal(reconnectGraceElapsed({}), false);
    assert.equal(reconnectGraceElapsed(), false);
});

test('reconnectGraceElapsed treats a junk window as the default', () => {
    assert.equal(reconnectGraceElapsed({ dropSince: 0, now: RECONNECT_STATUS_GRACE_MS, graceMs: NaN }), true);
});
