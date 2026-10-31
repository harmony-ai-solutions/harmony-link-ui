import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUDIO_MIME_CANDIDATES,
  DEFAULT_DEVICE_ID,
  FALLBACK_AUDIO_MIME,
  LEVEL_GAIN,
  MAX_RECORDING_MS,
  MIN_RECORDING_MS,
  SILENT_LEVEL_THRESHOLD,
  advanceSilenceWatch,
  buildAudioConstraints,
  describeMicError,
  deviceLabel,
  formatDuration,
  isSilentLevel,
  isStaleDeviceError,
  levelFromTimeDomain,
  micErrorKey,
  pickSupportedMimeType,
  reachedRecordingLimit,
  recordingProgress,
  resolveRecordingMimeType,
  ringGeometry,
  selectInputDevices,
  shouldSendRecording,
  smoothLevel,
} from './recorderUtils.js';

/* ── 1. Cap, timer, ring ─────────────────────────────────────────────── */

test('MAX_RECORDING_MS is the Android 2:00 parity ceiling', () => {
  assert.equal(MAX_RECORDING_MS, 120000);
  assert.equal(formatDuration(MAX_RECORDING_MS), '2:00');
});

test('MIN_RECORDING_MS rejects a 0.2 s accidental tap', () => {
  assert.equal(MIN_RECORDING_MS, 500);
  assert.equal(shouldSendRecording({ elapsedMs: 200 }).action, 'tooShort');
  assert.equal(shouldSendRecording({ elapsedMs: 499 }).action, 'tooShort');
  assert.equal(shouldSendRecording({ elapsedMs: 500 }).action, 'send');
});

test('formatDuration pads seconds and clamps junk to 0:00', () => {
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(999), '0:00');
  assert.equal(formatDuration(1000), '0:01');
  assert.equal(formatDuration(7000), '0:07');
  assert.equal(formatDuration(59000), '0:59');
  assert.equal(formatDuration(60000), '1:00');
  assert.equal(formatDuration(119000), '1:59');
  assert.equal(formatDuration(-5000), '0:00');
  assert.equal(formatDuration(NaN), '0:00');
  assert.equal(formatDuration(Infinity), '0:00');
  assert.equal(formatDuration(undefined), '0:00');
});

test('recordingProgress clamps to 0..1 and falls back on a bad ceiling', () => {
  assert.equal(recordingProgress(0), 0);
  assert.equal(recordingProgress(-100), 0);
  assert.equal(recordingProgress(MAX_RECORDING_MS / 2), 0.5);
  assert.equal(recordingProgress(MAX_RECORDING_MS), 1);
  assert.equal(recordingProgress(MAX_RECORDING_MS * 3), 1);
  // A zero/NaN max must not produce Infinity or NaN.
  assert.equal(recordingProgress(60000, 0), 0.5);
  assert.equal(recordingProgress(NaN), 0);
});

test('reachedRecordingLimit fires at exactly 2:00, not one tick later', () => {
  assert.equal(reachedRecordingLimit(MAX_RECORDING_MS - 1), false);
  assert.equal(reachedRecordingLimit(MAX_RECORDING_MS), true);
  assert.equal(reachedRecordingLimit(MAX_RECORDING_MS + 1), true);
  assert.equal(reachedRecordingLimit(NaN), false);
});

test('ringGeometry traces a full circle to an empty offset', () => {
  const empty = ringGeometry(0);
  assert.equal(empty.fraction, 0);
  assert.ok(Math.abs(empty.dashOffset - empty.circumference) < 1e-9);

  const full = ringGeometry(1);
  assert.equal(full.fraction, 1);
  assert.ok(Math.abs(full.dashOffset) < 1e-9);

  const half = ringGeometry(0.5);
  assert.ok(Math.abs(half.fraction - 0.5) < 1e-9);
  assert.ok(Math.abs(half.dashOffset - half.circumference / 2) < 1e-9);

  // Out-of-range input clamps instead of overshooting the ring.
  assert.equal(ringGeometry(-2).fraction, 0);
  assert.equal(ringGeometry(9).fraction, 1);
});

