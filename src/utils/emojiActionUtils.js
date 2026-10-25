/**
 * Pure helpers for the emoji-actions editor (plan 03-5c).
 *
 * ## What an emoji action actually is
 *
 * `entity_emoji_actions` is a per-entity table the chat picker
 * ([`EmojiPicker`](../components/chat/EmojiPicker.jsx)) reads. Picking an entry
 * sends its `substitution_text` (or the emoji itself when there is no text) as
 * an ordinary utterance, with an `additional_effects` block attached so the
 * engine shifts the character's mood.
 *
 * ## The wire contract — read this before touching `emotion_effect`
 *
 * `emotion_effect` is a **JSON column holding one emoji action's emotion
 * intent**, e.g. `{"emotion":"joy","delta":2.0}` (the migration comment in
 * `000022_add_entity_emoji_actions.up.sql` writes exactly that). It is NOT what
 * gets sent over the socket. The socket gets
 * `additional_effects.emotion_effects[]` — an ARRAY of `{emotion, delta}` — which
 * the engine maps through `emotion.Ekman8Emotions` and applies with
 * `SetEmotion` ([`applyAdditionalEffects`](../../../modules/cognition/processor.go:388)).
 *
 * The existing chat path ([`handleSendEmojiAction`](../components/chat/ChatDetailView.jsx))
 * flattens the column to a bare emotion NAME and a hard-coded `delta: 0.15`.
 * The editor's **Test** column shows the payload that WILL be sent, and
 * [`buildAdditionalEffects`] is the single implementation of that shape, so the
 * preview cannot drift from the send.
 *
 * @module utils/emojiActionUtils
 */

/** The eight Ekman emotions, in the engine's canonical order (`emotion.AllEkmanEmotions`). */
export const EKMAN_EMOTIONS = [
    'joy', 'sadness', 'trust', 'disgust',
    'fear', 'anger', 'surprise', 'anticipation',
];

/**
 * Delta the chat path attaches for an emoji action.
 *
 * Mirrors `handleSendEmojiAction`'s literal `0.15`. Exported so the Test column
 * and the send path can be compared in one place instead of two literals
 * drifting apart.
 */
export const DEFAULT_EMOJI_EMOTION_DELTA = 0.15;

/** True when `name` is one of the eight Ekman emotions. */
export function isEkmanEmotion(name) {
    return typeof name === 'string' && EKMAN_EMOTIONS.includes(name);
}

/** How many emotion effects one row may carry (see {@link parseEmotionEffect}). */
export const MAX_EMOTION_EFFECTS_PER_ROW = EKMAN_EMOTIONS.length;

/**
 * Parse the `emotion_effect` column into a list of `{emotion, delta}` pairs.
 *
 * Accepts both shapes that exist in the wild, because the app writes JSON and
 * older/manual rows may carry a bare name:
 *
 *   - `'{"emotion":"joy","delta":2.0}'` → `[{emotion:'joy', delta:2}]`
 *   - `'joy'`                           → `[{emotion:'joy'}]`
 *   - `''` / `null` / invalid JSON      → `[]`
 *
 * Unknown emotion names are NOT dropped silently — they are returned with
 * `valid: false` so the editor can show the row as needing attention instead of
 * pretending the field is empty (which is how a broken action becomes invisible
 * and then "mysteriously" does nothing at runtime).
 *
 * @param {string|null|undefined} raw
 * @returns {Array<{emotion: string, delta?: number, valid: boolean}>}
 */
