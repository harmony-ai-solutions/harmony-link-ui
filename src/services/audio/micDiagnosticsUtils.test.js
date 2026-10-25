import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MIC_ACTIONS,
    MIC_PERMISSION_STATES,
    MIC_PROMPTS_ON_START,
    MIC_REASONS,
    actionHasButton,
    actionPrompts,
    audioInputsOf,
    buildMicIssue,
    classifyMicFailure,
    classifyUnsupported,
    diagnosticsFromEnvironment,
    micActionPlan,
    micCopyKeys,
    normalisePermissionState,
    shouldRecheckOnPress,
} from './micDiagnosticsUtils.js';

/**
 * Task 04-2's acceptance criterion is "each failure class shows distinct,
 * actionable copy". "Distinct" and "actionable" are both testable, so these
 * tests check the PAIRS rather than the strings:
 *   - distinct  → no two failures share a body key or a title key
 *   - actionable → every fixable failure resolves to a real button
 */

/* ── Unsupported environments ────────────────────────────────────────── */

test('classifyUnsupported separates a stripped WebView from an insecure context', () => {
    assert.equal(classifyUnsupported({ hasMediaDevices: true }), 'ok');
    // No API and no secure context: the insecure copy is the actionable one.
    assert.equal(classifyUnsupported({ hasMediaDevices: false, isSecureContext: false }), 'insecure');
    // No API in a secure context: the build itself is the problem.
    assert.equal(classifyUnsupported({ hasMediaDevices: false, isSecureContext: true }), 'unavailable');
    // Unknown secure-context flag (older WebView) → the non-fixable verdict.
    assert.equal(classifyUnsupported({ hasMediaDevices: false }), 'unavailable');
    assert.equal(classifyUnsupported(), 'unavailable');
});

/* ── DOMException taxonomy ───────────────────────────────────────────── */

test('classifyMicFailure delegates to the one recorder taxonomy', () => {
    const error = (name) => Object.assign(new Error(name), { name });
    assert.equal(classifyMicFailure(error('NotAllowedError')), 'denied');
    assert.equal(classifyMicFailure(error('SecurityError')), 'denied');
    assert.equal(classifyMicFailure(error('PermissionDeniedError')), 'denied');
    assert.equal(classifyMicFailure(error('NotFoundError')), 'notFound');
    assert.equal(classifyMicFailure(error('OverconstrainedError')), 'notFound');
    assert.equal(classifyMicFailure(error('NotReadableError')), 'inUse');
    assert.equal(classifyMicFailure(error('TrackStartError')), 'inUse');
    assert.equal(classifyMicFailure(error('AbortError')), 'inUse');
    assert.equal(classifyMicFailure(error('NotSupportedError')), 'unavailable');
    assert.equal(classifyMicFailure(error('Wat')), 'unknown');
    assert.equal(classifyMicFailure(null), 'unknown');
    assert.equal(classifyMicFailure(undefined), 'unknown');
});

/* ── Permission state ────────────────────────────────────────────────── */

test('normalisePermissionState accepts only the four known states', () => {
    assert.equal(normalisePermissionState('granted'), 'granted');
    assert.equal(normalisePermissionState('DENIED'), 'denied');
    assert.equal(normalisePermissionState('  Prompt '), 'prompt');
    assert.equal(normalisePermissionState('unknown'), 'unknown');
    assert.equal(normalisePermissionState(''), 'unknown');
    assert.equal(normalisePermissionState(null), 'unknown');
    assert.equal(normalisePermissionState(42), 'unknown');
    // Every documented state round-trips.
    for (const state of MIC_PERMISSION_STATES) {
        assert.equal(normalisePermissionState(state), state);
    }
});

/* ── Device enumeration ──────────────────────────────────────────────── */

test('audioInputsOf keeps unlabelled inputs — pre-grant labels are empty, not absent', () => {
    const devices = audioInputsOf([
        { kind: 'audioinput', deviceId: 'default', label: '' },
        { kind: 'audioinput', deviceId: 'mic-1', label: '  USB Headset  ' },
        { kind: 'audiooutput', deviceId: 'spk', label: 'Speakers' },
        { kind: 'videoinput', deviceId: 'cam', label: 'Webcam' },
        null,
    ]);
    assert.deepEqual(devices, [
        { deviceId: 'default', label: '' },
        { deviceId: 'mic-1', label: 'USB Headset' },
    ]);
});