/* ── 2. MIME negotiation ─────────────────────────────────────────────── */

test('candidate order puts opus/webm first — what Windows Chromium produces', () => {
  assert.deepEqual([...AUDIO_MIME_CANDIDATES], [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]);
});

test('pickSupportedMimeType returns the FIRST supported candidate', () => {
  assert.equal(pickSupportedMimeType(() => true), 'audio/webm;codecs=opus');

  // Narrower support falls through in declaration order.
  const webmOnly = (mime) => mime === 'audio/webm';
  assert.equal(pickSupportedMimeType(webmOnly), 'audio/webm');

  const ogg = (mime) => mime === 'audio/ogg;codecs=opus';
  assert.equal(pickSupportedMimeType(ogg), 'audio/ogg;codecs=opus');

  const mp4 = (mime) => mime === 'audio/mp4';
  assert.equal(pickSupportedMimeType(mp4), 'audio/mp4');
});

test('pickSupportedMimeType returns "" when nothing is supported', () => {
  assert.equal(pickSupportedMimeType(() => false), '');
  assert.equal(pickSupportedMimeType(null), '');
  assert.equal(pickSupportedMimeType(undefined), '');
});

test('pickSupportedMimeType survives a throwing probe', () => {
  let calls = 0;
  const flaky = () => {
    calls += 1;
    if (calls === 1) throw new Error('boom');
    return true;
  };
  // The throw must not abort negotiation; the next candidate wins.
  assert.equal(pickSupportedMimeType(flaky), 'audio/webm');
});

test('resolveRecordingMimeType prefers probe, then recorder, then blob, then floor', () => {
  assert.equal(
    resolveRecordingMimeType({ probed: 'audio/webm;codecs=opus', recorderMimeType: 'audio/webm' }),
    'audio/webm;codecs=opus',
  );
  assert.equal(
    resolveRecordingMimeType({ probed: '', recorderMimeType: 'audio/webm', blobType: 'audio/ogg' }),
    'audio/webm',
  );
  assert.equal(
    resolveRecordingMimeType({ probed: '', recorderMimeType: '', blobType: 'audio/ogg;codecs=opus' }),
    'audio/ogg;codecs=opus',
  );
  // Never an empty string on the wire.
  assert.equal(resolveRecordingMimeType({}), FALLBACK_AUDIO_MIME);
  assert.equal(resolveRecordingMimeType(), FALLBACK_AUDIO_MIME);
  assert.equal(resolveRecordingMimeType({ probed: '   ' }), FALLBACK_AUDIO_MIME);
});

/* ── 3. Device selection ─────────────────────────────────────────────── */

test('selectInputDevices keeps only audio inputs and hoists the system default', () => {
  const devices = [
    { deviceId: 'mic-usb', kind: 'audioinput', label: 'USB Mic' },
    { deviceId: 'cam', kind: 'videoinput', label: 'Webcam' },
    { deviceId: 'default', kind: 'audioinput', label: 'Default' },
    { deviceId: 'speaker', kind: 'audiooutput', label: 'Speakers' },
    { deviceId: 'mic-builtin', kind: 'audioinput', label: 'Built-in' },
  ];

  const inputs = selectInputDevices(devices);
  assert.deepEqual(inputs.map((d) => d.deviceId), ['default', 'mic-usb', 'mic-builtin']);
  assert.equal(inputs[0].isDefault, true);
  assert.equal(inputs[1].isDefault, false);
});

test('selectInputDevices tolerates junk input', () => {
  assert.deepEqual(selectInputDevices(null), []);
  assert.deepEqual(selectInputDevices(undefined), []);
  assert.deepEqual(selectInputDevices('nope'), []);
  assert.deepEqual(selectInputDevices([null, undefined, {}]), []);
});

