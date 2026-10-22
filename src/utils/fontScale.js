/**
 * Global font-scale handling.
 *
 * The whole UI is sized in `rem`, so the root `<html>` font-size acts as a
 * single "zoom" knob for every screen. The user's choice (Small / Default /
 * Large) is persisted in localStorage so it survives restarts and is applied
 * immediately at boot — not just while the General Settings view happens to be
 * mounted (the previous behaviour, which meant every other screen stayed small).
 */

export const FONT_SCALE_STORAGE_KEY = 'harmony-font-scale';

export const FONT_SCALE_OPTIONS = [
    { value: 'compact', labelKey: 'generalSettings:fields.fontScale.options.compact' },
    { value: 'default', labelKey: 'generalSettings:fields.fontScale.options.default' },
    { value: 'large', labelKey: 'generalSettings:fields.fontScale.options.large' },
];

/**
 * Root font-size for each tier. Every `rem`-based size in the app scales with
 * these, so raising them lifts all text proportionally. Values are deliberately
 * larger than the previous 0.85/0.9/1.0rem set, which read as too small.
 */
export const FONT_SCALE_MAP = {
    compact: '1.1rem',
    default: '1.2rem',
    large: '1.35rem',
};

export const DEFAULT_FONT_SCALE = 'default';

export function isKnownFontScale(scale) {
    return Object.prototype.hasOwnProperty.call(FONT_SCALE_MAP, scale);
}

export function getStoredFontScale() {
    try {
        const stored = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
        return isKnownFontScale(stored) ? stored : null;
    } catch {
        return null;
    }
}

/**
 * Apply a font scale to the document root.
 *
 * @param {string} scale - One of the keys in {@link FONT_SCALE_MAP}.
 * @param {{ persist?: boolean }} [options] - When `persist` is false the value
 *   is applied without rewriting localStorage (used at boot to re-apply the
 *   stored choice).
 * @returns {string} The resolved scale that was applied.
 */
export function applyFontScale(scale, { persist = true } = {}) {
    const resolved = isKnownFontScale(scale) ? scale : DEFAULT_FONT_SCALE;
    document.documentElement.style.fontSize = FONT_SCALE_MAP[resolved];
    if (persist) {
        try {
            localStorage.setItem(FONT_SCALE_STORAGE_KEY, resolved);
        } catch {
            // Ignore storage failures (private mode, quota, …).
        }
    }
    return resolved;
}

/**
 * Apply the persisted scale at boot. Called from `main.jsx` before React
 * mounts so the very first paint is already at the correct size.
 */
export function applyStoredFontScale() {
    applyFontScale(getStoredFontScale() || DEFAULT_FONT_SCALE, { persist: false });
}
