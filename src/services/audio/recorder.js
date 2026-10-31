/**
 * Voice-note recorder driver (Task 04-1).
 *
 * Wraps `getUserMedia` + `MediaRecorder` + `AudioContext` into one object with a
 * single lifecycle, so the composer never owns browser state directly. The
 * decision logic lives in [`recorderUtils.js`](./recorderUtils.js); this file is
 * the impure half.
 *
 * Responsibilities, mapped to the task steps:
 *   1. **120 s ceiling** — a `setInterval` starts with the recorder and calls
 *      the adapter's stop path at {@link MAX_RECORDING_MS}, reporting
 *      `autoStopped` so the caller can toast "stopped at 2:00".
 *   2. **MIME negotiation** — probes {@link AUDIO_MIME_CANDIDATES} through
 *      `MediaRecorder.isTypeSupported` and passes the winner to the constructor
 *      AND to the caller, so the wire carries the type actually recorded.
 *   3. **Device choice** — `deviceId: { exact: id }`, with one transparent
 *      retry on the system default when the saved device has been unplugged.
 *   4. **Level meter** — `AnalyserNode` polled while recording, with the
 *      `AudioContext` closed on every exit path (stop, cancel, auto-stop,
 *      error, unmount) — an unclosed context is a real leak, not a nit.
 *   5. **Cancel vs send** — {@link VoiceRecorder.cancel} discards the take.
 *
 * Everything the browser provides is injectable via `options.env` so the module
 * can be exercised by `node --test`.
 */

import {
  AUDIO_MIME_CANDIDATES,
  LEVEL_INTERVAL_MS,
  MAX_RECORDING_MS,
  MIN_RECORDING_MS,
  TIMER_INTERVAL_MS,
  advanceSilenceWatch,
  buildAudioConstraints,
  describeMicError,
  isStaleDeviceError,
  levelFromTimeDomain,
  pickSupportedMimeType,
  reachedRecordingLimit,
  resolveRecordingMimeType,
  selectInputDevices,
  shouldSendRecording,
  smoothLevel,
} from './recorderUtils.js';

/** Opus at 128 kbps mono is transparent for speech and cheap to send. */
export const AUDIO_BITS_PER_SECOND = 128000;

/** Analyser window: 512 samples ≈ 10 ms at 48 kHz — fast enough to look live. */
export const ANALYSER_FFT_SIZE = 512;

/** Resolve the browser globals once per call so tests can inject fakes. */
function resolveEnv(env) {
  const scope = typeof globalThis !== 'undefined' ? globalThis : {};
  return {
    navigator: env?.navigator ?? scope.navigator,
    MediaRecorder: env?.MediaRecorder ?? scope.MediaRecorder,
    AudioContext: env?.AudioContext ?? scope.AudioContext ?? scope.webkitAudioContext,
    Blob: env?.Blob ?? scope.Blob,
    FileReader: env?.FileReader ?? scope.FileReader,
    setTimeout: env?.setTimeout ?? scope.setTimeout,
    clearTimeout: env?.clearTimeout ?? scope.clearTimeout,
    setInterval: env?.setInterval ?? scope.setInterval,
    clearInterval: env?.clearInterval ?? scope.clearInterval,
    now: env?.now ?? (() => Date.now()),
  };
}

/**
 * List audio input devices.
 *
 * Never throws: a machine with no `mediaDevices` (insecure context, stripped
 * WebView) returns an empty list and the caller shows a picker-less composer
 * rather than a crash.
 *
 * @param {{ navigator?: object }} [env]
 * @returns {Promise<Array<{deviceId: string, label: string, isDefault: boolean}>>}
 */
export async function listInputDevices(env) {
  const { navigator: nav } = resolveEnv(env);
  if (!nav?.mediaDevices?.enumerateDevices) return [];
  try {
    const devices = await nav.mediaDevices.enumerateDevices();
    return selectInputDevices(devices);
  } catch {
    return [];
  }
}

