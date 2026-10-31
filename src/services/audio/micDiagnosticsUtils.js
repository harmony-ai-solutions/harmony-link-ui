/**
 * Microphone diagnostics — pure logic (Task 04-2).
 *
 * `getUserMedia` can fail for reasons that need completely different fixes, and
 * the desktop used to collapse all of them into one sentence with no way out.
 * This module owns the *taxonomy* and the *action plan*; the impure sibling
 * [`micDiagnostics.js`](./micDiagnostics.js) owns the browser calls and
 * [`MicIssuePanel.jsx`](../../components/chat/MicIssuePanel.jsx) owns the pixels.
 *
 * Everything here is pure so it can be unit-tested with `node --test`, the same
 * constraint [`recorderUtils.js`](./recorderUtils.js) follows. No `navigator`,
 * no `window`, no timers.
 *
 * The two rules that shape the design:
 *
 *   1. **A reason must carry an ACTION, not just a sentence.** "Microphone
 *      blocked" without a Retry button is the bug this task exists to fix, so
 *      every reason resolves to an action plan from {@link MIC_ACTIONS}.
 *      `MIC_ACTIONS.NONE` is a real value, and it is only used where nothing the
 *      user can do would help.
 *   2. **Diagnosing must never prompt.** {@link diagnosticsFromEnvironment} can
 *      decide `denied` / `notFound` / `ok` from device enumeration plus the
 *      Permissions API alone. Asking for the microphone is a separate, explicit
 *      call ({@link MIC_PROMPTS_ON_START} is `false`), which is Task 04-2 step 3.
 */

import { describeMicError } from './recorderUtils.js';

/**
 * Reasons a microphone check can end on.
 *
 * `ok` is a reason rather than the absence of one so a caller can switch on it
 * without a null check, and so `result.ok === (result.reason === 'ok')` is a
 * single source of truth.
 */
export const MIC_REASONS = Object.freeze([
    'ok',
    'denied',
    'notFound',
    'inUse',
    'unavailable',
    'insecure',
    'unknown',
]);

/**
 * What the UI can DO about a reason.
 *
 * Only two actions exist on purpose. Every extra action is a button that has to
 * earn its place: "close other apps" became body copy instead of a button,
 * because pressing a button that instructs you to do something else is exactly
 * the dead end this task removes.
 */
export const MIC_ACTIONS = Object.freeze({
    RETRY: 'retry',
    OPEN_SOUND_SETTINGS: 'openSoundSettings',
    NONE: 'none',
});

/**
 * Permission states surfaced by `navigator.permissions.query({name:'microphone'})`.
 *
 * `unknown` covers every browser that does not implement the query (and the
 * `prompt`-less WebViews), so callers never have to feature-detect twice.
 */
export const MIC_PERMISSION_STATES = Object.freeze(['granted', 'denied', 'prompt', 'unknown']);

/**
 * Task 04-2 step 3: never ask for the microphone on app start.
 *
 * Exported as a constant rather than left implicit so the rule is greppable and
 * a future caller has to deliberately contradict a named decision.
 */
export const MIC_PROMPTS_ON_START = false;

/**
 * Reason for "this WebView has no microphone API at all".
 *
 * Distinguished from `unavailable` on purpose: an insecure context is fixable
 * (serve over HTTPS / loopback) while a stripped WebView build is not, and the
 * copy differs.
 *
 * @param {{ hasMediaDevices?: boolean, isSecureContext?: boolean }} input
 * @returns {'ok'|'unavailable'|'insecure'}
 */
export function classifyUnsupported({ hasMediaDevices, isSecureContext } = {}) {
    if (hasMediaDevices) return 'ok';
    if (isSecureContext === false) return 'insecure';
    return 'unavailable';
}

/**
 * Map a thrown error onto a failure reason.
 *
 * Delegates the DOMException taxonomy to
 * [`describeMicError`](./recorderUtils.js) rather than re-listing the aliases
 * (`PermissionDeniedError`, `TrackStartError`, `DevicesNotFoundError`, …) here:
 * one taxonomy, two consumers.
 *
 * @param {unknown} error
 * @returns {'denied'|'notFound'|'inUse'|'unavailable'|'unknown'}
 */
