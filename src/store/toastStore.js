import { create } from 'zustand';

/**
 * Global toast queue.
 *
 * A store (not a context) on purpose: success feedback must be reachable from
 * plain service/helper code, not only from components with a hook. Any module
 * can call `pushToast()` / `toast.success()` without being inside React.
 *
 * Behaviour:
 * - Fixed cap of {@link MAX_VISIBLE_TOASTS} toasts. Pushing beyond the cap
 *   drops the OLDEST toast (and cancels its timer) so the newest — usually the
 *   action the user just performed — is always the one that stays.
 * - Auto-dismiss after 4 s; errors stay 8 s (they carry more to read).
 *   `timeout: 0` makes a toast sticky until dismissed by hand.
 * - Timers live outside the store state so a re-render never resets them, and
 *   `dismissToast` cancels the pending timer so nothing double-fires.
 *
 * This only models state; rendering lives in
 * [`components/ui/Toaster.jsx`](../components/ui/Toaster.jsx).
 */

export const TOAST_KINDS = ['success', 'error', 'info'];

export const MAX_VISIBLE_TOASTS = 4;

/** Default lifetime for success/info toasts. */
export const DEFAULT_TOAST_TIMEOUT_MS = 4000;

/** Errors are worth a longer read. */
export const ERROR_TOAST_TIMEOUT_MS = 8000;

/** id → timeout handle. Module-scoped on purpose (see the doc block). */
const timers = new Map();
let idCounter = 0;

const nextToastId = () => {
    idCounter += 1;
    return `toast-${Date.now().toString(36)}-${idCounter.toString(36)}`;
};

const isToastKind = (kind) => TOAST_KINDS.includes(kind);

/**
 * Resolve how long a toast of `kind` should live.
 *
 * An explicit, positive `timeout` always wins; `0` means "sticky"; anything
 * else (undefined, negative, NaN) falls back to the per-kind default.
 */
export const toastLifetimeFor = (kind, timeout) => {
    if (typeof timeout === 'number' && Number.isFinite(timeout)) {
        if (timeout === 0) return 0;
        if (timeout > 0) return timeout;
    }
    return kind === 'error' ? ERROR_TOAST_TIMEOUT_MS : DEFAULT_TOAST_TIMEOUT_MS;
};

/** Normalise loose call styles (`pushToast('text')`, `pushToast({...})`). */
export const normalizeToastInput = (input) => {
    if (typeof input === 'string') {
        return { kind: 'info', message: input };
    }
    if (!input || typeof input !== 'object') {
        return { kind: 'info', message: '' };
    }
    const { kind, message, timeout, ...rest } = input;
    return {
        ...rest,
        kind: isToastKind(kind) ? kind : 'info',
        message: message == null ? '' : String(message),
        timeout,
    };
};

export const clearToastTimer = (id) => {
    const handle = timers.get(id);
    if (handle !== undefined) {
        clearTimeout(handle);
        timers.delete(id);
    }
};

export const clearAllToastTimers = () => {
    timers.forEach((handle) => clearTimeout(handle));
    timers.clear();
};

const useToastStore = create((set, get) => ({
    /** Oldest first; the Toaster stacks them in this order. */
    toasts: [],

    /**
     * Push a toast.
     *
     * @param {Object|string} input
     * @param {'success'|'error'|'info'} [input.kind='info']
     * @param {string} input.message
     * @param {number} [input.timeout] - ms; `0` keeps it until dismissed
     * @returns {string} the new toast id
     */
    pushToast: (input) => {
        const normalized = normalizeToastInput(input);
        const lifetime = toastLifetimeFor(normalized.kind, normalized.timeout);
        const id = normalized.id || nextToastId();

        const toast = {
            ...normalized,
            id,
            timeout: lifetime,
            createdAt: Date.now(),
        };

        set((state) => {
            let next = [...state.toasts, toast];
            const overflow = next.length - MAX_VISIBLE_TOASTS;
            if (overflow > 0) {
                // Evict the oldest — the user just acted, so keep the newest.
                next.slice(0, overflow).forEach((dropped) => clearToastTimer(dropped.id));
                next = next.slice(overflow);
            }
            return { toasts: next };
        });

        if (lifetime > 0) {
            const handle = setTimeout(() => {
                timers.delete(id);
                get().dismissToast(id);
            }, lifetime);
            // Node returns an object handle; browsers a number. Either is fine
            // as an opaque value — we only ever clear it.
            timers.set(id, handle);
        }

        return id;
    },

    /** Remove one toast and cancel its timer. Unknown ids are a no-op. */
    dismissToast: (id) => {
        clearToastTimer(id);
        set((state) => {
            const next = state.toasts.filter((toast) => toast.id !== id);
            return next.length === state.toasts.length ? state : { toasts: next };
        });
    },

    /** Remove every toast (used when leaving a flow, and by tests). */
    clearToasts: () => {
        clearAllToastTimers();
        set((state) => (state.toasts.length === 0 ? state : { toasts: [] }));
    },
}));

export default useToastStore;

/**
 * Service-friendly helpers — no hook required:
 *
 * ```
 * import { toast } from '../store/toastStore.js';
 * toast.success('Settings saved');
 * ```
 */
export const pushToast = (input) => useToastStore.getState().pushToast(input);
export const dismissToast = (id) => useToastStore.getState().dismissToast(id);
export const clearToasts = () => useToastStore.getState().clearToasts();

export const toast = {
    success: (message, options = {}) => pushToast({ ...options, kind: 'success', message }),
    error: (message, options = {}) => pushToast({ ...options, kind: 'error', message }),
    info: (message, options = {}) => pushToast({ ...options, kind: 'info', message }),
    dismiss: dismissToast,
    clear: clearToasts,
};
