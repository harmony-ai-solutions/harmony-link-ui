import React, { useId } from 'react';

/**
 * Dependency-free inline SVG flag icons (3:2 ratio, 24×16 viewBox).
 * Flags are drawn as vector art instead of emoji so they render identically on
 * every platform (Windows displays emoji flags as letter pairs like "US").
 *
 * Usage:
 *   <FlagIcon code="en" className="w-4 h-3.5" />
 */

/* 5-point star polygon generator. rot is in radians; 0 = pointing up. */
function star(cx, cy, r, rot = 0) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r : r * 0.45;
        const angle = (Math.PI * i) / 5 - Math.PI / 2 + rot;
        pts.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`);
    }
    return pts.join(' ');
}

const FLAG_ART = {
    /* ── United Kingdom (Union Jack, simplified) ─────────────────────── */
    en: (
        <>
            <rect width="24" height="16" fill="#012169" />
            <path d="M0 0 24 16M24 0 0 16" stroke="#ffffff" strokeWidth="3.4" />
            <path d="M0 0 24 16M24 0 0 16" stroke="#C8102E" strokeWidth="1.6" />
            <rect x="10.7" width="2.6" height="16" fill="#ffffff" />
            <rect y="6.7" width="24" height="2.6" fill="#ffffff" />
            <rect x="11.35" width="1.3" height="16" fill="#C8102E" />
            <rect y="7.35" width="24" height="1.3" fill="#C8102E" />
        </>
    ),
    /* ── United States ───────────────────────────────────────────────── */
    us: (
        <>
            <rect width="24" height="16" fill="#B22234" />
            {[1, 3, 5, 7, 9, 11].map((i) => (
                <rect key={i} y={(i * 1.23).toFixed(2)} width="24" height="1.23" fill="#ffffff" />
            ))}
            <rect width="9.8" height="7.4" fill="#3C3B6E" />
            {[
                [1.4, 1.6], [3.2, 2.6], [5.0, 1.6], [6.8, 2.6], [8.6, 1.6],
                [2.3, 4.4], [4.1, 5.4], [5.9, 4.4], [7.7, 5.4], [3.2, 6.9], [5.9, 6.9],
            ].map(([cx, cy], idx) => (
                <circle key={idx} cx={cx} cy={cy} r="0.55" fill="#ffffff" />
            ))}
        </>
    ),
    /* ── Germany ─────────────────────────────────────────────────────── */
    de: (
        <>
            <rect width="24" height="5.33" fill="#000000" />
            <rect y="5.33" width="24" height="5.33" fill="#DD0000" />
            <rect y="10.66" width="24" height="5.33" fill="#FFCE00" />
        </>
    ),
    /* ── France ──────────────────────────────────────────────────────── */
    fr: (
        <>
            <rect width="8" height="16" fill="#0055A4" />
            <rect x="8" width="8" height="16" fill="#ffffff" />
            <rect x="16" width="8" height="16" fill="#EF4135" />
        </>
    ),
    /* ── Spain ───────────────────────────────────────────────────────── */
    es: (
        <>
            <rect width="24" height="3.2" fill="#AA151B" />
            <rect y="3.2" width="24" height="9.6" fill="#F1BF00" />
            <rect y="12.8" width="24" height="3.2" fill="#AA151B" />
        </>
    ),
    /* ── Italy ───────────────────────────────────────────────────────── */
    it: (
        <>
            <rect width="8" height="16" fill="#009246" />
            <rect x="8" width="8" height="16" fill="#ffffff" />
            <rect x="16" width="8" height="16" fill="#CE2B37" />
        </>
    ),
    /* ── Portugal ────────────────────────────────────────────────────── */
    pt: (
        <>
            <rect width="8" height="16" fill="#046A38" />
            <rect x="8" width="16" height="16" fill="#DA291C" />
            <circle cx="8.6" cy="8" r="3.4" fill="#FFE900" />
            <circle cx="8.6" cy="8" r="2.1" fill="#ffffff" />
            <circle cx="8.6" cy="8" r="1.1" fill="#003399" />
        </>
    ),
    /* ── Russia ──────────────────────────────────────────────────────── */
    ru: (
        <>
            <rect width="24" height="5.33" fill="#ffffff" />
            <rect y="5.33" width="24" height="5.33" fill="#0039A6" />
            <rect y="10.66" width="24" height="5.33" fill="#D52B1E" />
        </>
    ),
    /* ── Japan ───────────────────────────────────────────────────────── */
    jp: (
        <>
            <rect width="24" height="16" fill="#ffffff" />
            <circle cx="12" cy="8" r="4.6" fill="#BC002D" />
        </>
    ),
    /* ── China ───────────────────────────────────────────────────────── */
    cn: (
        <>
            <rect width="24" height="16" fill="#DE2910" />
            <polygon points={star(7.2, 4.6, 2.1)} fill="#FFDE00" />
            {[[9.6, 2.3], [10.6, 3.9], [9.9, 5.9], [8.8, 5.0]].map(([cx, cy], idx) => (
                <polygon
                    key={idx}
                    points={star(cx, cy, 0.95, Math.atan2(4.6 - cy, 7.2 - cx))}
                    fill="#FFDE00"
                />
            ))}
        </>
    ),
    /* ── South Korea ─────────────────────────────────────────────────── */
    kr: (
        <>
            <rect width="24" height="16" fill="#ffffff" />
            <circle cx="12" cy="8" r="3.6" fill="#CD2E3A" />
            <path d="M12 4.4a3.6 3.6 0 0 1 0 7.2 3.6 3.6 0 0 0 0-7.2Z" fill="#0047A0" />
        </>
    ),
};

/* Neutral fallback used for unknown language codes */
const FALLBACK_ART = (
    <>
        <rect width="24" height="16" fill="#64748B" opacity="0.45" />
        <circle cx="12" cy="8" r="3" fill="none" stroke="#ffffff" strokeWidth="1.1" opacity="0.75" />
        <path d="M8.5 12.5a5 5 0 0 1 7 0" fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.75" />
    </>
);

export function FlagIcon({ code, className = 'w-4 h-3.5' }) {
    const clipId = `flag-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const art = FLAG_ART[code] || FALLBACK_ART;

    return (
        <svg className={className} viewBox="0 0 24 16" aria-hidden="true" shapeRendering="geometricPrecision">
            <defs>
                <clipPath id={clipId}>
                    <rect x="0" y="0" width="24" height="16" rx="2.5" />
                </clipPath>
            </defs>
            <g clipPath={`url(#${clipId})`}>{art}</g>
            <rect x="0.5" y="0.5" width="23" height="15" rx="2.5" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
        </svg>
    );
}

export default FlagIcon;
