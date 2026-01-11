import React from 'react';

/**
 * Reusable error/info dialog component
 * Styled with premium aesthetics, backdrop blur and theme variables.
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
            iconBg: 'bg-error-bg',
            iconColor: 'text-error',
            defaultTitle: 'Invalid Input',
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            )
        },
        success: {
            iconBg: 'bg-success/10',
            iconColor: 'text-success',
            defaultTitle: 'Success',
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        info: {
            iconBg: 'bg-accent-primary/10',
            iconColor: 'text-accent-primary',
            defaultTitle: 'Information',
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            )
        },
        warning: {
            iconBg: 'bg-warning/10',
            iconColor: 'text-warning',
            defaultTitle: 'Warning',
            icon: (
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            )
        }
    };

    const currentConfig = config[type] || config.error;
    const displayTitle = title || currentConfig.defaultTitle;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-background-surface border border-white/10 max-w-sm w-full rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-8 text-center">
                    <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full ${currentConfig.iconBg} mb-6`}>
                        <div className={currentConfig.iconColor}>
                            {currentConfig.icon}
                        </div>
                    </div>
                    <h3 className="text-xl font-extrabold text-text-primary mb-3 tracking-tight">
                        {displayTitle}
                    </h3>
                    <div className="mb-8 px-2">
                        <p className="text-[15px] leading-relaxed text-text-secondary whitespace-pre-line font-medium">
                            {message}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="btn-primary w-full py-3 shadow-lg shadow-accent-primary/20"
                    >
                        {closeText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ErrorDialog;
