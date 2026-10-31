import test from 'node:test';
import assert from 'node:assert/strict';
import {
    EKMAN_EMOTIONS,
    DEFAULT_EMOJI_EMOTION_DELTA,
    isEkmanEmotion,
    parseEmotionEffect,
    primaryEmotion,
    serialiseEmotionEffect,
    buildAdditionalEffects,
    additionalEffectsPreview,
    emojiActionContent,
    isEmojiActionSavable,
    emptyEmojiAction,
    planEmojiActionChanges,
    emojiActionChanged,
    normaliseEmojiActionRow,
} from './emojiActionUtils.js';

// ── Ekman set ───────────────────────────────────────────────────────────────

test('EKMAN_EMOTIONS holds exactly the eight engine emotions', () => {
    assert.equal(EKMAN_EMOTIONS.length, 8);
    // Must match emotion.AllEkmanEmotions (neutral is NOT in the 8).
    assert.deepEqual(EKMAN_EMOTIONS, [
        'joy', 'sadness', 'trust', 'disgust',
        'fear', 'anger', 'surprise', 'anticipation',
    ]);
    assert.equal(isEkmanEmotion('neutral'), false);
    assert.equal(isEkmanEmotion('joy'), true);
    assert.equal(isEkmanEmotion('JOY'), false, 'the wire value is lowercase');
});

// ── parseEmotionEffect ──────────────────────────────────────────────────────

test('parseEmotionEffect reads the JSON column shape', () => {
    assert.deepEqual(parseEmotionEffect('{"emotion":"joy","delta":2.0}'), [
        { emotion: 'joy', delta: 2, valid: true },
    ]);
});

test('parseEmotionEffect accepts a bare emotion name (legacy rows)', () => {
    assert.deepEqual(parseEmotionEffect('joy'), [{ emotion: 'joy', valid: true }]);
});

test('parseEmotionEffect keeps unknown emotions visible but marks them invalid', () => {
    assert.deepEqual(parseEmotionEffect('{"emotion":"envy"}'), [
        { emotion: 'envy', valid: false },
    ]);
});

test('parseEmotionEffect tolerates every empty/invalid state', () => {
    for (const raw of ['', '   ', null, undefined, '{}', 'not json', '{bad']) {
        assert.deepEqual(parseEmotionEffect(raw), [], `raw=${String(raw)}`);
    }
});

test('parseEmotionEffect handles an array of effects', () => {
    assert.deepEqual(parseEmotionEffect('[{"emotion":"joy","delta":1},{"emotion":"trust"}]'), [
        { emotion: 'joy', delta: 1, valid: true },
        { emotion: 'trust', valid: true },
    ]);
    assert.deepEqual(parseEmotionEffect('["joy"]'), [{ emotion: 'joy', valid: true }]);
});

// ── primaryEmotion ──────────────────────────────────────────────────────────

test('primaryEmotion returns the first VALID emotion', () => {
    assert.equal(primaryEmotion('{"emotion":"anger"}'), 'anger');
    assert.equal(primaryEmotion('envy'), '', 'an unknown name is not selectable');
    assert.equal(primaryEmotion(''), '');
});

// ── serialiseEmotionEffect ──────────────────────────────────────────────────

test('serialiseEmotionEffect writes the column JSON and clears on empty', () => {
    assert.equal(serialiseEmotionEffect('joy', 2), '{"emotion":"joy","delta":2}');
    assert.equal(serialiseEmotionEffect('joy'), '{"emotion":"joy"}');
    assert.equal(serialiseEmotionEffect(''), null);
    assert.equal(serialiseEmotionEffect('envy'), null, 'a non-Ekman name is never written');
    assert.equal(serialiseEmotionEffect(null), null);
});

test('serialiseEmotionEffect omits a non-finite delta', () => {
    assert.equal(serialiseEmotionEffect('joy', NaN), '{"emotion":"joy"}');
});

// ── buildAdditionalEffects ──────────────────────────────────────────────────

test('buildAdditionalEffects produces the engine wire shape', () => {
    assert.deepEqual(buildAdditionalEffects({ emotion_effect: 'joy' }), {
        emotion_effects: [{ emotion: 'joy', delta: DEFAULT_EMOJI_EMOTION_DELTA }],
    });
    assert.equal(DEFAULT_EMOJI_EMOTION_DELTA, 0.15, 'must match handleSendEmojiAction');
});

test('buildAdditionalEffects prefers the column delta over the fallback', () => {
    assert.deepEqual(buildAdditionalEffects({ emotion_effect: '{"emotion":"joy","delta":2}' }), {
        emotion_effects: [{ emotion: 'joy', delta: 2 }],
    });
});

test('buildAdditionalEffects returns null when nothing would be sent', () => {
    assert.equal(buildAdditionalEffects({ emotion_effect: null }), null);
    assert.equal(buildAdditionalEffects({}), null);
    assert.equal(buildAdditionalEffects(null), null);
    assert.equal(buildAdditionalEffects({ emotion_effect: 'envy' }), null);
});

// ── additionalEffectsPreview ────────────────────────────────────────────────

