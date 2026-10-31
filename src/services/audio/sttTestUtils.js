/**
 * STT test-panel helpers (Task 04-5).
 *
 * The panel itself is presentation; everything with a decision in it lives here
 * so `node --test` can pin the behaviour without a DOM, a microphone or an
 * engine. Three groups:
 *
 *   1. **What is testable.** A clip must exist before Transcribe does anything,
 *      and "recording" must not leave the button enabled with stale audio.
 *   2. **How the result reads.** A provider that recognised nothing is NOT a
 *      failure — conflating the two sends a user with a quiet microphone off to
 *      re-enter an API key that already works.
 *   3. **What the resolved config says.** The acceptance criterion is "see which
 *      config is used", so the panel renders the engine's report verbatim and
 *      labels where it came from.
 */

/** Task 04-5 step 2: record a fixed 5 seconds, not a free-form take. */
export const STT_TEST_RECORD_MS = 5000;

/** `MediaRecorder` on Windows/Chromium produces webm+opus; the rest are fallbacks. */
export const AUDIO_FILE_ACCEPT = [
  '.wav', '.mp3', '.m4a', '.webm', '.ogg', '.oga', '.opus', '.flac', '.mp4', '.aac', '.aiff',
].join(',');

/**
 * Formats a duration in milliseconds for display.
 *
 * Sub-second values keep two decimals — the difference between a 300 ms and an
 * 800 ms transcription is the interesting part when a provider is slow, and
 * "0 s" would erase it.
 *
 * @param {number} ms
 * @returns {string} e.g. `"820 ms"`, `"1.42 s"`
 */
