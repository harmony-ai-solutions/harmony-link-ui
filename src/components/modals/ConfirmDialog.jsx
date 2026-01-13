import React from 'react';

/**
 * Reusable confirmation dialog component
 * Styled with premium aesthetics, backdrop blur and theme variables.
 */
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Yes', cancelText = 'No' }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="modal-content max-w-sm w-full rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-8 text-center">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-accent-primary/10 mb-6">
                        <svg className="h-7 w-7 text-accent-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>

                    <h3 className="text-xl font-extrabold text-text-primary mb-3 tracking-tight">
                        {title}
                    </h3>

                    <div className="mb-8 px-2">
                        <p className="text-[15px] leading-relaxed text-text-secondary whitespace-pre-line font-medium">
                            {message}
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="btn-secondary flex-1 py-3"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className="btn-primary flex-1 py-3 shadow-lg shadow-accent-primary/20"
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
