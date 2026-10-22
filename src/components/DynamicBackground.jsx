import { useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useDynamicBackgroundStore from '../store/dynamicBackgroundStore';
import { VARIANT_SCENES } from './DynamicBackgroundVariants.jsx';

const AURA_TRAIL_LENGTH = 12;

/**
 * DynamicBackground — a theme-adaptive animated backdrop with selectable
 * scene variants (Aurora / Shapes / Sparkles / Waves).
 *
 * The variant is driven by the Zustand dynamicBackgroundStore, which is seeded
 * from applicationConfig.general.dynamicbackgroundvariant and can be switched
 * instantly from General Settings (no save required).
 *
 * Shared layers (all variants):
 *   - Mouse-following aura (standalone feature, toggleable via
 *     applicationConfig.general.cursoraura / the store's auraEnabled).
 *     The aura has selectable styles (applicationConfig.general.cursoraurastyle):
 *       glow  — soft radial glow (classic)
 *       ring  — crisp glowing ring that hugs the cursor
 *       trail — string of fading dots that chase the cursor
 *       embers — tiny glowing sparks that rise and fade from the cursor
 *                like a sparkler
 *   - Noise/grain overlay — filmic depth
 *
 * Each variant scene renders its own dedicated layers (see
 * DynamicBackgroundVariants.jsx + the CSS in styles/components.css).
 *
 * All colours are derived from CSS custom properties set by ThemeContext.
 * Animations are 100 % CSS for performance.
 *
 * ── Performance contract (do not regress) ──────────────────────────────
 * The cursor aura is moved WITHOUT React state and WITHOUT layout. A single
 * `mousemove` handler stores the pointer position in a ref and schedules one
 * `requestAnimationFrame`; that frame writes `--aura-x` / `--aura-y` (pixel
 * values) straight onto the fixed aura layer's inline style. The CSS then moves
 * the glow with `transform: translate3d(...)`, i.e. on the GPU compositor only.
 *
 * This matters: the aura layer is `position: fixed`, covers the viewport and
 * sits at z-index 40 ABOVE all page content. The previous implementation
 * animated `left`/`top` (layout properties) and called `setState` on every
 * mouse move — which re-rendered the whole background subtree and forced a
 * layout + repaint of a screen-covering overlay on top of everything. That is
 * what made the entire UI visibly shake while the mouse moved, and made
 * scrolling feel laggy. Keep this handler state-free and transform-based.
 *
 * The background itself is rendered as a regular element (not a portal) so
 * it lives inside #root alongside #App, always behind page content
 * (z-index: 0). The mouse-following aura is portaled to document.body in a
 * fixed full-viewport layer at z-index 40 so it stays visible ABOVE buttons,
 * cards and other page content, yet still sits BELOW modals/dialogs (z-50).
 */
function DynamicBackground() {
    // ── All hooks run unconditionally (React Rules of Hooks) ─────────
    const enabled = useDynamicBackgroundStore((s) => s.enabled);
    const variant = useDynamicBackgroundStore((s) => s.variant);
    const auraEnabled = useDynamicBackgroundStore((s) => s.auraEnabled);
    const auraStyle = useDynamicBackgroundStore((s) => s.auraStyle);

    // Embers style: deterministic set of sparker configs (staggered delays so
    // sparks are always mid-flight, varied drift/rise/size for a natural look)
    const embers = useMemo(() => {
        const count = 9;
        const items = [];
        for (let i = 0; i < count; i++) {
            const n = i * 37 + 11;
            items.push({
                size: `${7 + (n % 4) * 2}px`,
                duration: `${(1.3 + (n % 5) * 0.28).toFixed(2)}s`,
                delay: `${-((n * 13) % 20) / 10}s`,
                drift: `${(n % 2 === 0 ? 1 : -1) * (8 + (n % 3) * 12)}px`,
                rise: `${-(55 + (n % 4) * 22)}px`,
            });
        }
        return items;
    }, []);

    // ── Cursor aura refs (position is written outside React) ─────────
    const layerRef = useRef(null);
    const trailDotRefs = useRef([]);
    const trailBufRef = useRef([]);
    const posRef = useRef({ x: 0, y: 0 });
    const rafRef = useRef(0);
    const idleRef = useRef(null);

    useEffect(() => {
        if (!enabled || !auraEnabled) return undefined;

        const centerX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
        const centerY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
        trailBufRef.current = Array.from(
            { length: AURA_TRAIL_LENGTH },
            () => ({ x: centerX, y: centerY })
        );
        posRef.current = { x: centerX, y: centerY };

        // Paint the latest pointer position onto the DOM in one frame.
        const paint = () => {
            rafRef.current = 0;
            const layer = layerRef.current;
            const { x, y } = posRef.current;
            const px = `${x}px`;
            const py = `${y}px`;
            if (layer) {
                layer.style.setProperty('--aura-x', px);
                layer.style.setProperty('--aura-y', py);
            }
            // Trail dots each keep their own (older) position from the buffer.
            if (auraStyle === 'trail') {
                const buf = trailBufRef.current;
                const dots = trailDotRefs.current;
                for (let i = 0; i < dots.length; i++) {
                    const el = dots[i];
                    if (!el) continue;
                    const p = buf[i] || buf[buf.length - 1] || { x, y };
                    el.style.setProperty('--aura-x', `${p.x}px`);
                    el.style.setProperty('--aura-y', `${p.y}px`);
                }
            }
        };

        const onMove = (e) => {
            posRef.current = { x: e.clientX, y: e.clientY };
            if (auraStyle === 'trail') {
                const buf = trailBufRef.current;
                buf.push({ x: e.clientX, y: e.clientY });
                while (buf.length > AURA_TRAIL_LENGTH) buf.shift();
            }
            const layer = layerRef.current;
            if (layer) layer.style.setProperty('--aura-opacity', '0.45');
            if (idleRef.current) clearTimeout(idleRef.current);
            idleRef.current = setTimeout(() => {
                if (layerRef.current) layerRef.current.style.setProperty('--aura-opacity', '0.20');
            }, 2000);
            if (!rafRef.current) rafRef.current = requestAnimationFrame(paint);
        };

        window.addEventListener('mousemove', onMove, { passive: true });
        return () => {
            window.removeEventListener('mousemove', onMove);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = 0;
            if (idleRef.current) clearTimeout(idleRef.current);
        };
    }, [enabled, auraEnabled, auraStyle]);

    // Pause the CSS backdrop animations while the user scrolls.
    //
    // A full-viewport animated backdrop forces the app to recomposite every
    // frame. Layered with the `backdrop-filter` "glass" panels, that reads as a
    // visible wobble/shake while scrolling. Freezing just the backdrop's
    // animations for the duration of the scroll removes that per-frame work;
    // they resume ~140ms after scrolling stops, so nothing looks different when
    // the user is not actively scrolling. The listener uses capture so it also
    // catches scrolls from the nested `.app-main` scroller (scroll events do not
    // bubble, but they do propagate in the capture phase).
    useEffect(() => {
        let idleTimer = null;
        const onScroll = () => {
            document.documentElement.setAttribute('data-scrolling', 'true');
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                document.documentElement.removeAttribute('data-scrolling');
                idleTimer = null;
            }, 140);
        };
        window.addEventListener('scroll', onScroll, { passive: true, capture: true });
        return () => {
            window.removeEventListener('scroll', onScroll, { capture: true });
            if (idleTimer) clearTimeout(idleTimer);
            document.documentElement.removeAttribute('data-scrolling');
        };
    }, []);

    // Pre-compute floating stars (Aurora)
    const particles = useMemo(() => {
        const count = 40;
        const items = [];
        for (let i = 0; i < count; i++) {
            const seed = (i * 73 + 17) % 100;
            const topSeed = (i * 127 + 53) % 100;
            items.push({
                left: `${seed}%`,
                top: `${topSeed}%`,
                delay: `${-(i * 0.45).toFixed(2)}s`,
                duration: `${(5 + (i % 4) * 2.5).toFixed(1)}s`,
                size: `${3 + (i % 4)}px`,
                opacity: 0.25 + (i % 3) * 0.15,
            });
        }
        return items;
    }, []);

    // Pre-compute orb positions (Aurora)
    const orbs = useMemo(() => {
        const count = 4;
        const positions = [];
        for (let i = 0; i < count; i++) {
            const angle = (i * 137.508) % 360;
            const rad = (angle * Math.PI) / 180;
            const dist = 0.20 + i * 0.16;
            positions.push({
                top: `${50 + Math.sin(rad) * 45 * dist}%`,
                left: `${50 + Math.cos(rad) * 45 * dist}%`,
                delay: `${-(i * 2.5).toFixed(1)}s`,
                duration: `${(10 + i * 3).toFixed(1)}s`,
                size: `${380 + i * 120}px`,
                opacity: 0.22 + i * 0.04,
                accentVar: i % 2 === 0
                    ? 'var(--color-accent-primary)'
                    : 'var(--color-accent-secondary)',
            });
        }
        return positions;
    }, []);

    // Render the selected mouse aura style. Structure only — position/opacity
    // are injected as CSS variables at runtime (see the effect above).
    const renderAura = () => {
        if (!auraEnabled) return null;

        switch (auraStyle) {
            case 'ring':
                return <div className="dynamic-bg-aura-ring" />;
            case 'trail': {
                const lastIndex = AURA_TRAIL_LENGTH - 1;
                return (
                    <div className="dynamic-bg-aura-trail">
                        {Array.from({ length: AURA_TRAIL_LENGTH }).map((_, i) => {
                            const t = i / lastIndex; // 0 (tail) → 1 (head, at cursor)
                            return (
                                <span
                                    key={i}
                                    ref={(el) => { trailDotRefs.current[i] = el; }}
                                    className="dynamic-bg-aura-trail-dot"
                                    style={{
                                        '--dot-delay': `${(i * 0.022).toFixed(3)}s`,
                                        '--dot-scale': (0.45 + t * 0.55).toFixed(2),
                                        '--dot-opacity': (0.3 + t * 0.7).toFixed(2),
                                    }}
                                />
                            );
                        })}
                    </div>
                );
            }
            case 'embers':
                return (
                    <div className="dynamic-bg-aura-embers">
                        {embers.map((e, i) => (
                            <span
                                key={i}
                                className="dynamic-bg-aura-ember"
                                style={{
                                    '--ember-size': e.size,
                                    '--ember-duration': e.duration,
                                    '--ember-delay': e.delay,
                                    '--ember-drift': e.drift,
                                    '--ember-rise': e.rise,
                                }}
                            />
                        ))}
                    </div>
                );
            default:
                return <div className="dynamic-bg-aura" />;
        }
    };

    // Choose the scene renderer for the active variant
    const sceneRenderer = VARIANT_SCENES[variant] || VARIANT_SCENES.aurora;

    // ── Bail: clean unmount when disabled ────────────────────────────
    if (!enabled) return null;

    // Rendered as a direct sibling of #App inside #root so both
    // compete in the same stacking context. The fixed positioning
    // and z-index: 0 keep the background behind all page content.
    return (
        <>
            <div className="dynamic-bg" aria-hidden="true" data-variant={variant} data-aura-style={auraStyle}>
                {sceneRenderer({ particles, orbs })}

                {/* Noise texture overlay (shared) */}
                <div className="dynamic-bg-noise" />
            </div>

            {/* Mouse-following aura — standalone feature, works on every variant.
                Portaled to document.body so it renders ABOVE page content
                (buttons/cards) but stays BELOW modals (z-50). */}
            {auraEnabled && createPortal(
                <div ref={layerRef} className="dynamic-bg-aura-layer" aria-hidden="true">
                    {renderAura()}
                </div>,
                document.body
            )}
        </>
    );
}

export default DynamicBackground;
