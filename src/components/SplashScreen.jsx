import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getConfig } from '../services/management/configService.js';
import { LogDebug } from '../utils/logger.js';

// Timing budget for the launch splash.
const MIN_VISIBLE_MS = 1800;   // never flash the splash away instantly
const MAX_VISIBLE_MS = 4500;   // hard cap so a slow/unreachable engine can't hang the UI
const EXIT_MS = 700;           // must match the `.splash-exit` animation duration

/**
 * Launch splash / welcome screen.
 *
 * Shows the SOULBITS AI wordmark and an animated orb mark while the app
 * boots, then cross-fades away to reveal the UI underneath.
 *
 * Design notes:
 * - Fully theme-adaptive: every colour comes from the live CSS custom
 *   properties set by ThemeContext, with hard-coded fallbacks so the
 *   splash still looks right during the very first paint (before the
 *   theme has been applied).
 * - Self-contained readiness probe: resolves as soon as the management
 *   config is available (or the hard cap is hit), so the splash covers
 *   the initial data fetch instead of a fixed arbitrary delay.
 * - Click / Esc / Enter skips it for power users.
 * - Honours `prefers-reduced-motion` (see splash.css).
 *
 * The orb mark is an inline SVG so no external asset is required — swap
 * the <svg> block for an <img src={logoSrc} /> when a real SoulBits logo
 * asset is available.
 *
 * @param {Object} props
 * @param {Function} props.onDone - called once the splash has fully exited
 */
export default function SplashScreen({ onDone }) {
    const { t } = useTranslation();
    const [exiting, setExiting] = useState(false);

    // Keep the latest callback without re-running the boot effect.
    const onDoneRef = useRef(onDone);
    onDoneRef.current = onDone;

    const finishedRef = useRef(false);
    const exitTimerRef = useRef(null);

    const beginExit = useCallback(() => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        setExiting(true);
        exitTimerRef.current = window.setTimeout(() => {
            onDoneRef.current?.();
        }, EXIT_MS);
    }, []);

    useEffect(() => {
        let cancelled = false;
        let ready = false;
        let minElapsed = false;

        const maybeExit = () => {
            if (cancelled) return;
            if (ready && minElapsed) beginExit();
        };

        // Readiness probe — covers the app's initial config fetch.
        getConfig()
            .then(() => LogDebug('Splash: app config ready'))
            .catch(() => { /* engine not up yet — fall through to the cap */ })
            .finally(() => { ready = true; maybeExit(); });

        const minTimer = window.setTimeout(() => { minElapsed = true; maybeExit(); }, MIN_VISIBLE_MS);
        const maxTimer = window.setTimeout(() => { ready = true; minElapsed = true; maybeExit(); }, MAX_VISIBLE_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(minTimer);
            window.clearTimeout(maxTimer);
        };
    }, [beginExit]);

    // Clear a pending exit timer on unmount.
    useEffect(() => () => {
        if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    }, []);

    const handleSkip = useCallback((event) => {
        if (event.type === 'keydown') {
            const key = event.key;
            if (key !== 'Enter' && key !== ' ' && key !== 'Escape') return;
        }
        beginExit();
    }, [beginExit]);

    return (
        <div
            className={`splash-root ${exiting ? 'splash-exit' : ''}`}
            role="status"
            aria-live="polite"
            aria-label={t('splash.loading')}
            tabIndex={-1}
            onClick={handleSkip}
            onKeyDown={handleSkip}
        >
            <div className="splash-aurora" aria-hidden="true" />

            <div className="splash-content">
                {/* Animated orb mark */}
                <div className="splash-logo" aria-hidden="true">
                    <svg className="splash-mark" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="splashGrad" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="var(--color-accent-primary, #b84fd0)" />
                                <stop offset="55%" stopColor="var(--color-accent-secondary, #4a5fcf)" />
                                <stop offset="100%" stopColor="var(--color-accent-primary, #b84fd0)" />
                            </linearGradient>
                            <radialGradient id="splashCore" cx="50%" cy="45%" r="60%">
                                <stop offset="0%" stopColor="var(--color-accent-primary, #b84fd0)" stopOpacity="0.85" />
                                <stop offset="100%" stopColor="var(--color-accent-secondary, #4a5fcf)" stopOpacity="0" />
                            </radialGradient>
                        </defs>

                        <circle className="splash-mark-halo" cx="60" cy="60" r="52" fill="url(#splashCore)" />
                        <circle
                            className="splash-mark-ring"
                            cx="60" cy="60" r="42"
                            fill="none"
                            stroke="url(#splashGrad)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeDasharray="150 90"
                        />
                        <circle
                            className="splash-mark-ring-2"
                            cx="60" cy="60" r="30"
                            fill="none"
                            stroke="url(#splashGrad)"
                            strokeWidth="1.2"
                            strokeDasharray="5 9"
                        />
                        <circle className="splash-mark-core" cx="60" cy="60" r="13" fill="url(#splashGrad)" />
                        <g className="splash-mark-orbit">
                            <circle cx="60" cy="18" r="4.5" fill="var(--color-accent-primary, #b84fd0)" />
                        </g>
                    </svg>
                </div>

                {/* Wordmark */}
                <div className="splash-wordmark" data-text={t('splash.brand')}>
                    {t('splash.brand')}
                </div>

                {/* Sub-label */}
                <div className="splash-sub">
                    <span className="splash-sub-line" aria-hidden="true" />
                    <span className="splash-sub-text">{t('splash.brandSub')}</span>
                    <span className="splash-sub-line" aria-hidden="true" />
                </div>

                <p className="splash-tagline">{t('splash.tagline')}</p>
            </div>

            <div className="splash-loader" aria-hidden="true">
                <span /><span /><span />
            </div>
        </div>
    );
}
