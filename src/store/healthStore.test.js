import test from 'node:test';
import assert from 'node:assert/strict';
import useHealthStore, {
    deriveHealthState,
    nextPollDelay,
    resolveEngineHealthUrl,
    isOffline,
    shouldShowOfflineBanner,
    bindResumeProbe,
    HEALTH_POLL_INTERVAL_MS,
    HEALTH_MAX_BACKOFF_MS,
    HEALTH_BANNER_MIN_FAILURES,
} from './healthStore.js';

/** Build a fetch stub: `map` decides per-URL what the probe sees. */
const stubFetch = (map) => async (url) => {
    const verdict = map(url);
    if (verdict === 'network-error') throw new Error('Failed to fetch');
    return { ok: verdict === 'ok', status: verdict === 'ok' ? 200 : 503 };
};

const isEngineUrl = (url) => url.endsWith('/health');
const isManagementUrl = (url) => url.endsWith('/public/appversion');

/** Probe without rescheduling, so tests never leave a timer behind. */
const probeOnce = (map) => useHealthStore.getState().probe({ fetchImpl: stubFetch(map), reschedule: false });

const reset = () => useHealthStore.getState().reset();

// ── URL derivation ────────────────────────────────────────────────────────

test('the health URL follows the chat socket host, as http(s)', () => {
    // The probe must track VITE_HL_WS_URL/PORT; a hard-coded port would report
    // "offline" for a healthy engine on any non-default deployment.
    assert.equal(resolveEngineHealthUrl('ws://localhost:28080'), 'http://localhost:28080/health');
    assert.equal(resolveEngineHealthUrl('ws://192.168.1.9:28080/'), 'http://192.168.1.9:28080/health');
    assert.equal(resolveEngineHealthUrl('wss://engine.local:28443'), 'https://engine.local:28443/health');
});

// ── Pure state machine ────────────────────────────────────────────────────

test('deriveHealthState: management failure is offline regardless of the socket', () => {
    for (const socketState of ['idle', 'connected', 'connecting', 'reconnecting', 'error']) {
        assert.equal(
            deriveHealthState({ checking: false, managementOk: false, engineOk: true, socketState }),
            'offline',
        );
        assert.equal(
            deriveHealthState({ checking: false, managementOk: false, engineOk: false, socketState }),
            'offline',
        );
    }
});

test('deriveHealthState: management up but /health down is offline', () => {
    assert.equal(
        deriveHealthState({ checking: false, managementOk: true, engineOk: false, socketState: 'idle' }),
        'offline',
    );
});

test('deriveHealthState: both endpoints up with a dead socket is degraded', () => {
    for (const socketState of ['connecting', 'reconnecting', 'error']) {
        assert.equal(
            deriveHealthState({ checking: false, managementOk: true, engineOk: true, socketState }),
            'degraded',
        );
    }
});

test('deriveHealthState: idle socket is NOT degraded (no conversation open)', () => {
    // The socket only exists while a chat is open, so `idle` on any other tab
    // must not read as a degraded engine.
    assert.equal(
        deriveHealthState({ checking: false, managementOk: true, engineOk: true, socketState: 'idle' }),
        'connected',
    );
    assert.equal(
        deriveHealthState({ checking: false, managementOk: true, engineOk: true, socketState: 'connected' }),
        'connected',
    );
});

test('deriveHealthState: checking wins before any answer exists', () => {
    assert.equal(
        deriveHealthState({ checking: true, managementOk: false, engineOk: false, socketState: 'idle' }),
        'checking',
    );
});

// ── Backoff ladder ────────────────────────────────────────────────────────

test('nextPollDelay: 15s healthy, then doubling to a 120s cap', () => {
    assert.equal(nextPollDelay(0), HEALTH_POLL_INTERVAL_MS);
    assert.equal(nextPollDelay(1), 30000);
    assert.equal(nextPollDelay(2), 60000);
    assert.equal(nextPollDelay(3), HEALTH_MAX_BACKOFF_MS);
    assert.equal(nextPollDelay(9), HEALTH_MAX_BACKOFF_MS);
    // Defensive inputs must not produce NaN delays.
    assert.equal(nextPollDelay(-3), HEALTH_POLL_INTERVAL_MS);
    assert.equal(nextPollDelay(undefined), HEALTH_POLL_INTERVAL_MS);
});

test('isOffline identifies only the offline state', () => {
    assert.equal(isOffline('offline'), true);
    for (const state of ['checking', 'connected', 'degraded']) {
        assert.equal(isOffline(state), false);
    }
});

