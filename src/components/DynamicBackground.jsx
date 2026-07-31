import { useMemo, useState, useEffect, useCallback } from 'react';
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
 *   - Mouse-following radial aura (standalone feature, toggleable via
 *     applicationConfig.general.cursoraura / the store's auraEnabled)
 *   - Noise/grain overlay — filmic depth
 *
 * Each variant scene renders its own dedicated layers (see
 * DynamicBackgroundVariants.jsx + the CSS in styles/components.css).
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
    const variant = useDynamicBackgroundStore((s) => s.variant);
    const auraEnabled = useDynamicBackgroundStore((s) => s.auraEnabled);

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

    // Choose the scene renderer for the active variant
    const sceneRenderer = VARIANT_SCENES[variant] || VARIANT_SCENES.aurora;

    // ── Bail: clean unmount when disabled ────────────────────────────
    if (!enabled) return null;

    // Rendered as a direct sibling of #App inside #root so both
    // compete in the same stacking context. The fixed positioning
    // and z-index: 0 keep the background behind all page content.
    return (
        <div className="dynamic-bg" aria-hidden="true" data-variant={variant}>
            {sceneRenderer({ particles, orbs })}

            {/* Mouse-following radial aura — standalone feature, works on every variant */}
            {auraEnabled && (
                <div
                    className="dynamic-bg-aura"
                    style={{
                        '--aura-x': `${mousePos.x * 100}%`,
                        '--aura-y': `${mousePos.y * 100}%`,
                        '--aura-opacity': auraOpacity,
                    }}
                />
            )}

            {/* Noise texture overlay (shared) */}
            <div className="dynamic-bg-noise" />
        </div>
    );
}

export default DynamicBackground;