test('deviceLabel falls back to a stable, numbered label', () => {
  const t = (key, opts) => (opts ? `${key}:${opts.index}` : key);

  assert.equal(deviceLabel({ deviceId: 'a', label: 'USB Mic' }, t, 0), 'USB Mic');
  assert.equal(deviceLabel({ deviceId: 'default', isDefault: true }, t, 0), 'chat:input.micDeviceDefault');
  assert.equal(deviceLabel({ deviceId: 'x' }, t, 2), 'chat:input.micDeviceN:3');
  // Without a translator the copy is still usable English.
  assert.equal(deviceLabel({ deviceId: 'x' }, null, 1), 'Microphone 2');
});

test('buildAudioConstraints asks for exact ids, and default when unset', () => {
  assert.equal(buildAudioConstraints(''), true);
  assert.equal(buildAudioConstraints(undefined), true);
  assert.equal(buildAudioConstraints('   '), true);
  assert.deepEqual(buildAudioConstraints('abc123'), { deviceId: { exact: 'abc123' } });
  assert.deepEqual(buildAudioConstraints('  abc123  '), { deviceId: { exact: 'abc123' } });
  assert.equal(DEFAULT_DEVICE_ID, '');
});

test('isStaleDeviceError recognises an unplugged saved device', () => {
  assert.equal(isStaleDeviceError({ name: 'OverconstrainedError' }), true);
  assert.equal(isStaleDeviceError({ name: 'NotFoundError' }), true);
  assert.equal(isStaleDeviceError({ name: 'NotAllowedError' }), false);
  assert.equal(isStaleDeviceError(null), false);
  assert.equal(isStaleDeviceError('nope'), false);
});

/* ── 4. Level meter ──────────────────────────────────────────────────── */

/** Build a time-domain buffer from a peak amplitude (0..1), centred on 128. */
function timeDomain(peak, length = 64) {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    // Alternate +peak / -peak so RMS equals the peak exactly.
    const sign = i % 2 === 0 ? 1 : -1;
    bytes[i] = 128 + sign * peak * 127;
  }
  return bytes;
}

test('a flat 128 buffer is silence', () => {
  assert.equal(levelFromTimeDomain(new Uint8Array(64).fill(128)), 0);
  assert.equal(levelFromTimeDomain(null), 0);
  assert.equal(levelFromTimeDomain([]), 0);
  assert.equal(levelFromTimeDomain(undefined), 0);
});

test('levelFromTimeDomain scales RMS by the gain and clamps to 1', () => {
  const quiet = levelFromTimeDomain(timeDomain(0.1));
  assert.ok(Math.abs(quiet - 0.1 * LEVEL_GAIN) < 0.01, `quiet=${quiet}`);

  const loud = levelFromTimeDomain(timeDomain(0.9));
  assert.equal(loud, 1);
});

test('a silent mic shows no level and is warned about', () => {
  assert.equal(isSilentLevel(0), true);
  assert.equal(isSilentLevel(SILENT_LEVEL_THRESHOLD / 2), true);
  assert.equal(isSilentLevel(SILENT_LEVEL_THRESHOLD), false);
  assert.equal(isSilentLevel(0.4), false);
  assert.equal(isSilentLevel(NaN), true);
});

test('smoothLevel rises fast and falls slow', () => {
  const up = smoothLevel(0, 1);
  const down = smoothLevel(1, 0);

  // Attack covers most of the gap in one tick (0 → 0.65).
  assert.ok(up > 0.5, `attack=${up}`);
  // Release barely moves in one tick (1 → 0.8): it must NOT snap to zero, or
  // the bar flickers between syllables.
  assert.ok(down > 0.5, `release=${down}`);

  // The asymmetry is the point: the rise is bigger than the fall.
  assert.ok(up - 0 > 1 - down, 'attack should move further than release');

  // Clamped inputs never escape 0..1.
  assert.equal(smoothLevel(2, 5), 1);
  assert.equal(smoothLevel(-2, -5), 0);
  assert.equal(smoothLevel(NaN, NaN), 0);
});