test('additionalEffectsPreview renders a readable line', () => {
    assert.equal(additionalEffectsPreview({ emotion_effect: 'joy' }), 'joy +0.15');
    assert.equal(additionalEffectsPreview({ emotion_effect: '{"emotion":"anger","delta":-1.5}' }), 'anger -1.5');
    assert.equal(additionalEffectsPreview({ emotion_effect: null }), '');
});

// ── content + validity ──────────────────────────────────────────────────────

test('emojiActionContent falls back from substitution text to the emoji', () => {
    assert.equal(emojiActionContent({ emoji_native: '🔥', substitution_text: 'lights a match' }), 'lights a match');
    assert.equal(emojiActionContent({ emoji_native: '🔥', substitution_text: '   ' }), '🔥');
    assert.equal(emojiActionContent(null), '');
});

test('isEmojiActionSavable requires a non-blank emoji', () => {
    assert.equal(isEmojiActionSavable({ emoji_native: '🔥' }), true);
    assert.equal(isEmojiActionSavable({ emoji_native: '   ' }), false);
    assert.equal(isEmojiActionSavable({ emoji_native: '' }), false);
    assert.equal(isEmojiActionSavable(null), false);
});

test('emptyEmojiAction has no id so a new row cannot be mistaken for a saved one', () => {
    assert.deepEqual(emptyEmojiAction(), {
        id: null,
        emoji_native: '',
        substitution_text: '',
        emotion_effect: null,
        is_default: false,
    });
});

// ── change planning ─────────────────────────────────────────────────────────

test('planEmojiActionChanges splits creates, updates and deletes', () => {
    const original = [
        { id: 'a', emoji_native: '🔥', substitution_text: 'burn', emotion_effect: '{"emotion":"anger"}' },
        { id: 'b', emoji_native: '💧', substitution_text: 'splash', emotion_effect: null },
    ];
    const current = [
        { id: 'a', emoji_native: '🔥', substitution_text: 'burn', emotion_effect: '{"emotion":"anger"}' }, // unchanged
        { id: 'b', emoji_native: '💧', substitution_text: 'soak', emotion_effect: null },                 // updated
        { id: null, emoji_native: '🌙', substitution_text: '', emotion_effect: '{"emotion":"trust"}' },   // created
    ];
    const plan = planEmojiActionChanges(current, original);
    assert.equal(plan.creates.length, 1);
    assert.equal(plan.creates[0].emoji_native, '🌙');
    assert.deepEqual(plan.updates.map((r) => r.id), ['b']);
    assert.deepEqual(plan.deletes, []);
});

test('planEmojiActionChanges deletes rows that were removed from the list', () => {
    const original = [
        { id: 'a', emoji_native: '🔥' },
        { id: 'b', emoji_native: '💧' },
    ];
    const plan = planEmojiActionChanges([{ id: 'a', emoji_native: '🔥' }], original);
    assert.deepEqual(plan.deletes, ['b']);
    assert.equal(plan.creates.length, 0);
    assert.equal(plan.updates.length, 0);
});

test('planEmojiActionChanges never creates an unsavable row', () => {
    const plan = planEmojiActionChanges([{ id: null, emoji_native: '  ' }], []);
    assert.deepEqual(plan.creates, []);
});

test('planEmojiActionChanges treats an unknown id as an update, not a delete+create', () => {
    const plan = planEmojiActionChanges([{ id: 'zzz', emoji_native: '✨' }], []);
    assert.deepEqual(plan.updates.map((r) => r.id), ['zzz']);
    assert.deepEqual(plan.deletes, []);
});

test('planEmojiActionChanges tolerates null input', () => {
    assert.deepEqual(planEmojiActionChanges(null, null), { creates: [], updates: [], deletes: [] });
});

// ── emojiActionChanged ──────────────────────────────────────────────────────

test('emojiActionChanged compares only user-editable fields', () => {
    const a = { id: 'a', emoji_native: '🔥', substitution_text: 'x', emotion_effect: null, updated_at: '2026-01-01' };
    const b = { id: 'a', emoji_native: '🔥', substitution_text: 'x', emotion_effect: null, updated_at: '2026-02-02' };
    assert.equal(emojiActionChanged(a, b), false, 'timestamps must not count as a change');

    assert.equal(emojiActionChanged({ ...a, substitution_text: 'y' }, b), true);
    assert.equal(emojiActionChanged({ ...a, emoji_native: '💧' }, b), true);
    assert.equal(emojiActionChanged({ ...a, emotion_effect: '{"emotion":"joy"}' }, b), true);
    assert.equal(emojiActionChanged(a, null), true);
});

// ── normaliseEmojiActionRow ─────────────────────────────────────────────────

test('normaliseEmojiActionRow guarantees the editor keys exist', () => {
    assert.deepEqual(normaliseEmojiActionRow({
        id: 'a', emoji_native: '🔥', substitution_text: null, emotion_effect: '{"emotion":"joy"}', is_default: 1,
    }), {
        id: 'a',
        emoji_native: '🔥',
        substitution_text: '',
        emotion_effect: '{"emotion":"joy"}',
        is_default: true,
    });
    assert.deepEqual(normaliseEmojiActionRow(null), {
        id: null, emoji_native: '', substitution_text: '', emotion_effect: null, is_default: false,
    });
});
