/**
 * Entity display helpers for list/avatar rendering (Entity Settings left rail).
 *
 * Pure functions only — the DOM-dependent clipboard helper guards every
 * browser API behind runtime checks so this module stays importable under
 * plain `node --test` (no jsdom in this repo's harness).
 */

/**
 * First alphanumeric character of the display name, uppercased — the letter
 * shown in the avatar bubble when the entity has no character-profile image.
 * Leading punctuation/symbols are skipped; inputs with no alphanumeric
 * character at all (or non-string inputs) yield '' and the caller renders a
 * generic person glyph instead.
 *
 * @param {unknown} displayName
 * @returns {string}
 */
export function getEntityAvatarLetter(displayName) {
    if (typeof displayName !== 'string') return '';
    const match = displayName.match(/[a-z0-9]/i);
    return match ? match[0].toUpperCase() : '';
}

/**
 * Copy text to the clipboard with a legacy fallback: `navigator.clipboard`
 * is unavailable/untrusted on some self-hosted deployments (self-signed
 * HTTPS is only a secure context when the cert is trusted), so fall back to
 * the hidden-textarea + `document.execCommand('copy')` path.
 *
 * @param {string} text
 * @returns {Promise<boolean>} true when the copy succeeded
 */
export async function copyTextToClipboard(text) {
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // Permission denied / insecure context — fall through to the legacy path.
    }
    try {
        if (typeof document === 'undefined' || !document.body) return false;
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        return ok;
    } catch {
        return false;
    }
}
