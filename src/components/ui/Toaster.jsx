import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import useToastStore from '../../store/toastStore.js';
import { CheckIcon, WarningIcon, InfoCircleIcon, XIcon } from '../../constants/icons.jsx';

/**
 * Global toast surface.
 *
 * Renders the queue from [`store/toastStore.js`](../../store/toastStore.js)
 * through a portal into `document.body` — a portal so the stack is never
 * clipped by a scrolling/`overflow:hidden` ancestor such as `.app-main`, and so
 * it paints above modals without being a child of their stacking context.
 *
 * Design notes:
 * - `suspended` exists for the launch splash: the splash is a fixed overlay at
 *   z-index 100, so anything painted during boot either hides behind it or
 *   fights it. While suspended the queue keeps filling but nothing is rendered,
 *   which is what "nothing renders under the splash" means in practice.
 * - Styling is entirely `.hl-toast*` classes in
 *   [`styles/components.css`](../../styles/components.css), driven by theme
 *   tokens (status success / error / info), with a `prefers-reduced-motion`
 *   guard so the entrance animation can be switched off.
 * - Each toast is its own `role="status"` live region and a labelled close
 *   button keeps announcements usable. The container deliberately does NOT
 *   carry `aria-live` as well — nesting live regions makes screen readers
 *   announce every toast twice.
 */

const KIND_ICONS = {
    success: CheckIcon,
    error: WarningIcon,
    info: InfoCircleIcon,
};

function ToastItem({ toast, onDismiss }) {
    const { t } = useTranslation();
    const Icon = KIND_ICONS[toast.kind] || KIND_ICONS.info;

    return (
        <div
            className={`hl-toast hl-toast-${toast.kind}`}
            role="status"
            data-toast-kind={toast.kind}
        >
            <span className="hl-toast-icon" aria-hidden="true">
                <Icon className="hl-toast-icon-svg" />
            </span>
            <span className="hl-toast-message">{toast.message}</span>
            <button
                type="button"
                className="hl-toast-close"
                onClick={() => onDismiss(toast.id)}
                aria-label={t('common:toast.dismiss')}
            >
                <XIcon className="hl-toast-close-svg" />
            </button>
        </div>
    );
}

export default function Toaster({ suspended = false }) {
    const toasts = useToastStore((s) => s.toasts);
    const dismissToast = useToastStore((s) => s.dismissToast);
    const [portalHost, setPortalHost] = useState(null);

    // `document.body` is available at module scope in the browser, but reading
    // it in an effect keeps this safe under SSR/test renderers and guarantees a
    // real element before the portal mounts.
    useEffect(() => {
        setPortalHost(document.body);
    }, []);

    const handleDismiss = useCallback((id) => dismissToast(id), [dismissToast]);

    const { t } = useTranslation();

    if (suspended || !portalHost || toasts.length === 0) return null;

    return createPortal(
        <div className="hl-toaster" role="region" aria-label={t('common:toast.notifications')}>
            {toasts.map((toast) => (
                <ToastItem key={toast.id} toast={toast} onDismiss={handleDismiss} />
            ))}
        </div>,
        portalHost,
    );
}
