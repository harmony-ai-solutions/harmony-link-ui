import test from 'node:test';
import assert from 'node:assert/strict';

import {
    MIC_PROMPTS_ON_START,
    checkMicrophone,
    clearMicIssue,
    getLastMicIssue,
    readMicPermission,
    rememberMicIssue,
} from './micDiagnostics.js';
import { MIC_ACTIONS } from './micDiagnosticsUtils.js';

/**
 * The driver's whole value is its PROMPT DISCIPLINE: a settings screen may call
 * it on mount, and doing so must never raise a permission dialog. That is the
 * one property worth a dedicated test file, because it is the one that fails
 * silently (the dialog appears, the user is interrupted, no test goes red) and
 * because it is Task 04-2 step 3.
 */

/* ── Fakes ───────────────────────────────────────────────────────────── */

function makeEnv({
    devices = [{ kind: 'audioinput', deviceId: 'default', label: '' }],
    permission = 'prompt',
    getUserMedia = null,
    isSecureContext = true,
    enumerateError = null,
    permissionError = null,
} = {}) {
    const calls = { enumerate: 0, getUserMedia: 0, released: 0 };
    const env = {
        isSecureContext,
        navigator: {
            mediaDevices: {
                async enumerateDevices() {
                    calls.enumerate += 1;
                    if (enumerateError) throw enumerateError;
                    return devices;
                },
                async getUserMedia(constraints) {
                    calls.getUserMedia += 1;
                    if (getUserMedia) return getUserMedia(constraints);
                    return {
                        getTracks: () => [{ stop: () => { calls.released += 1; } }],
                    };
                },
            },
        },
        permissions: {
            async query({ name }) {
                if (permissionError) throw permissionError;
                assert.equal(name, 'microphone');
                return { state: permission };
            },
        },
    };
    return { env, calls };
}

const domError = (name) => Object.assign(new Error(name), { name });

/* ── The rule: diagnosis does not prompt ─────────────────────────────── */

test('checkMicrophone does not touch getUserMedia by default', async () => {
    const { env, calls } = makeEnv();
    const result = await checkMicrophone({ env });
    assert.equal(calls.getUserMedia, 0, 'a mount-time check must never raise a dialog');
    assert.equal(calls.enumerate, 1);
    assert.equal(result.reason, 'ok');
});

test('requestAccess: true is the ONLY way to prompt', async () => {
    const { env, calls } = makeEnv({ permission: 'granted' });
    await checkMicrophone({ env, requestAccess: true });
    assert.equal(calls.getUserMedia, 1);
});

test('a probe stream is released immediately so the OS mic indicator clears', async () => {
    const { env, calls } = makeEnv({ permission: 'granted' });
    await checkMicrophone({ env, requestAccess: true });
    assert.ok(calls.released >= 1, 'every probe track must be stopped');
});

test('the no-auto-prompt decision is exported, not just documented', () => {
    assert.equal(MIC_PROMPTS_ON_START, false);
});

/* ── Environment classification ─────────────────────────────────────── */

test('no mediaDevices at all reports unavailable without throwing', async () => {
    const result = await checkMicrophone({ env: { navigator: {}, isSecureContext: true } });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'unavailable');
    assert.equal(result.actions.primary, MIC_ACTIONS.NONE);
});

test('an insecure context is reported as insecure, not as a missing microphone', async () => {
    const result = await checkMicrophone({ env: { navigator: {}, isSecureContext: false } });
    assert.equal(result.reason, 'insecure');
});

test('zero audio inputs is notFound and offers the OS sound panel', async () => {
    const { env } = makeEnv({ devices: [{ kind: 'audiooutput', deviceId: 'spk' }], permission: 'granted' });
    const result = await checkMicrophone({ env });
    assert.equal(result.reason, 'notFound');
    assert.equal(result.actions.primary, MIC_ACTIONS.OPEN_SOUND_SETTINGS);
    assert.equal(result.actions.secondary, MIC_ACTIONS.RETRY);
});

test('a pre-grant prompt state is ok, and labels may be empty', async () => {
    const { env } = makeEnv({
        devices: [{ kind: 'audioinput', deviceId: 'default', label: '' }],
        permission: 'prompt',
    });
    const result = await checkMicrophone({ env });
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'ok');
    assert.equal(result.permission, 'prompt');
    assert.equal(result.devices.length, 1);
});

test('an already-denied permission is reported without a prompt', async () => {
    const { env, calls } = makeEnv({ permission: 'denied' });
    const result = await checkMicrophone({ env });
    assert.equal(result.reason, 'denied');
    assert.equal(calls.getUserMedia, 0);
    assert.equal(result.actions.primary, MIC_ACTIONS.RETRY);
});

