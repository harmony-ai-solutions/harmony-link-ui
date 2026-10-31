/**
 * Shared audio player (F8, extended by Task 04-4).
 *
 * The phone app had a bug from creating one <audio> element per bubble; this
 * module keeps a SINGLE hidden HTMLAudioElement for the whole chat screen, so
 * playing a new voice note always stops the previous one and memory stays flat.
 *
 * Playback sources are object URLs fetched lazily from the blob endpoint
 * (chatReadService.fetchMessageAudioObjectUrl) — audio is never inlined in the
 * timeline payload.
 *
 * ── WHAT TASK 04-4 CHANGED, AND WHY ────────────────────────────────────────
 *
 * The old player notified listeners only on `play`/`pause`/`ended`. A seek bar
 * needs a clock, and a seek bar driven by React state that only changes on those
 * three events would sit frozen at 0 % for the entire note and then jump to the
 * end — the classic broken scrubber. So:
 *
 * - `timeupdate` is now forwarded, but THROTTLED to ~4 Hz. The element fires it
 *   up to 4–66 times a second depending on the browser; re-rendering every
 *   bubble's scrubber at that rate is how a chat timeline starts dropping
 *   frames while audio plays. 250 ms is smooth enough for a 3 px line and cheap.
 * - `loadedmetadata` is forwarded so the true duration can replace the stored
 *   `audio_duration` (which is an estimate — the engine derives AI speech
 *   durations from word count, see `modules/cognition.go`).
 * - `seek`, `seekBy`, `setRate` were added. `setRate` applies to the LIVE
 *   element immediately, so changing speed mid-playback does not restart the
 *   note or reset its position.
 *
 * ── URL OWNERSHIP ──────────────────────────────────────────────────────────
 *
 * Audio URLs live in the shared registry (`objectUrlCache.js`) and the player is
 * a HOLDER: it acquires on load and releases only when it unloads that message.
 * That is what lets a bubble unmount mid-playback (the timeline's render window
 * slides while you listen) without revoking the bytes out from under the
 * element. Previously the URL was revoked on `ended` only, so every note that
 * was paused, scrubbed away from, or abandoned by closing the thread leaked its
 * blob for the lifetime of the window.
 */

import { acquireObjectUrl, releaseObjectUrl } from './objectUrlCache.js';
import {
    DEFAULT_PLAYBACK_RATE,
    sanitizePlaybackRate,
    seekTarget,
    clampSeekTime,
} from './playbackUtils.js';

/** The one shared element. Never construct a second one. */
let element = null;
/** The message whose audio is currently loaded, or null. */
let currentMessageId = null;
/** The playback rate the player should be using. */
let playbackRate = DEFAULT_PLAYBACK_RATE;
/** Listeners subscribing to playback state. */
const listeners = new Set();
/** Throttle bookkeeping for `timeupdate`. */
let lastProgressNotify = 0;

const PROGRESS_INTERVAL_MS = 250;

function getElement() {
    if (element) return element;
    if (typeof Audio === 'undefined') return null;
    element = new Audio();
    element.addEventListener('ended', handleEnded);
    element.addEventListener('pause', () => notify());
    element.addEventListener('play', () => notify());
    element.addEventListener('loadedmetadata', () => notify());
    element.addEventListener('timeupdate', handleTimeUpdate);
    // A decode/format failure must land the UI back on "Play" instead of
    // leaving a spinner-less bubble looking like it is playing silence.
    element.addEventListener('error', () => {
        if (currentMessageId) unloadCurrent();
        notify();
    });
    element.playbackRate = playbackRate;
    return element;
}

function handleEnded() {
    // Release the audio bytes as soon as the note finishes: it is by far the
    // most common exit, and holding the blob would pin a full voice note in
    // memory for a message the user has finished with.
    const finished = currentMessageId;
    currentMessageId = null;
    notify();
    if (finished) releaseObjectUrl('audio', finished);
}

function handleTimeUpdate() {
    const now = Date.now();
    if (now - lastProgressNotify < PROGRESS_INTERVAL_MS) return;
    lastProgressNotify = now;
    notify();
}

function notify() {
    const state = getState();
    for (const listener of listeners) {
        try {
            listener(state);
        } catch {
            /* a broken listener must not stop the others */
        }
    }
}

/** Detach the current source and let go of its object URL. */
function unloadCurrent() {
    const el = getElement();
    const previous = currentMessageId;
    currentMessageId = null;
    if (el) {
        try {
            el.pause();
        } catch {
            /* ignore */
        }
        // Clearing `src` also stops the network/buffer for the old blob.
        el.removeAttribute('src');
        try {
            el.load();
        } catch {
            /* not every environment implements load() after removeAttribute */
        }
    }
    if (previous) releaseObjectUrl('audio', previous);
}

