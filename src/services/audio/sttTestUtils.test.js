import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUDIO_FILE_ACCEPT,
  STT_TEST_MAX_AUDIO_BYTES,
  STT_TEST_RECORD_MS,
  audioClipLabel,
  formatElapsed,
  resolvedConfigRows,
  sttConfigSourceKey,
  sttTestAudioPayload,
  sttTestControls,
  sttTestError,
  sttTestOutcome,
  validateAudioFile,
} from './sttTestUtils.js';

/* A `t` stub that returns the key plus any vars, so assertions can name the
 * exact key the panel would render. */
const t = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);

/* ── 1. Fixed take length ───────────────────────────────────────────── */

test('STT_TEST_RECORD_MS is the task\'s five seconds', () => {
  assert.equal(STT_TEST_RECORD_MS, 5000);
});

test('AUDIO_FILE_ACCEPT lists the formats providers actually decode', () => {
  for (const ext of ['.wav', '.mp3', '.m4a', '.webm', '.ogg']) {
    assert.ok(AUDIO_FILE_ACCEPT.includes(ext), `${ext} must be accepted`);
  }
});

/* ── 2. formatElapsed ───────────────────────────────────────────────── */

test('formatElapsed keeps sub-second precision — it is the interesting part', () => {
  assert.equal(formatElapsed(820), '820 ms');
  assert.equal(formatElapsed(0), '0 ms');
});

test('formatElapsed switches to seconds at 1000 ms with two decimals', () => {
  assert.equal(formatElapsed(1000), '1.00 s');
  assert.equal(formatElapsed(1420), '1.42 s');
});

test('formatElapsed degrades to a dash for a missing/negative value', () => {
  // A provider that reports nothing must not render "0 ms", which would read as
  // "instant" rather than "unknown".
  assert.equal(formatElapsed(undefined), '—');
  assert.equal(formatElapsed(null), '—');
  assert.equal(formatElapsed(-5), '—');
  assert.equal(formatElapsed('nonsense'), '—');
});

/* ── 3. Control gating ──────────────────────────────────────────────── */

test('no audio means Transcribe is disabled and the hint says what to do', () => {
  const c = sttTestControls({ hasAudio: false, isRecording: false, isTranscribing: false });
  assert.equal(c.canTranscribe, false);
  assert.equal(c.canRecord, true);
  assert.equal(c.transcribeHintKey, 'sttTest.hints.noAudio');
});

test('a recording take stops Transcribe and the file picker', () => {
  const c = sttTestControls({ hasAudio: true, isRecording: true, isTranscribing: false });
  assert.equal(c.canTranscribe, false, 'one operation at a time');
  assert.equal(c.canUpload, false, 'swapping the clip under a live recorder is unreachable');
  assert.equal(c.transcribeHintKey, 'sttTest.hints.recording');
});

test('a transcription in flight disables every control', () => {
  const c = sttTestControls({ hasAudio: true, isRecording: false, isTranscribing: true });
  assert.equal(c.canTranscribe, false);
  assert.equal(c.canRecord, false);
  assert.equal(c.canUpload, false);
  assert.equal(c.transcribeHintKey, 'sttTest.hints.transcribing');
});

test('audio + idle is the only enablable state, and it carries no hint', () => {
  const c = sttTestControls({ hasAudio: true, isRecording: false, isTranscribing: false });
  assert.equal(c.canTranscribe, true);
  assert.equal(c.canRecord, true);
  assert.equal(c.canUpload, true);
  assert.equal(c.transcribeHintKey, '');
});

test('sttTestControls tolerates being called with nothing', () => {
  const c = sttTestControls();
  assert.equal(c.canTranscribe, false);
  assert.equal(c.transcribeHintKey, 'sttTest.hints.noAudio');
});

/* ── 4. Outcome classification ──────────────────────────────────────── */

test('a transcript is a success and carries text + timing', () => {
  const o = sttTestOutcome({
    status: 'success',
    text: '  hello  ',
    language: 'en',
    ms: 640,
    config: { provider: 'openai' },
  });
  assert.equal(o.tone, 'success');
  assert.equal(o.text, 'hello');
  assert.equal(o.language, 'en');
  assert.equal(o.ms, 640);
  assert.deepEqual(o.config, { provider: 'openai' });
});

