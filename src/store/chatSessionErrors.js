/**
 * Per-entity session errors for the chat detail screen (owner-approved
 * design, 2026-10-31): a failed entity session is NOT a socket problem —
 * the engine may be up and the socket live while the session start was
 * rejected (missing API key, bad provider config, session state
 * unavailable). Those failures are recorded here — newest first, capped —
 * and cleared on the next successful INIT_ENTITY. Pure functions so the
 * rules are locked by `node --test` (`chatSessionErrors.test.js`).
 */

/** Cap so a long-broken thread cannot grow the store or the modal unbounded. */
export const SESSION_ERROR_CAP = 10;

/**
 * Classify an error message into the code chip the modal shows. Deliberately
 * coarse — the MESSAGE is always shown verbatim; the chip only picks the hint.
 * @param {string} message
 * @returns {'config'|'session'|'network'}
 */
export function classifySessionError(message) {
    const m = typeof message === 'string' ? message.toLowerCase() : '';
    if (/(api[ _-]?key|not configured|no .*configured|provider|module|missing configuration|credential)/.test(m)) {
        return 'config';
    }
    if (/(connect|refused|timeout|timed out|network|unreachable|dns|handshake|eof)/.test(m)) {
        return 'network';
    }
    return 'session';
}

/**
 * Record one error at the head of the list (newest first).
 * @param {Array<{code: string, message: string, at: string}>} list
 * @param {{message?: string, code?: string, at?: string}} entry
 */
export function recordSessionError(list, entry) {
    const message = typeof entry?.message === 'string' && entry.message.trim()
        ? entry.message.trim()
        : 'Unknown error';
    const error = {
        code: entry?.code || classifySessionError(message),
        message,
        at: entry?.at || new Date().toISOString(),
    };
    return [error, ...(list || [])].slice(0, SESSION_ERROR_CAP);
}

/** A successful session wipes the slate (the modal promises this). */
export function clearSessionErrors() {
    return [];
}

/** `HH:MM:SS` for today, `DD.MM HH:MM:SS` otherwise (matches the approved mockup). */
export function sessionErrorTime(at, now = new Date()) {
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return '';
    const sameDay = date.toDateString() === now.toDateString();
    const two = (n) => String(n).padStart(2, '0');
    const clock = `${two(date.getHours())}:${two(date.getMinutes())}:${two(date.getSeconds())}`;
    return sameDay ? clock : `${two(date.getDate())}.${two(date.getMonth() + 1)} ${clock}`;
}
