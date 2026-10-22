import test from 'node:test';
import assert from 'node:assert/strict';
import {
    EMOTION_KEYS,
    emotionLabel,
    normalizeEmotion,
    clamp01,
    formatPercent,
    normalizeModules,
    summarizeMigrations,
    normalizeMemoryLevels,
    describeWireFrame,
    safeStringify,
    wireDirectionLabel,
} from './devtoolsUtils.js';

test('clamp01 clamps and coerces', () => {
    assert.equal(clamp01(0.5), 0.5);
    assert.equal(clamp01(-1), 0);
    assert.equal(clamp01(2), 1);
    assert.equal(clamp01('0.25'), 0.25);
    assert.equal(clamp01('nope'), 0);
    assert.equal(clamp01(NaN), 0);
});

test('emotionLabel capitalises', () => {
    assert.equal(emotionLabel('joy'), 'Joy');
    assert.equal(emotionLabel('anticipation'), 'Anticipation');
    assert.equal(emotionLabel(''), '');
});

test('normalizeEmotion keeps canonical order and clamps values', () => {
    const rows = normalizeEmotion({ trust: 0.4, joy: 1.5, anger: -0.2 });
    assert.deepEqual(rows.map((r) => r.key), ['joy', 'trust', 'anger']);
    assert.equal(rows[0].value, 1);
    assert.equal(rows[1].value, 0.4);
    assert.equal(rows[2].value, 0);
});

test('normalizeEmotion appends unknown keys and ignores last_update', () => {
    const rows = normalizeEmotion({ joy: 0.1, curiosity: 0.7, last_update: '2026-01-01' });
    const keys = rows.map((r) => r.key);
    assert.deepEqual(keys, ['joy', 'curiosity']);
    assert.equal(rows[1].label, 'Curiosity');
});

test('normalizeEmotion tolerates malformed input', () => {
    assert.deepEqual(normalizeEmotion(null), []);
    assert.deepEqual(normalizeEmotion(undefined), []);
    assert.deepEqual(normalizeEmotion('nope'), []);
});

test('formatPercent rounds to whole percent', () => {
    assert.equal(formatPercent(0.756), '76%');
    assert.equal(formatPercent(0), '0%');
    assert.equal(formatPercent(1), '100%');
});

test('normalizeModules sorts and marks enabled', () => {
    const rows = normalizeModules({ rag: 'r1', backend: '', vision: 'v1' });
    assert.deepEqual(rows.map((r) => r.name), ['backend', 'rag', 'vision']);
    assert.equal(rows[0].enabled, false);
    assert.equal(rows[1].enabled, true);
    assert.equal(rows[1].configId, 'r1');
});

test('normalizeModules tolerates malformed input', () => {
    assert.deepEqual(normalizeModules(null), []);
    assert.deepEqual(normalizeModules([]), []);
});

test('summarizeMigrations counts applied/pending', () => {
    const s = summarizeMigrations([
        { version: 1, applied: true },
        { version: 2, applied: false },
        { version: 3, applied: true },
    ]);
    assert.equal(s.total, 3);
    assert.equal(s.applied, 2);
    assert.equal(s.pending, 1);
    assert.equal(s.allApplied, false);
});

test('summarizeMigrations allApplied only when non-empty and all true', () => {
    assert.equal(summarizeMigrations([]).allApplied, false);
    assert.equal(summarizeMigrations([{ applied: true }]).allApplied, true);
});

test('normalizeMemoryLevels sorts ascending and filters bad levels', () => {
    const rows = normalizeMemoryLevels({ '2': 5, '0': 1, bad: 3, '1': 2 });
    assert.deepEqual(rows, [
        { level: 0, count: 1 },
        { level: 1, count: 2 },
        { level: 2, count: 5 },
    ]);
});

test('normalizeMemoryLevels tolerates malformed input', () => {
    assert.deepEqual(normalizeMemoryLevels(null), []);
    assert.deepEqual(normalizeMemoryLevels('x'), []);
});

test('describeWireFrame reads the envelope', () => {
    const d = describeWireFrame({ event_type: 'AI_UTTERANCE', status: 'SUCCESS', payload: { a: 1 } });
    assert.equal(d.eventType, 'AI_UTTERANCE');
    assert.equal(d.status, 'SUCCESS');
    assert.equal(d.hasPayload, true);
    assert.deepEqual(describeWireFrame(null), { eventType: 'unknown', status: '', hasPayload: false });
});

test('safeStringify truncates oversized payloads', () => {
    const big = { blob: 'x'.repeat(50000) };
    const { text, truncated } = safeStringify(big, 100);
    assert.equal(truncated, true);
    assert.ok(text.includes('(truncated)'));
    const small = safeStringify({ a: 1 });
    assert.equal(small.truncated, false);
    assert.ok(small.text.includes('"a"'));
});

test('wireDirectionLabel classifies outbound frames', () => {
    assert.equal(wireDirectionLabel({ event_type: 'ENTITY_UTTERANCE' }), 'out');
    assert.equal(wireDirectionLabel({ event_type: 'INIT_ENTITY' }), 'out');
    assert.equal(wireDirectionLabel({ event_type: 'AI_UTTERANCE' }), 'in');
    assert.equal(wireDirectionLabel(null), 'in');
});

test('EMOTION_KEYS has the eight Ekman emotions', () => {
    assert.equal(EMOTION_KEYS.length, 8);
    assert.ok(EMOTION_KEYS.includes('joy'));
    assert.ok(EMOTION_KEYS.includes('anticipation'));
});
