/**
 * Shared helpers for making a whole card/row toggle its expandable section on
 * click, instead of requiring the user to hit the small chevron.
 *
 * A row-level click handler must not hijack clicks that were meant for the
 * controls living inside the row (buttons, links, form fields), otherwise
 * clicking "Edit" would also collapse the row it belongs to. These helpers keep
 * the two behaviours separate.
 */

// Interactive elements (and explicit opt-outs) that should swallow the click
// instead of toggling the surrounding row.
const INTERACTIVE_SELECTOR = [
    'button',
    'a',
    'input',
    'select',
    'textarea',
    'label',
    'summary',
    '[role="button"]',
    '[role="link"]',
    '[contenteditable="true"]',
    '[data-no-row-toggle]',
].join(', ');

/**
 * Whether a click event should be ignored by a row-level expand/collapse
 * handler because it landed on an interactive control (or an element that
 * opted out via `data-no-row-toggle`).
 *
 * @param {React.MouseEvent|MouseEvent} event
 * @returns {boolean} true when the row should NOT toggle.
 */
export const isRowToggleBlocked = (event) => {
    const target = event?.target;
    if (!target || typeof target.closest !== 'function') return false;
    return Boolean(target.closest(INTERACTIVE_SELECTOR));
};

/**
 * Convenience wrapper: run `toggle` only when the click did not originate from
 * an interactive control. Returns the handler so it can be spread onto a row.
 *
 * @param {() => void} toggle
 * @returns {(event: React.MouseEvent) => void}
 */
export const rowToggleHandler = (toggle) => (event) => {
    if (isRowToggleBlocked(event)) return;
    toggle();
};
