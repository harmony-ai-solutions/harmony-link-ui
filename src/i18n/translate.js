/**
 * Lazy translator bridge for non-React modules.
 *
 * **Why this exists:** stores and services must be able to produce user-facing
 * text, but they must NOT import `i18n.js`. That module imports the locale JSON
 * files, which Node cannot load without import attributes — so a single
 * `import i18n from '../i18n/i18n.js'` inside `chatStore.js` makes the whole
 * store unloadable under `node --test` and every unit test built on top of it
 * fails at import time.
 *
 * Instead, `i18n.js` registers its `t` function here once at boot
 * ({@link setTranslator}), and consumers import this tiny module — which has no
 * imports of its own.
 *
 * The fallback matters: an unregistered translator (a unit test, or a toast
 * raised before i18n initialises) returns the KEY'S LAST SEGMENT rather than an
 * empty string or a raw dotted key, so a toast always carries text and a
 * missing registration is visible but not ugly.
 */

/** @type {((key: string, options?: object) => string) | null} */
let translator = null;

/**
 * Register the app's translate function. Called ONCE by `i18n.js` after its
 * `init()`; calling it again simply replaces the function (useful for tests).
 *
 * @param {(key: string, options?: object) => string} fn
 */
export function setTranslator(fn) {
    translator = typeof fn === 'function' ? fn : null;
}

/** Clear the registration (tests, or a hot reload of i18n). */
export function clearTranslator() {
    translator = null;
}

/**
 * Translate `key`, falling back to its last segment when no translator is
 * registered.
 *
 * @param {string} key - a namespaced key, e.g. `chat:menu.pin`
 * @param {object} [options] - interpolation values
 * @returns {string}
 */
export function translate(key, options) {
    if (translator) {
        const value = translator(key, options);
        // i18next returns the key itself when a translation is missing; treat
        // that as a miss and fall back to something readable.
        if (value && value !== key) return value;
    }
    if (typeof key !== 'string' || key.length === 0) return '';
    const segment = key.split(/[.:]/).filter(Boolean).pop() || '';
    return segment;
}

/** True when a translator has been registered. */
export function hasTranslator() {
    return translator !== null;
}
