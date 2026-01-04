import React, { useState, useEffect, useRef } from 'react';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black bg-opacity-50" 
                onClick={onCancel}
            ></div>
            
            {/* Dialog */}
            <div className="relative bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
                {/* Title */}
                <h3 className="text-lg font-semibold text-orange-400 mb-3">
                    {title}
                </h3>
                
                {/* Message */}
                {message && (
                    <p className="text-sm text-gray-300 mb-4 whitespace-pre-line">
                        {message}
                    </p>
                )}
                
                {/* Input Field */}
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-orange-400 mb-6"
                />
                
                {/* Buttons */}
                <div className="flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-gray-300 rounded transition-colors"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InputDialog;
