import React from 'react';
import useToastStore from '../../store/toastStore.js';

/**
 * ToastHost — fixed-position in-app toast stack (plan 7-15, task W).
 *
 * Mounted once at the app root. Renders the queue from toastStore bottom-right
 * using the app's glass/dark theme tokens so it matches the existing modals.
 */

const TYPE_STYLES = {
    success: {
        border: 'border-green-500/30',
        icon: 'text-green-400',
    },
    error: {
        border: 'border-red-500/30',
        icon: 'text-red-400',
    },
    info: {
        border: 'border-white/15',
        icon: 'text-accent-primary',
    },
};

function ToastIcon({ type }) {
    if (type === 'success') {
        return (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
        );
    }
    if (type === 'error') {
        return (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        );
    }
    return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    );
}

export const ToastHost = () => {
    const toasts = useToastStore((s) => s.toasts);
    const dismiss = useToastStore((s) => s.dismiss);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-16 right-6 z-[10000] flex flex-col gap-3 w-[22rem] max-w-[calc(100vw-3rem)]">
            {toasts.map((toast) => {
                const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info;
                return (
                    <div
                        key={toast.id}
                        role="status"
                        className={`modal-content rounded-xl px-4 py-3 flex items-start gap-3 border ${style.border} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                    >
                        <span className={`mt-0.5 flex-shrink-0 ${style.icon}`}>
                            <ToastIcon type={toast.type} />
                        </span>
                        <div className="flex-1 min-w-0">
                            {toast.title && (
                                <p className="text-sm font-semibold text-text-primary">{toast.title}</p>
                            )}
                            {toast.message && (
                                <p className="text-xs text-text-muted mt-0.5 break-words">{toast.message}</p>
                            )}
                        </div>
                        <button
                            onClick={() => dismiss(toast.id)}
                            aria-label="Dismiss"
                            className="flex-shrink-0 text-text-muted hover:text-text-primary transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

export default ToastHost;