export function parseEmotionEffect(raw) {
    if (raw === null || raw === undefined) return [];
    const text = String(raw).trim();
    if (!text) return [];

    const asEffect = (emotion, delta) => {
        const name = typeof emotion === 'string' ? emotion.trim().toLowerCase() : '';
        if (!name) return null;
        const out = { emotion: name, valid: isEkmanEmotion(name) };
        const num = Number(delta);
        if (Number.isFinite(num) && delta !== undefined && delta !== null && delta !== '') {
            out.delta = num;
        }
        return out;
    };

    // Bare emotion name (legacy / hand-written rows). Restricted to a single
    // identifier-shaped token: "not json" must fall through to the JSON branch
    // and be reported as unparseable, not echoed back as an emotion named
    // "not json" (which would render as an invalid select value with no
    // explanation).
    if (/^[A-Za-z][A-Za-z_]*$/.test(text)) {
        const single = asEffect(text, undefined);
        return single ? [single] : [];
    }
    if (!text.startsWith('{') && !text.startsWith('[') && !text.startsWith('"')) {
        return [];
    }

    try {
        const parsed = JSON.parse(text);
        if (typeof parsed === 'string') {
            const single = asEffect(parsed, undefined);
            return single ? [single] : [];
        }
        if (Array.isArray(parsed)) {
            return parsed
                .map((entry) => {
                    if (typeof entry === 'string') return asEffect(entry, undefined);
                    if (entry && typeof entry === 'object') return asEffect(entry.emotion, entry.delta);
                    return null;
                })
                .filter(Boolean);
        }
        if (parsed && typeof parsed === 'object') {
            const single = asEffect(parsed.emotion, parsed.delta);
            return single ? [single] : [];
        }
    } catch {
        return [];
    }
    return [];
}

/**
 * The FIRST emotion of a row, which is what the single-select editor edits.
 *
 * The column supports one effect per row today; the array tolerance exists
 * because rows written by the app or by hand may carry more. The editor shows
 * the select for the first and keeps the rest untouched in
 * [`serialiseEmotionEffect`]'s `preserved` argument.
 *
 * @param {string|null|undefined} raw
 * @returns {string} an Ekman name, or `''` when the row has no usable emotion
 */
export function primaryEmotion(raw) {
    const effects = parseEmotionEffect(raw).filter((e) => e.valid);
    return effects.length > 0 ? effects[0].emotion : '';
}

/**
 * Write the `emotion_effect` column from a selected emotion.
 *
 * Returns `null` (→ the column is cleared) when no emotion is selected, so
 * "no emotion effect" is representable rather than being written as
 * `{"emotion":""}` — which the engine would log a warning about on every use.
 *
 * @param {string} emotion - one of {@link EKMAN_EMOTIONS}, or '' to clear
 * @param {number} [delta] - omitted when not a finite number
 * @returns {string|null}
 */
export function serialiseEmotionEffect(emotion, delta) {
    const name = typeof emotion === 'string' ? emotion.trim().toLowerCase() : '';
    if (!isEkmanEmotion(name)) return null;
    const out = { emotion: name };
    const num = Number(delta);
    if (Number.isFinite(num)) out.delta = num;
    return JSON.stringify(out);
}

/**
 * Build the `additional_effects` payload a send would attach for this action.
 *
 * Shape is the engine's `events.AdditionalEffects`:
 * `{ emotion_effects: [{ emotion, delta }] }`, or `null` when the action has no
 * emotion effect (the socket omits the key entirely in that case).
 *
 * @param {{emotion_effect?: string|null}} action
 * @param {number} [delta=DEFAULT_EMOJI_EMOTION_DELTA]
 * @returns {{emotion_effects: Array<{emotion: string, delta: number}>}|null}
 */
export function buildAdditionalEffects(action, delta = DEFAULT_EMOJI_EMOTION_DELTA) {
    const raw = action ? action.emotion_effect : null;
    const effects = parseEmotionEffect(raw).filter((e) => e.valid);
    if (effects.length === 0) return null;
    const fallback = Number.isFinite(Number(delta)) ? Number(delta) : DEFAULT_EMOJI_EMOTION_DELTA;
    return {
        emotion_effects: effects.map((e) => ({
            emotion: e.emotion,
            delta: Number.isFinite(e.delta) ? e.delta : fallback,
        })),
    };
}

/**
 * One-line, read-only rendering of the payload for the **Test** column.
 *
 * Empty string when nothing would be sent — the column says "no effects" in
 * words rather than showing `{}`, because an empty object reads like a payload.
 *
 * @param {{emotion_effect?: string|null}} action
 * @returns {string}
 */
export function additionalEffectsPreview(action) {
    const payload = buildAdditionalEffects(action);
    if (!payload) return '';
    return payload.emotion_effects
        .map((e) => `${e.emotion} ${e.delta >= 0 ? '+' : ''}${e.delta}`)
        .join(', ');
}

/**
 * The text a pick of this action would send.
 *
 * NOT trimmed to empty: when `substitution_text` is blank the emoji itself is
 * the message (the existing chat handler does
 * `action.substitution_text || action.emoji_native`).
 *
 * @param {{emoji_native?: string, substitution_text?: string|null}} action
 * @returns {string}
 */
