/**
 * Conversation quick-actions: pin / archive / mute.
 *
 * **Status: seam only — Phase 02 makes these real.** The engine already has
 * the storage for all three (`chat_conversation_settings.pinned`,
 * `.archived`, and `entities.is_muted`), but there is no Go repository or
 * HTTP/WS endpoint yet, and the chat list payload does not carry the flags.
 * Rather than build a parallel UI that would have to be rewritten, this module
 * is the ONE place Phase 02 fills in:
 *
 * - the toast key mapping is pure and exercised by
 *   `conversationActions.test.js`, so wiring the store actions later needs no
 *   UI change;
 * - {@link NOT_IMPLEMENTED} records the honest state so callers can hide the
 *   affordance instead of firing a toast for a no-op.
 *
 * Nothing here mutates state. {@link announceConversationAction} is the
 * success-feedback helper Phase 02's `chatStore` actions call after their
 * request resolves.
 */
import { toast } from './toastStore.js';

export const CONVERSATION_ACTIONS = ['pin', 'archive', 'mute'];

/** True until Phase 02 ships the repository + endpoints. */
export const NOT_IMPLEMENTED = true;

/**
 * Translation keys (under the `common:toast.*` namespace) for each action in
 * both directions. `on: true` applies the action, `on: false` reverts it.
 */
export const CONVERSATION_TOAST_KEYS = {
    pin: { on: 'conversationPinned', off: 'conversationUnpinned' },
    archive: { on: 'conversationArchived', off: 'conversationUnarchived' },
    mute: { on: 'conversationMuted', off: 'conversationUnmuted' },
};

/**
 * Resolve the short i18n key (without namespace) for a conversation action,
 * or `null` for an unknown action — callers should then stay silent rather
 * than render a raw key into a toast.
 *
 * @param {'pin'|'archive'|'mute'} action
 * @param {boolean} on
 * @returns {string|null}
 */
export const conversationToastKey = (action, on) => {
    const entry = CONVERSATION_TOAST_KEYS[action];
    if (!entry) return null;
    return on ? entry.on : entry.off;
};

/**
 * Push the success toast for a pin/archive/mute toggle.
 *
 * @param {'pin'|'archive'|'mute'} action
 * @param {boolean} on
 * @param {(key: string) => string} translate - a `t` function already bound to
 *   the `common` namespace, so this module stays i18n-free and testable.
 * @returns {string|null} the toast id, or null when nothing was pushed
 */
export const announceConversationAction = (action, on, translate) => {
    const key = conversationToastKey(action, on);
    if (!key || typeof translate !== 'function') return null;
    return toast.success(translate(`toast.${key}`));
};
