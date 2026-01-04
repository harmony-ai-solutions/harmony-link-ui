import React from 'react';

/**
 * Reusable confirmation dialog component
 * Styled to match the app theme, replaces window.confirm()
 */
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, confirmText = 'Yes', cancelText = 'No' }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600/50 z-50 flex items-center justify-center">
            <div className="relative mx-auto p-5 border border-neutral-800 w-96 shadow-lg rounded-md bg-neutral-900">
                <div className="mt-3 text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-orange-200">
                        <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h3 className="text-lg leading-6 font-medium text-orange-500 mt-4">{title}</h3>
                    <div className="mt-2 px-7 py-3">
                        <p className="text-sm text-gray-200 whitespace-pre-line">{message}</p>
                    </div>
                    <div className="flex justify-center gap-4 pt-3">
                        <button
                            onClick={onConfirm}
                            className="bg-orange-500 hover:bg-orange-600 font-bold py-2 px-6 text-white rounded transition-colors"
                        >
                            {confirmText}
                        </button>
                        <button
                            onClick={onCancel}
                            className="bg-neutral-700 hover:bg-neutral-600 font-bold py-2 px-6 text-gray-300 rounded transition-colors"
                        >
                            {cancelText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
