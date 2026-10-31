/**
 * Desktop Chat — voice-note recorder logic (Task 04-1).
 *
 * Every function here is pure and free of browser globals so it can be
 * unit-tested with `node --test` (the same constraint `chatInputUtils.js` and
 * `chatStoreUtils.js` follow). `services/audio/recorder.js` is the impure
 * driver over these helpers; `ChatInput.jsx` is a thin view over both.
 *
 * Task 04-1 has five parts and each has a home here:
 *   1. the 120 s ceiling + timer/ring maths — {@link MAX_RECORDING_MS},
 *      {@link formatDuration}, {@link recordingProgress}, {@link ringGeometry}
 *   2. MIME negotiation — {@link AUDIO_MIME_CANDIDATES},
 *      {@link pickSupportedMimeType}, {@link resolveRecordingMimeType}
 *   3. device selection — {@link selectInputDevices}, {@link deviceLabel},
 *      {@link buildAudioConstraints}, {@link isStaleDeviceError}
 *   4. the level meter maths — {@link levelFromTimeDomain}, {@link smoothLevel},
 *      {@link isSilentLevel}
 *   5. cancel vs send — {@link MIN_RECORDING_MS}, {@link shouldSendRecording},
 *      {@link describeMicError}
 */

/* ── 1. Duration ceiling, timer and progress ring ────────────────────── */

/**
 * Hard recording ceiling in milliseconds.
 *
 * Android stops a voice note at 2:00 and the engine's STT providers are tuned
 * around short utterances; an unbounded browser recording is also the easiest
 * way to build a 40 MB base64 frame that the socket then refuses.
 */
export const MAX_RECORDING_MS = 120000;

/**
 * Shortest recording that may be SENT.
 *
 * A tap on the mic button produces a ~0.2 s blip that transcribes to nothing and
 * leaves an empty audio bubble in the timeline. Below this the take is
 * discarded with an explanation instead of being sent.
 */
export const MIN_RECORDING_MS = 500;

/** Timer tick while recording. 100 ms keeps the ring smooth without churn. */
export const TIMER_INTERVAL_MS = 100;

/** Poll cadence of the level meter (rAF is unavailable in the test env). */
export const LEVEL_INTERVAL_MS = 100;

/** RMS below this counts as silence (roughly −34 dBFS after gain). */
export const SILENT_LEVEL_THRESHOLD = 0.015;

/** How long a recording may stay silent before the user is warned once. */
export const SILENCE_WARN_AFTER_MS = 3000;

/** RMS gain: speech peaks around 0.1–0.3 raw, which would look like a dead bar. */
export const LEVEL_GAIN = 3.2;

/**
 * Format elapsed milliseconds as `m:ss`.
 *
 * Clamped rather than throwing: the timer reads this every tick, so a stray
 * negative or NaN must render `0:00` instead of `NaN:NaN`.
 *
 * @param {number} ms
 * @returns {string} e.g. `0:07`, `1:59`, `2:00`
 */
