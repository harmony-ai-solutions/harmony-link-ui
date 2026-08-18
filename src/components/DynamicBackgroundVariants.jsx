import { useMemo } from 'react';

/**
 * Variant scene renderers for the Dynamic Background system.
 * Each renderer returns the JSX layers for one animated backdrop scene.
 * All colour values are theme-derived CSS custom properties, so each scene
 * adapts to the active theme. Animation lives entirely in CSS
 * (frontend/src/styles/components.css) for performance.
 */

/* ── Shared helpers ─────────────────────────────────────────────────── */

/** Deterministic pseudo-random set of twinkling stars. */
function useStarfield(count, seedOffset = 0) {
    return useMemo(() => {
        const items = [];
        for (let i = 0; i < count; i++) {
            const n = i * 31 + seedOffset;
            items.push({
                left: `${(n * 37) % 100}%`,
                top: `${(n * 53) % 100}%`,
                size: `${1.5 + ((n * 7) % 3)}px`,
                opacity: 0.35 + ((n * 11) % 5) * 0.12,
                duration: `${(3 + ((n * 13) % 6)).toFixed(1)}s`,
                delay: `${-((n * 17) % 60) / 10}s`,
            });
        }
        return items;
    }, [count, seedOffset]);
}

/* ── Aurora (default) — stars, orbs, cursor-following aura ─────────── */
export function AuroraScene({ particles, orbs }) {
    return (
        <>
            <div className="dynamic-bg-base" />
            <div className="dynamic-bg-grid" />
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
        </>
    );
}

/* ── Shapes — softly drifting geometric shapes (circles, squares, rings) */
export function ShapesScene() {
    const shapes = useMemo(() => {
        const items = [];
        const kinds = ['circle', 'square', 'ring', 'diamond'];
        for (let i = 0; i < 24; i++) {
            const n = i * 47;
            items.push({
                kind: kinds[i % 4],
                left: `${(n * 17) % 100}%`,
                top: `${(n * 29) % 100}%`,
                size: `${16 + ((n * 5) % 34)}px`,
                duration: `${(14 + ((n * 7) % 16)).toFixed(1)}s`,
                delay: `${-((n * 11) % 80) / 10}s`,
                drift: `${40 + ((n * 13) % 60)}px`,
                opacity: 0.5 + ((n * 3) % 4) * 0.12,
                accent: (n % 3 === 0)
                    ? 'var(--color-accent-primary)'
                    : (n % 3 === 1)
                        ? 'var(--color-accent-secondary)'
                        : 'var(--color-text-secondary)',
            });
        }
        return items;
    }, []);
    return (
        <div className="dynamic-bg-shapes">
            <div className="dynamic-bg-base" />
            {shapes.map((s, i) => (
                <div
                    key={`sh-${i}`}
                    className={`shape-item shape-${s.kind}`}
                    style={{
                        left: s.left,
                        top: s.top,
                        width: s.size,
                        height: s.size,
                        '--sh-duration': s.duration,
                        '--sh-delay': s.delay,
                        '--sh-drift': s.drift,
                        '--sh-opacity': s.opacity,
                        '--sh-color': s.accent,
                    }}
                />
            ))}
        </div>
    );
}

/* ── Sparkles — shimmering sparkle bursts + drifting stars ─────────── */
export function SparklesScene() {
    const sparkles = useMemo(() => {
        const items = [];
        for (let i = 0; i < 60; i++) {
            const n = i * 61;
            items.push({
                left: `${(n * 13) % 100}%`,
                top: `${(n * 23) % 100}%`,
                size: `${10 + ((n * 7) % 16)}px`,
                duration: `${(2.5 + ((n * 11) % 5)).toFixed(1)}s`,
                delay: `${-((n * 17) % 80) / 10}s`,
                accent: (n % 3 === 0)
                    ? 'var(--color-accent-primary)'
                    : (n % 3 === 1)
                        ? 'var(--color-accent-secondary)'
                        : 'var(--color-text-primary)',
            });
        }
        return items;
    }, []);
    const stars = useStarfield(60, 7);
    return (
        <div className="dynamic-bg-sparkles">
            <div className="dynamic-bg-base" />
            {stars.map((s, i) => (
                <div
                    key={`spk-star-${i}`}
                    className="sparkle-star"
                    style={{
                        '--s-left': s.left,
                        '--s-top': s.top,
                        '--s-size': s.size,
                        '--s-opacity': s.opacity,
                        '--s-duration': s.duration,
                        '--s-delay': s.delay,
                    }}
                />
            ))}
            {sparkles.map((s, i) => (
                <div
                    key={`spk-${i}`}
                    className="sparkle-burst"
                    style={{
                        left: s.left,
                        top: s.top,
                        width: s.size,
                        height: s.size,
                        '--spk-duration': s.duration,
                        '--spk-delay': s.delay,
                        '--spk-color': s.accent,
                    }}
                />
            ))}
        </div>
    );
}

/* ── Waves — thin glowing ribbons flowing up/down and left/right ───── */
export function WavesScene() {
    const waves = useMemo(() => {
        const items = [];
        const dirs = ['wave-x', 'wave-y'];
        for (let i = 0; i < 14; i++) {
            const n = i * 37;
            items.push({
                dir: dirs[i % 2],
                pos: `${6 + ((n * 11) % 88)}%`,
                thickness: `${2 + ((n * 5) % 4)}px`,
                duration: `${(8 + ((n * 13) % 10)).toFixed(1)}s`,
                delay: `${-((n * 17) % 80) / 10}s`,
                travel: `${160 + ((n * 9) % 140)}px`,
                accent: (n % 3 === 0)
                    ? 'var(--color-accent-primary)'
                    : (n % 3 === 1)
                        ? 'var(--color-accent-secondary)'
                        : 'var(--color-text-secondary)',
            });
        }
        return items;
    }, []);
    return (
        <div className="dynamic-bg-waves">
            <div className="dynamic-bg-base" />
            {waves.map((w, i) => (
                <div
                    key={`wave-${i}`}
                    className={`wave-item ${w.dir}`}
                    style={{
                        '--wave-pos': w.pos,
                        '--wave-thickness': w.thickness,
                        '--wave-duration': w.duration,
                        '--wave-delay': w.delay,
                        '--wave-travel': w.travel,
                        '--wave-color': w.accent,
                    }}
                />
            ))}
        </div>
    );
}

/** Map a variant id to its scene renderer. */
export const VARIANT_SCENES = {
    aurora: (ctx) => <AuroraScene {...ctx} />,
    shapes: () => <ShapesScene />,
    sparkles: () => <SparklesScene />,
    waves: () => <WavesScene />,
};
