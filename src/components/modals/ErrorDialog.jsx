import React from 'react';

/**
 * Reusable error/info dialog component
 * Styled to match the app theme, replaces hardcoded isModalVisible modals
 * 
 * @param {boolean} isOpen - Controls dialog visibility
 * @param {string} title - Dialog title (default: "Invalid Input")
 * @param {string} message - Message to display
 * @param {function} onClose - Callback when dialog is closed
 * @param {string} type - Dialog type: 'error', 'success', 'info', 'warning' (default: 'error')
 */
const ErrorDialog = ({ 
    isOpen, 
    title, 
    message, 
    onClose, 
    type = 'error',
    closeText = 'Close'
}) => {
    if (!isOpen) return null;

    // Determine styling based on type
    const config = {
        error: {
            bgColor: 'bg-red-200',
            iconColor: 'text-red-600',
            titleColor: 'text-red-500',
            defaultTitle: 'Invalid Input',
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
            )
        },
        success: {
            bgColor: 'bg-green-200',
            iconColor: 'text-green-600',
            titleColor: 'text-green-500',
            defaultTitle: 'Success',
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
            )
        },
        info: {
            bgColor: 'bg-blue-200',
            iconColor: 'text-blue-600',
            titleColor: 'text-blue-500',
            defaultTitle: 'Information',
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
            )
        },
        warning: {
            bgColor: 'bg-orange-200',
            iconColor: 'text-orange-600',
            titleColor: 'text-orange-500',
            defaultTitle: 'Warning',
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
            )
        }
    };

    const currentConfig = config[type] || config.error;
    const displayTitle = title || currentConfig.defaultTitle;

    return (
        <div className="fixed inset-0 bg-gray-600/50 z-50 flex items-center justify-center">
            <div className="relative mx-auto p-5 border border-neutral-800 w-96 shadow-lg rounded-md bg-neutral-900">
                <div className="mt-3 text-center">
                    <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${currentConfig.bgColor}`}>
                        <div className={currentConfig.iconColor}>
                            {currentConfig.icon}
                        </div>
                    </div>
                    <h3 className={`text-lg leading-6 font-medium ${currentConfig.titleColor} mt-4`}>
                        {displayTitle}
                    </h3>
                    <div className="mt-2 px-7 py-3">
                        <p className="text-sm text-gray-200 whitespace-pre-line">{message}</p>
                    </div>
                    <div className="items-center px-4 py-3">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-colors"
                        >
                            {closeText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ErrorDialog;
