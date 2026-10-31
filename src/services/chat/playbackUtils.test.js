import test from 'node:test';
import assert from 'node:assert/strict';

import {
    AUTOPLAY_WINDOW_MS,
    DEFAULT_PLAYBACK_RATE,
    PLAYBACK_RATES,
    SEEK_STEP_SECONDS,
    audioKeyIntent,
    clampSeekTime,
    formatClock,
    fractionFromPointer,
    isTypingTarget,
    newestInboundAudioMessage,
    playbackProgress,
    sanitizePlaybackRate,
    seekTarget,
    shouldAutoplayAudio,
    timeFromFraction,
} from './playbackUtils.js';

// ── Playback rate (step 2) ──────────────────────────────────────────────

test('the three supported rates are exactly the task\'s 0.75 / 1 / 1.25', () => {
    assert.deepEqual([...PLAYBACK_RATES], [0.75, 1, 1.25]);
    assert.equal(DEFAULT_PLAYBACK_RATE, 1);
});

test('sanitizePlaybackRate keeps every supported rate', () => {
    for (const rate of PLAYBACK_RATES) {
        assert.equal(sanitizePlaybackRate(rate), rate);
    }
});

test('sanitizePlaybackRate resolves junk, NaN and unsupported numbers to 1x', () => {
    // A hand-edited localStorage row must never put the element at 0x (silent,
    // looks broken) or at 7x (unintelligible).
    assert.equal(sanitizePlaybackRate(undefined), 1);
    assert.equal(sanitizePlaybackRate(null), 1);
    assert.equal(sanitizePlaybackRate('fast'), 1);
    assert.equal(sanitizePlaybackRate(NaN), 1);
    assert.equal(sanitizePlaybackRate(Infinity), 1);
    assert.equal(sanitizePlaybackRate(0), 1);
    assert.equal(sanitizePlaybackRate(-1), 1);
    assert.equal(sanitizePlaybackRate(1.5), 1);
    assert.equal(sanitizePlaybackRate(2), 1);
});

test('sanitizePlaybackRate accepts a persisted string form', () => {
    assert.equal(sanitizePlaybackRate('0.75'), 0.75);
    assert.equal(sanitizePlaybackRate('1.25'), 1.25);
});

// ── Seek maths (step 1) ─────────────────────────────────────────────────

test('clampSeekTime bounds to the media range', () => {
    assert.equal(clampSeekTime(5, 12), 5);
    assert.equal(clampSeekTime(-3, 12), 0);
    assert.equal(clampSeekTime(99, 12), 12);
});

test('clampSeekTime is 0 while the duration is unknown, not a guess', () => {
    // `duration` is NaN until loadedmetadata fires for a blob URL, which is the
    // normal state right after a play press. Returning the requested time here
    // would make the scrubber jump and then snap back.
    assert.equal(clampSeekTime(7, NaN), 0);
    assert.equal(clampSeekTime(7, 0), 0);
    assert.equal(clampSeekTime(7, Infinity), 0);
});

test('clampSeekTime treats a NaN time as 0', () => {
    assert.equal(clampSeekTime(NaN, 12), 0);
    assert.equal(clampSeekTime(undefined, 12), 0);
});

test('seekTarget moves by the step and stops at both ends', () => {
    assert.equal(SEEK_STEP_SECONDS, 5);
    assert.equal(seekTarget(6, SEEK_STEP_SECONDS, 20), 11);
    assert.equal(seekTarget(6, -SEEK_STEP_SECONDS, 20), 1);
    // Clamped, not wrapped: → at the end stays at the end.
    assert.equal(seekTarget(19, SEEK_STEP_SECONDS, 20), 20);
    assert.equal(seekTarget(2, -SEEK_STEP_SECONDS, 20), 0);
});

test('seekTarget survives a NaN currentTime', () => {
    assert.equal(seekTarget(NaN, 5, 20), 5);
});

test('playbackProgress is a 0..1 fraction with no NaN', () => {
    assert.equal(playbackProgress(0, 10), 0);
    assert.equal(playbackProgress(5, 10), 0.5);
    assert.equal(playbackProgress(10, 10), 1);
    // Overshoot (rounding in the element) saturates instead of exceeding 1.
    assert.equal(playbackProgress(11, 10), 1);
    assert.equal(playbackProgress(5, 0), 0);
    assert.equal(playbackProgress(5, NaN), 0);
    assert.equal(playbackProgress(NaN, 10), 0);
});

