import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createVoiceRecorder,
  listInputDevices,
} from './recorder.js';
import { MAX_RECORDING_MS } from './recorderUtils.js';

/**
 * These tests exist because three of the four failure modes in Task 04-1 are
 * invisible in a browser until a user hits them:
 *   - an auto-stop at 2:00 that resolves nobody's promise (audio silently lost)
 *   - a sub-0.5 s tap becoming an empty bubble
 *   - a saved but unplugged device bricking the mic button
 * The browser is injected through `env`, so none of this needs a real device.
 */

/* ── Fakes ───────────────────────────────────────────────────────────── */

/** Deterministic clock driving both the ceiling timer and the level meter. */
function makeClock() {
  let now = 0;
  let nextId = 0;
  const timers = new Map();

  return {
    now: () => now,
    setInterval(fn, ms) {
      nextId += 1;
      timers.set(nextId, { fn, period: ms, next: now + ms, once: false });
      return nextId;
    },
    clearInterval(id) {
      timers.delete(id);
    },
    setTimeout(fn, ms) {
      nextId += 1;
      timers.set(nextId, { fn, period: ms, next: now + ms, once: true });
      return nextId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    /** Fire every due timer in time order, then land exactly on `now + delta`. */
    advance(delta) {
      const target = now + delta;
      for (;;) {
        let dueId = null;
        let dueTimer = null;
        for (const [id, timer] of timers) {
          if (timer.next <= target && (!dueTimer || timer.next < dueTimer.next)) {
            dueId = id;
            dueTimer = timer;
          }
        }
        if (dueId === null) break;
        now = dueTimer.next;
        if (dueTimer.once) timers.delete(dueId);
        else dueTimer.next += dueTimer.period;
        dueTimer.fn();
      }
      now = target;
    },
    pendingTimers: () => timers.size,
  };
}

class FakeBlob {
  constructor(parts = [], options = {}) {
    this.parts = parts;
    this.type = options.type || '';
    this.size = parts.reduce((total, part) => total + (part?.length || 0), 0);
  }
}

/** Flatten a FakeBlob's parts, recursing into nested FakeBlobs like the real Blob does. */
function flattenParts(parts) {
  return parts
    .map((part) => (part instanceof FakeBlob ? flattenParts(part.parts) : String(part ?? '')))
    .join('');
}

class FakeFileReader {
  readAsDataURL(blob) {
    // Recursion matters: the recorder builds a Blob from the recorder's own
    // chunk Blobs, exactly as the browser does.
    const payload = flattenParts(blob.parts || []);
    const base64 = Buffer.from(payload, 'utf8').toString('base64');
    this.result = `data:${blob.type};base64,${base64}`;
    this.onload?.();
  }
}

/**
 * Minimal MediaRecorder.
 *
 * Emits one data chunk on `stop()`, which is enough to model the real flush.
 */
function makeRecorderClass(supported) {
  return class FakeMediaRecorder {
    static isTypeSupported(mime) {
      return supported.includes(mime);
    }

    constructor(stream, options = {}) {
      this.stream = stream;
      this.mimeType = options.mimeType || '';
      this.audioBitsPerSecond = options.audioBitsPerSecond;
      this.state = 'inactive';
      this.ondataavailable = null;
      this.onstop = null;
      this.onerror = null;
    }

    start(timeslice) {
      this.timeslice = timeslice;
      this.state = 'recording';
    }

    stop() {
      if (this.state === 'inactive') throw new Error('already-inactive');
      this.state = 'inactive';
      this.ondataavailable?.({ data: new FakeBlob(['voice-bytes'], { type: this.mimeType }) });
      this.onstop?.();
    }
  };
}

/** Stream whose tracks report the granted device and can be inspected later. */
function makeStream(deviceId) {
  const track = {
    stopped: false,
    stop() {
      this.stopped = true;
    },
    getSettings: () => ({ deviceId }),
  };
  return {
    tracks: [track],
    getTracks: () => [track],
    getAudioTracks: () => [track],
  };
}

/* ── 1. The 2:00 ceiling delivers the take ───────────────────────────── */

test('the 2:00 ceiling stops the take AND resolves it with audio', async () => {
  const clock = makeClock();
  const events = [];
  let currentDevice = 'mic-1';

  const env = {
    now: clock.now,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    MediaRecorder: makeRecorderClass(['audio/webm;codecs=opus']),
    Blob: FakeBlob,
    FileReader: FakeFileReader,
    navigator: {
      mediaDevices: {
        getUserMedia: async () => makeStream(currentDevice),
        enumerateDevices: async () => [],
      },
    },
  };

  const recorder = createVoiceRecorder({
    env,
    onAutoStop: ({ elapsedMs }) => events.push(['autoStop', elapsedMs]),
  });

  const { take, mimeType } = await recorder.start({ deviceId: '' });
  assert.equal(mimeType, 'audio/webm;codecs=opus');

  // Nothing yet — the take is still running.
  clock.advance(MAX_RECORDING_MS - 100);
  assert.equal(recorder.isRecording(), true);

  // Cross the ceiling: the driver stops itself.
  clock.advance(200);
  assert.deepEqual(events, [['autoStop', MAX_RECORDING_MS]]);

  // THE REGRESSION THAT MATTERS: the audio must still arrive.
  const result = await take;
  assert.equal(result.cancelled, false);
  assert.equal(result.audioBase64, Buffer.from('voice-bytes', 'utf8').toString('base64'));
  assert.equal(result.mimeType, 'audio/webm;codecs=opus');
  assert.equal(Math.round(result.durationSeconds), MAX_RECORDING_MS / 1000);

  // Timers and the analyser must be gone — no leak after an auto-stop.
  assert.equal(clock.pendingTimers(), 0);
});

/* ── 2. Cancel vs send ───────────────────────────────────────────────── */

function makeEnv(clock, { supported = ['audio/webm'], devices = [] } = {}) {
  return {
    now: clock.now,
    setInterval: clock.setInterval,
    clearInterval: clock.clearInterval,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    MediaRecorder: makeRecorderClass(supported),
    Blob: FakeBlob,
    FileReader: FakeFileReader,
    navigator: {
      mediaDevices: {
        getUserMedia: async () => makeStream('mic-1'),
        enumerateDevices: async () => devices,
      },
    },
  };
}

test('a manual stop sends the take', async () => {
  const clock = makeClock();
  const recorder = createVoiceRecorder({ env: makeEnv(clock) });

  const { take } = await recorder.start();
  clock.advance(2000);
  await recorder.stop();

  const result = await take;
  assert.equal(result.cancelled, false);
  assert.ok(result.audioBase64.length > 0);
  assert.equal(clock.pendingTimers(), 0);
});

test('cancel discards the take and sends nothing', async () => {
  const clock = makeClock();
  const recorder = createVoiceRecorder({ env: makeEnv(clock) });

  const { take } = await recorder.start();
  clock.advance(5000);
  recorder.cancel();

  const result = await take;
  assert.equal(result.cancelled, true);
  assert.equal(result.blob, null);
  assert.equal(result.audioBase64, '');
});

test('a 0.2 s accidental tap is rejected as too short, not sent', async () => {
  const clock = makeClock();
  const recorder = createVoiceRecorder({ env: makeEnv(clock) });

  const { take } = await recorder.start();
  clock.advance(200);

  let thrown = null;
  try {
    await recorder.stop();
    await take;
  } catch (error) {
    thrown = error;
  }

  assert.ok(thrown, 'a sub-0.5 s take must reject');
  assert.equal(thrown.code, 'tooShort');
  assert.equal(thrown.elapsedMs, 200);
});

/* ── 3. MIME + device contract ───────────────────────────────────────── */

test('the negotiated type is what the recorder is constructed with', async () => {
  const clock = makeClock();
  // Only the ogg candidate is supported here, as on some Firefox builds.
  const env = makeEnv(clock, { supported: ['audio/ogg;codecs=opus'] });
  const recorder = createVoiceRecorder({ env });

  const { mimeType } = await recorder.start();
  assert.equal(mimeType, 'audio/ogg;codecs=opus');

  const result = await (async () => {
    clock.advance(1000);
    await recorder.stop();
    return null;
  })();
  assert.equal(result, null);
});

test('a saved device is requested as an exact constraint', async () => {
  const clock = makeClock();
  const requested = [];
  const env = makeEnv(clock);
  env.navigator.mediaDevices.getUserMedia = async (constraints) => {
    requested.push(constraints);
    return makeStream('usb-mic');
  };

  const recorder = createVoiceRecorder({ env });
  const started = await recorder.start({ deviceId: 'usb-mic' });

  assert.deepEqual(requested[0], { audio: { deviceId: { exact: 'usb-mic' } } });
  assert.equal(started.deviceId, 'usb-mic');
});

test('an unplugged saved device retries once on the system default', async () => {
  const clock = makeClock();
  const requested = [];
  const env = makeEnv(clock);
  env.navigator.mediaDevices.getUserMedia = async (constraints) => {
    requested.push(constraints);
    if (constraints.audio?.deviceId?.exact) {
      const error = new Error('no such device');
      error.name = 'OverconstrainedError';
      throw error;
    }
    return makeStream('builtin');
  };

  const recorder = createVoiceRecorder({ env });
  const started = await recorder.start({ deviceId: 'unplugged-usb' });

  assert.equal(requested.length, 2, 'must retry exactly once');
  assert.deepEqual(requested[1], { audio: true });
  assert.equal(started.deviceId, 'builtin');
});

test('a permission denial propagates without a retry', async () => {
  const clock = makeClock();
  let calls = 0;
  const env = makeEnv(clock);
  env.navigator.mediaDevices.getUserMedia = async () => {
    calls += 1;
    const error = new Error('denied');
    error.name = 'NotAllowedError';
    throw error;
  };

  const recorder = createVoiceRecorder({ env });
  await assert.rejects(() => recorder.start({ deviceId: 'usb-mic' }), /denied/);
  assert.equal(calls, 1, 'a denial is not a stale device');
});

/* ── 4. Level meter + teardown ───────────────────────────────────────── */

test('the level meter publishes levels and the AudioContext is closed on stop', async () => {
  const clock = makeClock();
  const levels = [];
  let contextClosed = false;
  let disconnected = false;

  class FakeAnalyser {
    constructor() {
      this.fftSize = 512;
    }

    getByteTimeDomainData(buffer) {
      // Loud signal: alternate 128±100 so RMS is well above the silence floor.
      for (let i = 0; i < buffer.length; i += 1) buffer[i] = i % 2 === 0 ? 228 : 28;
    }

    disconnect() {
      disconnected = true;
    }
  }

  class FakeAudioContext {
    createMediaStreamSource() {
      return { connect: () => {} };
    }

    createAnalyser() {
      return new FakeAnalyser();
    }

    close() {
      contextClosed = true;
      return Promise.resolve();
    }
  }

  const env = { ...makeEnv(clock), AudioContext: FakeAudioContext };
  const recorder = createVoiceRecorder({ env, onLevel: (value) => levels.push(value) });

  const { take } = await recorder.start();
  clock.advance(400);

  assert.ok(levels.length > 0, 'the meter must publish while recording');
  assert.ok(levels.some((value) => value > 0), 'a loud signal must read above zero');

  clock.advance(1000);
  await recorder.stop();
  await take;

  // Memory-leak guard: the context must be closed, not just dropped.
  assert.equal(contextClosed, true);
  assert.equal(disconnected, true);
  assert.equal(clock.pendingTimers(), 0);
});

test('a silent microphone never produces a level and warns once', async () => {
  const clock = makeClock();
  const levels = [];
  let silenceWarnings = 0;

  class SilentAnalyser {
    constructor() {
      this.fftSize = 512;
    }

    // Every sample dead-centre: digital silence.
    getByteTimeDomainData(buffer) {
      buffer.fill(128);
    }

    disconnect() {}
  }

  class FakeAudioContext {
    createMediaStreamSource() {
      return { connect: () => {} };
    }

    createAnalyser() {
      return new SilentAnalyser();
    }

    close() {
      return Promise.resolve();
    }
  }

  const env = { ...makeEnv(clock), AudioContext: FakeAudioContext };
  const recorder = createVoiceRecorder({
    env,
    onLevel: (value) => levels.push(value),
    onSilence: () => {
      silenceWarnings += 1;
    },
  });

  const { take } = await recorder.start();
  clock.advance(6000);

  assert.ok(levels.every((value) => value === 0), 'a silent mic must show no level');
  assert.equal(silenceWarnings, 1, 'the warning fires exactly once per take');

  await recorder.stop();
  await take;
});

test('dispose during a take releases the microphone AND settles the take', async () => {
  const clock = makeClock();
  let stream = null;
  const env = makeEnv(clock);
  env.navigator.mediaDevices.getUserMedia = async () => {
    stream = makeStream('mic-1');
    return stream;
  };

  const recorder = createVoiceRecorder({ env });
  const { take } = await recorder.start();
  clock.advance(3000);
  recorder.dispose();

  assert.equal(stream.tracks[0].stopped, true);
  assert.equal(clock.pendingTimers(), 0);

  // THE HANG THIS GUARDS AGAINST: `MediaRecorder.onstop` is asynchronous, so
  // dropping the resolver on dispose would leave the composer awaiting forever.
  const result = await take;
  assert.equal(result.cancelled, true);
  assert.equal(result.audioBase64, '');
});

test('cancel settles the take without waiting for a second onstop', async () => {
  const clock = makeClock();
  const recorder = createVoiceRecorder({ env: makeEnv(clock) });

  const { take } = await recorder.start();
  clock.advance(4000);
  recorder.cancel();

  // Already settled — resolving twice must not throw or hang.
  const result = await take;
  assert.equal(result.cancelled, true);
  expectNoTimers(clock);
});

/** Small helper so the intent reads at the call site. */
function expectNoTimers(clock) {
  assert.equal(clock.pendingTimers(), 0, 'no timer may outlive the take');
}

/* ── 5. Device listing ───────────────────────────────────────────────── */

test('listInputDevices returns audio inputs and never throws', async () => {
  const devices = await listInputDevices({
    navigator: {
      mediaDevices: {
        enumerateDevices: async () => [
          { deviceId: 'default', kind: 'audioinput', label: 'Default' },
          { deviceId: 'cam', kind: 'videoinput', label: 'Cam' },
          { deviceId: 'usb', kind: 'audioinput', label: 'USB' },
        ],
      },
    },
  });
  assert.deepEqual(devices.map((d) => d.deviceId), ['default', 'usb']);

  // No mediaDevices at all.
  assert.deepEqual(await listInputDevices({ navigator: {} }), []);
  // enumerateDevices throwing.
  const throwing = {
    navigator: { mediaDevices: { enumerateDevices: async () => { throw new Error('nope'); } } },
  };
  assert.deepEqual(await listInputDevices(throwing), []);
});
