import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import useDynamicBackgroundStore from '../store/dynamicBackgroundStore';
import { VARIANT_SCENES } from './DynamicBackgroundVariants.jsx';

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

    // Mouse position state for the cursor-following aura
    const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
    const [isMoving, setIsMoving] = useState(false);

    // Trail style: rolling history of recent cursor positions (oldest first)
    const AURA_TRAIL_LENGTH = 12;
    const [trail, setTrail] = useState(() =>
        Array.from({ length: AURA_TRAIL_LENGTH }, () => ({ x: 0.5, y: 0.5 }))
    );
    const trailRef = useRef(
        Array.from({ length: AURA_TRAIL_LENGTH }, () => ({ x: 0.5, y: 0.5 }))
    );

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

    const handleMouseMove = useCallback((e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        setMousePos({ x, y });
        setIsMoving(true);

        // Trail: push current position, keep the ring buffer capped
        const t = trailRef.current;
        t.push({ x, y });
        if (t.length > AURA_TRAIL_LENGTH) t.shift();
        setTrail([...t]);
    }, []);

    // Reset isMoving after mouse stops — keeps the aura subtle when idle
    useEffect(() => {
        if (!isMoving) return;
        const timeout = setTimeout(() => setIsMoving(false), 2000);
        return () => clearTimeout(timeout);
    }, [isMoving, mousePos]);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [handleMouseMove]);

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

    const auraOpacity = isMoving ? 0.45 : 0.20;

    // Render the selected mouse aura style
    const renderAura = () => {
        if (!auraEnabled) return null;

        switch (auraStyle) {
            case 'ring':
                return (
                    <div
                        className="dynamic-bg-aura-ring"
                        style={{
                            '--aura-x': `${mousePos.x * 100}%`,
                            '--aura-y': `${mousePos.y * 100}%`,
                            '--aura-opacity': auraOpacity,
                        }}
                    />
                );
            case 'trail': {
                const lastIndex = AURA_TRAIL_LENGTH - 1;
                return (
                    <div
                        className="dynamic-bg-aura-trail"
                        style={{ '--aura-opacity': auraOpacity }}
                    >
                        {trail.map((p, i) => {
                            const t = i / lastIndex; // 0 (tail) → 1 (head, at cursor)
                            return (
                                <span
                                    key={i}
                                    className="dynamic-bg-aura-trail-dot"
                                    style={{
                                        '--aura-x': `${p.x * 100}%`,
                                        '--aura-y': `${p.y * 100}%`,
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
                    <div
                        className="dynamic-bg-aura-embers"
                        style={{ '--aura-opacity': auraOpacity }}
                    >
                        {embers.map((e, i) => (
                            <span
                                key={i}
                                className="dynamic-bg-aura-ember"
                                style={{
                                    '--aura-x': `${mousePos.x * 100}%`,
                                    '--aura-y': `${mousePos.y * 100}%`,
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
                return (
                    <div
                        className="dynamic-bg-aura"
                        style={{
                            '--aura-x': `${mousePos.x * 100}%`,
                            '--aura-y': `${mousePos.y * 100}%`,
                            '--aura-opacity': auraOpacity,
                        }}
                    />
                );
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
                <div className="dynamic-bg-aura-layer" aria-hidden="true">
                    {renderAura()}
                </div>,
                document.body
            )}
        </>
    );
}

export default DynamicBackground;
