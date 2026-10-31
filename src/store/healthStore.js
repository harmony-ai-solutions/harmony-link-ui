import { create } from 'zustand';
import { getManagementApiUrl, getPublicApiPath } from '../services/management/baseService.js';

/**
 * Engine health — the shell's answer to "is the engine actually there?".
 *
 * Before this store, a dead engine and an empty database looked identical: every
 * view renders its empty state, so the user cannot tell *"no characters"* from
 * *"the engine is down"*.
 *
 * There is exactly **one** probe, the same one the phone app relies on:
 *
 * **Management API reachability** — `GET /public/appversion`, which needs no
 * admin key. This is the API every data view reads through, so its absence is
 * what makes the app show stale/empty data; while it answers, the engine is up.
 *
 * An earlier version also probed the event server's `/health`. It was dropped:
 * that server comes up and goes down independently of the management API, so a
 * probe racing an engine restart produced false "the event server is not
 * answering" banners while the app itself was perfectly usable.
 *
 * The **live chat socket** is a second input, but it is deliberately NOT fetched
 * here: the chat socket only exists while a conversation is open
 * ([`chatStore.connectSocket`](./chatStore.js)), so an `idle` socket on the
 * Settings tab means "no socket expected", not "socket down". The shell feeds
 * the real state in through {@link useHealthStore.setSocketState} and this
 * module stays free of a `chatStore` import (which also keeps it unit-testable
 * without the service layer's `import.meta.env` reads).
 *
 * Resulting state machine — see {@link deriveHealthState}:
 *
 * | management | chat socket           | state      |
 * |------------|-----------------------|------------|
 * | down       | any                   | `offline`  |
 * | up         | reconnecting          | `degraded` |
 * | up         | idle/connected/connecting/error | `connected`|
 *
 * `checking` is a transient fourth value used only before the first probe
 * resolves (and while a manual Retry runs): claiming "Connected" before the
 * first answer would be a guess, and claiming "Offline" would flash a banner on
 * every boot.
 *
 * Polling is a self-rescheduling timeout rather than an interval, so the delay
 * can grow: {@link HEALTH_POLL_INTERVAL_MS} while healthy (15 s) and
 * {@link nextPollDelay}'s exponential backoff up to
 * {@link HEALTH_MAX_BACKOFF_MS} while failing, so a stopped engine is not
 * hammered by a tab left open overnight. The first success resets the ladder,
 * which is what makes recovery land within one poll.
 *
 * Two startup-specific guards sit on top of that: the persistent banner is
 * debounced to {@link HEALTH_BANNER_MIN_FAILURES} consecutive failures (the pill
 * still flips on the first), and {@link bindResumeProbe} re-probes immediately
 * when a hidden/minimised page comes back after a failure, so the slow end of
 * the ladder is never what the user stares at.
 */

/** Healthy poll cadence (the plan's 15 s). */
export const HEALTH_POLL_INTERVAL_MS = 15000;

/** Ceiling for the failure backoff — a dead engine is probed at most this often. */
export const HEALTH_MAX_BACKOFF_MS = 120000;

/** Per-probe request timeout. Shorter than the healthy interval by design. */
export const HEALTH_PROBE_TIMEOUT_MS = 4000;

/**
 * Consecutive failures required before the persistent banner is rendered.
 *
 * The pill flips on the very first failure (it is a live status read), but the
 * banner waits for a second: on desktop the UI loads as soon as Vite is up while
 * the engine binary starts ~20 s later, so the first probe legitimately fails
 * with "Failed to fetch" and a one-strike banner would flash on every boot.
 */
export const HEALTH_BANNER_MIN_FAILURES = 2;

/** Only a REAL socket drop (dropped and retrying) degrades the global pill.
 *  `connecting` is the ordinary opening handshake, and `error` is an entity
 *  SESSION failure (shown as Degraded in the chat header + error modal) —
 *  neither means the engine is unhealthy. Engine reachability is the
 *  management probe's job (offline). Owner decision 2026-10-31. */
export const SOCKET_DOWN_STATES = ['reconnecting'];

/** The three user-visible states, plus the transient `checking`. */
export const HEALTH_STATES = ['checking', 'connected', 'degraded', 'offline'];

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
 * @param {string} input.socketState - `idle|connecting|connected|reconnecting|error`
 * @returns {'checking'|'connected'|'degraded'|'offline'}
 */
export function deriveHealthState({ checking, managementOk, socketState }) {
    // Never assert a state before the first answer (or during a manual retry
    // that follows a failed probe) — the checking pill is honest, a wrong
    // "connected"/"offline" is not.
    if (checking) return 'checking';
    if (!managementOk) return 'offline';
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
 * True only once the offline state has survived
 * {@link HEALTH_BANNER_MIN_FAILURES} consecutive failed probes.
 *
 * A single failure still shows as Offline in the pill; the banner is the loud,
 * persistent surface, so it is debounced against the startup window where the
 * engine is merely late rather than down. A manual Retry that also fails counts
 * (it does not reset the failure streak), so clicking Retry never hides it.
 *
 * @param {string} status - `checking|connected|degraded|offline`
 * @param {number} failures - consecutive failed probes (`healthStore.failures`)
 * @returns {boolean}
 */
export function shouldShowOfflineBanner(status, failures) {
    return isOffline(status) && (Number(failures) || 0) >= HEALTH_BANNER_MIN_FAILURES;
}

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
            // response and rely on the management API's CORS header.
            mode: 'cors',
            ...(controller ? { signal: controller.signal } : {}),
        });
    } finally {
        clearTimeout(timer);
    }
}

