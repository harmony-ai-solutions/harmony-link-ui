/**
 * Developer tools — pure helpers (Phase 3).
 *
 * Side-effect free and free of external imports so they can be unit-tested
 * with `node --test` (the store/service layers touch `import.meta.env`, which
 * is unavailable outside Vite).
 */

/** Emotion names in the fixed Ekman8 display order. */
export const EMOTION_KEYS = [
    'joy', 'sadness', 'trust', 'disgust',
    'fear', 'anger', 'surprise', 'anticipation',
];

/** Human-readable label for a raw emotion key. */
export function emotionLabel(key) {
    if (!key) return '';
    return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Normalise an emotion payload into a sorted `[{key, label, value}]` list.
 * Values are clamped to 0..1 and non-numeric entries become 0, so a malformed
 * payload never breaks the gauge row. Keys present in the payload but not in
 * the canonical Ekman8 set are appended (future-proofing) after the known ones.
 *
 * @param {Record<string, number>} emotion
 * @returns {Array<{key: string, label: string, value: number}>}
 */
export function normalizeEmotion(emotion) {
    if (!emotion || typeof emotion !== 'object') return [];
    const seen = new Set();
    const out = [];
    for (const key of EMOTION_KEYS) {
        if (key in emotion) {
            seen.add(key);
            out.push({ key, label: emotionLabel(key), value: clamp01(emotion[key]) });
        }
    }
    for (const [key, raw] of Object.entries(emotion)) {
        if (seen.has(key) || key === 'last_update') continue;
        out.push({ key, label: emotionLabel(key), value: clamp01(raw) });
    }
    return out;
}

/** Clamp a value into the 0..1 range; non-finite values become 0. */
export function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
}

/** Format a 0..1 intensity as a whole percentage string. */
export function formatPercent(value) {
    return `${Math.round(clamp01(value) * 100)}%`;
}

/**
 * Flatten a module-name → config-id map into a stable, sorted list for
 * rendering. Modules with an empty config id are treated as disabled.
 *
 * @param {Record<string, string>} modules
 * @returns {Array<{name: string, configId: string, enabled: boolean}>}
 */
export function normalizeModules(modules) {
    if (!modules || typeof modules !== 'object') return [];
    return Object.entries(modules)
        .map(([name, configId]) => ({
            name,
            configId: configId || '',
            enabled: !!configId,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Summarise a migration-status payload for the Dev Tools header.
 *
 * @param {Array<{version: number, description: string, applied: boolean}>} migrations
 * @returns {{total: number, applied: number, pending: number, allApplied: boolean}}
 */
export function summarizeMigrations(migrations) {
    const list = Array.isArray(migrations) ? migrations : [];
    const applied = list.filter((m) => m && m.applied).length;
    return {
        total: list.length,
        applied,
        pending: list.length - applied,
        allApplied: list.length > 0 && applied === list.length,
    };
}

/**
 * Map an entity's memory-by-level counts into a stable, ascending list.
 *
 * @param {Record<string, number>} memoryByLevel
 * @returns {Array<{level: number, count: number}>}
 */
export function normalizeMemoryLevels(memoryByLevel) {
    if (!memoryByLevel || typeof memoryByLevel !== 'object') return [];
    return Object.entries(memoryByLevel)
        .map(([level, count]) => ({ level: Number(level), count: Number(count) || 0 }))
        .filter((row) => Number.isFinite(row.level))
        .sort((a, b) => a.level - b.level);
}

/**
 * Detect the `{event_type, status, payload}` envelope of a raw chat frame so
 * the wire inspector (D7) can badge direction/type without re-parsing.
 *
 * @param {object} frame
 * @returns {{eventType: string, status: string, hasPayload: boolean}}
 */
export function describeWireFrame(frame) {
    if (!frame || typeof frame !== 'object') {
        return { eventType: 'unknown', status: '', hasPayload: false };
    }
    return {
        eventType: frame.event_type || 'unknown',
        status: frame.status || '',
        hasPayload: !!(frame.payload && Object.keys(frame.payload).length > 0),
    };
}

/**
 * Serialise a value for the wire inspector with a size guard, so a huge binary
 * payload cannot freeze the panel. Returns the JSON text and whether it was
 * truncated.
 *
 * @param {*} value
 * @param {number} [maxChars]
 * @returns {{text: string, truncated: boolean}}
 */
export function safeStringify(value, maxChars = 20000) {
    let text;
    try {
        text = JSON.stringify(value, null, 2);
    } catch {
        text = String(value);
    }
    if (typeof text !== 'string') text = String(text);
    if (text.length > maxChars) {
        return { text: `${text.slice(0, maxChars)}\n… (truncated)`, truncated: true };
    }
    return { text, truncated: false };
}

/** Short label for a wire frame direction (inbound vs outbound). */
export function wireDirectionLabel(frame) {
    const { eventType } = describeWireFrame(frame);
    if (eventType === 'INIT_ENTITY' || eventType === 'CONNECTION_PING' || eventType === 'ENTITY_UTTERANCE'
        || eventType === 'ENTITY_UTTERANCE_EDIT' || eventType === 'SET_REPLY_MODE' || eventType === 'STT_INPUT_AUDIO') {
        return 'out';
    }
    return 'in';
}