test('audioInputsOf survives junk input', () => {
    assert.deepEqual(audioInputsOf(undefined), []);
    assert.deepEqual(audioInputsOf(null), []);
    assert.deepEqual(audioInputsOf('nope'), []);
    assert.deepEqual(audioInputsOf([{ kind: 'audioinput' }]), [{ deviceId: '', label: '' }]);
});

/* ── Non-prompting classification ────────────────────────────────────── */

test('a listed device with no denial is ok — prompt must NOT read as a failure', () => {
    const result = diagnosticsFromEnvironment({
        hasMediaDevices: true,
        isSecureContext: true,
        permission: 'prompt',
        devices: [{ kind: 'audioinput', deviceId: 'default', label: '' }],
    });
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'ok');
    assert.equal(result.permission, 'prompt');
});

test('zero audio inputs is notFound without ever prompting', () => {
    const result = diagnosticsFromEnvironment({
        hasMediaDevices: true,
        isSecureContext: true,
        permission: 'granted',
        devices: [{ kind: 'audiooutput', deviceId: 'spk' }],
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'notFound');
    assert.deepEqual(result.devices, []);
});

test('an explicit denial wins over a listed device', () => {
    const result = diagnosticsFromEnvironment({
        hasMediaDevices: true,
        isSecureContext: true,
        permission: 'denied',
        devices: [{ kind: 'audioinput', deviceId: 'default' }],
    });
    assert.equal(result.reason, 'denied');
    // The device list is still reported — it is useful context for support.
    assert.equal(result.devices.length, 1);
});

test('missing API short-circuits before permission or devices are considered', () => {
    const result = diagnosticsFromEnvironment({
        hasMediaDevices: false,
        isSecureContext: false,
        permission: 'granted',
        devices: [{ kind: 'audioinput', deviceId: 'default' }],
    });
    assert.equal(result.reason, 'insecure');
});

test('an unknown permission state with a device present is ok', () => {
    const result = diagnosticsFromEnvironment({
        hasMediaDevices: true,
        permission: 'unknown',
        devices: [{ kind: 'audioinput', deviceId: 'default' }],
    });
    assert.equal(result.reason, 'ok');
});

/* ── Action plans ────────────────────────────────────────────────────── */

test('every fixable failure resolves to a real button', () => {
    assert.deepEqual(micActionPlan('denied'), { primary: MIC_ACTIONS.RETRY, secondary: MIC_ACTIONS.NONE });
    assert.deepEqual(micActionPlan('notFound'), {
        primary: MIC_ACTIONS.OPEN_SOUND_SETTINGS,
        secondary: MIC_ACTIONS.RETRY,
    });
    assert.deepEqual(micActionPlan('inUse'), { primary: MIC_ACTIONS.RETRY, secondary: MIC_ACTIONS.NONE });
    assert.deepEqual(micActionPlan('unknown'), { primary: MIC_ACTIONS.RETRY, secondary: MIC_ACTIONS.NONE });

    for (const reason of ['denied', 'notFound', 'inUse', 'unknown']) {
        assert.equal(actionHasButton(micActionPlan(reason).primary), true, `${reason} needs a primary action`);
    }
});

test('the unfixable reasons offer no button at all', () => {
    for (const reason of ['insecure', 'unavailable']) {
        const plan = micActionPlan(reason);
        assert.equal(plan.primary, MIC_ACTIONS.NONE, `${reason} must not offer a dead button`);
        assert.equal(plan.secondary, MIC_ACTIONS.NONE);
        assert.equal(actionHasButton(plan.primary), false);
    }
});

test('a healthy microphone still offers "Test again" — a status line is not a dead end', () => {
    const plan = micActionPlan('ok');
    assert.equal(plan.primary, MIC_ACTIONS.RETRY);
    // And that button is allowed to prompt: re-testing means actually capturing.
    assert.equal(actionPrompts(plan.primary), true);
});

test('a plan for an unrecognised reason degrades to no action, not to a guess', () => {
    assert.deepEqual(micActionPlan('somethingNew'), { primary: MIC_ACTIONS.NONE, secondary: MIC_ACTIONS.NONE });
});

test('only Retry is allowed to raise a permission dialog', () => {
    assert.equal(actionPrompts(MIC_ACTIONS.RETRY), true);
    assert.equal(actionPrompts(MIC_ACTIONS.OPEN_SOUND_SETTINGS), false);
    assert.equal(actionPrompts(MIC_ACTIONS.NONE), false);
    assert.equal(actionPrompts('nonsense'), false);
});

/* ── Copy ────────────────────────────────────────────────────────────── */

test('each failure class has DISTINCT title and body copy', () => {
    const failures = ['denied', 'notFound', 'inUse', 'unavailable', 'insecure', 'unknown'];
    const titles = failures.map((reason) => micCopyKeys(reason).title);
    const bodies = failures.map((reason) => micCopyKeys(reason).body);
    assert.equal(new Set(titles).size, failures.length, 'titles must not collide');
    assert.equal(new Set(bodies).size, failures.length, 'bodies must not collide');
});

test('micCopyKeys falls back to the unknown namespace for a stray reason', () => {
    assert.deepEqual(micCopyKeys('bogus'), micCopyKeys('unknown'));
    assert.equal(micCopyKeys(undefined).title, 'chat:mic.unknown.title');
});

test('body copy reuses the composer sentences already shipped in 04-1', () => {
    // The three task-mandated failures must keep their exact existing keys so
    // the composer and the diagnostics panel never say two different things.
    assert.equal(micCopyKeys('denied').body, 'chat:input.micDenied');
    assert.equal(micCopyKeys('notFound').body, 'chat:input.micNotFound');
    assert.equal(micCopyKeys('inUse').body, 'chat:input.micInUse');
});

test('every reason has all four copy keys populated', () => {
    for (const reason of MIC_REASONS) {
        const copy = micCopyKeys(reason);
        for (const field of ['title', 'body', 'primary', 'secondary']) {
            assert.equal(typeof copy[field], 'string');
            assert.ok(copy[field].length > 0, `${reason}.${field} must not be empty`);
            assert.ok(copy[field].includes(':'), `${reason}.${field} must be a namespaced i18n key`);
        }
    }
});

/* ── Re-check policy (step 2) ────────────────────────────────────────── */

test('diagnostics are re-run on the first press after a failure, and only then', () => {
    assert.equal(shouldRecheckOnPress(null), false);
    assert.equal(shouldRecheckOnPress(undefined), false);
    assert.equal(shouldRecheckOnPress(''), false);
    assert.equal(shouldRecheckOnPress('ok'), false);
    for (const reason of ['denied', 'notFound', 'inUse', 'unavailable', 'insecure', 'unknown']) {
        assert.equal(shouldRecheckOnPress(reason), true, `${reason} must trigger a re-check`);
    }
});

/* ── The assembled result ────────────────────────────────────────────── */

test('buildMicIssue assembles copy + actions + normalised devices', () => {
    const issue = buildMicIssue({
        ok: false,
        reason: 'notFound',
        permission: 'granted',
        devices: [{ kind: 'audioinput', deviceId: 'gone', label: 'Unplugged' }],
    });
    assert.equal(issue.ok, false);
    assert.equal(issue.reason, 'notFound');
    assert.equal(issue.permission, 'granted');
    assert.deepEqual(issue.devices, [{ deviceId: 'gone', label: 'Unplugged' }]);
    assert.equal(issue.copy.title, 'chat:mic.notFound.title');
    assert.equal(issue.actions.primary, MIC_ACTIONS.OPEN_SOUND_SETTINGS);
    assert.equal(issue.actions.secondary, MIC_ACTIONS.RETRY);
});

test('buildMicIssue treats an ok result as ok even with an undefined flag', () => {
    const issue = buildMicIssue({ reason: 'ok' });
    assert.equal(issue.ok, true);
    // A healthy mic still gets "Test again" rather than a read-only status line.
    assert.equal(issue.actions.primary, MIC_ACTIONS.RETRY);
});

test('buildMicIssue normalises a missing reason to unknown rather than throwing', () => {
    const issue = buildMicIssue({});
    assert.equal(issue.reason, 'unknown');
    assert.equal(issue.ok, false);
    assert.equal(issue.copy.title, 'chat:mic.unknown.title');
});

test('buildMicIssue never reports ok when ok is false', () => {
    const issue = buildMicIssue({ ok: false, reason: 'ok' });
    assert.equal(issue.ok, false);
});

test('the no-auto-prompt decision is a named, testable constant', () => {
    assert.equal(MIC_PROMPTS_ON_START, false);
});
