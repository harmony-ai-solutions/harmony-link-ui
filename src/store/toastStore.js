import { create } from 'zustand';

/**
 * toastStore — lightweight in-app toast queue (plan 7-15, task W).
 *
 * The desktop had no in-app toast primitive; the paired-device notification
 * (task W §3) needs one. Kept deliberately small: a push/dismiss queue with an
 * auto-dismiss timer, rendered by <ToastHost />.
 */

let seq = 0;

const useToastStore = create((set, get) => ({
    toasts: [],

    /**
     * Push a toast. Returns its id.
     * @param {Object} toast
     * @param {string} [toast.type='info'] - 'info' | 'success' | 'error'.
     * @param {string} toast.title
     * @param {string} [toast.message]
     * @param {number} [toast.duration=5000] - Auto-dismiss after ms (0 = sticky).
     */
    push: (toast) => {
        const id = ++seq;
        const entry = { id, type: 'info', duration: 5000, ...toast };
        set((s) => ({ toasts: [...s.toasts, entry] }));
        if (entry.duration > 0) {
            setTimeout(() => get().dismiss(id), entry.duration);
        }
        return id;
    },

    dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export default useToastStore;