export function emojiActionContent(action) {
    if (!action) return '';
    const text = typeof action.substitution_text === 'string' ? action.substitution_text.trim() : '';
    return text || (action.emoji_native || '');
}

/**
 * Is this row complete enough to save?
 *
 * `emoji_native` is the table's UNIQUE key component with `entity_id`, and the
 * create route 400s on a blank one — so the editor must not offer to add a row
 * that cannot be saved.
 *
 * @param {{emoji_native?: string}} action
 * @returns {boolean}
 */
export function isEmojiActionSavable(action) {
    return !!(action && typeof action.emoji_native === 'string' && action.emoji_native.trim() !== '');
}

/**
 * Seed a new, unsaved row for the editor's "add" button.
 *
 * `id` is null on purpose: the engine assigns a uuidv7 on create, and inventing
 * a client id here would make an unsaved row indistinguishable from a saved one
 * in the key-based reconciliation the editor does on save.
 *
 * @returns {{id: null, emoji_native: string, substitution_text: string, emotion_effect: null, is_default: boolean}}
 */
export function emptyEmojiAction() {
    return {
        id: null,
        emoji_native: '',
        substitution_text: '',
        emotion_effect: null,
        // A brand-new row is never one of the engine's seeded defaults — those
        // are wiped wholesale by `DELETE ?scope=default`, so claiming the flag
        // here would make a user row disappear on the app's next default reset.
        is_default: false,
    };
}

/**
 * Split the editor's rows into the change plan the save loop executes.
 *
 * The emoji-action routes are per-row (`POST` create, `PUT` update, `DELETE`
 * single), so there is no bulk write to send. Comparing the saved snapshot
 * against the current rows is what makes one Save button behave like a bulk
 * edit without inventing a batch endpoint.
 *
 * Rows are matched by `id` when present; rows without one are creates.
 *
 * @param {Array<object>} current - the rows currently in the editor
 * @param {Array<object>} original - the rows as loaded from the engine
 * @returns {{creates: Array<object>, updates: Array<object>, deletes: Array<string>}}
 */
export function planEmojiActionChanges(current, original) {
    const rows = Array.isArray(current) ? current : [];
    const saved = Array.isArray(original) ? original : [];
    const savedById = new Map(saved.filter((r) => r && r.id).map((r) => [r.id, r]));

    const creates = [];
    const updates = [];
    const keptIds = new Set();

    for (const row of rows) {
        if (!isEmojiActionSavable(row)) continue; // incomplete rows are not saved
        if (!row.id) {
            creates.push(row);
            continue;
        }
        keptIds.add(row.id);
        const before = savedById.get(row.id);
        if (!before) {
            // An id we did not load — treat as an update so a stale list cannot
            // make the row vanish on save.
            updates.push(row);
            continue;
        }
        if (emojiActionChanged(row, before)) updates.push(row);
    }

    const deletes = saved
        .filter((r) => r && r.id && !keptIds.has(r.id))
        .map((r) => r.id);

    return { creates, updates, deletes };
}

/** Field-level diff for one row (ignores timestamps and server-owned flags). */
export function emojiActionChanged(row, before) {
    if (!row || !before) return true;
    return (
        (row.emoji_native || '') !== (before.emoji_native || '') ||
        (row.substitution_text || '') !== (before.substitution_text || '') ||
        (row.emotion_effect || null) !== (before.emotion_effect || null)
    );
}

/**
 * Normalise a row loaded from `GET /entities/:id/emoji-actions` for the editor.
 *
 * The wire value of `emotion_effect` is a raw JSON string (the sync model keeps
 * the column shape). The editor works with that same string so an untouched row
 * round-trips byte-identically — this function only guarantees the keys exist.
 *
 * @param {object} raw
 * @returns {{id: string|null, emoji_native: string, substitution_text: string, emotion_effect: string|null, is_default: boolean}}
 */
export function normaliseEmojiActionRow(raw) {
    if (!raw || typeof raw !== 'object') return emptyEmojiAction();
    return {
        id: raw.id || null,
        emoji_native: raw.emoji_native || '',
        substitution_text: typeof raw.substitution_text === 'string' ? raw.substitution_text : '',
        emotion_effect: raw.emotion_effect ?? null,
        is_default: !!raw.is_default,
    };
}
