import React, { cloneElement, isValidElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Distance in px between the trigger and the tooltip bubble.
const GAP = 10;
// Minimum distance kept from the viewport edges.
const VIEWPORT_PAD = 8;

/**
 * Theme-adaptive hover/focus tooltip.
 *
 * Renders through a React portal into `document.body` so it is never clipped by
 * an ancestor `overflow: hidden` (e.g. the collapsible sidebar rail) or trapped
 * below a `backdrop-filter` / `transform` containing block. It is styled with the
 * app's glassmorphism design tokens (see `.hl-tooltip` in styles/components.css)
 * instead of the browser's native black `title` box.
 *
 * Usage:
 *   <Tooltip content={t('nav.tabs.characters')} placement="right">
 *     <button className="app-sidebar-item">…</button>
 *   </Tooltip>
 *
 * Expects a single DOM-element child (the trigger). The mouse/focus handlers and
 * a positioning ref are merged onto it via `cloneElement`; any handlers already
 * present on the child are preserved.
 *
 * @param {React.ReactNode} content   Tooltip text / node.
 * @param {'top'|'bottom'|'left'|'right'} placement  Preferred side (default 'top').
 * @param {number} delay              Hover delay before showing, in ms (default 120).
 * @param {boolean} disabled          When true, never shows (default false).
 * @param {React.ReactElement} children  The single trigger element.
 */
const Tooltip = ({ content, placement = 'top', delay = 120, disabled = false, children }) => {
    const triggerRef = useRef(null);
    const tipRef = useRef(null);
    const showTimer = useRef(null);
    const [visible, setVisible] = useState(false);
    const [coords, setCoords] = useState(null);

    const show = useCallback(() => {
        if (disabled || !content) return;
        clearTimeout(showTimer.current);
        showTimer.current = setTimeout(() => setVisible(true), delay);
    }, [disabled, content, delay]);

    const hide = useCallback(() => {
        clearTimeout(showTimer.current);
        setVisible(false);
    }, []);

    // Clear any pending timer on unmount.
    useEffect(() => () => clearTimeout(showTimer.current), []);

    // Hide immediately if the tooltip becomes disabled while shown (e.g. the
    // sidebar is expanded while the pointer is still over a tab).
    useEffect(() => {
        if (disabled) {
            clearTimeout(showTimer.current);
            setVisible(false);
        }
    }, [disabled]);

    // Measure the trigger + bubble and place the bubble once it is rendered.
    useLayoutEffect(() => {
        if (!visible) {
            setCoords(null);
            return;
        }
        const trigger = triggerRef.current;
        const tip = tipRef.current;
        if (!trigger || !tip) return;

        const t = trigger.getBoundingClientRect();
        const w = tip.offsetWidth;
        const h = tip.offsetHeight;

        // Trigger centre in viewport coordinates — the arrow should always
        // point here, even after the bubble is clamped at a viewport edge.
        const centerX = t.left + t.width / 2;
        const centerY = t.top + t.height / 2;

        let top = 0;
        let left = 0;
        switch (placement) {
            case 'right':
                top = centerY - h / 2;
                left = t.right + GAP;
                break;
            case 'left':
                top = centerY - h / 2;
                left = t.left - w - GAP;
                break;
            case 'bottom':
                top = t.bottom + GAP;
                left = centerX - w / 2;
                break;
            case 'top':
            default:
                top = t.top - h - GAP;
                left = centerX - w / 2;
                break;
        }

        // Keep the bubble inside the viewport. A trigger near an edge (e.g. the
        // top-bar help button) forces the bubble to slide inward; the arrow is
        // then offset so it still points at the trigger instead of the bubble's
        // own centre — otherwise the tooltip looks misaligned.
        const clampedLeft = Math.max(VIEWPORT_PAD, Math.min(left, window.innerWidth - w - VIEWPORT_PAD));
        const clampedTop = Math.max(VIEWPORT_PAD, Math.min(top, window.innerHeight - h - VIEWPORT_PAD));

        // Arrow offset from the bubble centre, capped so it stays on the bubble.
        const ARROW_PAD = 12;
        const rawArrowX = centerX - (clampedLeft + w / 2);
        const rawArrowY = centerY - (clampedTop + h / 2);
        const arrowX = Math.max(-(w / 2 - ARROW_PAD), Math.min(w / 2 - ARROW_PAD, rawArrowX));
        const arrowY = Math.max(-(h / 2 - ARROW_PAD), Math.min(h / 2 - ARROW_PAD, rawArrowY));

        setCoords({ top: clampedTop, left: clampedLeft, arrowX, arrowY });
    }, [visible, placement]);

    // The tooltip cannot attach handlers to a non-element child — render as-is.
    if (!isValidElement(children)) {
        return children ?? null;
    }

    // Merge our positioning ref with any ref the child already owns (e.g. the
    // LanguagePicker's triggerRef, used to anchor its dropdown) so neither is lost.
    const setRefs = (node) => {
        triggerRef.current = node;
        const childRef = children.props.ref;
        if (typeof childRef === 'function') childRef(node);
        else if (childRef && typeof childRef === 'object') childRef.current = node;
    };

    const trigger = cloneElement(children, {
        ref: setRefs,
        onMouseEnter: (e) => { children.props.onMouseEnter?.(e); show(); },
        onMouseLeave: (e) => { children.props.onMouseLeave?.(e); hide(); },
        onFocus: (e) => { children.props.onFocus?.(e); show(); },
        onBlur: (e) => { children.props.onBlur?.(e); hide(); },
    });

    // The arrow keeps its CSS `50%` anchor; a non-zero offset slides it along
    // the bubble so it still points at the trigger when the bubble is clamped.
    const arrowStyle = coords
        ? (placement === 'top' || placement === 'bottom'
            ? { left: `calc(50% + ${coords.arrowX}px)` }
            : { top: `calc(50% + ${coords.arrowY}px)` })
        : undefined;

    return (
        <>
            {trigger}
            {visible && createPortal(
                <div
                    ref={tipRef}
                    role="tooltip"
                    data-placement={placement}
                    className={`hl-tooltip${coords ? ' hl-tooltip-visible' : ''}`}
                    style={coords ? { top: coords.top, left: coords.left } : undefined}
                >
                    {content}
                    <span className="hl-tooltip-arrow" aria-hidden="true" style={arrowStyle} />
                </div>,
                document.body
            )}
        </>
    );
};

export default Tooltip;