test('timeFromFraction inverts playbackProgress and clamps the input', () => {
    assert.equal(timeFromFraction(0.5, 20), 10);
    assert.equal(timeFromFraction(0, 20), 0);
    assert.equal(timeFromFraction(1, 20), 20);
    assert.equal(timeFromFraction(2, 20), 20);
    assert.equal(timeFromFraction(-1, 20), 0);
    assert.equal(timeFromFraction(0.5, 0), 0);
});

test('fractionFromPointer maps a click inside the track', () => {
    const rect = { left: 100, width: 200 };
    assert.equal(fractionFromPointer(100, rect), 0);
    assert.equal(fractionFromPointer(200, rect), 0.5);
    assert.equal(fractionFromPointer(300, rect), 1);
    // A click left of the track or a zero-width track (display:none) is 0, not
    // a negative or infinite fraction.
    assert.equal(fractionFromPointer(50, rect), 0);
    assert.equal(fractionFromPointer(150, { left: 100, width: 0 }), 0);
    assert.equal(fractionFromPointer(150, null), 0);
});

test('formatClock pads and floors, never showing a negative time', () => {
    assert.equal(formatClock(0), '0:00');
    assert.equal(formatClock(9.9), '0:09');
    assert.equal(formatClock(65), '1:05');
    assert.equal(formatClock(600), '10:00');
    assert.equal(formatClock(-4), '0:00');
    assert.equal(formatClock(NaN), '0:00');
});

// ── Keyboard (step 3) ───────────────────────────────────────────────────

test('Space toggles and the arrows seek by 5 s', () => {
    assert.deepEqual(audioKeyIntent({ key: ' ' }), { action: 'toggle' });
    assert.deepEqual(audioKeyIntent({ key: 'Spacebar' }), { action: 'toggle' });
    assert.deepEqual(audioKeyIntent({ key: 'ArrowLeft' }), { action: 'seek', delta: -5 });
    assert.deepEqual(audioKeyIntent({ key: 'ArrowRight' }), { action: 'seek', delta: 5 });
});

test('other keys and modified arrows are not ours', () => {
    assert.equal(audioKeyIntent({ key: 'a' }), null);
    assert.equal(audioKeyIntent({ key: 'Enter' }), null);
    assert.equal(audioKeyIntent({ key: 'ArrowUp' }), null);
    assert.equal(audioKeyIntent(null), null);
    // Ctrl/Alt/Meta + arrow is navigation or an OS shortcut; stealing it is the
    // bug this guards.
    assert.equal(audioKeyIntent({ key: 'ArrowLeft', ctrlKey: true }), null);
    assert.equal(audioKeyIntent({ key: 'ArrowLeft', metaKey: true }), null);
    assert.equal(audioKeyIntent({ key: 'ArrowLeft', altKey: true }), null);
    assert.equal(audioKeyIntent({ key: ' ', ctrlKey: true }), null);
});

test('isTypingTarget recognises text entry and nothing else', () => {
    assert.equal(isTypingTarget({ tagName: 'TEXTAREA' }), true);
    assert.equal(isTypingTarget({ tagName: 'SELECT' }), true);
    assert.equal(isTypingTarget({ tagName: 'INPUT' }), true);
    assert.equal(isTypingTarget({ tagName: 'INPUT', type: 'text' }), true);
    assert.equal(isTypingTarget({ tagName: 'INPUT', type: 'radio' }), false);
    assert.equal(isTypingTarget({ tagName: 'input', type: 'checkbox' }), false);
    assert.equal(isTypingTarget({ tagName: 'INPUT', type: 'range' }), false);
    assert.equal(isTypingTarget({ tagName: 'BUTTON' }), false);
    assert.equal(isTypingTarget({ tagName: 'DIV' }), false);
    assert.equal(isTypingTarget(null), false);
});

test('isTypingTarget sees a contenteditable and a node inside one', () => {
    assert.equal(isTypingTarget({ tagName: 'DIV', isContentEditable: true }), true);
    const editable = {
        isContentEditable: false,
        getAttribute: (name) => (name === 'contenteditable' ? '' : null),
    };
    const child = {
        tagName: 'SPAN',
        closest: (selector) => (selector === '[contenteditable]' ? editable : null),
    };
    assert.equal(isTypingTarget(child), true);
});

test('isTypingTarget respects contenteditable="false"', () => {
    const editable = {
        getAttribute: (name) => (name === 'contenteditable' ? 'false' : null),
    };
    const child = { closest: () => editable };
    assert.equal(isTypingTarget(child), false);
});

// ── Autoplay policy (step 4) ────────────────────────────────────────────

