import React, { useState } from 'react';

const ThemedSelect = ({ value, onChange, options, placeholder = "Select...", disabled, className = "" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(opt => String(opt.value) === String(value));

    return (
        <div className={`relative w-full ${className}`}>
            <button
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

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-[60]"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute z-[70] w-full mt-2 bg-background-elevated/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top">
                        <div className="max-h-64 overflow-y-auto custom-scrollbar p-1">
                            {options.map((option) => (
                                <div
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150 mb-0.5 last:mb-0 flex items-center justify-between group ${String(option.value) === String(value)
                                            ? 'bg-accent-primary text-white font-bold'
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
                </>
            )}
        </div>
    );
};

export default ThemedSelect;
