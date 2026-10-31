import React from 'react';

/**
 * Shared loading placeholder — a thin pulsing block.
 *
 * Used wherever the *count* of upcoming rows is known or can be guessed
 * (chat list, message timeline, log viewer, character grid). A centred
 * spinner followed by the word "Loading…" tells the user nothing about what
 * is coming, shifts the layout when it resolves, and looked different in every
 * view. A skeleton answers all three at once.
 *
 * Rules that matter here:
 * - The pulse is an **opacity** animation on a solid block, not an animated
 *   gradient or a `backdrop-filter`. Gradient `background-position` animation
 *   and glass inside the `.app-main` scroll column is exactly what caused the
 *   Chromium scroll shake (see the scroll-shake note in
 *   [`styles/components.css`](../../styles/components.css)); opacity composites
 *   without repainting the layer.
 * - The animation pauses while the user is scrolling (`html[data-scrolling]`,
 *   set by [`DynamicBackground`](../DynamicBackground.jsx)), the same window in
 *   which the backdrop and scrollbar animations pause.
 * - `prefers-reduced-motion` disables the pulse entirely — the block stays
 *   visible, it just stops breathing.
 * - Everything is `aria-hidden`; the containing view owns the announcement
 *   (normally an [`EmptyState`](./EmptyState.jsx) once loading finishes).
 *
 * @param {string|number} [width]      CSS width (default 100%).
 * @param {string|number} [height]     CSS height (default 0.75rem).
 * @param {string|number} [radius]     CSS border-radius override.
 * @param {boolean} [inline=false]     Render a `<span>` instead of a `<div>`.
 * @param {string} [className]         Extra classes (`.ui-skeleton-line`,
 *                                     `.ui-skeleton-circle`, surface presets).
 * @param {object} [style]             Extra inline styles.
 */
export default function Skeleton({
    width,
    height,
    radius,
    inline = false,
    className = '',
    style,
    ...rest
}) {
    const Comp = inline ? 'span' : 'div';
    const merged = {};
    if (width !== undefined) merged.width = width;
    if (height !== undefined) merged.height = height;
    if (radius !== undefined) merged.borderRadius = radius;

    return (
        <Comp
            className={`ui-skeleton${className ? ` ${className}` : ''}`}
            style={{ ...merged, ...style }}
            aria-hidden="true"
            {...rest}
        />
    );
}

/**
 * A small stack of text lines — the simplest "something is coming here"
 * placeholder. The last line is short so the block reads like a paragraph
 * rather than a solid rectangle.
 *
 * @param {number} [lines=3]
 * @param {string} [lineHeight='0.7rem']
 * @param {string} [gap='0.45rem']
 * @param {string} [width='100%']  Width of all but the last line.
 */
export function SkeletonText({
    lines = 3,
    lineHeight = '0.7rem',
    gap = '0.45rem',
    width = '100%',
    className = '',
}) {
    return (
        <div
            className={`ui-skeleton-text${className ? ` ${className}` : ''}`}
            style={{ gap }}
            aria-hidden="true"
        >
            {Array.from({ length: Math.max(1, lines) }).map((_, index) => (
                <Skeleton
                    key={index}
                    className="ui-skeleton-line"
                    height={lineHeight}
                    width={index === lines - 1 && lines > 1 ? '60%' : width}
                />
            ))}
        </div>
    );
}
