import React from 'react';

const SettingsTooltip = ({ tooltipIndex, tooltipVisible, setTooltipVisible, children }) => {
    return (
        <span className="relative ml-1 text-accent-primary hover:text-accent-primary-hover cursor-pointer transition-colors"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setTooltipVisible(tooltipIndex !== tooltipVisible() ? tooltipIndex : 0);
            }}>
            (?)
            {tooltipVisible() === tooltipIndex && (
                <span className="absolute w-64 -left-28 top-8 p-4 text-[13px] leading-relaxed text-text-primary border border-white/20 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50 backdrop-blur-xl animate-in slide-in-from-top-2 duration-300"
                    style={{ backgroundColor: 'var(--color-background-elevated)' }}
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