// ── Store state machine ───────────────────────────────────────────────────

test('boots in checking (no state is claimed before the first answer)', () => {
    reset();
    const state = useHealthStore.getState();
    assert.equal(state.status, 'checking');
    assert.equal(state.lastCheckedAt, null);
});

test('connected → degraded → offline → connected, driven by probe results', async () => {
    reset();

    // Both up, no socket open yet.
    await probeOnce((url) => (isEngineUrl(url) || isManagementUrl(url) ? 'ok' : 'network-error'));
    assert.equal(useHealthStore.getState().status, 'connected');

    // Socket drops to reconnecting: degraded WITHOUT waiting for a poll.
    useHealthStore.getState().setSocketState('reconnecting');
    assert.equal(useHealthStore.getState().status, 'degraded');

    // Socket recovers: connected again, still no poll.
    useHealthStore.getState().setSocketState('connected');
    assert.equal(useHealthStore.getState().status, 'connected');

    // Engine goes away entirely.
    await probeOnce((url) => (isManagementUrl(url) ? 'ok' : 'network-error'));
    assert.equal(useHealthStore.getState().status, 'offline');

    // Management API goes away (the case that blanks every data view).
    await probeOnce(() => 'network-error');
    assert.equal(useHealthStore.getState().status, 'offline');

    // Engine restarts: recovery lands on the next probe, no reload required.
    await probeOnce(() => 'ok');
    assert.equal(useHealthStore.getState().status, 'connected');
    assert.equal(useHealthStore.getState().failures, 0);
});

test('a non-2xx answer is a failure, not a success', async () => {
    reset();
    await probeOnce(() => 'server-error');
    const state = useHealthStore.getState();
    assert.equal(state.status, 'offline');
    assert.equal(state.engineOk, false);
    assert.equal(state.managementOk, false);
});

test('failures climb while down and reset on the first success', async () => {
    reset();
    await probeOnce(() => 'network-error');
    assert.equal(useHealthStore.getState().failures, 1);
    await probeOnce(() => 'network-error');
    assert.equal(useHealthStore.getState().failures, 2);

    await probeOnce(() => 'ok');
    assert.equal(useHealthStore.getState().failures, 0);
});

test('retry re-probes both endpoints immediately and clears the ladder on success', async () => {
    reset();
    await probeOnce(() => 'network-error');
    await probeOnce(() => 'network-error');
    assert.equal(useHealthStore.getState().failures, 2);

    // Retry must re-probe immediately rather than wait out the backoff.
    const originalFetch = globalThis.fetch;
    let probed = 0;
    globalThis.fetch = async () => {
        probed += 1;
        return { ok: true, status: 200 };
    };
    try {
        const status = await useHealthStore.getState().retry();
        assert.equal(status, 'connected');
        assert.equal(probed, 2, 'both endpoints probed');
    } finally {
        globalThis.fetch = originalFetch;
    }

    assert.equal(useHealthStore.getState().failures, 0);
    assert.equal(useHealthStore.getState().status, 'connected');
});

test('start is idempotent so a StrictMode double-invoke cannot double-poll', () => {
    reset();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({ ok: true, status: 200 });
    try {
        useHealthStore.getState().start();
        useHealthStore.getState().start();
        assert.equal(useHealthStore.getState().running, true);
    } finally {
        // Stop clears the pending timer this started.
        useHealthStore.getState().stop();
        globalThis.fetch = originalFetch;
    }
    assert.equal(useHealthStore.getState().running, false);
});

// ── Startup resilience: banner debounce + return-to-page probe ────────────

/** Let a probe's promise chain settle (both fetch promises resolve). */
const flushProbe = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Minimal window/document stand-in: tracks listeners so a leaked mount can be
 * told apart from a properly cleaned one.
 */
function fakeEventTarget(visibilityState = 'visible') {
    const listeners = new Map();
    return {
        visibilityState,
        addEventListener(type, handler) {
            listeners.set(type, [...(listeners.get(type) || []), handler]);
        },
        removeEventListener(type, handler) {
            listeners.set(type, (listeners.get(type) || []).filter((h) => h !== handler));
        },
        emit(type) {
            for (const handler of listeners.get(type) || []) handler();
        },
        listenerCount(type) {
            return (listeners.get(type) || []).length;
        },
    };
}

