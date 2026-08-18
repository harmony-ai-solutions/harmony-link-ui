import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Tooltip popup width in px (matches the w-72-ish box used previously).
const TOOLTIP_WIDTH = 288;

/**
 * Click-to-toggle info tooltip.
 *
 * The popup is rendered through a React portal into document.body so it is never
 * clipped by ancestor `overflow: hidden` or trapped below a `backdrop-filter` /
 * `transform` containing block (e.g. `.character-editor-section`). It is
 * positioned fixed relative to the trigger icon and given a very high z-index so
 * it always floats above modal overlays and sibling sections.
 *
 * API (unchanged): parents own a shared `tooltipVisible` number state and pass
 * `tooltipIndex`, `tooltipVisible` (a getter fn) and `setTooltipVisible`. Only
 * one tooltip is open at a time (the one whose index matches the shared state).
 */
const SettingsTooltip = ({ tooltipIndex, tooltipVisible, setTooltipVisible, children }) => {
    const triggerRef = useRef(null);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const isOpen = tooltipVisible() === tooltipIndex;

    const handleToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen) {
            setTooltipVisible(0);
            return;
        }
        const rect = triggerRef.current?.getBoundingClientRect();
        if (rect) {
            const gap = 8;
            const approxHeight = 180;
            let left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
            left = Math.max(16, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 16));
            // Prefer below the icon; flip above when there isn't room.
            let top = rect.bottom + gap;
            if (top + approxHeight > window.innerHeight - 16) {
                top = Math.max(16, rect.top - gap - approxHeight);
            }
            setCoords({ top, left });
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
                    className="fixed p-4 text-[13px] leading-relaxed text-text-primary rounded-xl z-[9999] animate-in slide-in-from-top-2 duration-300 normal-case tracking-normal"
                    style={{
                        top: `${coords.top}px`,
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
