import React, { useState, useEffect, useRef } from 'react';

/**
 * Reusable input dialog component
 * Styled with premium aesthetics, backdrop blur and theme variables.
 */
const InputDialog = ({
    isOpen,
    title,
    message,
    defaultValue = '',
    placeholder = '',
    onConfirm,
    onCancel,
    confirmText = 'OK',
    cancelText = 'Cancel'
}) => {
    const [inputValue, setInputValue] = useState(defaultValue);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setInputValue(defaultValue);
            // Focus the input when dialog opens
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 100);
        }
    }, [isOpen, defaultValue]);

    const handleConfirm = () => {
        onConfirm(inputValue);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        } else if (e.key === 'Escape') {
            onCancel();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background-surface border border-white/10 max-w-md w-full rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-8">
                    <h3 className="text-xl font-extrabold text-text-primary mb-3 tracking-tight">
                        {title}
                    </h3>

                    {message && (
                        <p className="text-[15px] leading-relaxed text-text-secondary mb-6 font-medium whitespace-pre-line">
                            {message}
                        </p>
                    )}

                    <div className="mb-8">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={placeholder}
                            className="input-field w-full py-3 px-4 text-base transition-all duration-200"
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={onCancel}
                            className="btn-secondary px-6 py-2.5"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="btn-primary px-8 py-2.5 shadow-lg shadow-accent-primary/20"
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InputDialog;