export function formatDuration(ms) {
    const safe = Number.isFinite(ms) ? Math.max(0, ms) : 0;
    const totalSeconds = Math.floor(safe / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Progress of the current take towards the ceiling, clamped to 0..1.
 *
 * @param {number} elapsedMs
 * @param {number} [maxMs]
 * @returns {number}
 */
export function recordingProgress(elapsedMs, maxMs = MAX_RECORDING_MS) {
    const max = Number.isFinite(maxMs) && maxMs > 0 ? maxMs : MAX_RECORDING_MS;
    const elapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0;
    if (elapsed <= 0) return 0;
    if (elapsed >= max) return 1;
    return elapsed / max;
}

/**
 * SVG geometry for the progress ring drawn inside the mic button.
 *
 * The consumer feeds `strokeDasharray`/`strokeDashoffset` straight onto a
 * `<circle>`; doing the `2πr` maths here keeps the geometry unit-testable and
 * out of the render path.
 *
 * @param {number} progress 0..1
 * @param {number} [radius]
 * @returns {{ circumference: number, dashArray: string, dashOffset: number, fraction: number }}
 */
export function ringGeometry(progress, radius = 15.5) {
    const r = Number.isFinite(radius) && radius > 0 ? radius : 15.5;
    const fraction = recordingProgress(progress * MAX_RECORDING_MS);
    const circumference = 2 * Math.PI * r;
    return {
        circumference,
        dashArray: `${circumference} ${circumference}`,
        dashOffset: circumference * (1 - fraction),
        fraction,
    };
}

/**
 * Has the take reached the automatic-stop ceiling?
 *
 * `>=` rather than `>`: the timer fires at 100 ms boundaries, so an exact hit is
 * the common case and a strict comparison would overshoot a full tick.
 *
 * @param {number} elapsedMs
 * @param {number} [maxMs]
 * @returns {boolean}
 */
export function reachedRecordingLimit(elapsedMs, maxMs = MAX_RECORDING_MS) {
    const max = Number.isFinite(maxMs) && maxMs > 0 ? maxMs : MAX_RECORDING_MS;
    return Number.isFinite(elapsedMs) && elapsedMs >= max;
}

/* ── 2. MIME negotiation ─────────────────────────────────────────────── */

/**
 * Candidate recording types in preference order.
 *
 * Order matters and is deliberate:
 *   - `audio/webm;codecs=opus` is what Chrome/Edge on Windows actually produce
 *     and what OpenAI/Whisper-style providers decode most reliably;
 *   - bare `audio/webm` is the fallback for engines that reject the parameter;
 *   - `audio/ogg;codecs=opus` covers Firefox;
 *   - `audio/mp4` covers Safari/WKWebView.
 *
 * The declared value is sent on the wire as `audio_type`, so it must be the
 * type the recorder ACTUALLY used — never a hardcoded guess.
 */
export const AUDIO_MIME_CANDIDATES = Object.freeze([
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
]);

/**
 * Last-resort type when nothing probes as supported.
 *
 * Returning `''` would make `MediaRecorder` choose its default and leave
 * `blob.type` empty, which is exactly the case that puts an unusable
 * `audio_type` on the wire.
 */
export const FALLBACK_AUDIO_MIME = 'audio/webm';

/**
 * Pick the first supported recording type.
 *
 * @param {(mime: string) => boolean} isTypeSupported - typically
 *   `(m) => MediaRecorder.isTypeSupported(m)`. A throwing probe is treated as
 *   "not supported" so one bad candidate cannot abort negotiation.
 * @param {string[]} [candidates]
 * @returns {string} the winning type, or `''` when none probe as supported
 */
export function pickSupportedMimeType(isTypeSupported, candidates = AUDIO_MIME_CANDIDATES) {
    if (typeof isTypeSupported !== 'function') return '';
    for (const candidate of Array.isArray(candidates) ? candidates : []) {
        try {
            if (isTypeSupported(candidate)) return candidate;
        } catch {
            /* a probe that throws cannot be claimed as supported */
        }
    }
    return '';
}

/**
 * Resolve the type to construct the recorder with AND to send on the wire.
 *
 * Preference is the probed value; when nothing probes (old WebView, unusual
 * build) the recorder's own `mimeType` is more truthful than a constant, and the
 * constant is the final floor so the wire never carries `''`.
 *
 * @param {{ probed?: string, recorderMimeType?: string, blobType?: string }} sources
 * @returns {string}
 */
export function resolveRecordingMimeType({ probed = '', recorderMimeType = '', blobType = '' } = {}) {
    const usable = [probed, recorderMimeType, blobType]
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0);
    return usable[0] || FALLBACK_AUDIO_MIME;
}

/* ── 3. Input device selection ───────────────────────────────────────── */

/** Sentinel used by `getUserMedia` for "whatever the system picks". */
export const DEFAULT_DEVICE_ID = '';

/**
 * Normalise `enumerateDevices()` output into the audio inputs worth showing.
 *
 * The system pseudo-device (`deviceId: 'default'`) is hoisted to the front: it
 * is the only entry that survives a headset being plugged in, so it belongs
 * above hardware that may disappear between sessions.
 *
 * Labels are empty until the user grants permission — the caller supplies the
 * placeholder copy, which is why `label` is left untouched here.
 *
 * @param {Array<{deviceId?: string, kind?: string, label?: string}>} devices
 * @returns {Array<{ deviceId: string, label: string, isDefault: boolean }>}
 */
export function selectInputDevices(devices) {
    const inputs = (Array.isArray(devices) ? devices : [])
        .filter((device) => device && device.kind === 'audioinput')
        .map((device) => {
            const deviceId = typeof device.deviceId === 'string' ? device.deviceId : '';
            return {
                deviceId,
                label: typeof device.label === 'string' ? device.label : '',
                isDefault: deviceId === 'default' || deviceId === DEFAULT_DEVICE_ID,
            };
        });

    // Hoist the system default; `filter` keeps the original order otherwise.
    return [
        ...inputs.filter((device) => device.isDefault),
        ...inputs.filter((device) => !device.isDefault),
    ];
}

/**
 * Display label for a device row, with a stable numeric fallback.
 *
 * @param {{ label?: string, isDefault?: boolean, deviceId?: string }} device
 * @param {(key: string, options?: object) => string} t - i18next translator
 * @param {number} index - position in the list, used for "Microphone 2"
 * @returns {string}
 */
export function deviceLabel(device, t, index = 0) {
    const label = device && typeof device.label === 'string' ? device.label.trim() : '';
    if (label) return label;
    if (device && (device.isDefault || device.deviceId === DEFAULT_DEVICE_ID)) {
        return typeof t === 'function' ? t('chat:input.micDeviceDefault') : 'System default microphone';
    }
    return typeof t === 'function'
        ? t('chat:input.micDeviceN', { index: index + 1 })
        : `Microphone ${index + 1}`;
}

/**
 * Build the `getUserMedia` audio constraint for a chosen device.
 *
 * `exact` is required by the task: a non-exact id lets the browser silently
 * substitute another microphone, and the user then believes the picker is
 * broken. The trade-off is an `OverconstrainedError` when the saved device is
 * unplugged — handled by {@link isStaleDeviceError}.
 *
 * An empty/absent id yields `true` (system default) rather than an empty
 * `exact`, which some Chromium builds reject outright.
 *
 * @param {string} [deviceId]
 * @returns {boolean|{deviceId: {exact: string}}}
 */
export function buildAudioConstraints(deviceId) {
    const id = typeof deviceId === 'string' ? deviceId.trim() : '';
    if (!id) return true;
    return { deviceId: { exact: id } };
}

/**
 * Is this failure caused by a saved device that no longer exists?
 *
 * A persisted `inputDeviceId` outlives the USB headset it names. Treating that
 * as a hard "microphone unavailable" error would brick the mic button until the
 * user finds the picker, so the caller retries once with the system default.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
export function isStaleDeviceError(error) {
    const name = error && typeof error.name === 'string' ? error.name : '';
    return name === 'OverconstrainedError' || name === 'NotFoundError';
}

/* ── 4. Level meter ──────────────────────────────────────────────────── */

/**
 * Convert an `AnalyserNode.getByteTimeDomainData` buffer into a 0..1 level.
 *
 * RMS of the centred waveform, scaled by {@link LEVEL_GAIN}: raw speech RMS sits
 * near 0.05–0.2, which on an unscaled bar reads as "the mic is dead".
 *
 * @param {Uint8Array|number[]|null} bytes - unsigned 8-bit samples (128 = silence)
 * @returns {number} 0..1
 */
export function levelFromTimeDomain(bytes) {
    if (!bytes || typeof bytes.length !== 'number' || bytes.length === 0) return 0;
    let sum = 0;
    for (let i = 0; i < bytes.length; i += 1) {
        const sample = (bytes[i] - 128) / 128;
        sum += sample * sample;
    }
    const rms = Math.sqrt(sum / bytes.length);
    const scaled = rms * LEVEL_GAIN;
    if (!Number.isFinite(scaled) || scaled <= 0) return 0;
    return scaled > 1 ? 1 : scaled;
}

/**
 * Asymmetric smoothing: rise fast, fall slow.
 *
 * A symmetric filter makes the bar lag behind speech onset (reads as "not
 * working") and flicker to zero between syllables. Fast attack / slow release
 * looks like every other level meter the user has seen.
 *
 * @param {number} previous
 * @param {number} next
 * @param {{ attack?: number, release?: number }} [options]
 * @returns {number} 0..1
 */
export function smoothLevel(previous, next, options = {}) {
    const attack = Number.isFinite(options.attack) ? options.attack : 0.65;
    const release = Number.isFinite(options.release) ? options.release : 0.2;
    const prev = Number.isFinite(previous) ? Math.max(0, Math.min(1, previous)) : 0;
    const target = Number.isFinite(next) ? Math.max(0, Math.min(1, next)) : 0;
    const factor = target > prev ? attack : release;
    return prev + (target - prev) * factor;
}

/**
 * Does this level read as "no sound is arriving"?
 *
 * @param {number} level 0..1
 * @param {number} [threshold]
 * @returns {boolean}
 */
export function isSilentLevel(level, threshold = SILENT_LEVEL_THRESHOLD) {
    const value = Number.isFinite(level) ? level : 0;
    const limit = Number.isFinite(threshold) ? threshold : SILENT_LEVEL_THRESHOLD;
    return value < limit;
}

/**
 * Track continuous silence and decide when to warn — once per take.
 *
 * @param {{ elapsedMs: number, silentSinceMs: number|null, warned: boolean, level: number, threshold?: number, warnAfterMs?: number }} state
 * @returns {{ silentSinceMs: number|null, warn: boolean }}
 */
export function advanceSilenceWatch(state) {
    const {
        elapsedMs = 0,
        silentSinceMs = null,
        warned = false,
        level = 0,
        threshold = SILENT_LEVEL_THRESHOLD,
        warnAfterMs = SILENCE_WARN_AFTER_MS,
    } = state || {};

    if (!isSilentLevel(level, threshold)) {
        return { silentSinceMs: null, warn: false };
    }

    const since = Number.isFinite(silentSinceMs) ? silentSinceMs : elapsedMs;
    const silentFor = elapsedMs - since;
    if (!warned && silentFor >= warnAfterMs) {
        return { silentSinceMs: since, warn: true };
    }
    return { silentSinceMs: since, warn: false };
}

/* ── 5. Cancel vs send ───────────────────────────────────────────────── */

/**
 * Decide what to do with a finished take.
 *
 * Three outcomes, and the UI treats each differently:
 *   - `send`      → hand the audio to the caller
 *   - `tooShort`  → discard, explain (a 0.2 s tap must not become a message)
 *   - `cancelled` → discard silently (the user asked for it)
 *
 * @param {{ elapsedMs?: number, cancelled?: boolean, minMs?: number }} result
 * @returns {{ action: 'send'|'tooShort'|'cancelled', elapsedMs: number }}
 */
export function shouldSendRecording(result = {}) {
    const elapsedMs = Number.isFinite(result.elapsedMs) ? Math.max(0, result.elapsedMs) : 0;
    if (result.cancelled) return { action: 'cancelled', elapsedMs };
    const minMs = Number.isFinite(result.minMs) ? result.minMs : MIN_RECORDING_MS;
    if (elapsedMs < minMs) return { action: 'tooShort', elapsedMs };
    return { action: 'send', elapsedMs };
}

/**
 * Classify a `getUserMedia` failure into the copy the composer shows.
 *
 * Kept here (not in the view) so Task 04-2's richer diagnostics can reuse the
 * same taxonomy instead of inventing a second one.
 *
 * Deliberately a pure function of the error object — it never inspects the
 * global `navigator`. Probing a global made the result depend on the host
 * (Node ships a `navigator` without `mediaDevices`, which silently turned every
 * unknown failure into `unavailable`). The "there is no `mediaDevices` at all"
 * case is signalled by the caller throwing a `NotSupportedError` instead.
 *
 * @param {unknown} error
 * @returns {'denied'|'notFound'|'inUse'|'unavailable'|'unknown'}
 */
export function describeMicError(error) {
    const name = error && typeof error.name === 'string' ? error.name : '';
    switch (name) {
        case 'NotAllowedError':
        case 'SecurityError':
        case 'PermissionDeniedError':
            return 'denied';
        case 'NotFoundError':
        case 'DevicesNotFoundError':
        case 'OverconstrainedError':
            return 'notFound';
        case 'NotReadableError':
        case 'TrackStartError':
        case 'AbortError':
            return 'inUse';
        // Insecure context / stripped WebView: the API is absent entirely.
        case 'NotSupportedError':
            return 'unavailable';
        default:
            return 'unknown';
    }
}

/**
 * i18n key for a {@link describeMicError} reason.
 *
 * @param {string} reason
 * @returns {string}
 */
export function micErrorKey(reason) {
    switch (reason) {
        case 'denied':
            return 'chat:input.micDenied';
        case 'notFound':
            return 'chat:input.micNotFound';
        case 'inUse':
            return 'chat:input.micInUse';
        case 'unavailable':
            return 'chat:input.micUnavailable';
        default:
            return 'chat:input.recordingFailed';
    }
}
