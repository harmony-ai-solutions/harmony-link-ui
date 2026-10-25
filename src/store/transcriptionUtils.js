/**
 * Desktop Chat — transcription state (Task 04-3).
 *
 * Pure logic only: no imports beyond the store's own helpers, so it runs under
 * `node --test` without a bundler (the same constraint chatStoreUtils.js has).
 * chatStore.js is the stateful wrapper.
 *
 * ── WHY A PER-MESSAGE STATE AT ALL ───────────────────────────────────────
 *
 * A voice note is persisted with an empty `content` and an audio blob. Nothing
 * downstream can tell the three possible reasons apart:
 *
 *   1. STT is still running (a spinner belongs here),
 *   2. STT ran and produced nothing (a Retry belongs here),
 *   3. STT was never attempted (a Retry ALSO belongs here — and until this task
 *      this was every desktop voice note, because nothing sent STT_INPUT_AUDIO;
 *      see .current_work/desktop-app-readiness/04-Voice-And-Audio.md §04-1).
 *
 * Since (2) and (3) want the same affordance, the states collapse to: has text
 * → done; no text and a live attempt → pending; no text otherwise → failed.
 *
 * ── THE ONE RULE THAT KEEPS HISTORY QUIET ────────────────────────────────
 *
 * `pending` is a WINDOW, not a default. A row only reads as pending while it was
 * created inside the window opened by the most recent audio send (or retry).
 * Without that window every audio-only message ever loaded would render
 * "Transcribing…" and then flip to Retry twenty seconds later, once per app
 * start. Old untranscribed notes jump straight to `failed`, which is honest:
 * they were never transcribed.
 *
 * @typedef {'pending'|'done'|'failed'} TranscriptionState
 */

import { toTime } from './chatStoreUtils.js';

/** STT is still running for this message. */
export const TRANSCRIPTION_PENDING = 'pending';
/** The message has its text. */
export const TRANSCRIPTION_DONE = 'done';
/** No text and no live attempt — offer Retry. */
export const TRANSCRIPTION_FAILED = 'failed';

/**
 * How long a voice note may stay `pending` before the UI calls it failed.
 *
 * 20 s is the task's number. It is a UI deadline, not a provider timeout: the
 * engine's own transcription call may still be in flight, and a late
 * STT_OUTPUT_TEXT still wins (content → done, unconditionally). The point is
 * that a user staring at a silent bubble gets an action instead of waiting
 * forever, not that the attempt is abandoned.
 */
export const TRANSCRIPTION_TIMEOUT_MS = 20000;

/** The three valid states, for validating persisted/deserialised values. */
export const TRANSCRIPTION_STATES = [
    TRANSCRIPTION_PENDING,
    TRANSCRIPTION_DONE,
    TRANSCRIPTION_FAILED,
];

/**
 * True when a message can carry a transcription state at all.
 *
 * Only audio messages can: the state describes the TEXT OF A VOICE NOTE. A text
 * or image row returns null from {@link deriveTranscriptionState} so bubbles
 * have nothing to render, rather than a meaningless 'done'.
 *
 * @param {object|null|undefined} message
 * @returns {boolean}
 */
export function isTranscribableMessage(message) {
    return !!message?.has_audio;
}

/**
 * True when a message carries recognisable text.
 *
 * Whitespace-only counts as empty: an STT provider that returns "   " did not
 * transcribe anything, and the engine refuses to store it for the same reason
 * (management/routes_messages.go returns 422 on an empty transcript).
 *
 * @param {object|null|undefined} message
 * @returns {boolean}
 */
export function hasTranscribedText(message) {
    return typeof message?.content === 'string' && message.content.trim() !== '';
}

/**
 * Derive the state of one message.
 *
 * Order matters, and each step is a decision worth keeping:
 *
 *   1. Non-audio → `null`. No affordance, no state.
 *   2. Text present → `done`. This is UNCONDITIONAL and wins over everything:
 *      a late STT_OUTPUT_TEXT arriving after the window closed (or after a
 *      "failed" was declared by the timeout) must still land as done, because
 *      the text is now there. Declaring it failed again would hide real text.
 *   3. Inside the open attempt window → `pending`.
 *   4. Otherwise → `failed`.
 *
 * @param {object|null|undefined} message
 * @param {{ expectSinceMs?: number|null, now?: number }} [options]
 *   `expectSinceMs` is the epoch-ms at which an STT attempt was started (audio
 *   sent, or Retry pressed). Absent/null means no attempt is open, so an
 *   audio-only row is `failed`.
 * @returns {TranscriptionState|null}
 */
export function deriveTranscriptionState(message, { expectSinceMs = null, now = Date.now() } = {}) {
    if (!isTranscribableMessage(message)) return null;
    if (hasTranscribedText(message)) return TRANSCRIPTION_DONE;

    const since = Number(expectSinceMs);
    if (Number.isFinite(since) && since > 0) {
        const createdAt = toTime(message.created_at);
        // `createdAt >= since` tolerates the engine's timestamp rounding: the row
        // is written server-side microseconds after the send, and a strict `>`
        // against a client clock would miss it on a slow round-trip.
        const inWindow = createdAt >= since && now < since + TRANSCRIPTION_TIMEOUT_MS;
        if (inWindow) return TRANSCRIPTION_PENDING;
    }
    return TRANSCRIPTION_FAILED;
}

