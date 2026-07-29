import { useMemo, useState, useEffect, useCallback } from 'react';
import useDynamicBackgroundStore from '../store/dynamicBackgroundStore';

/**
 * DynamicBackground — A theme-adaptive animated backdrop with mouse-following aura.
 *
 * Layers (bottom → top):
 *   1. Base fill (theme's background-base colour)
 *   2. Dot-grid pattern — subtle texture with radial fade
 *   3. Mouse-following radial aura — a large glow that tracks cursor position
 *   4. Floating stars — drifting accent-coloured 4-point stars
 *   5. Animated gradient orbs — large soft blobs drifting across screen
 *   6. Noise/grain overlay — filmic depth
 *
 * All colours are derived from CSS custom properties set by ThemeContext.
 * Animations are 100 % CSS for performance.
 *
 * Rendered as a regular element (not a portal) so it lives inside #root
 * alongside #App. This ensures reliable stacking across all pages — on pages
 * where #App content creates additional stacking contexts, the background
 * still spans the full viewport as a fixed-position sibling.
 */
function DynamicBackground() {
    // ── All hooks run unconditionally (React Rules of Hooks) ─────────
    const enabled = useDynamicBackgroundStore((s) => s.enabled);

    // Mouse position state for the cursor-following aura
    const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
    const [isMoving, setIsMoving] = useState(false);

    const handleMouseMove = useCallback((e) => {
        setMousePos({
            x: e.clientX / window.innerWidth,
            y: e.clientY / window.innerHeight,
        });
        setIsMoving(true);
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

    // Pre-compute floating stars
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

    // Pre-compute orb positions
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

    // ── Bail: clean unmount when disabled ────────────────────────────
    if (!enabled) return null;

    // Rendered as a direct sibling of #App inside #root so both
    // compete in the same stacking context. The fixed positioning
    // and z-index: 0 keep the background behind all page content.
    return (
        <div className="dynamic-bg" aria-hidden="true">
            {/* Layer 1 — Base fill matching theme background */}
            <div className="dynamic-bg-base" />

            {/* Layer 2 — Dot grid */}
            <div className="dynamic-bg-grid" />

            {/* Layer 3 — Mouse-following radial aura */}
            <div
                className="dynamic-bg-aura"
                style={{
                    '--aura-x': `${mousePos.x * 100}%`,
                    '--aura-y': `${mousePos.y * 100}%`,
                    '--aura-opacity': auraOpacity,
                }}
            />

            {/* Layer 4 — Floating stars */}
            {particles.map((p, i) => (
                <div
                    key={`p-${i}`}
                    className="dynamic-bg-particle"
                    style={{
                        '--p-left': p.left,
                        '--p-top': p.top,
                        '--p-delay': p.delay,
                        '--p-duration': p.duration,
                        '--p-size': p.size,
                        '--p-opacity': p.opacity,
                    }}
                />
            ))}

            {/* Layer 5 — Animated gradient orbs */}
            {orbs.map((orb, i) => (
                <div
                    key={`orb-${i}`}
                    className="dynamic-bg-orb"
                    style={{
                        '--orb-top': orb.top,
                        '--orb-left': orb.left,
                        '--orb-delay': orb.delay,
                        '--orb-duration': orb.duration,
                        '--orb-size': orb.size,
                        '--orb-opacity': orb.opacity,
                        '--orb-color': orb.accentVar,
                    }}
                />
            ))}

            {/* Layer 6 — Noise texture overlay */}
            <div className="dynamic-bg-noise" />
        </div>
    );
}

export default DynamicBackground;