test('advanceSilenceWatch warns once, only after sustained silence', () => {
  // Speaking resets the watch.
  assert.deepEqual(
    advanceSilenceWatch({ elapsedMs: 1000, silentSinceMs: 0, warned: false, level: 0.5 }),
    { silentSinceMs: null, warn: false },
  );

  // Silence starts the clock but does not warn immediately.
  const first = advanceSilenceWatch({ elapsedMs: 1000, silentSinceMs: null, warned: false, level: 0 });
  assert.equal(first.silentSinceMs, 1000);
  assert.equal(first.warn, false);

  // Before the threshold: still quiet.
  const early = advanceSilenceWatch({ elapsedMs: 2000, silentSinceMs: 1000, warned: false, level: 0 });
  assert.equal(early.warn, false);

  // Past the threshold: warn exactly once.
  const late = advanceSilenceWatch({ elapsedMs: 4000, silentSinceMs: 1000, warned: false, level: 0 });
  assert.equal(late.warn, true);

  const again = advanceSilenceWatch({ elapsedMs: 9000, silentSinceMs: 1000, warned: true, level: 0 });
  assert.equal(again.warn, false);
});

/* ── 5. Cancel vs send, error copy ───────────────────────────────────── */

test('shouldSendRecording sends, discards short takes, and honours cancel', () => {
  assert.deepEqual(shouldSendRecording({ elapsedMs: 8000 }), { action: 'send', elapsedMs: 8000 });
  assert.deepEqual(shouldSendRecording({ elapsedMs: 120000 }), { action: 'send', elapsedMs: 120000 });
  assert.equal(shouldSendRecording({ elapsedMs: 300 }).action, 'tooShort');
  // Cancel wins over duration — an explicit cancel never sends.
  assert.equal(shouldSendRecording({ elapsedMs: 30000, cancelled: true }).action, 'cancelled');
  assert.equal(shouldSendRecording({ elapsedMs: 100, cancelled: true }).action, 'cancelled');
  // Junk durations are treated as too short, never as a send.
  assert.equal(shouldSendRecording({}).action, 'tooShort');
  assert.equal(shouldSendRecording().action, 'tooShort');
  assert.equal(shouldSendRecording({ elapsedMs: NaN }).action, 'tooShort');
});

test('describeMicError maps the DOMException classes to distinct reasons', () => {
  assert.equal(describeMicError({ name: 'NotAllowedError' }), 'denied');
  assert.equal(describeMicError({ name: 'PermissionDeniedError' }), 'denied');
  assert.equal(describeMicError({ name: 'NotFoundError' }), 'notFound');
  assert.equal(describeMicError({ name: 'OverconstrainedError' }), 'notFound');
  assert.equal(describeMicError({ name: 'NotReadableError' }), 'inUse');
  assert.equal(describeMicError({ name: 'TrackStartError' }), 'inUse');
  assert.equal(describeMicError({ name: 'NotSupportedError' }), 'unavailable');
  assert.equal(describeMicError({ name: 'WeirdError' }), 'unknown');
  assert.equal(describeMicError(null), 'unknown');
  // Purity guard: the host's global `navigator` must not influence the result.
  assert.equal(describeMicError({ name: 'WeirdError' }), 'unknown');
});

test('micErrorKey gives every reason its own copy key', () => {
  const keys = ['denied', 'notFound', 'inUse', 'unavailable', 'unknown'].map(micErrorKey);
  assert.equal(new Set(keys).size, keys.length, 'each reason needs distinct copy');
  assert.equal(micErrorKey('denied'), 'chat:input.micDenied');
  assert.equal(micErrorKey('notFound'), 'chat:input.micNotFound');
  assert.equal(micErrorKey('inUse'), 'chat:input.micInUse');
  // Unknown falls back to the generic failure message.
  assert.equal(micErrorKey('nonsense'), 'chat:input.recordingFailed');
});
