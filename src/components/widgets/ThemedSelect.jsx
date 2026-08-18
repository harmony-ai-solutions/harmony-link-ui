import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

const ThemedSelect = ({ value, onChange, options, placeholder = "Select...", disabled, className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dropdownStyle, setDropdownStyle] = useState({});
    const buttonRef = useRef(null);
    const selectedOption = options.find(opt => String(opt.value) === String(value));

    // Calculate dropdown position relative to viewport on open
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownStyle({
                top: rect.bottom + 8,
                left: rect.left,
                width: rect.width,
            });
        }
    }, [isOpen]);

    // Recalculate on scroll/resize while open to keep dropdown anchored
    useEffect(() => {
        if (!isOpen) return;
        const recalc = () => {
            if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                setDropdownStyle({
                    top: rect.bottom + 8,
                    left: rect.left,
                    width: rect.width,
                });
            }
        };
        window.addEventListener('scroll', recalc, true);
        window.addEventListener('resize', recalc);
        return () => {
            window.removeEventListener('scroll', recalc, true);
            window.removeEventListener('resize', recalc);
        };
    }, [isOpen]);

    return (
        <div className={`relative w-full ${className}`}>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`input-field w-full flex items-center justify-between text-left transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed bg-surface/50' : 'cursor-pointer hover:border-accent-primary/50'
                    } ${isOpen ? 'border-accent-primary ring-1 ring-accent-primary/20' : ''}`}
            >
                <span className={`truncate ${!selectedOption ? 'text-text-muted' : 'text-text-primary font-medium'}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <svg
                    className={`w-4 h-4 text-text-muted transition-transform duration-300 ${isOpen ? 'rotate-180 text-accent-primary' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && createPortal(
                <>
                    <div
                        className="fixed inset-0 z-[60]"
                        onClick={() => setIsOpen(false)}
                    />
                    <div
                        className="fixed z-[70] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top"
                        style={{
                            backgroundColor: 'var(--color-background-surface)',
                            border: '1px solid var(--color-border-default)',
                            top: `${dropdownStyle.top}px`,
                            left: `${dropdownStyle.left}px`,
                            width: `${dropdownStyle.width}px`,
                        }}
                    >
                        <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
                            {options.map((option) => (
                                <div
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150 mb-0.5 last:mb-0 flex items-center justify-between group ${String(option.value) === String(value)
                                            ? 'bg-accent-primary/25 text-accent-primary font-extrabold ring-1 ring-accent-primary/40 shadow-sm shadow-accent-primary/20'
                                            : 'text-text-primary hover:bg-white/5 hover:text-accent-primary'
                                    }`}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {String(option.value) === String(value) && (
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export default ThemedSelect;
