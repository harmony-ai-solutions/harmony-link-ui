/**
 * windowFocus.js — window focus / visibility signal for the Wails webview.
 *
 * Plan 7-12 §4 (desktop D3): the desktop frontend only raises an OS notification
 * while the user is looking elsewhere, so it needs a reliable "is the window
 * focused?" signal. Wails v2 exposes no focus runtime event (verified against
 * wailsapp/wails/v2@v2.13.0 — the version pinned in the engine's go.mod), so we
 * use the standard webview DOM signals instead:
 *
 *   - `document.visibilityState === "hidden"` — the window is minimized/hidden
 *     (fires `visibilitychange`).
 *   - `document.hasFocus()` — false when another OS window/application is
 *     active (WebView2/WebKit/WebKitGTK implement this per the HTML spec; it
 *     flips on `blur`/`focus`).
 *
 * A window counts as "focused" only when it is visible AND has document focus.
 * The value is computed live at the moment it is read (the notify decision),
 * which avoids the drift that a cached flag updated only by `focus`/`blur`
 * listeners can accumulate when a webview skips an event.
 *
 * Guarded so the module stays importable under non-DOM environments (SSR,
 * tests) — it then reports "focused" (the safe default: never notify).
 */

/**
 * True when the webview window is visible and currently has document focus.
 * Returns true (the safe "focused" default) when DOM APIs are unavailable.
 *
 * @returns {boolean}
 */
export function isWindowFocused() {
    if (typeof document === "undefined") return true;
    try {
        if (document.visibilityState === "hidden") return false;
        if (typeof document.hasFocus === "function") return document.hasFocus();
    } catch {
        // Never let a focus probe throw into the notification path.
        return true;
    }
    return true;
}

/**
 * Subscribe to focus/visibility transitions. Returns an unsubscribe function.
 *
 * The notify decision reads {@link isWindowFocused} live, so this is optional
 * (observability / future UI use), but it keeps the signal documented and lets
 * callers react to transitions.
 *
 * @param {(focused: boolean) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeWindowFocus(callback) {
    if (typeof window === "undefined" || typeof document === "undefined") {
        return () => {};
    }
    const emit = () => {
        try {
            callback(isWindowFocused());
        } catch {
            /* listener errors are isolated from the tracker */
        }
    };
    window.addEventListener("focus", emit);
    window.addEventListener("blur", emit);
    document.addEventListener("visibilitychange", emit);
    return () => {
        window.removeEventListener("focus", emit);
        window.removeEventListener("blur", emit);
        document.removeEventListener("visibilitychange", emit);
    };
}