test('an empty transcript is its OWN tone, not an error', () => {
  // The distinction is load-bearing: "heard nothing" is a microphone/format
  // problem, "failed" is a credential problem, and they need different advice.
  const o = sttTestOutcome({ status: 'success', text: '', empty: true, ms: 300 });
  assert.equal(o.tone, 'empty');
  assert.equal(o.text, '');
});

test('a whitespace-only transcript is treated as empty', () => {
  const o = sttTestOutcome({ status: 'success', text: '   \n  ' });
  assert.equal(o.tone, 'empty');
});

test('an engine `empty` flag wins over accidental text', () => {
  // Defensive: the engine never sends both, but the flag is authoritative if a
  // future provider returns whitespace-with-a-warning.
  const o = sttTestOutcome({ text: 'x', empty: true });
  assert.equal(o.tone, 'empty');
  assert.equal(o.text, '');
});

test('a non-numeric ms becomes null rather than NaN', () => {
  const o = sttTestOutcome({ text: 'hi', ms: 'slow' });
  assert.equal(o.ms, null);
});

test('sttTestOutcome survives a null body', () => {
  const o = sttTestOutcome(null);
  assert.equal(o.tone, 'empty');
  assert.equal(o.ms, null);
  assert.equal(o.config, null);
});

test('the configured language is labelled as a config value, not a detection', () => {
  const o = sttTestOutcome({ text: 'hi', language: 'de' });
  assert.equal(o.language, 'de');
  // No provider implementation returns a detected language; the field is the
  // configured one, and the panel's copy says so.
  const withoutLanguage = sttTestOutcome({ text: 'hi' });
  assert.equal(withoutLanguage.language, '');
});

/* ── 5. Verbatim errors ─────────────────────────────────────────────── */

test('a provider error keeps its message intact and only translates the fallback', () => {
  const e = sttTestError(new Error('401 invalid api key for model whisper-1'), t);
  assert.equal(e.tone, 'error');
  assert.equal(e.verbatim, '401 invalid api key for model whisper-1');
  assert.equal(e.fallback, 'sttTest.failed');
});

test('an error with no message still has a translated fallback to show', () => {
  const e = sttTestError(new Error(''), t);
  assert.equal(e.verbatim, '');
  assert.equal(e.fallback, 'sttTest.failed');
});

test('a non-Error throw does not blow up the panel', () => {
  const e = sttTestError('plain string', t);
  assert.equal(e.verbatim, '');
  assert.equal(e.fallback, 'sttTest.failed');
});

/* ── 6. Resolved-config rendering ───────────────────────────────────── */

test('resolvedConfigRows renders config / provider / model / language in order', () => {
  const rows = resolvedConfigRows(
    { config_name: 'whisper', provider: 'openai', model: 'whisper-1', language: 'en', source: 'config' },
    t,
  );
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.equal(byKey.config.value, 'whisper');
  assert.equal(byKey.provider.value, 'openai');
  assert.equal(byKey.model.value, 'whisper-1');
  assert.equal(byKey.language.value, 'en');
  assert.equal(byKey.source.value, 'sttTest.source.config');
  assert.ok(rows.every((r) => r.missing === false));
});

test('a missing model reads as a FINDING, not an empty cell', () => {
  // This is the acceptance criterion: a misconfigured module must be obvious.
  const rows = resolvedConfigRows({ config_name: 'x', provider: 'openai' }, t);
  const model = rows.find((r) => r.key === 'model');
  assert.equal(model.value, 'sttTest.notSet');
  assert.equal(model.missing, true);
});

test('resolvedConfigRows falls back to the config id when there is no name', () => {
  const rows = resolvedConfigRows({ config_id: 'cfg-123', provider: 'openai' }, t);
  assert.equal(rows.find((r) => r.key === 'config').value, 'cfg-123');
});

test('the source row is omitted when the engine did not report one', () => {
  const rows = resolvedConfigRows({ provider: 'openai', config_name: 'x' }, t);
  assert.equal(rows.some((r) => r.key === 'source'), false);
});