/** A single probe. Never throws — the answer is folded into `{ok}`. */
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
    /** Last socket state pushed in by the shell (`chatStore.connectionState`). */
    socketState: 'idle',
    /** Consecutive failed probes; drives {@link nextPollDelay}. */
    failures: 0,
    /** Epoch ms of the last completed probe (null before the first one). */
    lastCheckedAt: null,
    /** Last transport-level error message from the management probe, for the tooltip. */
    lastError: null,
    /** True while a probe is in flight. */
    probing: false,
    /** True once {@link start} has been called (guards double polling). */
    running: false,

    // ── Derived ──────────────────────────────────────────────────────────

    /** Recompute `status` from the current facts without touching the network. */
    refresh: () => {
        const { managementOk, socketState, lastCheckedAt } = get();
        set({
            status: deriveHealthState({
                // `checking` means "no answer has EVER arrived", not "a probe is
                // running": re-deriving on every in-flight probe would blink the
                // pill to "Checking…" once per interval, which reads as a
                // flapping connection. An in-flight Retry is conveyed by
                // `probing` (the banner button's spin) instead.
                checking: lastCheckedAt === null,
                managementOk,
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
     * Probe the management API once and reschedule.
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

        const management = await probeEndpoint(resolveManagementHealthUrl(), doFetch);

        const managementOk = management.ok;
        const failures = managementOk ? 0 : get().failures + 1;

        set({
            managementOk,
            failures,
            probing: false,
            lastCheckedAt: Date.now(),
            lastError: management.error || null,
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
     * Manual Retry (offline banner button): re-probe immediately, so recovery
     * does not have to wait out a 120 s backoff.
     *
     * `failures` is deliberately NOT zeroed first: a retry that still fails is
     * another consecutive failure, so it keeps the banner's debounce honest
     * (and its count) instead of restarting the streak. The immediate probe is
     * what escapes the ladder — it clears the pending timer either way.
     *
     * @returns {Promise<string>} the resulting status
     */
    retry: () => {
        // Keep `running` as-is: a manual retry must not start a poller the shell
        // never asked for, and must not stop one that is already going.
        return get().probe();
    },

    /**
     * "The user came back" hook — called from
     * {@link bindResumeProbe} on `visibilitychange`/`focus`.
     *
     * A tab that was hidden while the engine started would otherwise sit out the
     * backoff ladder (up to 120 s) before noticing. Only acts when polling is
     * running and the last answer was a failure; `retry()` re-probes at once and
     * `probe()` clears `pollTimer`, so this cannot stack a second poller.
     *
     * @returns {boolean} true when a re-probe was kicked off
     */
    resumeIfFailed: () => {
        const { running, probing, failures } = get();
        if (!running || probing || failures < 1) return false;
        get().retry();
        return true;
    },

    /** Reset to the boot state (tests / teardown). */
    reset: () => {
        get().stop();
        set({
            status: 'checking',
            managementOk: false,
            socketState: 'idle',
            failures: 0,
            lastCheckedAt: null,
            lastError: null,
            probing: false,
            running: false,
        });
    },
}));

/**
 * Wire "the page came back" events to {@link useHealthStore.resumeIfFailed}.
 *
 * Both the tab becoming visible again and the window regaining focus count: a
 * minimised window fires `focus` without `visibilitychange`, and an unfocused
 * tab fires `visibilitychange` without `focus`. The returned cleanup removes
 * exactly the listeners this call added, so a StrictMode
 * mount/unmount/remount leaves one pair rather than two.
 *
 * @param {Object} [targets]
 * @param {EventTarget} [targets.document] - receives `visibilitychange`
 * @param {EventTarget} [targets.window] - receives `focus`
 * @param {{getState: Function}} [store] - injectable for `healthStore.test.js`
 * @returns {() => void} cleanup
 */
export function bindResumeProbe({ document: doc, window: win } = {}, store = useHealthStore) {
    const docTarget = doc ?? (typeof document !== 'undefined' ? document : null);
    const winTarget = win ?? (typeof window !== 'undefined' ? window : null);
    if (!docTarget && !winTarget) return () => {};

    const onVisibilityChange = () => {
        // Only "visible" means the user is back; "hidden" means they left.
        const visibility = docTarget?.visibilityState;
        if (visibility && visibility !== 'visible') return;
        store.getState().resumeIfFailed();
    };
    const onFocus = () => {
        store.getState().resumeIfFailed();
    };

    docTarget?.addEventListener('visibilitychange', onVisibilityChange);
    winTarget?.addEventListener('focus', onFocus);

    return () => {
        docTarget?.removeEventListener('visibilitychange', onVisibilityChange);
        winTarget?.removeEventListener('focus', onFocus);
    };
}

export default useHealthStore;