/** Current playback state: which message is playing, and progress. */
export function getState() {
    const el = getElement();
    return {
        playingMessageId: el && !el.paused ? currentMessageId : null,
        // `currentMessageId` even when paused, so the scrubber can show where
        // the user left off. `playingMessageId` is the play/pause answer.
        loadedMessageId: el ? currentMessageId : null,
        currentTime: el && Number.isFinite(el.currentTime) ? el.currentTime : 0,
        duration: el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0,
        rate: playbackRate,
    };
}

/** Subscribe to playback state changes. Returns an unsubscribe function. */
export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Set the speed used for playback (step 2).
 *
 * Applied to the live element immediately: a rate change mid-note must not
 * restart it. Persistence is the caller's job (`chatPrefsStore`) — this service
 * deliberately holds no storage of its own, so opening a second window cannot
 * disagree with localStorage.
 *
 * @param {unknown} rate
 * @returns {number} the rate actually applied
 */
export function setRate(rate) {
    playbackRate = sanitizePlaybackRate(rate);
    const el = getElement();
    if (el) {
        try {
            el.playbackRate = playbackRate;
        } catch {
            /* ignore */
        }
    }
    notify();
    return playbackRate;
}

/** The rate currently applied by the player. */
export function getRate() {
    return playbackRate;
}

/**
 * Seek the loaded message to an absolute time (scrubber drag / click).
 *
 * A seek on a message that is NOT loaded is a no-op returning false: seeking
 * cannot load a note, and silently starting one because the user dragged a
 * neighbour's bar would be surprising.
 *
 * @param {string} messageId
 * @param {number} time seconds
 * @returns {boolean} whether the element accepted the seek
 */
export function seek(messageId, time) {
    const el = getElement();
    if (!el || !messageId || currentMessageId !== messageId) return false;
    const target = clampSeekTime(time, el.duration);
    try {
        el.currentTime = target;
    } catch {
        return false;
    }
    notify();
    return true;
}

/**
 * Seek relative to the current position (−/+ 5 s in step 3).
 *
 * @param {string} messageId
 * @param {number} delta seconds
 * @returns {boolean}
 */
export function seekBy(messageId, delta) {
    const el = getElement();
    if (!el || !messageId || currentMessageId !== messageId) return false;
    return seek(messageId, seekTarget(el.currentTime, delta, el.duration));
}

/**
 * Toggle playback for a message's audio.
 *
 * @param {string} messageId
 * @param {() => Promise<string|null>} loadUrl - lazily resolves the audio URL
 * @param {{ autoplay?: boolean }} [options] - `autoplay: false` loads the note
 *   and stops at 0:00 so the bubble can show a Play affordance (step 4's
 *   "otherwise show a Play affordance" path); the default plays.
 * @returns {Promise<void>}
 */
export async function toggle(messageId, loadUrl, { autoplay = true } = {}) {
    const el = getElement();
    if (!el || !messageId) return;

    // Same message → toggle pause/play.
    if (currentMessageId === messageId) {
        if (el.paused) {
            await play(el);
        } else {
            el.pause();
        }
        return;
    }

    // Different message → unload the old one (which releases its URL) first.
    unloadCurrent();
    currentMessageId = messageId;
const url = await acquireObjectUrl('audio', messageId, loadUrl);
if (currentMessageId !== messageId) {
    // Another note started while this one was fetching: give the hold back
    // rather than caching a URL this player will never use.
    releaseObjectUrl('audio', messageId);
    return;
}
if (!url) {
    currentMessageId = null;
    notify();
    return;
}


    el.src = url;
    el.playbackRate = playbackRate;
    el.currentTime = 0;
    if (autoplay) await play(el);
    notify();
}

/** `play()` that swallows the autoplay-policy rejection. */
async function play(el) {
    try {
        await el.play();
    } catch {
        /* A blocked or interrupted play leaves the bubble showing "Play". */
    }
}

/** Stop playback, unload the source and release its object URL. */
export function stop() {
    unloadCurrent();
    notify();
}

/**
 * Format seconds as m:ss (for the bubble duration label).
 *
 * Kept here (rather than imported from `playbackUtils.formatClock`) because it
 * was this module's public API before 04-4 and is re-exported by name.
 */
export function formatDuration(seconds) {
    if (!seconds || !Number.isFinite(seconds)) return '0:00';
    const total = Math.round(seconds);
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default {
    toggle,
    stop,
    seek,
    seekBy,
    setRate,
    getRate,
    subscribe,
    getState,
    formatDuration,
};
