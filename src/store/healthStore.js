import { create } from 'zustand';
import { getManagementApiUrl, getPublicApiPath } from '../services/management/baseService.js';
import { resolveWebSocketUrl } from '../services/chat/chatSocketService.js';

/**
 * Engine health — the shell's answer to "is the engine actually there?".
 *
 * Before this store, a dead engine and an empty database looked identical: every
 * view renders its empty state, so the user cannot tell *"no characters"* from
 * *"the engine is down"* (plan task 01-6).
 *
 * Two independent probes, both cheap and unauthenticated:
 *
 * 1. **Event server liveness** — `GET /health` on the event server. That route
 *    is served by [`eventserver/request.go`](../../../eventserver/request.go)
 *    before any auth or session logic, so it answers even when the database or
 *    a module is broken. This is the endpoint the task refers to as "already
 *    exists". It lives on the **event server** port (28080 by default), NOT the
 *    management API port — a distinction worth keeping in mind, because the two
 *    servers come up and go down independently.
 * 2. **Management API reachability** — `GET /public/appversion`, which needs no
 *    admin key. This is the API every data view reads through, so its absence
 *    is what makes the app show stale/empty data.
 *
 * The **live chat socket** is a third input, but it is deliberately NOT fetched
 * here: the chat socket only exists while a conversation is open
 * ([`chatStore.connectSocket`](./chatStore.js)), so an `idle` socket on the
 * Settings tab means "no socket expected", not "socket down". The shell feeds
 * the real state in through {@link useHealthStore.setSocketState} and this
 * module stays free of a `chatStore` import (which also keeps it unit-testable
 * without the service layer's `import.meta.env` reads).
 *
 * Resulting state machine — see {@link deriveHealthState}:
 *
 * | management | /health | chat socket          | state      |
 * |------------|---------|----------------------|------------|
 * | down       | any     | any                  | `offline`  |
 * | up         | down    | any                  | `offline`  |
 * | up         | up      | connecting/reconnect | `degraded` |
 * | up         | up      | idle or connected    | `connected`|
 *
 * `checking` is a transient fourth value used only before the first probe
 * resolves (and while a manual Retry runs): claiming "Connected" before the
 * first answer would be a guess, and claiming "Offline" would flash a banner on
 * every boot.
 *
 * Polling is a self-rescheduling timeout rather than an interval, so the delay
 * can grow: {@link HEALTH_POLL_INTERVAL_MS} while healthy (the task's 15 s) and
 * {@link nextPollDelay}'s exponential backoff up to
 * {@link HEALTH_MAX_BACKOFF_MS} while failing, so a stopped engine is not
 * hammered by a tab left open overnight. The first success resets the ladder,
 * which is what makes recovery land within one poll.
 */

/** Healthy poll cadence (the plan's 15 s). */
export const HEALTH_POLL_INTERVAL_MS = 15000;

/** Ceiling for the failure backoff — a dead engine is probed at most this often. */
export const HEALTH_MAX_BACKOFF_MS = 120000;

/** Per-probe request timeout. Shorter than the healthy interval by design. */
export const HEALTH_PROBE_TIMEOUT_MS = 4000;

/** States a chat socket can be in that mean "live events are NOT flowing". */
export const SOCKET_DOWN_STATES = ['connecting', 'reconnecting', 'error'];

/** The three user-visible states, plus the transient `checking`. */
export const HEALTH_STATES = ['checking', 'connected', 'degraded', 'offline'];

/**
 * Resolve the event server's `/health` URL.
 *
 * Derived from the chat socket URL rather than hard-coded, so a deployment that
 * moves the engine (VITE_HL_WS_URL / VITE_HL_WS_PORT) moves the probe with it —
 * probing a stale hard-coded port would report `offline` for a healthy engine.
 *
 * @param {string} [wsUrl] - defaults to {@link resolveWebSocketUrl}
 * @returns {string} an http(s) URL
 */
