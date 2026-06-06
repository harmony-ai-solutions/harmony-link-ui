import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Tutorial overlay with spotlight cutout and positioned tooltip.
 *
 * Props:
 * - targetSelector: CSS selector for the element to highlight
 * - title: Step title string
 * - content: Step content (string or JSX)
 * - stepIndex: Current step number (0-based)
 * - totalSteps: Total number of steps
 * - onNext: Callback for Next button
 * - onPrev: Callback for Back button
 * - onSkip: Callback for Skip button
 * - onComplete: Callback for Finish button
 * - placement: 'top' | 'bottom' | 'left' | 'right'
 * - showPrev: boolean - show Back button?
 * - isLastStep: boolean - show Finish instead of Next?
 * - isBlocked: boolean - show prerequisite block message?
 * - blockMessage: string - message when blocked
 * - onGoToStep: callback for "Go to Step X" button
 * - hideNextButton: boolean - hide Next button (for branch decision steps)
 */
export default function TutorialOverlay({
    targetSelector,
    title,
    content,
    stepIndex,
    totalSteps,
    sectionLabel = null,
    stepInSection,
    totalInSection,
    onNext,
    onPrev,
    onSkip,
    onComplete,
    placement = 'bottom',
    showPrev = false,
    isLastStep = false,
    isBlocked = false,
    blockMessage = null,
    onGoToStep,
    hideNextButton = false,
    nextDisabled = false,
}) {
    const [targetRect, setTargetRect] = useState(null);
    const [tooltipStyle, setTooltipStyle] = useState({});
    const [arrowStyle, setArrowStyle] = useState({});
    const [effectivePlacement, setEffectivePlacement] = useState(placement);
    const tooltipRef = useRef(null);
    const GAP = 12;

    const updatePosition = useCallback(() => {
        const el = document.querySelector(targetSelector);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);

        // Calculate tooltip position
        const tooltipWidth = 480;
        const tooltipHeight = tooltipRef.current?.offsetHeight || 200;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let p = placement;
        let top, left;

        // Auto-flip if going off-screen
        if (p === 'bottom' && rect.bottom + GAP + tooltipHeight > vh) p = 'top';
        if (p === 'top' && rect.top - GAP - tooltipHeight < 0) p = 'bottom';
        if (p === 'right' && rect.right + GAP + tooltipWidth > vw) p = 'left';
        if (p === 'left' && rect.left - GAP - tooltipWidth < 0) p = 'right';

        setEffectivePlacement(p);

        switch (p) {
            case 'bottom':
                top = rect.bottom + GAP;
                left = rect.left + rect.width / 2 - tooltipWidth / 2;
                break;
            case 'top':
                top = rect.top - GAP - tooltipHeight;
                left = rect.left + rect.width / 2 - tooltipWidth / 2;
                break;
            case 'right':
                top = rect.top + rect.height / 2 - tooltipHeight / 2;
                left = rect.right + GAP;
                break;
            case 'left':
                top = rect.top + rect.height / 2 - tooltipHeight / 2;
                left = rect.left - GAP - tooltipWidth;
                break;
            default:
                top = rect.bottom + GAP;
                left = rect.left + rect.width / 2 - tooltipWidth / 2;
        }

        // Clamp to viewport
        left = Math.max(16, Math.min(left, vw - tooltipWidth - 16));
        top = Math.max(16, Math.min(top, vh - tooltipHeight - 16));

        setTooltipStyle({ top, left });
    }, [targetSelector, placement]);

    useEffect(() => {
        updatePosition();
        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true);
        const raf = requestAnimationFrame(updatePosition);

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
            cancelAnimationFrame(raf);
        };
    }, [updatePosition]);

    // Re-calculate after content renders
    useEffect(() => {
        const timer = setTimeout(updatePosition, 50);
        return () => clearTimeout(timer);
    }, [updatePosition, content]);

    if (!targetRect) return null;

    return (
        <>
            {/* Spotlight — box-shadow creates the dimming everywhere except
                the transparent rectangle over the target element */}
            <div
                className="tutorial-spotlight"
                style={{
                    top: targetRect.top - 4,
                    left: targetRect.left - 4,
                    width: targetRect.width + 8,
                    height: targetRect.height + 8,
                }}
            />

            {/* Tooltip */}
            <div
                ref={tooltipRef}
                className="tutorial-tooltip"
                style={tooltipStyle}
            >
                {/* Arrow */}
                <div
                    className="tutorial-tooltip-arrow"
                    data-placement={effectivePlacement}
                />

                {/* Progress indicator */}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-accent-primary">
                        {sectionLabel
                            ? `${sectionLabel} · Step ${stepInSection} of ${totalInSection}`
                            : `Step ${stepIndex + 1} of ${totalSteps}`
                        }
                    </span>
                    <div className="flex gap-1">
                        {Array.from({ length: totalInSection }).map((_, i) => (
                            <div
                                key={i}
                                className={`w-1.5 h-1.5 rounded-full ${
                                    i < stepInSection ? 'bg-accent-primary' : 'bg-white/20'
                                }`}
                            />
                        ))}
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-lg font-extrabold text-text-primary mb-2">
                    {title}
                </h3>

                {/* Content */}
                <div className="tutorial-tooltip-content text-sm text-text-secondary leading-relaxed mb-4">
                    {content}
                </div>

                {/* Prerequisite blocked message */}
                {isBlocked && (
                    <div className="p-3 mb-4 rounded-lg bg-accent-secondary/10 border border-accent-secondary/30">
                        <p className="text-sm text-accent-secondary">{blockMessage}</p>
                        {onGoToStep && (
                            <button
                                onClick={onGoToStep}
                                className="btn-primary mt-2 text-sm py-1.5"
                            >
                                Go to required step
                            </button>
                        )}
                    </div>
                )}

                {/* Navigation buttons */}
                <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                        {showPrev && (
                            <button
                                onClick={onPrev}
                                className="btn-secondary text-sm py-1.5 px-3"
                            >
                                Back
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onSkip}
                            className="text-xs text-text-muted hover:text-text-primary transition-colors py-1.5 px-2"
                        >
                            Skip Tutorial
                        </button>
                        {!isBlocked && !hideNextButton && (
                            <button
                                onClick={isLastStep ? onComplete : onNext}
                                disabled={nextDisabled}
                                className={`text-sm py-1.5 px-4 ${nextDisabled ? 'btn-primary opacity-40 cursor-not-allowed' : 'btn-primary'}`}
                            >
                                {isLastStep ? 'Finish' : 'Next'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
