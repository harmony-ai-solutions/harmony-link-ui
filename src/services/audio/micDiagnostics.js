/**
 * Microphone diagnostics — the impure driver (Task 04-2).
 *
 * `checkMicrophone()` answers one question: "can this app record right now, and
 * if not, what exactly should the user do?" The taxonomy and the action plan
 * live in [`micDiagnosticsUtils.js`](./micDiagnosticsUtils.js); this file only
 * touches `navigator`.
 *
 * ## The rule that makes this usable at all
 *
 * **It does not prompt unless you tell it to.** `checkMicrophone()` defaults to
 * `requestAccess: false`, so calling it when the Voice Input settings screen
 * opens (Task 04-2 step 2) enumerates devices and reads the permission state
 * without ever raising a dialog. A prompt only appears when the user presses
 * Retry (or the mic button), which is Task 04-2 step 3: *request permission only
 * on an explicit user action*.
 *
 * A non-prompting check is still informative, which is the point:
 *   - zero audio inputs → `notFound`, without asking for anything;
 *   - permission already `denied` → `denied`, without asking for anything;
 *   - `prompt` → `ok`, because the device exists and the first real recording
 *     will ask. Reporting `prompt` as a failure would put an error in front of
 *     every first-time user.
 *
 * The browser surface is injectable via `options.env` so this is testable with
 * `node --test`, exactly like [`recorder.js`](./recorder.js).
 */

import {
    MIC_PROMPTS_ON_START,
    buildMicIssue,
    classifyMicFailure,
    classifyUnsupported,
    diagnosticsFromEnvironment,
    normalisePermissionState,
} from './micDiagnosticsUtils.js';

/** Release a probe stream immediately — a kept track lights the OS mic indicator. */
function releaseStream(stream) {
    try {
        stream?.getTracks?.().forEach((track) => {
            try {
                track.stop();
            } catch {
                /* already stopped */
            }
        });
    } catch {
        /* stream already gone */
    }
}

/** Resolve the browser globals once per call so tests can inject fakes. */
function resolveEnv(env) {
    const scope = typeof globalThis !== 'undefined' ? globalThis : {};
    return {
        navigator: env?.navigator ?? scope.navigator,
        permissions: env?.permissions ?? scope.navigator?.permissions,
        isSecureContext: env?.isSecureContext ?? scope.isSecureContext,
        getUserMedia: env?.getUserMedia ?? null,
    };
}

/**
 * Read the microphone permission state without prompting.
 *
 * Every failure path answers `unknown` rather than throwing: Firefox does not
 * implement `microphone` in the Permissions API, and several Chromium-based
 * WebViews reject the `name` with `TypeError`. `unknown` simply means "cannot
 * tell from here", which the classifier already handles.
 *
 * @param {object} env - resolved environment
 * @param {boolean} [isSecureContext]
 * @returns {Promise<'granted'|'denied'|'prompt'|'unknown'>}
 */
export async function readMicPermission(env, isSecureContext) {
    const permissions = env?.permissions;
    if (!permissions?.query) return 'unknown';
    // An insecure context cannot grant a microphone; asking the API there only
    // produces a rejection whose message varies per engine.
    if (isSecureContext === false) return 'unknown';
    try {
        const status = await permissions.query({ name: 'microphone' });
        return normalisePermissionState(status?.state);
    } catch {
        return 'unknown';
    }
}

/**
 * Ask the OS/WebView for the microphone and release it straight away.
 *
 * This is the only place in the diagnostics module that can raise a dialog, so
 * it is never reachable from a screen mount — only from an explicit user action.
 *
 * @param {object} env
 * @returns {Promise<{ error: unknown }>} `error` is `null` on success
 */
async function probeAccess(env) {
    const mediaDevices = env?.navigator?.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
        const missing = new Error('media-devices-unavailable');
        missing.name = 'NotSupportedError';
        return { error: missing };
    }
    try {
        const stream = await mediaDevices.getUserMedia({ audio: true });
        releaseStream(stream);
        return { error: null };
    } catch (error) {
        return { error };
    }
}

