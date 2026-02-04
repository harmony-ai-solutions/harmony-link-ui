import React from "react";

const ConfigVerificationSection = ({ onValidate, validationState, className = "" }) => {
    return (
        <div className={`flex flex-col mb-6 w-full gap-2 ${className}`}>
            <div className={`flex items-center justify-between ${
                validationState.status === 'success' ? 'card-compact-success' :
                validationState.status === 'error' ? 'card-compact-error' :
                'card-compact-info'
            }`}>
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-colors duration-300 ${
                        validationState.status === 'success' ? 'bg-success/20 border-success/40 text-success' :
                        validationState.status === 'error' ? 'bg-error/20 border-error/40 text-error' :
                        'bg-info/20 border-info/40 text-info'
                    }`}>
                        {validationState.status === 'success' ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                        ) : validationState.status === 'error' ? (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        )}
                    </div>
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Configuration Verification</h4>
                        <p className="text-[10px] text-text-muted font-bold opacity-80 italic">Connection Test & Validation</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-4">
                    {validationState.status !== 'idle' && (
                        <span className={`text-xs font-bold animate-in fade-in slide-in-from-right-2 duration-300 ${
                            validationState.status === 'success' ? 'text-success' :
                            validationState.status === 'error' ? 'text-error' :
                            'text-info'
                        }`}>
                            {validationState.message}
                        </span>
                    )}
                    <button
                        onClick={onValidate}
                        disabled={validationState.status === 'loading'}
                        className="btn-primary py-1.5 px-4 rounded-lg font-bold text-[10px] tracking-widest uppercase transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:shadow-accent-primary/20 active:scale-95"
                    >
                        {validationState.status === 'loading' ? 'Verifying...' : 'Verify Now'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfigVerificationSection;