test('a Permissions API rejection degrades to unknown instead of failing the check', async () => {
    const { env } = makeEnv({ permissionError: domError('TypeError') });
    const result = await checkMicrophone({ env });
    assert.equal(result.permission, 'unknown');
    // The device is still listed, so the mic is usable — no error is surfaced.
    assert.equal(result.ok, true);
});

test('an enumerateDevices rejection is unknown, NOT "no microphone"', async () => {
    const { env } = makeEnv({ enumerateError: domError('NotAllowedError') });
    const result = await checkMicrophone({ env });
    assert.equal(result.reason, 'unknown');
    assert.equal(result.actions.primary, MIC_ACTIONS.RETRY);
});

/* ── Explicit grants map to the task's three failure classes ────────── */

test('NotAllowedError from an explicit grant is denied with a Retry', async () => {
    const { env } = makeEnv({
        permission: 'prompt',
        getUserMedia: () => Promise.reject(domError('NotAllowedError')),
    });
    const result = await checkMicrophone({ env, requestAccess: true });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'denied');
    assert.equal(result.copy.title, 'chat:mic.denied.title');
    assert.equal(result.copy.body, 'chat:input.micDenied');
    assert.equal(result.actions.primary, MIC_ACTIONS.RETRY);
});

test('NotFoundError from an explicit grant is notFound with the sound panel', async () => {
    const { env } = makeEnv({
        permission: 'prompt',
        getUserMedia: () => Promise.reject(domError('NotFoundError')),
    });
    const result = await checkMicrophone({ env, requestAccess: true });
    assert.equal(result.reason, 'notFound');
    assert.equal(result.copy.body, 'chat:input.micNotFound');
    assert.equal(result.actions.primary, MIC_ACTIONS.OPEN_SOUND_SETTINGS);
});

test('NotReadableError from an explicit grant is inUse with a Retry', async () => {
    const { env } = makeEnv({
        permission: 'prompt',
        getUserMedia: () => Promise.reject(domError('NotReadableError')),
    });
    const result = await checkMicrophone({ env, requestAccess: true });
    assert.equal(result.reason, 'inUse');
    assert.equal(result.copy.body, 'chat:input.micInUse');
    assert.equal(result.actions.primary, MIC_ACTIONS.RETRY);
});

test('the three failure classes produce three different titles and actions', async () => {
    const cases = [
        ['NotAllowedError', 'denied'],
        ['NotFoundError', 'notFound'],
        ['NotReadableError', 'inUse'],
    ];
    const seen = new Set();
    for (const [name, expected] of cases) {
        const { env } = makeEnv({ getUserMedia: () => Promise.reject(domError(name)) });
        const result = await checkMicrophone({ env, requestAccess: true });
        assert.equal(result.reason, expected);
        seen.add(result.copy.title);
        seen.add(result.copy.body);
    }
    assert.equal(seen.size, 6, 'six distinct strings for three distinct failures');
});

test('a successful grant reports ok even when the permission read says prompt', async () => {
    const { env } = makeEnv({ permission: 'prompt' });
    const result = await checkMicrophone({ env, requestAccess: true });
    assert.equal(result.ok, true);
    assert.equal(result.reason, 'ok');
});

/* ── Permission helper ──────────────────────────────────────────────── */

test('readMicPermission answers unknown when the API is missing', async () => {
    assert.equal(await readMicPermission({}, true), 'unknown');
    assert.equal(await readMicPermission(undefined, true), 'unknown');
});

test('readMicPermission does not query an insecure context', async () => {
    const { env } = makeEnv({ permission: 'granted' });
    assert.equal(await readMicPermission(env, false), 'unknown');
});

/* ── The remembered failure (step 2) ────────────────────────────────── */

test('the last failure is remembered until a take succeeds', () => {
    clearMicIssue();
    assert.equal(getLastMicIssue(), null);

    rememberMicIssue('denied');
    assert.equal(getLastMicIssue(), 'denied');

    // A later success clears it, so the next press does not re-check.
    rememberMicIssue('ok');
    assert.equal(getLastMicIssue(), null);
});

test('rememberMicIssue ignores junk instead of blaming the microphone', () => {
    clearMicIssue();
    rememberMicIssue('');
    assert.equal(getLastMicIssue(), null);
    rememberMicIssue(null);
    assert.equal(getLastMicIssue(), null);
    rememberMicIssue('ok');
    assert.equal(getLastMicIssue(), null);
    rememberMicIssue(42);
    assert.equal(getLastMicIssue(), null);

    rememberMicIssue('inUse');
    assert.equal(getLastMicIssue(), 'inUse');
    clearMicIssue();
    assert.equal(getLastMicIssue(), null);
});
