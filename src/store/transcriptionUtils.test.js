/**
 * Transcription state machine — Task 04-3.
 *
 * These pin the rules the Retry surface depends on, especially the ones that are
 * easy to break by "simplifying" the derivation:
 *
 *   1. only audio messages have a state at all;
 *   2. text ALWAYS wins (`done`), even over a sticky failure or a closed window
 *      — a late STT_OUTPUT_TEXT must never be hidden;
 *   3. `pending` is a window, not a default (old notes must not re-animate);
 *   4. `failed` is sticky, so a merge cannot make the Retry button vanish;
 *   5. Retry is offered only when it can actually work (persisted id, no text).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    TRANSCRIPTION_PENDING,
    TRANSCRIPTION_DONE,
    TRANSCRIPTION_FAILED,
    TRANSCRIPTION_TIMEOUT_MS,
    isTranscribableMessage,
    hasTranscribedText,
    deriveTranscriptionState,
    stampTranscriptionState,
    stampTranscriptionStates,
    markPendingTranscriptionsFailed,
    canRetranscribeMessage,
    transcriptionPatchFromResponse,
    transcriptionErrorMessage,
} from './transcriptionUtils.js';

const NOW = Date.parse('2026-10-25T12:00:00Z');

/** An audio-only voice note created `offsetMs` before NOW. */
const voiceNote = (overrides = {}) => ({
    id: 'm-voice',
    content: '',
    has_audio: true,
    has_image: false,
    message_type: 'audio',
    created_at: new Date(NOW - 1000).toISOString(),
    ...overrides,
});

// ── identity ─────────────────────────────────────────────────────────────

test('only audio messages carry a transcription state', () => {
    assert.equal(isTranscribableMessage(voiceNote()), true);
    assert.equal(isTranscribableMessage({ has_audio: false, content: 'hi' }), false);
    assert.equal(isTranscribableMessage(null), false);

    // A text or image row derives null, not a meaningless 'done'.
    assert.equal(deriveTranscriptionState({ id: 'm1', content: 'hi', has_audio: false }), null);
    assert.equal(deriveTranscriptionState({ id: 'm2', has_image: true, has_audio: false }), null);
});

test('whitespace-only content counts as no transcription', () => {
    assert.equal(hasTranscribedText({ content: '   ' }), false);
    assert.equal(hasTranscribedText({ content: 'hi' }), true);
    assert.equal(hasTranscribedText({}), false);
});

// ── deriveTranscriptionState ─────────────────────────────────────────────

test('a voice note outside any window is failed (Retry offered)', () => {
    assert.equal(
        deriveTranscriptionState(voiceNote(), { expectSinceMs: null, now: NOW }),
        TRANSCRIPTION_FAILED,
    );
});

test('a voice note inside the open window is pending', () => {
    const since = NOW - 2000;
    assert.equal(
        deriveTranscriptionState(voiceNote(), { expectSinceMs: since, now: NOW }),
        TRANSCRIPTION_PENDING,
    );
});

test('pending expires at the 20 s deadline', () => {
    const since = NOW - 1000;
    const note = voiceNote({ created_at: new Date(since).toISOString() });

    // One millisecond before the deadline it is still pending.
    assert.equal(
        deriveTranscriptionState(note, { expectSinceMs: since, now: since + TRANSCRIPTION_TIMEOUT_MS - 1 }),
        TRANSCRIPTION_PENDING,
    );
    // At the deadline it is failed.
    assert.equal(
        deriveTranscriptionState(note, { expectSinceMs: since, now: since + TRANSCRIPTION_TIMEOUT_MS }),
        TRANSCRIPTION_FAILED,
    );
});

test('a note OLDER than the window is failed even while an attempt is live', () => {
    // This is the regression the window exists for: without it, every old
    // untranscribed note would render "Transcribing…" on each load.
    const since = NOW - 60_000;
    const oldNote = voiceNote({ created_at: new Date(NOW - 3_600_000).toISOString() });
    assert.equal(
        deriveTranscriptionState(oldNote, { expectSinceMs: since, now: NOW }),
        TRANSCRIPTION_FAILED,
    );
});

test('text wins unconditionally — a late STT_OUTPUT_TEXT still lands', () => {
    // Same row, now with content, while the window is CLOSED and a failure was
    // recorded. If text did not win, real transcribed text would render as
    // "failed" and the user would be invited to retry work that succeeded.
    const note = voiceNote({ content: 'hello there', transcription: TRANSCRIPTION_FAILED });
    assert.equal(
        deriveTranscriptionState(note, { expectSinceMs: null, now: NOW }),
        TRANSCRIPTION_DONE,
    );
});

// ── stampTranscriptionState ──────────────────────────────────────────────

test('stamp keeps the same reference when nothing changed', () => {
    const note = { ...voiceNote(), transcription: TRANSCRIPTION_DONE, content: 'hi' };
    assert.equal(stampTranscriptionState(note, { now: NOW }), note);
});

test('stamp clears a stale state when audio disappears', () => {
    const edited = { id: 'm1', content: 'text now', has_audio: false, transcription: 'failed' };
    const stamped = stampTranscriptionState(edited, { now: NOW });
    assert.equal(stamped.transcription, null);
});