test('banner stays hidden after one failed probe and appears after the second', async () => {
    reset();

    // The pill is honest immediately: one failure is already Offline.
    await probeOnce(() => 'network-error');
    let state = useHealthStore.getState();
    assert.equal(state.status, 'offline');
    assert.equal(state.failures, 1);
    assert.equal(shouldShowOfflineBanner(state.status, state.failures), false);

    // The second consecutive failure is what earns the persistent banner.
    await probeOnce(() => 'network-error');
    state = useHealthStore.getState();
    assert.equal(state.failures, HEALTH_BANNER_MIN_FAILURES);
    assert.equal(shouldShowOfflineBanner(state.status, state.failures), true);

    // Healthy again: gone, even though the first failure is history.
    await probeOnce(() => 'ok');
    state = useHealthStore.getState();
    assert.equal(state.status, 'connected');
    assert.equal(shouldShowOfflineBanner(state.status, state.failures), false);
});

test('a manual Retry that still fails counts as another failure (banner stays up)', async () => {
    reset();
    await probeOnce(() => 'network-error');
    await probeOnce(() => 'network-error');
    assert.equal(useHealthStore.getState().failures, 2);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
        throw new Error('Failed to fetch');
    };
    try {
        const status = await useHealthStore.getState().retry();
        assert.equal(status, 'offline');
    } finally {
        globalThis.fetch = originalFetch;
    }

    const state = useHealthStore.getState();
    assert.equal(state.failures, 3, 'the retry failure extends the streak');
    assert.equal(shouldShowOfflineBanner(state.status, state.failures), true);
});

test('a returning page re-probes at once only when the last probe failed', async () => {
    reset();
    const doc = fakeEventTarget();
    const win = fakeEventTarget();

    const originalFetch = globalThis.fetch;
    let probed = 0;
    globalThis.fetch = async () => {
        probed += 1;
        return { ok: true, status: 200 };
    };

    const cleanup = bindResumeProbe({ document: doc, window: win });
    try {
        // Not polling yet: a stray event must not start one.
        useHealthStore.setState({ failures: 1 });
        doc.emit('visibilitychange');
        win.emit('focus');
        assert.equal(probed, 0, 'no probe while polling is stopped');

        // Polling, but the last answer was healthy: still nothing to do.
        useHealthStore.setState({ running: true, failures: 0 });
        doc.emit('visibilitychange');
        win.emit('focus');
        assert.equal(probed, 0, 'no probe while healthy');

        // Tab hidden again: the event is not a return.
        useHealthStore.setState({ failures: 1 });
        doc.visibilityState = 'hidden';
        doc.emit('visibilitychange');
        assert.equal(probed, 0, 'hidden visibility is not a return');
        doc.visibilityState = 'visible';

        // Polling after a failure: re-probe immediately (both endpoints).
        doc.emit('visibilitychange');
        assert.equal(probed, 2, 'visibility return probes both endpoints');
        await flushProbe();
        assert.equal(useHealthStore.getState().status, 'connected');
        assert.equal(useHealthStore.getState().failures, 0);

        // And once healthy, focus must not add a probe.
        win.emit('focus');
        assert.equal(probed, 2, 'focus while healthy is a no-op');
    } finally {
        cleanup();
        useHealthStore.getState().stop();
        globalThis.fetch = originalFetch;
    }
});

test('StrictMode mount/unmount/remount leaves one listener pair and one poller', async () => {
    reset();
    const doc = fakeEventTarget();
    const win = fakeEventTarget();

    const originalFetch = globalThis.fetch;
    let probed = 0;
    globalThis.fetch = async () => {
        probed += 1;
        return { ok: true, status: 200 };
    };

    let cleanup = bindResumeProbe({ document: doc, window: win });
    try {
        // First mount, then the StrictMode teardown.
        useHealthStore.getState().start();
        await flushProbe();
        cleanup();
        useHealthStore.getState().stop();
        assert.equal(doc.listenerCount('visibilitychange'), 0);
        assert.equal(win.listenerCount('focus'), 0);

        // Remount: exactly one of each, even though start() runs again.
        cleanup = bindResumeProbe({ document: doc, window: win });
        useHealthStore.getState().start();
        await flushProbe();
        assert.equal(doc.listenerCount('visibilitychange'), 1);
        assert.equal(win.listenerCount('focus'), 1);
        assert.equal(useHealthStore.getState().running, true);

        // One event → one probe (two fetches), not two overlapping pollers.
        probed = 0;
        useHealthStore.setState({ failures: 1 });
        doc.emit('visibilitychange');
        await flushProbe();
        assert.equal(probed, 2, 'a single re-probe, both endpoints');
    } finally {
        cleanup();
        useHealthStore.getState().stop();
        globalThis.fetch = originalFetch;
    }
});