const audioMessage = (overrides = {}) => ({
    id: 'm1',
    has_audio: true,
    sender_entity_id: 'ai-1',
    ...overrides,
});

test('the autoplay window is 30 s', () => {
    assert.equal(AUTOPLAY_WINDOW_MS, 30000);
});

test('a fresh app never autoplays — no recorded action means not watching', () => {
    // The load case: `lastUserActionAt` is 0 because nothing has been sent.
    assert.equal(shouldAutoplayAudio({
        message: audioMessage(),
        ownEntityId: 'user-1',
        lastUserActionAt: 0,
        now: 1_000_000,
    }), false);
    assert.equal(shouldAutoplayAudio({
        message: audioMessage(),
        ownEntityId: 'user-1',
        lastUserActionAt: undefined,
        now: 1_000_000,
    }), false);
});

test('an inbound note within 30 s of a send autoplays', () => {
    assert.equal(shouldAutoplayAudio({
        message: audioMessage(),
        ownEntityId: 'user-1',
        lastUserActionAt: 1_000_000,
        now: 1_000_000 + AUTOPLAY_WINDOW_MS,
    }), true);
});

test('an inbound note just past the window does not autoplay', () => {
    assert.equal(shouldAutoplayAudio({
        message: audioMessage(),
        ownEntityId: 'user-1',
        lastUserActionAt: 1_000_000,
        now: 1_000_000 + AUTOPLAY_WINDOW_MS + 1,
    }), false);
});

test('our own voice note never autoplays back at us', () => {
    assert.equal(shouldAutoplayAudio({
        message: audioMessage({ sender_entity_id: 'user-1' }),
        ownEntityId: 'user-1',
        lastUserActionAt: 1_000_000,
        now: 1_000_010,
    }), false);
});

test('a text reply never autoplays', () => {
    assert.equal(shouldAutoplayAudio({
        message: audioMessage({ has_audio: false }),
        ownEntityId: 'user-1',
        lastUserActionAt: 1_000_000,
        now: 1_000_010,
    }), false);
});

test('a hidden document suppresses autoplay', () => {
    assert.equal(shouldAutoplayAudio({
        message: audioMessage(),
        ownEntityId: 'user-1',
        lastUserActionAt: 1_000_000,
        now: 1_000_010,
        documentHidden: true,
    }), false);
});

test('a note already considered is not played twice', () => {
    assert.equal(shouldAutoplayAudio({
        message: audioMessage(),
        ownEntityId: 'user-1',
        lastUserActionAt: 1_000_000,
        now: 1_000_010,
        alreadyPlayed: new Set(['m1']),
    }), false);
});

test('a backwards clock is treated as unknown, not as "just now"', () => {
    assert.equal(shouldAutoplayAudio({
        message: audioMessage(),
        ownEntityId: 'user-1',
        lastUserActionAt: 1_000_000,
        now: 999_000,
    }), false);
});

test('a missing message or id fails closed', () => {
    assert.equal(shouldAutoplayAudio({}), false);
    assert.equal(shouldAutoplayAudio({ message: { has_audio: true } }), false);
});

test('newestInboundAudioMessage skips trailing text and our own notes', () => {
    const timeline = [
        { id: 'a1', has_audio: true, sender_entity_id: 'ai-1' },
        { id: 't1', has_audio: false, sender_entity_id: 'ai-1' },
        // Newer than a1 but it is OURS: it must not mask a1 for autoplay
        // purposes... but a1 is already older, so the answer stays a1.
        { id: 'a2', has_audio: true, sender_entity_id: 'user-1' },
    ];
    assert.equal(newestInboundAudioMessage(timeline, 'user-1')?.id, 'a1');
});

test('newestInboundAudioMessage returns the newest AI note', () => {
    const timeline = [
        { id: 'a1', has_audio: true, sender_entity_id: 'ai-1' },
        { id: 'a2', has_audio: true, sender_entity_id: 'ai-1' },
        { id: 't1', has_audio: false, sender_entity_id: 'ai-1' },
    ];
    assert.equal(newestInboundAudioMessage(timeline, 'user-1')?.id, 'a2');
});

test('newestInboundAudioMessage is null for an empty or audio-free timeline', () => {
    assert.equal(newestInboundAudioMessage([], 'user-1'), null);
    assert.equal(newestInboundAudioMessage(null, 'user-1'), null);
    assert.equal(newestInboundAudioMessage([
        { id: 't1', has_audio: false, sender_entity_id: 'ai-1' },
    ], 'user-1'), null);
});
