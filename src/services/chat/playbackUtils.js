/**
 * Pure playback rules for the chat audio surface (Task 04-4).
 *
 * Everything here is dependency-free and DOM-free so it can be unit-tested with
 * `node --test` (the frontend has no jsdom / testing-library, so component
 * behaviour is only reachable through pure helpers — same convention as
 * `recorderUtils.js` and `transcriptionUtils.js`).
 *
 * Three groups:
 *
 * 1. **Seek maths** — clamping a time to the media, converting a pointer
 *    position to a time (the scrubber), and the progress fraction.
 * 2. **Keyboard intent** — turning a `keydown` into one of three intents
 *    (toggle / seek / nothing), including the guard that stops the bubble from
 *    swallowing keys meant for a text field.
 * 3. **Autoplay policy** — the 30 s "the user is watching" window, which fails
 *    closed in every ambiguous case.
 */

/** Selectable playback speeds (step 2). */
export const PLAYBACK_RATES = Object.freeze([0.75, 1, 1.25]);

/** Speed used until the user picks one — 1× is the neutral choice. */
export const DEFAULT_PLAYBACK_RATE = 1;

/** ← / → jump (step 3). */
export const SEEK_STEP_SECONDS = 5;

/**
 * How long after sending a message the user still counts as "watching" and an
 * incoming AI voice note may play on its own (step 4).
 */
export const AUTOPLAY_WINDOW_MS = 30000;

/** Input types that are NOT text entry, so Space must not be stolen from them. */
const NON_TYPING_INPUT_TYPES = new Set([
    'range',
    'checkbox',
    'radio',
    'button',
    'submit',
    'reset',
    'file',
    'color',
]);

/**
 * Coerce a persisted/unknown value to a supported rate.
 *
 * A hand-edited localStorage row (or a future rate that was removed) must not
 * put the player at 0× or at 7×, so anything unrecognised falls back to 1×.
 *
 * @param {unknown} value
 * @returns {number}
 */
export function sanitizePlaybackRate(value) {
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (typeof numeric !== 'number' || !Number.isFinite(numeric)) {
        return DEFAULT_PLAYBACK_RATE;
    }
    return PLAYBACK_RATES.includes(numeric) ? numeric : DEFAULT_PLAYBACK_RATE;
}

/**
 * Clamp a requested time into the media's range.
 *
 * An unknown duration (`NaN`/`Infinity`/`0` — the element has no metadata yet,
 * which is the normal state for a freshly loaded blob) resolves to 0 rather
 * than to a meaningless number: seeking before metadata is available is a
 * no-op in the browser, so pretending otherwise would make the scrubber jump.
 *
 * @param {number} time
 * @param {number} duration
 * @returns {number}
 */
export function clampSeekTime(time, duration) {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    const requested = Number.isFinite(time) ? time : 0;
    if (requested <= 0) return 0;
    return requested >= duration ? duration : requested;
}

/**
 * Where a relative seek lands (← / → / Home / End).
 *
 * @param {number} currentTime
 * @param {number} delta seconds, may be negative
 * @param {number} duration
 * @returns {number}
 */
export function seekTarget(currentTime, delta, duration) {
    const from = Number.isFinite(currentTime) ? currentTime : 0;
    const step = Number.isFinite(delta) ? delta : 0;
    return clampSeekTime(from + step, duration);
}

/**
 * Playback position as a 0..1 fraction. An unknown duration is 0, never a
 * division by zero that would paint the bar at `NaN%`.
 *
 * @param {number} currentTime
 * @param {number} duration
 * @returns {number}
 */
export function playbackProgress(currentTime, duration) {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    const time = Number.isFinite(currentTime) ? currentTime : 0;
    if (time <= 0) return 0;
    if (time >= duration) return 1;
    return time / duration;
}

/**
 * The inverse of {@link playbackProgress} — used when a click on the track is
 * translated into a seek destination.
 *
 * @param {number} fraction
 * @param {number} duration
 * @returns {number}
 */
export function timeFromFraction(fraction, duration) {
    if (!Number.isFinite(duration) || duration <= 0) return 0;
    const clamped = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
    return clampSeekTime(clamped * duration, duration);
}

/**
 * Pointer position → 0..1 along a track.
 *
 * @param {number} clientX
 * @param {{left: number, width: number}} rect the track's bounding box
 * @returns {number}
 */
export function fractionFromPointer(clientX, rect) {
    const width = rect?.width;
    if (!Number.isFinite(width) || width <= 0) return 0;
    const x = Number.isFinite(clientX) ? clientX : 0;
    const fraction = (x - (rect.left || 0)) / width;
    if (!Number.isFinite(fraction) || fraction <= 0) return 0;
    return fraction >= 1 ? 1 : fraction;
}

/**
 * Is this event target a place where the user is TYPING?
 *
 * Step 3's hard requirement: Space must toggle audio only when the bubble has
 * focus, never while the user is writing. The bubble does not add a window
 * listener (so it cannot reach the composer at all), but this guard also
 * protects against a portal/teleport and makes the rule explicit and testable.
 *
 * @param {any} target
 * @returns {boolean}
 */
