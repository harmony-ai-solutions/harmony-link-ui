/**
 * osNotifications.js — desktop OS notification surface for the Wails webview.
 *
 * Plan 7-12 §4 (desktop D3): when the window is unfocused, the desktop frontend
 * raises a native OS notification for incoming outreach.
 *
 * Mechanism (investigated, frontend-only): the engine pins
 * `github.com/wailsapp/wails/v2 v2.13.0`, whose runtime ships a full
 * notification API — both the injected `window.runtime` object
 * (internal/frontend/runtime/desktop/main.js spreads `...Notifications`) and the
 * Go system calls behind it (pkg/runtime/notifications.go). The Wails dispatcher
 * registers `:wails:InitializeNotifications` / `:wails:SendNotification` /
 * `:wails:IsNotificationAvailable` unconditionally (no build-time opt-in), and
 * the Windows implementation uses native toast notifications. The generated
 * wrappers are already present in `wailsjs/runtime/runtime.js`. No engine-side
 * (Go) change is required.
 *
 * This module is deliberately runtime-guarded: under a plain browser / Vite dev
 * server (no `window.runtime`) every call degrades to a no-op so the frontend
 * stays importable and runnable outside Wails — mirroring the guarded
 * `window.runtime` access in src/utils/logger.js.
 */

/** @returns {any|null} The injected Wails runtime, or null outside Wails. */
function getRuntime() {
    try {
        return (typeof window !== "undefined" && window.runtime) ? window.runtime : null;
    } catch {
        return null;
    }
}

/**
 * True when the current runtime can raise native OS notifications. False in a
 * plain browser (Vite dev / docker-served UI without the Wails shell).
 *
 * @returns {boolean}
 */
export function isOsNotificationSupported() {
    const rt = getRuntime();
    return !!(rt && typeof rt.SendNotification === "function");
}

let initialized = false;
let initPromise = null;

/**
 * Initialize the Wails notification service (idempotent). On Windows this
 * registers the toast COM activator and app data; on macOS it ensures the
 * notification delegate exists. Must run before the first SendNotification.
 *
 * @returns {Promise<boolean>} true when the notification service is ready.
 */
export function initializeOsNotifications() {
    if (initialized) return Promise.resolve(true);
    if (initPromise) return initPromise;

    const rt = getRuntime();
    if (!rt || typeof rt.InitializeNotifications !== "function") {
        return Promise.resolve(false);
    }

    initPromise = (async () => {
        try {
            if (typeof rt.IsNotificationAvailable === "function") {
                const available = await rt.IsNotificationAvailable();
                if (!available) return false;
            }
            await rt.InitializeNotifications();
            // macOS prompts here; Windows/Linux return true immediately.
            if (typeof rt.RequestNotificationAuthorization === "function") {
                try {
                    await rt.RequestNotificationAuthorization();
                } catch {
                    /* authorization is best-effort — a denied prompt simply
                       means no banner is shown, which is acceptable */
                }
            }
            initialized = true;
            return true;
        } catch {
            // Best-effort surface: swallow and report unavailable. initPromise
            // stays set so a failed init does not retry-storm on every event.
            return false;
        }
    })();

    return initPromise;
}

/**
 * Raise a native OS notification. Best-effort: resolves false when the Wails
 * runtime is absent, notifications are unavailable, or the OS call throws.
 *
 * @param {{ id: string, title: string, body?: string, subtitle?: string }} options
 * @returns {Promise<boolean>} true when the notification was handed to the OS.
 */
export async function sendOsNotification(options) {
    const rt = getRuntime();
    if (!rt || typeof rt.SendNotification !== "function") return false;

    const ready = await initializeOsNotifications();
    if (!ready) return false;

    try {
        await rt.SendNotification({
            id: String(options?.id ?? ""),
            title: String(options?.title ?? ""),
            body: options?.body != null ? String(options.body) : undefined,
            subtitle: options?.subtitle,
        });
        return true;
    } catch {
        return false;
    }
}