test('a recorded failure is sticky against re-derivation', () => {
    // The row is audio-only, a failure was recorded, and a window happens to be
    // open. Without stickiness the derive would say 'pending' and the Retry
    // button would disappear on the next socket event.
    const note = voiceNote({ transcription: TRANSCRIPTION_FAILED });
    const since = NOW - 1000;
    const stamped = stampTranscriptionState(note, { expectSinceMs: since, now: NOW });
    assert.equal(stamped.transcription, TRANSCRIPTION_FAILED);
});

test('delivered text overrides the sticky failure', () => {
    const note = voiceNote({ content: 'transcribed', transcription: TRANSCRIPTION_FAILED });
    const stamped = stampTranscriptionState(note, { now: NOW });
    assert.equal(stamped.transcription, TRANSCRIPTION_DONE);
});

test('stampTranscriptionStates returns the same array when all rows are correct', () => {
    const messages = [
        { id: 'a', content: 'hi', has_audio: false },
        { ...voiceNote(), transcription: TRANSCRIPTION_FAILED },
    ];
    assert.equal(stampTranscriptionStates(messages, { now: NOW }), messages);
});

test('stampTranscriptionStates stamps a mixed timeline', () => {
    const messages = [
        { id: 'text', content: 'hi', has_audio: false },
        voiceNote({ id: 'note' }),
        voiceNote({ id: 'note-done', content: 'words' }),
    ];
    const stamped = stampTranscriptionStates(messages, { now: NOW });
    assert.equal(stamped[0].transcription, undefined, 'text rows carry no state');
    assert.equal(stamped[1].transcription, TRANSCRIPTION_FAILED);
    assert.equal(stamped[2].transcription, TRANSCRIPTION_DONE);
});

// ── markPendingTranscriptionsFailed ──────────────────────────────────────

test('an undirected failure marks only pending rows', () => {
    const messages = [
        voiceNote({ id: 'pending', transcription: TRANSCRIPTION_PENDING }),
        voiceNote({ id: 'done', content: 'words', transcription: TRANSCRIPTION_DONE }),
        { id: 'text', content: 'hi', has_audio: false },
    ];
    const next = markPendingTranscriptionsFailed(messages);
    assert.equal(next[0].transcription, TRANSCRIPTION_FAILED);
    assert.equal(next[1].transcription, TRANSCRIPTION_DONE);
    assert.equal(next[2].transcription, undefined);
});

test('marking with nothing pending is a no-op reference-wise', () => {
    const messages = [{ id: 'text', content: 'hi', has_audio: false }];
    assert.equal(markPendingTranscriptionsFailed(messages), messages);
});

// ── canRetranscribeMessage ───────────────────────────────────────────────

test('Retry is offered only for a persisted, textless, failed audio row', () => {
    const failed = voiceNote({ transcription: TRANSCRIPTION_FAILED });
    assert.equal(canRetranscribeMessage(failed), true);

    // Not while the attempt is live.
    assert.equal(canRetranscribeMessage(voiceNote({ transcription: TRANSCRIPTION_PENDING })), false);
    // Not when there is text — there is nothing to retry.
    assert.equal(canRetranscribeMessage(voiceNote({ content: 'words', transcription: TRANSCRIPTION_DONE })), false);
    // Not for a non-audio row.
    assert.equal(canRetranscribeMessage({ id: 't', content: '', has_audio: false }), false);
    // Not without an id: the endpoint addresses a persisted row, so the button
    // could only 404.
    assert.equal(canRetranscribeMessage(voiceNote({ id: '', transcription: TRANSCRIPTION_FAILED })), false);
    assert.equal(canRetranscribeMessage(null), false);
});

// ── response / error helpers ─────────────────────────────────────────────

test('a successful retry patches content, type and state', () => {
    const patch = transcriptionPatchFromResponse('m-voice', {
        content: 'hello there',
        message_type: 'combined',
        updated_at: '2026-10-25T12:00:05Z',
    });
    assert.equal(patch.id, 'm-voice');
    assert.equal(patch.content, 'hello there');
    // 'combined' is what keeps the audio bubble alongside the new text.
    assert.equal(patch.message_type, 'combined');
    assert.equal(patch.updated_at, '2026-10-25T12:00:05Z');
    assert.equal(patch.transcription, TRANSCRIPTION_DONE);
    // A transcription is not a user edit.
    assert.equal(patch.is_edited, false);
});

test('response helper tolerates a partial body', () => {
    const patch = transcriptionPatchFromResponse('m-1', {});
    assert.equal(patch.content, '');
    assert.equal(patch.message_type, undefined);
    assert.equal(patch.transcription, TRANSCRIPTION_DONE);
});

test('the provider error is surfaced verbatim', () => {
    assert.equal(transcriptionErrorMessage(new Error('401 invalid api key')), '401 invalid api key');
    assert.equal(transcriptionErrorMessage('  raw failure  '), 'raw failure');
    assert.equal(transcriptionErrorMessage(null), '');
    assert.equal(transcriptionErrorMessage({}), '');
});