/**
 * Stamp a derived state onto one message, preserving terminal states.
 *
 * The difference from a bare {@link deriveTranscriptionState} call:
 *
 *   - a `failed` state is STICKY. Once an explicit failure is recorded (an STT
 *     error event, or a failed Retry) the row must not silently re-enter
 *     `pending` because a later merge re-ran the derivation — otherwise the
 *     Retry button would disappear on the next socket event and the user would
 *     have no way to act.
 *   - delivered text still wins over a sticky failure (step 2 above), so a late
 *     success always lands.
 *
 * @param {object} message
 * @param {{ expectSinceMs?: number|null, now?: number }} [options]
 * @returns {object} the same reference when nothing changed (React-friendly)
 */
export function stampTranscriptionState(message, options = {}) {
    const derived = deriveTranscriptionState(message, options);
    if (derived === null) {
        // Non-audio rows must not carry a stale state after an edit that removed
        // the audio, so an existing value is cleared rather than left behind.
        return message?.transcription ? { ...message, transcription: null } : message;
    }
    if (derived !== TRANSCRIPTION_DONE && message?.transcription === TRANSCRIPTION_FAILED) {
        return message;
    }
    if (message?.transcription === derived) return message;
    return { ...message, transcription: derived };
}

/**
 * Apply {@link stampTranscriptionState} across a timeline, returning the SAME
 * array when every row is already correct so the store never re-renders for
 * nothing.
 *
 * @param {Array<object>} messages
 * @param {{ expectSinceMs?: number|null, now?: number }} [options]
 * @returns {Array<object>}
 */
export function stampTranscriptionStates(messages, options = {}) {
    let changed = false;
    const next = (messages || []).map((message) => {
        const stamped = stampTranscriptionState(message, options);
        if (stamped !== message) changed = true;
        return stamped;
    });
    return changed ? next : (messages || []);
}

/**
 * Which messages an undirected STT failure should mark.
 *
 * ── WHY "ALL PENDING", NOT ONE ID ────────────────────────────────────────
 *
 * The engine's error response echoes the SOURCE EVENT id, not a message id
 * (eventserver/handler_websocket.go `buildErrorResponseEvent`), and a failed
 * STT call does not necessarily know which row it belonged to. Rather than
 * invent an attribution the wire does not carry, every message that is
 * currently awaiting a transcription is marked failed. That is safe: a row with
 * text is `done` and untouched, and a wrong "failed" only ever costs the user a
 * Retry press on a bubble that already had no text.
 *
 * @param {Array<object>} messages
 * @returns {Array<object>} the same array when nothing was pending
 */
export function markPendingTranscriptionsFailed(messages) {
    let changed = false;
    const next = (messages || []).map((message) => {
        if (message?.transcription === TRANSCRIPTION_PENDING) {
            changed = true;
            return { ...message, transcription: TRANSCRIPTION_FAILED };
        }
        return message;
    });
    return changed ? next : (messages || []);
}

/**
 * True when the bubble should offer **Retry transcription**.
 *
 * Deliberately NOT offered while pending (the attempt is live) or when text
 * exists (there is nothing to retry). Also requires an id, because the retry
 * endpoint addresses a persisted row — an optimistic, not-yet-saved row must
 * not show a button that could only 404.
 *
 * @param {object|null|undefined} message
 * @returns {boolean}
 */
export function canRetranscribeMessage(message) {
    if (!isTranscribableMessage(message)) return false;
    if (!message.id) return false;
    if (hasTranscribedText(message)) return false;
    return message.transcription === TRANSCRIPTION_FAILED;
}

/**
 * Build the timeline patch from the retranscribe endpoint's response.
 *
 * The response is the authority on both fields, and they are applied verbatim:
 * `message_type` becomes 'combined' server-side for an audio row (text AND
 * audio), which is what keeps the audio bubble — and the "this was a voice
 * note" affordance Android loses by patching content in place.
 *
 * @param {string} messageId
 * @param {{ content?: string, message_type?: string, updated_at?: string }} response
 * @returns {object} the patch for {@link replaceMessage}
 */
export function transcriptionPatchFromResponse(messageId, response) {
    const patch = {
        id: messageId,
        transcription: TRANSCRIPTION_DONE,
        // A successful retry also clears the sticky failure marker the state is
        // derived from — the row now has text.
        is_edited: false,
    };
    const content = typeof response?.content === 'string' ? response.content : '';
    patch.content = content;
    if (response?.message_type) patch.message_type = response.message_type;
    if (response?.updated_at) patch.updated_at = response.updated_at;
    return patch;
}

/**
 * The most useful sentence to show when a retry fails.
 *
 * The engine deliberately surfaces the provider's message verbatim (a bad key, a
 * missing model, an unsupported container), so this prefers it over any generic
 * copy — that string is the entire diagnostic value of the feature.
 *
 * @param {unknown} error
 * @returns {string} empty when there is nothing specific to say
 */
export function transcriptionErrorMessage(error) {
    if (!error) return '';
    const message = typeof error === 'string' ? error : error.message;
    return typeof message === 'string' ? message.trim() : '';
}