/**
 * Check the microphone.
 *
 * Returns `{ ok, reason, devices }` — the shape Task 04-2 specifies — plus the
 * derived `permission`, `copy` keys and `actions` plan so a caller can render a
 * complete, actionable panel from ONE value. Adding fields is additive; the
 * documented three are always present.
 *
 * @param {{
 *   requestAccess?: boolean,
 *   env?: object,
 * }} [options]
 * @returns {Promise<{
 *   ok: boolean,
 *   reason: string,
 *   devices: Array<{deviceId: string, label: string}>,
 *   permission: string,
 *   copy: {title: string, body: string, primary: string, secondary: string},
 *   actions: {primary: string, secondary: string},
 * }>}
 */
export async function checkMicrophone(options = {}) {
    const env = resolveEnv(options.env);
    const mediaDevices = env.navigator?.mediaDevices;

    // 1. No API at all, or an insecure context. Decided first because nothing
    //    else can be trusted and the copy differs ("serve over HTTPS").
    const supported = classifyUnsupported({
        hasMediaDevices: !!mediaDevices?.enumerateDevices,
        isSecureContext: env.isSecureContext,
    });
    if (supported !== 'ok') {
        return buildMicIssue({ ok: false, reason: supported, devices: [] });
    }

    // 2. Optional explicit grant. Runs BEFORE enumeration so a successful grant
    //    also fills in device labels in the same pass.
    let failure = null;
    if (options.requestAccess === true) {
        const probe = await probeAccess(env);
        failure = probe.error;
    }

    // 3. Enumerate. A rejection here (rare, but real in hardened WebViews) is
    //    reported as `unknown` rather than "no devices", because telling a user
    //    they have no microphone when the call merely failed is worse than
    //    saying nothing definite.
    let devices = [];
    let enumerateFailed = false;
    try {
        devices = await mediaDevices.enumerateDevices();
    } catch {
        enumerateFailed = true;
    }

    // 4. Permission state — read without prompting, and only meaningful on the
    //    non-prompting path. After a probe, the error itself is authoritative.
    const permission = await readMicPermission(env, env.isSecureContext);

    if (failure) {
        const reason = classifyMicFailure(failure);
        return buildMicIssue({ ok: false, reason, permission, devices });
    }

    if (enumerateFailed) {
        return buildMicIssue({ ok: false, reason: 'unknown', permission, devices: [] });
    }

    return buildMicIssue(diagnosticsFromEnvironment({
        hasMediaDevices: true,
        isSecureContext: env.isSecureContext,
        permission,
        devices,
    }));
}

/* ── The last failure, remembered ──────────────────────────────────────
   Task 04-2 step 2 says to re-check on the first mic press "if a previous
   attempt failed". That memory must outlive the composer (the user goes to
   Settings to grant permission, then comes back), and it lives in a module
   variable rather than localStorage on purpose: a stale "denied" persisted
   across a restart would show an error before the user has done anything, and
   the very first check on this launch would be skipped. */

/** @type {string|null} */
let lastFailureReason = null;

/**
 * Record the outcome of a check or a failed take.
 *
 * Called by the composer after {@link checkMicrophone} and after a failed
 * `getUserMedia` inside the recorder, so both paths teach the next press.
 *
 * @param {string|null} reason
 * @returns {void}
 */
export function rememberMicIssue(reason) {
    const isFailure = typeof reason === 'string' && reason.length > 0 && reason !== 'ok';
    lastFailureReason = isFailure ? reason : null;
}

/** @returns {string|null} the last failure reason, or null when the mic is fine. */
export function getLastMicIssue() {
    return lastFailureReason;
}

/** Forget the last failure (a take succeeded, or the panel was dismissed). */
export function clearMicIssue() {
    lastFailureReason = null;
}

export { MIC_PROMPTS_ON_START };