export function resolveEngineHealthUrl(wsUrl) {
    const base = wsUrl || resolveWebSocketUrl();
    const httpBase = base.replace(/^ws(s?):\/\//i, 'http$1://');
    return `${httpBase.replace(/\/+$/, '')}/health`;
}

/**
 * Resolve the management API's unauthenticated version route (reachability probe).
 * @returns {string}
 */
export function resolveManagementHealthUrl() {
    return `${getManagementApiUrl()}${getPublicApiPath()}/appversion`;
}

/**
 * Pure state machine (exported for `healthStore.test.js`).
 *
 * @param {Object} input
 * @param {boolean} input.checking - no result yet, or a manual retry is running
 * @param {boolean} input.managementOk - management API answered
 * @param {boolean} input.engineOk - event server `/health` answered
 * @param {string} input.socketState - `idle|connecting|connected|reconnecting|error`
 * @returns {'checking'|'connected'|'degraded'|'offline'}
 */
export function deriveHealthState({ checking, managementOk, engineOk, socketState }) {
    // Never assert a state before the first answer (or during a manual retry
    // that follows a failed probe) — the checking pill is honest, a wrong
    // "connected"/"offline" is not.
    if (checking) return 'checking';
    if (!managementOk) return 'offline';
    if (!engineOk) return 'offline';
    if (SOCKET_DOWN_STATES.includes(socketState)) return 'degraded';
    return 'connected';
}

/**
 * Delay before the next poll, given the number of consecutive failed probes.
 *
 * `0` failures → 15 s; then 30 s, 60 s, capped at 120 s. Capped rather than
 * unbounded so a long-idle window still notices an engine that came back
 * without waiting for user input.
 *
 * @param {number} failures - consecutive failures (0 = last probe succeeded)
 * @returns {number} milliseconds
 */
export function nextPollDelay(failures) {
    const count = Number.isFinite(failures) && failures > 0 ? Math.floor(failures) : 0;
    if (count === 0) return HEALTH_POLL_INTERVAL_MS;
    return Math.min(HEALTH_POLL_INTERVAL_MS * 2 ** count, HEALTH_MAX_BACKOFF_MS);
}

/** True when the state should render the persistent offline banner. */
export const isOffline = (state) => state === 'offline';

/**
 * Fetch with an abort-based timeout. Resolves to the `Response`; rejects on
 * network error or timeout (both mean "not reachable", which is all we need).
 *
 * @param {string} url
 * @param {number} timeoutMs
 * @param {typeof fetch} fetchImpl
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, timeoutMs, fetchImpl) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), timeoutMs);
    try {
        return await fetchImpl(url, {
            method: 'GET',
            cache: 'no-store',
            // Opaque cross-origin responses (`no-cors`) would make a reachable
            // engine indistinguishable from a proxy error, so ask for the real
            // response and rely on the event server's CORS header.
            mode: 'cors',
            ...(controller ? { signal: controller.signal } : {}),
        });
    } finally {
        clearTimeout(timer);
    }
}

/** A single probe. Never throws — every failure is folded into the flags. */
async function probeEndpoint(url, fetchImpl) {
    try {
        const response = await fetchWithTimeout(url, HEALTH_PROBE_TIMEOUT_MS, fetchImpl);
        return { ok: !!response?.ok, status: response?.status ?? 0, error: null };
    } catch (error) {
        return { ok: false, status: 0, error: error?.message || 'unreachable' };
    }
}

/** Module-scoped timer — not reactive state, so re-renders never reset it. */
let pollTimer = null;

export const useHealthStore = create((set, get) => ({
    // ── State ────────────────────────────────────────────────────────────
    /** `checking|connected|degraded|offline` — drives the top-bar strip. */
    status: 'checking',
    /** Management API answered the last probe. */
    managementOk: false,
    /** Event server answered `GET /health` on the last probe. */
    engineOk: false,
    /** Last socket state pushed in by the shell (`chatStore.connectionState`). */
    socketState: 'idle',
    /** Consecutive failed probes; drives {@link nextPollDelay}. */
    failures: 0,
    /** Epoch ms of the last completed probe (null before the first one). */
    lastCheckedAt: null,
    /** Last transport-level error message, for the tooltip. */
    lastError: null,
    /** True while a probe is in flight. */
    probing: false,
    /** True once {@link start} has been called (guards double polling). */
    running: false,

    // ── Derived ──────────────────────────────────────────────────────────

    /** Recompute `status` from the current facts without touching the network. */
    refresh: () => {
        const { managementOk, engineOk, socketState, lastCheckedAt } = get();
        set({
            status: deriveHealthState({
                // `checking` means "no answer has EVER arrived", not "a probe is
                // running": re-deriving on every in-flight probe would blink the
                // pill to "Checking…" once per interval, which reads as a
                // flapping connection. An in-flight Retry is conveyed by
                // `probing` (the banner button's spin) instead.
                checking: lastCheckedAt === null,
                managementOk,
                engineOk,
                socketState,
            }),
        });
    },

    /**
     * Push the live chat-socket state in from the shell. Pure re-derivation: no
     * timer, no network — a socket drop between polls must not wait 15 s to show
     * as Degraded.
     *
     * @param {string} socketState - `chatStore.connectionState`
     */
    setSocketState: (socketState) => {
        set({ socketState: socketState || 'idle' });
        get().refresh();
    },

    // ── Probing ──────────────────────────────────────────────────────────

    /**
     * Probe both endpoints once and reschedule.
     *
     * @param {Object} [options]
     * @param {typeof fetch} [options.fetchImpl] - injectable for tests
     * @param {boolean} [options.reschedule=true] - false for a one-off probe
     * @returns {Promise<'checking'|'connected'|'degraded'|'offline'>} the new status
     */
    probe: async ({ fetchImpl, reschedule = true } = {}) => {
        const doFetch = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
        if (!doFetch) {
            set({ status: 'offline', lastError: 'fetch unavailable', lastCheckedAt: Date.now() });
            return 'offline';
        }

        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }

        set({ probing: true });
        get().refresh();

        const [management, engine] = await Promise.all([
            probeEndpoint(resolveManagementHealthUrl(), doFetch),
            probeEndpoint(resolveEngineHealthUrl(), doFetch),
        ]);

        const managementOk = management.ok;
        const engineOk = engine.ok;
        const healthy = managementOk && engineOk;
        const failures = healthy ? 0 : get().failures + 1;

        set({
            managementOk,
            engineOk,
            failures,
            probing: false,
            lastCheckedAt: Date.now(),
            lastError: management.error || engine.error || null,
        });
        get().refresh();

        if (reschedule && get().running) {
            pollTimer = setTimeout(() => {
                pollTimer = null;
                get().probe();
            }, nextPollDelay(failures));
        }

        return get().status;
    },

    /**
     * Start polling. Idempotent — the shell calls it on mount and a StrictMode
     * double-invoke must not create two pollers.
     */
    start: () => {
        if (get().running) {
            get().refresh();
            return;
        }
        set({ running: true });
        get().probe();
    },

    /** Stop polling and clear the pending timer. */
    stop: () => {
        if (pollTimer) {
            clearTimeout(pollTimer);
            pollTimer = null;
        }
        set({ running: false });
    },

    /**
     * Manual Retry (offline banner button): reset the backoff ladder and
     * re-probe both endpoints immediately, so recovery does not have to wait out
     * a 120 s backoff.
     *
     * @returns {Promise<string>} the resulting status
     */
    retry: () => {
        set({ failures: 0 });
        // Keep `running` as-is: a manual retry must not start a poller the shell
        // never asked for, and must not stop one that is already going.
        return get().probe();
    },

    /** Reset to the boot state (tests / teardown). */
    reset: () => {
        get().stop();
        set({
            status: 'checking',
            managementOk: false,
            engineOk: false,
            socketState: 'idle',
            failures: 0,
            lastCheckedAt: null,
            lastError: null,
            probing: false,
            running: false,
        });
    },
}));

export default useHealthStore;
