import React from 'react';

const SettingsTooltip = ({ tooltipIndex, tooltipVisible, setTooltipVisible, children }) => {
    return (
        <span className="relative ml-1 text-text-muted hover:text-accent-primary cursor-pointer transition-colors"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTooltipVisible(tooltipIndex !== tooltipVisible() ? tooltipIndex : 0);
            }}
            title="Click for more information"
            aria-label="More information"
        >
            <svg className="w-3.5 h-3.5 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                    d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
            </svg>
            {tooltipVisible() === tooltipIndex && (
                <span
                    className="absolute w-64 -left-28 top-8 p-4 text-[13px] leading-relaxed text-text-primary rounded-xl z-50 animate-in slide-in-from-top-2 duration-300"
                    style={{
                        background: 'var(--color-background-elevated)',
                        backdropFilter: 'blur(20px) saturate(1.3)',
                        WebkitBackdropFilter: 'blur(20px) saturate(1.3)',
                        border: '1px solid var(--color-border-glass)',
                        boxShadow: '0 0 40px var(--color-glow-accent-soft), 0 8px 32px rgba(0,0,0,0.4)',
                    }}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}>
                    <span className="relative z-10">{children}</span>
                </span>
            )}
        </span>
    );
};

export default SettingsTooltip;