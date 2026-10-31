/**
 * Chat connection status (desktop parity with the phone app's
 * `resolveChatConnectionState`).
 *
 * The store's socket state is an IMPLEMENTATION detail (`idle`, `connecting`,
 * `connected`, `reconnecting`, `error`); the header shows one of four honest
 * labels. The phone app derives its label from the logical session and never
 * lets a transient socket retry flash "reconnecting" for every blip — the same
 * precedence is kept here:
 *
 *   offline  ← no open session / no socket at all
 *   connecting ← an attempt is in flight and nothing dropped yet
 *   reconnecting ← a real drop that outlived the grace window
 *   connected ← the socket is live
 *   degraded ← this ENTITY's session failed (the socket/engine may be up)
 *
 * `error` maps to DEGRADED (owner decision 2026-10-31) — the engine may be up
 * while THIS entity's session failed (missing API key, bad provider config,
 * session state unavailable). The chat header shows "Degraded" plus the error
 * bubble that opens the error modal; "offline" is reserved for no socket /
 * unreachable engine, which is the management probe's verdict.
 */

/**
 * How long a dropped socket may keep retrying BEFORE the header admits it.
 *
 * The first reconnect attempt fires after 2 s and almost always succeeds; a
 * status flip inside that window is pure flicker. The grace window is
 * deliberately longer than the first backoff rung, so a normal one-attempt
 * reconnect never changes the label at all.
 */
export const RECONNECT_STATUS_GRACE_MS = 3000;

/**
 * The i18n suffix for a store connection state,
 * `chat:conversation.connection.<suffix>`.
 *
 * @param {string} state - `idle|connecting|connected|reconnecting|error`
 * @returns {'connected'|'connecting'|'reconnecting'|'degraded'|'offline'}
 */
export function connectionStatusKey(state) {
    switch (state) {
        case 'connected':
            return 'connected';
        case 'connecting':
            return 'connecting';
        case 'reconnecting':
            return 'reconnecting';
        case 'error':
            return 'degraded';
        default:
            return 'offline';
    }
}

/**
 * Whether a socket event may promote the header to "reconnecting".
 *
 * Only a REAL drop counts: a close while the socket was connected/connecting.
 * An initial connection failure (`error`) stays offline until a socket actually
 * opens, and events while no conversation is open are ignored entirely.
 *
 * @param {string} current - the state before the drop (store's `connectionState`)
 * @returns {boolean}
 */
export function canPromoteToReconnecting(current) {
    return current === 'connected' || current === 'connecting';
}

/**
 * Whether the grace window has elapsed since the drop.
 *
 * @param {{ dropSince?: number|null, now?: number, graceMs?: number }} input
 * @returns {boolean}
 */
export function reconnectGraceElapsed({ dropSince, now = Date.now(), graceMs = RECONNECT_STATUS_GRACE_MS } = {}) {
    if (!Number.isFinite(dropSince)) return false;
    const window = Number.isFinite(graceMs) ? graceMs : RECONNECT_STATUS_GRACE_MS;
    return now - dropSince >= window;
}