export function classifyMicFailure(error) {
    return describeMicError(error);
}

/**
 * Normalise a permission state string.
 *
 * @param {unknown} state
 * @returns {'granted'|'denied'|'prompt'|'unknown'}
 */
export function normalisePermissionState(state) {
    const value = typeof state === 'string' ? state.trim().toLowerCase() : '';
    return MIC_PERMISSION_STATES.includes(value) && value !== 'unknown' ? value : 'unknown';
}

/**
 * Audio inputs from an `enumerateDevices()` result, or an already-normalised list.
 *
 * Labels are deliberately NOT required: before the first grant Chromium reports
 * every input with an empty label, and treating that as "no device" would tell a
 * user with a working headset that they have no microphone.
 *
 * A missing `kind` counts as "already an audio input", so this function is
 * IDEMPOTENT. `checkMicrophone` normalises once and {@link buildMicIssue}
 * re-normalises the result; a strict `kind` test made that second pass silently
 * empty the device list — caught by a test, not by reading.
 *
 * @param {Array<{kind?: string, deviceId?: string, label?: string}>} devices
 * @returns {Array<{deviceId: string, label: string}>}
 */
export function audioInputsOf(devices) {
    return (Array.isArray(devices) ? devices : [])
        .filter((device) => device && (device.kind === 'audioinput' || device.kind === undefined))
        .map((device) => ({
            deviceId: typeof device.deviceId === 'string' ? device.deviceId : '',
            label: typeof device.label === 'string' ? device.label.trim() : '',
        }));
}

/**
 * Conclusion drawn from the environment WITHOUT asking for permission.
 *
 * Precedence matters and is what makes the result honest:
 *
 *   1. no API / insecure context — nothing else can be trusted;
 *   2. permission explicitly `denied` — report it even if devices are listed,
 *      because the next `getUserMedia` is guaranteed to fail;
 *   3. zero audio inputs — `notFound`, and this is the only way to detect it
 *      without a prompt;
 *   4. otherwise `ok`. Note that `prompt` resolves to `ok`: the microphone is
 *      available and the first real recording will show the OS prompt. Treating
 *      `prompt` as a failure would put an error in front of every new user.
 *
 * @param {{
 *   hasMediaDevices?: boolean,
 *   isSecureContext?: boolean,
 *   permission?: string,
 *   devices?: Array<object>,
 * }} input
 * @returns {{ ok: boolean, reason: string, permission: string, devices: Array<{deviceId: string, label: string}> }}
 */
export function diagnosticsFromEnvironment(input = {}) {
    const devices = audioInputsOf(input.devices);
    const permission = normalisePermissionState(input.permission);
    const unsupported = classifyUnsupported(input);
    if (unsupported !== 'ok') {
        return { ok: false, reason: unsupported, permission, devices };
    }
    if (permission === 'denied') {
        return { ok: false, reason: 'denied', permission, devices };
    }
    if (devices.length === 0) {
        return { ok: false, reason: 'notFound', permission, devices };
    }
    return { ok: true, reason: 'ok', permission, devices };
}

/**
 * The action plan for a reason.
 *
 * `denied` → Retry is the task's explicit requirement: a browser-level block can
 * be lifted while the app is running, and re-asking is the only way to notice.
 * `notFound` → the OS sound panel is primary, because no in-app action can
 * conjure a device; Retry is still offered as the secondary for the
 * "I just plugged it in" case.
 * `inUse` → Retry, with the cause named in the copy (close the other app).
 * `ok` → Retry too, labelled "Test again": once a successful check exists, the
 * only reason to press anything is to re-verify after plugging something in, and
 * a status line with no control is a screen the user cannot act on.
 *
 * @param {string} reason
 * @returns {{ primary: string, secondary: string }}
 */
export function micActionPlan(reason) {
    switch (reason) {
        case 'denied':
        case 'inUse':
        case 'ok':
        case 'unknown':
            return { primary: MIC_ACTIONS.RETRY, secondary: MIC_ACTIONS.NONE };
        case 'notFound':
            return { primary: MIC_ACTIONS.OPEN_SOUND_SETTINGS, secondary: MIC_ACTIONS.RETRY };
        case 'insecure':
        case 'unavailable':
        default:
            return { primary: MIC_ACTIONS.NONE, secondary: MIC_ACTIONS.NONE };
    }
}