/** Read a Blob as base64 without the `data:` URL prefix. */
function blobToBase64(blob, FileReaderImpl) {
  const Reader = FileReaderImpl ?? (typeof FileReader !== 'undefined' ? FileReader : null);
  if (!Reader) return Promise.resolve('');
  return new Promise((resolve, reject) => {
    const reader = new Reader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Create a recorder driver.
 *
 * Callbacks (all optional, all safe to omit):
 *   - `onTick({ elapsedMs, progress })` — every {@link TIMER_INTERVAL_MS}
 *   - `onLevel(level)` — 0..1, every {@link LEVEL_INTERVAL_MS}
 *   - `onSilence()` — once per take, when the mic has been silent too long
 *   - `onAutoStop({ elapsedMs })` — the 2:00 ceiling fired
 *   - `onDeviceList(devices)` — after the permission grant, so labels are filled
 *
 * @param {{
 *   onTick?: (info: {elapsedMs: number, progress: number}) => void,
 *   onLevel?: (level: number) => void,
 *   onSilence?: () => void,
 *   onAutoStop?: (info: {elapsedMs: number}) => void,
 *   onDeviceList?: (devices: Array<object>) => void,
 *   env?: object,
 * }} [options]
 */
export function createVoiceRecorder(options = {}) {
  const env = resolveEnv(options.env);
  const callbacks = {
    onTick: options.onTick,
    onLevel: options.onLevel,
    onSilence: options.onSilence,
    onAutoStop: options.onAutoStop,
    onDeviceList: options.onDeviceList,
  };

  /** @type {MediaStream|null} */
  let stream = null;
  /** @type {MediaRecorder|null} */
  let recorder = null;
  /** @type {AudioContext|null} */
  let audioContext = null;
  /** @type {AnalyserNode|null} */
  let analyser = null;

  let chunks = [];
  let timerId = null;
  let levelId = null;
  /**
   * Take start, or `null` when no take is running.
   *
   * Deliberately not `0` + a truthiness check: an injected clock legitimately
   * starts at 0, and `startedAt ? … : 0` turned every elapsed time into 0 ms,
   * which then failed the 0.5 s minimum and discarded good audio.
   */
  let startedAt = null;
  let mimeType = '';
  let cancelled = false;
  let finishing = false;
  let level = 0;
  let silentSinceMs = null;
  let silenceWarned = false;

  /**
   * The in-flight take.
   *
   * A SINGLE promise shared by every exit — the user pressing send, ✕ cancel and
   * the 2:00 ceiling. A second wrapper promise would leave an auto-stopped take
   * resolving nobody's handler, silently dropping the audio.
   */
  let takePromise = null;
  let resolveTake = null;
  let rejectTake = null;

  const isRecording = () => !!recorder && recorder.state === 'recording';

  /** Close the AudioContext — the leak the task calls out explicitly. */
  const teardownAnalyser = () => {
    if (levelId !== null) {
      env.clearInterval(levelId);
      levelId = null;
    }
    try {
      analyser?.disconnect();
    } catch {
      /* already disconnected */
    }
    analyser = null;
    const context = audioContext;
    audioContext = null;
    if (context && typeof context.close === 'function') {
      // `close()` is async in every implementation that has it; ignoring the
      // rejection avoids an unhandled promise while still releasing the device.
      try {
        const closing = context.close();
        if (closing && typeof closing.catch === 'function') closing.catch(() => {});
      } catch {
        /* already closed */
      }
    }
  };

  /** Stop the ceiling timer. */
  const teardownTimer = () => {
    if (timerId !== null) {
      env.clearInterval(timerId);
      timerId = null;
    }
  };

  /** Release the microphone. Always the last step, so `onstop` still has tracks. */
  const releaseStream = () => {
    const current = stream;
    stream = null;
    try {
      current?.getTracks?.().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* already stopped */
        }
      });
    } catch {
      /* stream already gone */
    }
  };

  /** Sample the analyser and publish a smoothed level. */
  const sampleLevel = () => {
    if (!analyser) return;
    const elapsedMs = env.now() - startedAt;

    const buffer = new Uint8Array(analyser.fftSize || ANALYSER_FFT_SIZE);
    try {
      analyser.getByteTimeDomainData(buffer);
    } catch {
      return;
    }

    level = smoothLevel(level, levelFromTimeDomain(buffer));
    callbacks.onLevel?.(level);

    const silence = advanceSilenceWatch({
      elapsedMs,
      silentSinceMs,
      warned: silenceWarned,
      level,
    });
    silentSinceMs = silence.silentSinceMs;
    if (silence.warn) {
      silenceWarned = true;
      callbacks.onSilence?.();
    }
  };

  /** Build the analyser graph; failure is non-fatal (meter only). */
  const setupAnalyser = () => {
    const Context = env.AudioContext;
    if (!Context || !stream) return;
    try {
      audioContext = new Context();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE;
      source.connect(analyser);
      // Deliberately NOT connected to destination — monitoring would echo.
      levelId = env.setInterval(sampleLevel, LEVEL_INTERVAL_MS);
    } catch {
      teardownAnalyser();
    }
  };

  /** Stop the recorder, optionally discarding the take. */
  const finish = (takeOptions = {}) => {
    if (finishing) return;
    finishing = true;
    cancelled = takeOptions.cancelled === true;
    teardownTimer();
    teardownAnalyser();
    const active = recorder;
    if (active && active.state !== 'inactive') {
      try {
        active.stop();
        return;
      } catch {
        /* fall through to the manual settle below */
      }
    }
    settle();
  };

  /** Build the result once the recorder has flushed its final chunk. */
  const settle = () => {
    const elapsedMs = startedAt === null ? 0 : env.now() - startedAt;
    const verdict = shouldSendRecording({ elapsedMs, cancelled, minMs: MIN_RECORDING_MS });
    const activeMime = resolveRecordingMimeType({
      probed: mimeType,
      recorderMimeType: recorder?.mimeType || '',
      blobType: chunks[0]?.type || '',
    });

    recorder = null;
    startedAt = null;
    const captured = chunks;
    chunks = [];
    releaseStream();

    const resolve = resolveTake;
    const reject = rejectTake;
    resolveTake = null;
    rejectTake = null;
    finishing = false;

    if (!resolve) return;

    if (verdict.action === 'cancelled') {
      resolve({ cancelled: true, elapsedMs, mimeType: activeMime, blob: null, audioBase64: '' });
      return;
    }

    const BlobImpl = env.Blob ?? (typeof Blob !== 'undefined' ? Blob : null);
    const blob = BlobImpl && captured.length > 0 ? new BlobImpl(captured, { type: activeMime }) : null;

    if (verdict.action === 'tooShort') {
      const tooShort = new Error('recording-too-short');
      tooShort.code = 'tooShort';
      tooShort.elapsedMs = elapsedMs;
      reject?.(tooShort);
      return;
    }

    if (!blob) {
      const empty = new Error('recording-empty');
      empty.code = 'empty';
      empty.elapsedMs = elapsedMs;
      reject?.(empty);
      return;
    }

    blobToBase64(blob, env.FileReader)
      .then((audioBase64) => resolve({
        cancelled: false,
        elapsedMs,
        durationSeconds: elapsedMs / 1000,
        mimeType: activeMime,
        blob,
        audioBase64,
      }))
      .catch((error) => {
        const failed = new Error('recording-read-failed');
        failed.code = 'readFailed';
        failed.cause = error;
        reject?.(failed);
      });
  };

  /**
   * Start a take.
   *
   * @param {{ deviceId?: string }} [params]
   * @returns {Promise<{ mimeType: string, deviceId: string }>}
   */
  const start = async (params = {}) => {
    if (recorder) throw new Error('recorder-already-running');

    const RecorderImpl = env.MediaRecorder;
    const mediaDevices = env.navigator?.mediaDevices;
    if (!RecorderImpl || !mediaDevices?.getUserMedia) {
      const unavailable = new Error('media-devices-unavailable');
      unavailable.name = 'NotSupportedError';
      throw unavailable;
    }

    mimeType = pickSupportedMimeType(
      (candidate) => RecorderImpl.isTypeSupported(candidate),
      AUDIO_MIME_CANDIDATES,
    );

    const requestedDeviceId = typeof params.deviceId === 'string' ? params.deviceId.trim() : '';
    const requestStream = (deviceId) => mediaDevices.getUserMedia({
      audio: buildAudioConstraints(deviceId),
    });

    let grantedStream;
    try {
      grantedStream = await requestStream(requestedDeviceId);
    } catch (error) {
      // A saved USB headset that has been unplugged must not brick the button:
      // one retry on the system default, then surface the real error.
      const canRetry = requestedDeviceId && isStaleDeviceError(error);
      if (!canRetry) throw error;
      grantedStream = await requestStream('');
    }

    stream = grantedStream;
    chunks = [];
    cancelled = false;
    finishing = false;
    level = 0;
    silentSinceMs = null;
    silenceWarned = false;

    const buildRecorder = (withMime) => {
      if (!withMime) return new RecorderImpl(stream);
      try {
        return new RecorderImpl(stream, {
          mimeType: withMime,
          audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        });
      } catch {
        // Some engines reject `audioBitsPerSecond`; retry with the mime alone.
        return new RecorderImpl(stream, { mimeType: withMime });
      }
    };

    recorder = buildRecorder(mimeType);

    takePromise = new Promise((resolve, reject) => {
      resolveTake = resolve;
      rejectTake = reject;
    });

    recorder.ondataavailable = (event) => {
      if (event?.data && (event.data.size > 0 || event.data.size === undefined)) {
        chunks.push(event.data);
      }
    };
    recorder.onstop = () => settle();
    recorder.onerror = (event) => {
      const error = event?.error || new Error('recorder-error');
      teardownTimer();
      teardownAnalyser();
      releaseStream();
      recorder = null;
      finishing = false;
      const reject = rejectTake;
      resolveTake = null;
      rejectTake = null;
      reject?.(error);
    };

    startedAt = env.now();
    // 250 ms slices: the first chunk lands quickly, so a cancelled take has
    // something to discard and a normal take is not one giant allocation.
    recorder.start(250);
    setupAnalyser();

    /**
     * `take` resolves for EVERY exit — user stop, cancel and the 2:00 ceiling.
     * The caller awaits it once, so an auto-stopped take is still delivered.
     */
    takePromise.catch(() => {});

    timerId = env.setInterval(() => {
      const elapsedMs = env.now() - startedAt;
      callbacks.onTick?.({
        elapsedMs,
        progress: Math.min(1, elapsedMs / MAX_RECORDING_MS),
      });
      if (reachedRecordingLimit(elapsedMs)) {
        callbacks.onAutoStop?.({ elapsedMs });
        finish();
      }
    }, TIMER_INTERVAL_MS);

    // Device labels are only populated after permission is granted.
    if (callbacks.onDeviceList) {
      listInputDevices(options.env).then((devices) => {
        if (devices.length > 0) callbacks.onDeviceList(devices);
      });
    }

    // Report the device actually granted (Chromium fills it from the track).
    let grantedDeviceId = requestedDeviceId;
    try {
      grantedDeviceId = stream.getAudioTracks?.()[0]?.getSettings?.().deviceId || requestedDeviceId;
    } catch {
      /* settings unavailable */
    }

    return { mimeType, deviceId: grantedDeviceId, take: takePromise };
  };

  /**
   * Finish the take and hand it to the caller.
   *
   * Returns the SAME promise `start()` handed out, so whichever exit wins
   * (button, ceiling, cancel) the composer's single `await` receives the audio.
   */
  const stop = () => {
    if (!recorder) return Promise.reject(new Error('recorder-not-running'));
    const take = takePromise;
    finish({ cancelled: false });
    return take;
  };

  /** Discard the take without sending anything. */
  const cancel = () => {
    if (!recorder) return;
    finish({ cancelled: true });
  };

  /**
   * Release everything (unmount). Safe to call at any time.
   *
   * A pending take is SETTLED, never abandoned: `MediaRecorder.onstop` fires
   * asynchronously, so dropping the resolver here would leave the caller's
   * `await take` hanging forever and the composer stuck in "recording".
   */
  const dispose = () => {
    teardownTimer();
    teardownAnalyser();

    const resolve = resolveTake;
    const reject = rejectTake;
    resolveTake = null;
    rejectTake = null;

    const wasRunning = !!recorder;
    if (wasRunning) {
      // Detach the handler first: the take is settled below, and a later
      // `onstop` must not settle it a second time.
      recorder.onstop = null;
      recorder.ondataavailable = null;
      recorder.onerror = null;
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          /* already stopped */
        }
      }
    }

    recorder = null;
    startedAt = null;
    finishing = false;
    chunks = [];
    releaseStream();

    if (wasRunning && resolve) {
      resolve({
        cancelled: true,
        elapsedMs: 0,
        mimeType: resolveRecordingMimeType({ probed: mimeType }),
        blob: null,
        audioBase64: '',
      });
    }
    // `reject` is intentionally unused: disposing is not a failure.
    void reject;
  };

  return {
    start,
    stop,
    cancel,
    dispose,
    isRecording,
    getDeviceId: () => {
      try {
        return stream?.getAudioTracks?.()[0]?.getSettings?.().deviceId || '';
      } catch {
        return '';
      }
    },
  };
}

export { describeMicError };
