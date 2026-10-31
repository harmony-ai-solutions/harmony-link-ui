/**
 * Chat scroll stickiness (phone parity).
 *
 * These are the rules the detail view reads before any automatic scroll: a
 * reader inside the 150 px window follows the tail, a reader outside it keeps
 * their place and gets the "jump to latest" affordance instead.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    distanceFromBottom,
    isNearBottom,
    NEAR_BOTTOM_THRESHOLD_PX,
} from './chatScrollUtils.js';

/** A scroller whose content is `height` tall with a `client`-tall viewport. */
const metrics = (height, top, client) => ({ scrollHeight: height, scrollTop: top, clientHeight: client });

test('the stickiness threshold is the phone app value (150 px)', () => {
    assert.equal(NEAR_BOTTOM_THRESHOLD_PX, 150);
});

test('distanceFromBottom reports the gap below the viewport', () => {
    assert.equal(distanceFromBottom(metrics(1000, 500, 400)), 100);
    assert.equal(distanceFromBottom(metrics(1000, 600, 400)), 0);
});

test('distanceFromBottom clamps an over-scrolled container at 0', () => {
    assert.equal(distanceFromBottom(metrics(1000, 700, 400)), 0);
});

test('distanceFromBottom reports Infinity for unknown geometry', () => {
    assert.equal(distanceFromBottom({}), Number.POSITIVE_INFINITY);
    assert.equal(distanceFromBottom({ scrollHeight: NaN, scrollTop: 0, clientHeight: 10 }), Number.POSITIVE_INFINITY);
    assert.equal(distanceFromBottom(undefined), Number.POSITIVE_INFINITY);
});

test('isNearBottom is true strictly inside the window', () => {
    assert.equal(isNearBottom(metrics(1000, 500, 400)), true); // 100
    assert.equal(isNearBottom(metrics(1000, 451, 400)), true); // 149
});

test('isNearBottom is false at the threshold and beyond', () => {
    assert.equal(isNearBottom(metrics(1000, 450, 400)), false); // distance === 150
    assert.equal(isNearBottom(metrics(1000, 449, 400)), false); // 151
    assert.equal(isNearBottom(metrics(1000, 0, 400)), false);
});

test('isNearBottom treats content shorter than the viewport as the bottom', () => {
    assert.equal(isNearBottom(metrics(200, 0, 400)), true);
});

test('isNearBottom treats unknown geometry as NOT at the bottom', () => {
    assert.equal(isNearBottom({}), false);
});

test('isNearBottom honours a custom threshold and rejects junk', () => {
    assert.equal(isNearBottom(metrics(1000, 400, 400), 250), true);
    assert.equal(isNearBottom(metrics(1000, 400, 400), NaN), false); // falls back to 150
});