/**
 * i18n keys for a reason.
 *
 * Four keys per reason, all mandatory, so a contributor adding a reason is
 * forced by the copy shape to say what to DO about it:
 *   - `title`     — the one-line verdict
 *   - `body`      — what is wrong and what the user can do
 *   - `primary`   — label of the action plan's primary button
 *   - `secondary` — label of its secondary button
 *
 * `body` deliberately reuses the `chat:input.mic*` sentences the composer has
 * shown since 04-1 instead of forking a second set of sentences for the same
 * three failures. The new `chat:mic.*` namespace only adds what was missing:
 * a title, and the button labels.
 *
 * @param {string} reason
 * @returns {{ title: string, body: string, primary: string, secondary: string }}
 */
export function micCopyKeys(reason) {
    const key = MIC_REASONS.includes(reason) ? reason : 'unknown';
    return {
        title: `chat:mic.${key}.title`,
        body: MIC_BODY_KEYS[key] ?? MIC_BODY_KEYS.unknown,
        primary: `chat:mic.${key}.primary`,
        secondary: `chat:mic.${key}.secondary`,
    };
}

/** Body copy per reason — the existing composer sentences, plus two new ones. */
const MIC_BODY_KEYS = Object.freeze({
    ok: 'chat:input.micAvailable',
    denied: 'chat:input.micDenied',
    notFound: 'chat:input.micNotFound',
    inUse: 'chat:input.micInUse',
    unavailable: 'chat:input.micUnavailable',
    insecure: 'chat:mic.insecure.body',
    unknown: 'chat:input.recordingFailed',
});

/**
 * Does this action render a button at all?
 *
 * The UI reads this instead of testing the action string itself, so the
 * "a reason with no action renders no button" rule lives in one place.
 *
 * @param {string} action
 * @returns {boolean}
 */
export function actionHasButton(action) {
    return action === MIC_ACTIONS.RETRY || action === MIC_ACTIONS.OPEN_SOUND_SETTINGS;
}

/**
 * Should the next mic press re-run diagnostics before requesting the device?
 *
 * Task 04-2 step 2: re-check on the first press **after a failure**, not on
 * every press. Once a take has succeeded the mic is known-good, and re-checking
 * on every press would add an `enumerateDevices` round-trip to the hot path.
 *
 * `denied` is included even though re-requesting would fail again: the check is
 * what produces the actionable copy, so skipping it would leave the generic
 * message in place.
 *
 * @param {string|null|undefined} previousReason reason of the LAST failure
 * @returns {boolean}
 */
export function shouldRecheckOnPress(previousReason) {
    if (!previousReason) return false;
    return previousReason !== 'ok';
}

/**
 * Should an explicit action re-ask the browser for the device?
 *
 * Retry is the only action that does; everything else must stay non-prompting so
 * opening a settings screen can never trigger a permission dialog.
 *
 * @param {string} action
 * @returns {boolean}
 */
export function actionPrompts(action) {
    return action === MIC_ACTIONS.RETRY;
}

/**
 * Build the object the UI consumes from a raw check result.
 *
 * @param {{ ok?: boolean, reason?: string, devices?: Array<object>, permission?: string }} result
 * @returns {{
 *   ok: boolean,
 *   reason: string,
 *   permission: string,
 *   devices: Array<{deviceId: string, label: string}>,
 *   copy: { title: string, body: string, primary: string, secondary: string },
 *   actions: { primary: string, secondary: string },
 * }}
 */
export function buildMicIssue(result = {}) {
    const reason = MIC_REASONS.includes(result.reason) ? result.reason : 'unknown';
    return {
        ok: reason === 'ok' && result.ok !== false,
        reason,
        permission: normalisePermissionState(result.permission),
        devices: audioInputsOf(result.devices),
        copy: micCopyKeys(reason),
        actions: micActionPlan(reason),
    };
}