export function formatElapsed(ms) {
  // `null`/`''` are checked BEFORE `Number(...)`, because both coerce to 0 — a
  // missing timing would then render as "0 ms", which reads as "instant"
  // instead of "unknown". A test caught this; do not "simplify" it back.
  if (ms === null || ms === undefined || ms === '') return '—';
  const value = Number(ms);
  if (!Number.isFinite(value) || value < 0) return '—';
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

/**
 * The panel's controls state.
 *
 * `transcribe` is enabled only when there is audio AND nothing else is running.
 * While a take is in flight the record button becomes Stop, and Transcribe is
 * disabled — starting a second operation would replace the clip the user is
 * about to send without telling them.
 *
 * @param {{ hasAudio: boolean, isRecording: boolean, isTranscribing: boolean }} state
 * @returns {{ canTranscribe: boolean, canRecord: boolean, canUpload: boolean, transcribeHintKey: string }}
 */
export function sttTestControls({ hasAudio, isRecording, isTranscribing } = {}) {
  const busy = Boolean(isRecording || isTranscribing);
  const has = Boolean(hasAudio);
  let hintKey = '';
  if (isTranscribing) hintKey = 'sttTest.hints.transcribing';
  else if (isRecording) hintKey = 'sttTest.hints.recording';
  else if (!has) hintKey = 'sttTest.hints.noAudio';
  return {
    canTranscribe: has && !busy,
    canRecord: !isTranscribing,
    // Disabled during a take: swapping the file under a running recorder is a
    // state the panel should not be able to reach.
    canUpload: !busy,
    transcribeHintKey: hintKey,
  };
}

/**
 * Normalises an engine response into what the panel renders.
 *
 * The three outcomes are deliberately distinct:
 *   - `success` — text came back;
 *   - `empty`   — the call ran, the provider heard no speech (a microphone or
 *                 format problem, NOT a credential problem);
 *   - `error`   — the provider refused, and its message is shown verbatim.
 *
 * @param {object|null} response - the `/api/module-configs/stt/test` body
 * @returns {{ tone: 'success'|'empty'|'error', text: string, language: string, ms: number|null, warning: string, config: object|null }}
 */
export function sttTestOutcome(response) {
  const body = response && typeof response === 'object' ? response : {};
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  const empty = body.empty === true || text === '';
  const config = body.config && typeof body.config === 'object' ? body.config : null;
  const ms = Number.isFinite(Number(body.ms)) ? Number(body.ms) : null;

  if (empty) {
    return {
      tone: 'empty',
      text: '',
      language: '',
      ms,
      warning: typeof body.warning === 'string' ? body.warning : '',
      config,
    };
  }
  return {
    tone: 'success',
    text,
    // The engine reports the CONFIGURED language, not a detection — a bare
    // `string` from TranscribeAudio carries no detection metadata anywhere.
    language: typeof body.language === 'string' ? body.language : '',
    ms,
    warning: '',
    config,
  };
}

/**
 * Turns a thrown error into the panel's error view.
 *
 * `verbatim` is the whole point (task step 5): the message is shown as the
 * provider wrote it, and only the FALLBACK is translated. A provider sentence
 * that has been through an i18n catalogue is no longer a provider sentence.
 *
 * @param {unknown} error
 * @param {(key: string) => string} t
 * @returns {{ tone: 'error', verbatim: string, fallback: string }}
 */
export function sttTestError(error, t) {
  const message = error && typeof error.message === 'string' ? error.message.trim() : '';
  const fallbackKey = 'sttTest.failed';
  const fallback = typeof t === 'function' ? t(fallbackKey) : fallbackKey;
  return {
    tone: 'error',
    verbatim: message,
    fallback,
  };
}

/**
 * Where the engine got the config from — the difference between "I picked this
 * in the dropdown" and "this is what chat would have used".
 *
 * @param {string} source
 * @returns {string} an i18n key
 */
export function sttConfigSourceKey(source) {
  switch (String(source || '').trim()) {
    case 'config': return 'sttTest.source.config';
    case 'entity_mapping': return 'sttTest.source.entityMapping';
    case 'inline': return 'sttTest.source.inline';
    default: return 'sttTest.source.unknown';
  }
}

/**
 * Renders the resolved config as label/value rows.
 *
 * Missing values become an explicit "not set" rather than an empty cell: an
 * unset model is precisely the misconfiguration this panel exists to reveal,
 * and a blank line looks like a layout bug instead of a finding.
 *
 * @param {object|null} config - the engine's `config` object
 * @param {(key: string) => string} t
 * @returns {Array<{ key: string, label: string, value: string, missing: boolean }>}
 */
export function resolvedConfigRows(config, t) {
  const tr = (key) => (typeof t === 'function' ? t(key) : key);
  const missing = tr('sttTest.notSet');
  const field = (key, labelKey, raw) => {
    const value = typeof raw === 'string' ? raw.trim() : '';
    return { key, label: tr(labelKey), value: value || missing, missing: !value };
  };

  const source = config && typeof config === 'object' ? config.source : '';
  const rows = [
    field('config', 'sttTest.fields.config', config?.config_name || config?.config_id || ''),
    field('provider', 'sttTest.fields.provider', config?.provider || ''),
    field('model', 'sttTest.fields.model', config?.model || ''),
    field('language', 'sttTest.fields.language', config?.language || ''),
  ];
  if (source) {
    rows.push({
      key: 'source',
      label: tr('sttTest.fields.source'),
      value: tr(sttConfigSourceKey(source)),
      missing: false,
    });
  }
  return rows;
}

/**
 * Validates a chosen/uploaded file before it becomes the test clip.
 *
 * Rejecting a `.txt` early is much clearer than letting the provider answer
 * "could not decode audio". The size ceiling mirrors the engine's 25 MB limit,
 * so the panel fails before uploading a clip the route will refuse.
 *
 * @param {{ name?: string, type?: string, size?: number }|null} file
 * @param {(key: string, vars?: object) => string} [t]
 * @returns {{ ok: true } | { ok: false, reason: 'missing'|'type'|'size'|'empty', message: string }}
 */
export function validateAudioFile(file, t) {
  const tr = (key, vars) => (typeof t === 'function' ? t(key, vars) : key);
  if (!file) {
    return { ok: false, reason: 'missing', message: tr('sttTest.fileErrors.missing') };
  }
  if (!Number.isFinite(Number(file.size)) || Number(file.size) <= 0) {
    return { ok: false, reason: 'empty', message: tr('sttTest.fileErrors.empty') };
  }
  if (Number(file.size) > STT_TEST_MAX_AUDIO_BYTES) {
    return {
      ok: false,
      reason: 'size',
      message: tr('sttTest.fileErrors.size', { limit: '25 MB' }),
    };
  }

  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  const looksAudio = type.startsWith('audio/') ||
    type === 'video/webm' ||
    type === 'application/ogg' ||
    AUDIO_FILE_ACCEPT.split(',').some((ext) => name.endsWith(ext));
  if (!looksAudio) {
    return { ok: false, reason: 'type', message: tr('sttTest.fileErrors.type') };
  }
  return { ok: true };
}

/** Matches the engine's `maxSTTTestAudioBytes` (25 MB — OpenAI's per-file cap). */
export const STT_TEST_MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/**
 * The upload body for a recorded or chosen clip.
 *
 * `mime_type` is carried as recorded rather than guessed: 04-1 negotiated it
 * from `MediaRecorder.isTypeSupported`, and a provider that cannot decode the
 * container needs the panel to have told it the truth.
 *
 * @param {{ audioBase64?: string, mimeType?: string }|null} clip
 * @returns {{ audio_base64: string, mime_type: string }|null}
 */
export function sttTestAudioPayload(clip) {
  const base64 = typeof clip?.audioBase64 === 'string' ? clip.audioBase64.trim() : '';
  if (!base64) return null;
  const mimeType = typeof clip?.mimeType === 'string' ? clip.mimeType.trim() : '';
  return {
    audio_base64: base64,
    mime_type: mimeType || 'application/octet-stream',
  };
}

/**
 * A human label for a clip, used by the panel's "which clip am I testing" line.
 *
 * @param {{ source?: 'recording'|'file', durationMs?: number, fileName?: string }|null} clip
 * @param {(key: string, vars?: object) => string} [t]
 */
export function audioClipLabel(clip, t) {
  const tr = (key, vars) => (typeof t === 'function' ? t(key, vars) : key);
  if (!clip) return '';
  if (clip.source === 'file') {
    return tr('sttTest.clip.file', { name: clip.fileName || '—' });
  }
  const durationMs = Number(clip.durationMs);
  const seconds = Number.isFinite(durationMs) && durationMs > 0
    ? (durationMs / 1000).toFixed(1)
    : String(STT_TEST_RECORD_MS / 1000);
  return tr('sttTest.clip.recording', { seconds });
}
