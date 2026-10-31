import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useHealthStore, { isOffline } from '../../store/healthStore.js';
import useChatStore from '../../store/chatStore.js';
import Tooltip from './Tooltip.jsx';
import { RefreshIcon } from '../../constants/icons.jsx';

/**
 * Engine-health surfaces for the shell (plan task 01-6).
 *
 * Two pieces, both reading the same [`healthStore`](../../store/healthStore.js):
 *
 * - {@link HealthIndicator} — the slim pill that sits in the top bar next to the
 *   language picker. Three states: **Connected**, **Degraded** (engine reachable,
 *   live chat socket down) and **Offline**. During the very first probe it reads
 *   **Checking** instead of guessing.
 * - {@link HealthBanner} — a persistent strip above the content column, rendered
 *   only while **Offline**, with a single **Retry** action.
 *
 * Colour semantics are deliberately the existing `.chat-detail-status-*` ones
 * (`connected` → success, `reconnecting` → warning, `error` → danger), so the
 * engine health reads the same as the per-conversation status inside chat rather
 * than inventing a second traffic-light vocabulary.
 *
 * Navigation is never blocked: the banner is an `<aside>` in the normal flow and
 * the cached stores keep rendering underneath it. A user who is offline can still
 * browse their messages, characters and settings — they just cannot refetch.
 */

/** Map a health state onto the existing `chat-detail-status-*` suffix. */
export function healthStatusClass(status) {
    if (status === 'connected') return 'chat-detail-status-connected';
    if (status === 'degraded') return 'chat-detail-status-reconnecting';
    if (status === 'offline') return 'chat-detail-status-error';
    return '';
}

/** i18n key (in the `common` namespace) for a health state's label. */
export function healthLabelKey(status) {
    switch (status) {
        case 'connected': return 'health.connected';
        case 'degraded': return 'health.degraded';
        case 'offline': return 'health.offline';
        default: return 'health.checking';
    }
}

/**
 * Subscribe the health store to the live chat socket.
 *
 * The socket only exists while a conversation is open, so `idle` must NOT read
 * as "down" — [`deriveHealthState`](../../store/healthStore.js) already treats
 * `idle` as healthy and only `connecting`/`reconnecting`/`error` as degraded.
 * Pushing it through a store subscription (not a React effect on a selector)
 * means a socket drop between polls flips the pill immediately, without waiting
 * for the next 15 s probe.
 */
function useSocketHealthBridge() {
    useEffect(() => {
        const push = (socketState) => useHealthStore.getState().setSocketState(socketState);
        push(useChatStore.getState().connectionState);
        return useChatStore.subscribe((state, previous) => {
            if (state.connectionState !== previous.connectionState) {
                push(state.connectionState);
            }
        });
    }, []);
}

/**
 * Own the health lifecycle: start polling, bridge the chat socket, stop on
 * unmount.
 *
 * Call this ONCE, in the shell. The two surfaces below are pure subscribers, so
 * rendering `<HealthIndicator />` in the nav and `<HealthBanner />` in the
 * content column does not create two pollers or two socket subscriptions.
 */
export function useEngineHealth() {
    useEffect(() => {
        useHealthStore.getState().start();
        return () => useHealthStore.getState().stop();
    }, []);
    useSocketHealthBridge();
}

/**
 * Slim top-bar status strip: a coloured dot + label, three states.
 *
 * The tooltip carries the detail (which endpoint failed, when it was last
 * checked) so the pill itself can stay one word wide next to the language picker
 * and the theme toggle.
 */
export function HealthIndicator({ className = '' }) {
    const { t } = useTranslation();
    const status = useHealthStore((s) => s.status);
    const managementOk = useHealthStore((s) => s.managementOk);
    const engineOk = useHealthStore((s) => s.engineOk);
    const socketState = useHealthStore((s) => s.socketState);
    const lastError = useHealthStore((s) => s.lastError);

    const label = t(healthLabelKey(status));

    // One line naming the failing layer, so "Degraded" is actionable.
    let detailKey = 'health.detail.allOk';
    if (status === 'degraded') detailKey = 'health.detail.socketDown';
    else if (!managementOk) detailKey = 'health.detail.managementDown';
    else if (!engineOk) detailKey = 'health.detail.eventServerDown';
    else if (status === 'checking') detailKey = 'health.detail.probing';

    const detail = t(detailKey, { socketState, error: lastError || '' });

    return (
        <Tooltip content={detail} placement="bottom">
            <span
                className={`app-health-pill app-health-pill-${status} ${className}`}
                role="status"
                aria-live="polite"
                aria-label={label}
                data-tutorial-id="app-health-indicator"
            >
                {/* The dot takes its colour from `.app-health-pill-<status>`
                    in CSS; only the LABEL reuses `.chat-detail-status-*`, whose
                    rules are `color:`-only and so cannot style a block dot. */}
                <span className="app-health-dot" aria-hidden="true" />
                <span className={`app-health-label ${healthStatusClass(status)}`}>{label}</span>
            </span>
        </Tooltip>
    );
}

/**
 * Persistent banner above the content column while the engine is **Offline**.
 *
 * Rendered as a normal block (not an overlay) on purpose: navigation and every
 * cached view stay usable, which is the task's fourth requirement. It disappears
 * on its own the moment a probe (or Retry) succeeds.
 */
export function HealthBanner() {
    const { t } = useTranslation();
    const status = useHealthStore((s) => s.status);
    const probing = useHealthStore((s) => s.probing);
    const retry = useHealthStore((s) => s.retry);
    const managementOk = useHealthStore((s) => s.managementOk);
    const engineOk = useHealthStore((s) => s.engineOk);
    const lastError = useHealthStore((s) => s.lastError);

    if (!isOffline(status)) return null;

    // Name the layer that is down — "engine is down" is misleading when only one
    // of the two servers failed to answer.
    const descriptionKey = !managementOk
        ? 'health.banner.managementDown'
        : !engineOk
            ? 'health.banner.eventServerDown'
            : 'health.banner.default';

    return (
        <aside
            className="app-health-banner"
            role="alert"
            data-tutorial-id="app-health-banner"
        >
            <span className="app-health-banner-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
            </span>

            <div className="app-health-banner-text">
                <p className="app-health-banner-title">{t('health.banner.title')}</p>
                <p className="app-health-banner-desc">
                    {t(descriptionKey)}
                    {lastError ? <span className="app-health-banner-err"> — {lastError}</span> : null}
                </p>
            </div>

            <button
                type="button"
                className="btn-secondary app-health-banner-retry"
                onClick={() => retry()}
                disabled={probing}
                aria-busy={probing}
            >
                <RefreshIcon className={`w-3.5 h-3.5${probing ? ' app-health-spin' : ''}`} />
                <span>{probing ? t('health.banner.retrying') : t('health.banner.retry')}</span>
            </button>
        </aside>
    );
}

/** Convenience wrapper: owns the lifecycle and renders both surfaces. */
export default function EngineHealth({ withBanner = true, withIndicator = true }) {
    useEngineHealth();
    return (
        <>
            {withIndicator ? <HealthIndicator /> : null}
            {withBanner ? <HealthBanner /> : null}
        </>
    );
}
