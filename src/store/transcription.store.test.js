/**
 * chatStore.retranscribeMessage — Task 04-3 acceptance path.
 *
 * Same seam as messageActions.store.test.js: the REAL service module runs and
 * only the network is stubbed, so both the wire call and the timeline effect are
 * assertable without a bundler.
 *
 * The behaviours that matter:
 *
 *   1. a Retry POSTs to `/messages/:id/retranscribe` and does NOT send audio (the
 *      engine re-reads the stored blob — that is why no second message appears);
 *   2. on success the SAME row gains the text and `message_type = 'combined'`,
 *      so the bubble keeps its audio AND shows the words;
 *   3. a failed retry returns the row to `failed` (Retry pressable again) and
 *      surfaces the provider's message verbatim;
 *   4. a Retry is refused for a row that is not eligible — no request at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const calls = [];
/** @type {{ok: boolean, body: object, status: number}} */
let nextResponse = { ok: true, body: {}, status: 200 };

globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method || 'GET', body: options.body });
    return {
        ok: nextResponse.ok,
        status: nextResponse.status,
        json: async () => nextResponse.body,
    };
};

const { default: useChatStore } = await import('./chatStore.js');
const { clearToasts, default: useToastStore } = await import('./toastStore.js');

/** A failed voice note, in the shape the timeline holds after the timeout. */
const failedVoiceNote = (id = 'm-voice', extra = {}) => ({
    id,
    entity_id: 'ai1',
    sender_entity_id: 'user',
    interaction_id: 'i1',
    content: '',
    message_type: 'audio',
    has_audio: true,
    audio_mime_type: 'audio/webm',
    has_image: false,
    is_edited: false,
    is_pinned: false,
    is_read: true,
    reply_to_message_id: '',
    reply_preview: '',
    reactions_json: '',
    transcription: 'failed',
    created_at: '2026-10-25T10:00:00Z',
    updated_at: '2026-10-25T10:00:00Z',
    ...extra,
});

function reset({ messages = [] } = {}) {
    calls.length = 0;
    nextResponse = { ok: true, body: {}, status: 200 };
    clearToasts();
    useChatStore.setState({ messages, error: null });
}

const lastCall = () => calls[calls.length - 1];
const findMessage = (id) => useChatStore.getState().messages.find((m) => m.id === id);

test('retranscribeMessage POSTs to the retranscribe route and fills in the same row', async () => {
    reset({ messages: [failedVoiceNote()] });
    nextResponse = {
        ok: true,
        status: 200,
        body: {
            status: 'ok',
            id: 'm-voice',
            content: 'hello there',
            message_type: 'combined',
            updated_at: '2026-10-25T10:00:05Z',
        },
    };

    // Optimistic pending: the Retry button is already gone mid-flight.
    const pending = useChatStore.getState().retranscribeMessage('m-voice');
    assert.equal(findMessage('m-voice').transcription, 'pending');

    const ok = await pending;
    assert.equal(ok, true);

    // ONE message — the acceptance criterion. No audio is re-sent: the engine
    // re-reads the stored blob, which is the whole reason for option (b).
    assert.equal(useChatStore.getState().messages.length, 1);
    const row = findMessage('m-voice');
    assert.equal(row.content, 'hello there');
    assert.equal(row.message_type, 'combined', 'audio bubble survives alongside the text');
    assert.equal(row.has_audio, true, 'the voice note itself is untouched');
    assert.equal(row.transcription, 'done');
    assert.equal(row.is_edited, false, 'a transcription is not a user edit');

    // Wire assertions.
    assert.equal(calls.length, 1);
    assert.equal(lastCall().method, 'POST');
    assert.match(lastCall().url, /\/messages\/m-voice\/retranscribe$/);
    assert.deepEqual(JSON.parse(lastCall().body), {}, 'no audio is sent');
});

test('a failed retry returns to failed and surfaces the provider message', async () => {
    reset({ messages: [failedVoiceNote()] });
    nextResponse = { ok: false, status: 502, body: { error: '401 invalid api key' } };

    const ok = await useChatStore.getState().retranscribeMessage('m-voice');
    assert.equal(ok, false);

    // Pressable again.
    assert.equal(findMessage('m-voice').transcription, 'failed');
    // Row not half-written.
    assert.equal(findMessage('m-voice').content, '');
    assert.equal(findMessage('m-voice').message_type, 'audio');

    const toasts = useToastStore.getState().toasts;
    assert.equal(toasts.length, 1);
    // The provider's own words — the diagnostic value of the feature.
    assert.match(toasts[0].message, /401 invalid api key/);
});

test('a retry is refused (no request) for an ineligible row', async () => {
    reset({
        messages: [
            // Already transcribed.
            failedVoiceNote('m-done', { content: 'words', transcription: 'done' }),
            // Not persisted.
            failedVoiceNote('m-unsaved', { id: '' }),
        ],
    });

    assert.equal(await useChatStore.getState().retranscribeMessage('m-done'), false);
    assert.equal(await useChatStore.getState().retranscribeMessage('m-unsaved'), false);
    assert.equal(await useChatStore.getState().retranscribeMessage('missing'), false);
    assert.equal(calls.length, 0, 'an ineligible retry must not hit the network');
});