test('resolvedConfigRows survives a null config', () => {
  const rows = resolvedConfigRows(null, t);
  assert.equal(rows.length, 4);
  assert.ok(rows.every((r) => r.missing === true));
});

test('every source maps to a distinct, non-empty label key', () => {
  const keys = ['config', 'entity_mapping', 'inline', '', 'weird'].map(sttConfigSourceKey);
  assert.equal(keys[0], 'sttTest.source.config');
  assert.equal(keys[1], 'sttTest.source.entityMapping');
  assert.equal(keys[2], 'sttTest.source.inline');
  // Unknown sources must not accidentally claim "the configuration selected
  // above" — that would mislabel where the config came from.
  assert.equal(keys[3], 'sttTest.source.unknown');
  assert.equal(keys[4], 'sttTest.source.unknown');
});

/* ── 7. File validation ─────────────────────────────────────────────── */

test('a plausible audio file passes', () => {
  assert.deepEqual(validateAudioFile({ name: 'clip.webm', type: 'audio/webm', size: 1024 }, t), { ok: true });
  assert.deepEqual(validateAudioFile({ name: 'X.WAV', type: '', size: 10 }, t), { ok: true },
    'an uppercase extension with no MIME still passes');
  assert.deepEqual(validateAudioFile({ name: 'f', type: 'audio/mpeg', size: 10 }, t), { ok: true });
});

test('a non-audio file is rejected with an actionable message', () => {
  const v = validateAudioFile({ name: 'notes.txt', type: 'text/plain', size: 10 }, t);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'type');
  assert.equal(v.message, 'sttTest.fileErrors.type');
});

test('an empty file is rejected before it reaches the engine', () => {
  const v = validateAudioFile({ name: 'clip.webm', type: 'audio/webm', size: 0 }, t);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'empty');
});

test('a file over the 25 MB ceiling is rejected client-side', () => {
  const v = validateAudioFile(
    { name: 'long.wav', type: 'audio/wav', size: STT_TEST_MAX_AUDIO_BYTES + 1 },
    t,
  );
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'size');
});

test('a file exactly at the ceiling is allowed', () => {
  const v = validateAudioFile(
    { name: 'long.wav', type: 'audio/wav', size: STT_TEST_MAX_AUDIO_BYTES },
    t,
  );
  assert.equal(v.ok, true);
});

test('no file at all is a distinct reason', () => {
  assert.equal(validateAudioFile(null, t).reason, 'missing');
});

/* ── 8. Request payload ─────────────────────────────────────────────── */

test('the payload carries the negotiated mime type, not a guess', () => {
  const p = sttTestAudioPayload({ audioBase64: 'AAA=', mimeType: 'audio/webm;codecs=opus' });
  assert.deepEqual(p, { audio_base64: 'AAA=', mime_type: 'audio/webm;codecs=opus' });
});

test('a clip with no mime type falls back to octet-stream rather than empty', () => {
  const p = sttTestAudioPayload({ audioBase64: 'AAA=' });
  assert.equal(p.mime_type, 'application/octet-stream');
});

test('no audio yields null so the caller cannot send an empty body', () => {
  assert.equal(sttTestAudioPayload(null), null);
  assert.equal(sttTestAudioPayload({ audioBase64: '   ' }), null);
});

/* ── 9. Clip labels ─────────────────────────────────────────────────── */

test('a recording is labelled with its own duration', () => {
  assert.equal(
    audioClipLabel({ source: 'recording', durationMs: 5000 }, t),
    'sttTest.clip.recording:{"seconds":"5.0"}',
  );
});

test('an uploaded file is labelled by name', () => {
  assert.equal(
    audioClipLabel({ source: 'file', fileName: 'sample.m4a' }, t),
    'sttTest.clip.file:{"name":"sample.m4a"}',
  );
});

test('a missing duration falls back to the fixed take length', () => {
  // An auto-stopped take still reports elapsed time, but a driver that could
  // not measure it must render the intended length rather than "0.0 s".
  assert.equal(
    audioClipLabel({ source: 'recording' }, t),
    'sttTest.clip.recording:{"seconds":"5"}',
  );
});

test('no clip renders nothing', () => {
  assert.equal(audioClipLabel(null, t), '');
});
