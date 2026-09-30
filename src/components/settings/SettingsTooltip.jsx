import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Tooltip popup width in px (matches the w-72-ish box used previously).
const TOOLTIP_WIDTH = 288;
// Gap between the icon and the popup, and the minimum space we want between the
// popup and the viewport edge.
const GAP = 8;
const MARGIN = 16;
// Minimum free space below the icon required to open the popup downwards.
const MIN_SPACE_BELOW = 120;

/**
 * Click-to-toggle info tooltip.
 *
 * The popup is rendered through a React portal into document.body so it is never
 * clipped by ancestor `overflow: hidden` or trapped below a `backdrop-filter` /
 * `transform` containing block (e.g. `.character-editor-section`). It is
 * positioned fixed relative to the trigger icon and given a very high z-index so
 * it always floats above modal overlays and sibling sections.
 *
 * It anchors directly beside the icon — the popup's nearest edge is aligned with
 * the icon (not centred on it) — so it never appears far from the icon even when
 * the icon sits near a screen edge. It closes when the user clicks anywhere
 * outside the icon or the popup.
 *
 * The coordinates are computed synchronously in the click handler, before the
 * popup mounts, so the popup paints in its final position on the very first
 * frame (no flash at a default corner, then jump).
 *
 * API (unchanged): parents own a shared `tooltipVisible` number state and pass
 * `tooltipIndex`, `tooltipVisible` (a getter fn) and `setTooltipVisible`. Only
 * one tooltip is open at a time (the one whose index matches the shared state).
 */
const SettingsTooltip = ({ tooltipIndex, tooltipVisible, setTooltipVisible, children }) => {
    const triggerRef = useRef(null);
    const popupRef = useRef(null);
    // Either { top, left } (opened below the icon) or { bottom, left } (opened
    // above it). Anchoring by the popup's *near* edge keeps it flush against the
    // icon regardless of the popup's real height.
    const [coords, setCoords] = useState({ top: null, bottom: null, left: 0 });
    const isOpen = tooltipVisible() === tooltipIndex;

    // Close the popup when the user clicks anywhere outside the trigger icon and
    // the popup itself. Uses `pointerdown` (capture) so it fires before the
    // opening `click` of the trigger and never instantly re-closes on open.
    useEffect(() => {
        if (!isOpen) return;
        const handlePointerDown = (e) => {
            if (triggerRef.current?.contains(e.target)) return;
            if (popupRef.current?.contains(e.target)) return;
            setTooltipVisible(0);
        };
        document.addEventListener('pointerdown', handlePointerDown, true);
        return () => document.removeEventListener('pointerdown', handlePointerDown, true);
    }, [isOpen, setTooltipVisible]);

    const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen) {
            setTooltipVisible(0);
            return;
        }

        const rect = triggerRef.current?.getBoundingClientRect();
        if (rect) {
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            // Horizontal: keep the popup's nearest edge beside the icon. When the
            // icon is on the right half of the screen align the right edges,
            // otherwise align the left edges — so it stays next to the icon
            // instead of being pushed far away by viewport clamping.
            let left = rect.left + rect.width / 2 > vw / 2
                ? rect.right - TOOLTIP_WIDTH
                : rect.left;
            left = Math.max(MARGIN, Math.min(left, vw - TOOLTIP_WIDTH - MARGIN));

            // Vertical: anchor the popup's near edge GAP away from the icon, so it
            // is always flush next to it regardless of the popup's height. Open
            // below when there is room; otherwise open above by anchoring the
            // popup's bottom edge just above the icon.
            if (vh - rect.bottom - GAP - MARGIN >= MIN_SPACE_BELOW) {
                setCoords({ top: rect.bottom + GAP, bottom: null, left });
            } else {
                setCoords({ top: null, bottom: vh - rect.top + GAP, left });
            }
        }

        setTooltipVisible(tooltipIndex);
    };

    return (
        <>
            <span
                ref={triggerRef}
                className="relative ml-1 inline-flex items-center text-text-muted hover:text-accent-primary cursor-pointer transition-colors"
                onClick={handleToggle}
                title="Click for more information"
                aria-label="More information"
            >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                </svg>
            </span>
            {isOpen && createPortal(
                <span
                    ref={popupRef}
                    className="fixed p-4 text-[13px] leading-relaxed text-text-primary rounded-xl z-[9999] normal-case tracking-normal"
                    style={{
                        top: coords.top != null ? `${coords.top}px` : 'auto',
                        bottom: coords.bottom != null ? `${coords.bottom}px` : 'auto',
                        left: `${coords.left}px`,
                        width: `${TOOLTIP_WIDTH}px`,
                        background: 'var(--color-background-elevated)',
                        backdropFilter: 'blur(20px) saturate(1.3)',
                        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
                        border: '1px solid var(--color-border-glass)',
                        boxShadow: '0 0 40px var(--color-glow-accent-soft), 0 8px 32px rgba(0,0,0,0.4)',
                    }}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                >
                    {children}
                </span>,
                document.body
            )}
        </>
    );
};

export default SettingsTooltip;