export function isTypingTarget(target) {
    if (!target || typeof target !== 'object') return false;

    const tag = typeof target.tagName === 'string' ? target.tagName.toUpperCase() : '';
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;

    if (tag === 'INPUT') {
        const type = typeof target.type === 'string' ? target.type.toLowerCase() : 'text';
        // An INPUT with no type defaults to `text` in the DOM, so the fallback
        // above is what keeps `<input>` behaving as a text field.
        return !NON_TYPING_INPUT_TYPES.has(type);
    }

    if (target.isContentEditable === true) return true;

    // A nested node inside a rich-text editor: `isContentEditable` is only set
    // on elements, and `closest` is the reliable walk up the tree.
    if (typeof target.closest === 'function') {
        const editable = target.closest('[contenteditable]');
        if (editable) {
            const value = editable.getAttribute('contenteditable');
            if (value !== 'false') return true;
        }
    }
    return false;
}

/**
 * Translate a keydown into an audio intent, or `null` when the key is not ours.
 *
 * Modifier combinations are deliberately declined: `Ctrl+←` / `Alt+←` are
 * navigation and OS shortcuts, and stealing them from a focused control is the
 * kind of thing that makes an app feel broken.
 *
 * @param {{ key?: string, shiftKey?: boolean, ctrlKey?: boolean,
 *   metaKey?: boolean, altKey?: boolean }} event
 * @returns {{action: 'toggle'} | {action: 'seek', delta: number} | null}
 */
export function audioKeyIntent(event) {
    if (!event) return null;
    if (event.ctrlKey || event.metaKey || event.altKey) return null;

    switch (event.key) {
        case ' ':
        case 'Spacebar': // legacy Edge / old Chromium
            return { action: 'toggle' };
        case 'ArrowLeft':
            return { action: 'seek', delta: -SEEK_STEP_SECONDS };
        case 'ArrowRight':
            return { action: 'seek', delta: SEEK_STEP_SECONDS };
        default:
            return null;
    }
}

/**
 * Should an incoming AI voice note start playing on its own (step 4)?
 *
 * The default answer is NO, and every input that is missing or ambiguous keeps
 * it NO. That is the acceptance criterion — "no unexpected sound" — so this
 * predicate is written as a stack of disqualifiers rather than as a permissive
 * rule with exceptions.
 *
 * @param {{
 *   message?: object|null,
 *   ownEntityId?: string,
 *   lastUserActionAt?: number,
 *   now?: number,
 *   alreadyPlayed?: Set<string>|null,
 *   documentHidden?: boolean,
 * }} input
 * @returns {boolean}
 */
export function shouldAutoplayAudio({
    message,
    ownEntityId,
    lastUserActionAt,
    now,
    alreadyPlayed,
    documentHidden,
} = {}) {
    if (!message || !message.id) return false;
    // Only audio. A text reply costs nothing to display and must never make a
    // sound by itself.
    if (!message.has_audio) return false;
    // Only the AI's side: our own voice note was just recorded by the user and
    // playing it back unasked is the worst possible surprise.
    const sender = message.sender_entity_id || '';
    if (sender && sender === (ownEntityId || '')) return false;
    // No recorded action → we cannot claim the user is watching. This is the
    // case that covers "the thread was already open when the app started".
    if (!Number.isFinite(lastUserActionAt) || lastUserActionAt <= 0) return false;
    if (!Number.isFinite(now)) return false;
    const elapsed = now - lastUserActionAt;
    // A negative elapsed means the clock moved backwards; treat it as unknown
    // rather than as "just now".
    if (elapsed < 0 || elapsed > AUTOPLAY_WINDOW_MS) return false;
    // A hidden window means the user is demonstrably not watching.
    if (documentHidden) return false;
    if (alreadyPlayed && typeof alreadyPlayed.has === 'function' && alreadyPlayed.has(message.id)) {
        return false;
    }
    return true;
}

/**
 * The newest inbound (AI) audio message in a timeline, or `null`.
 *
 * Used to answer "is there a new AI voice reply?", which is a different
 * question from "is the last message audio" — the AI may have followed a voice
 * note with text, and that must not resurrect the earlier sound.
 *
 * @param {Array<object>} messages oldest → newest
 * @param {string} ownEntityId
 * @returns {object|null}
 */
export function newestInboundAudioMessage(messages, ownEntityId) {
    if (!Array.isArray(messages) || messages.length === 0) return null;
    const own = ownEntityId || '';
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (!message || !message.has_audio) continue;
        const sender = message.sender_entity_id || '';
        if (own && sender === own) continue;
        return message;
    }
    return null;
}

/** Format seconds as `m:ss` for the bubble's elapsed label. */
export function formatClock(seconds) {
    const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const total = Math.floor(safe);
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
}
