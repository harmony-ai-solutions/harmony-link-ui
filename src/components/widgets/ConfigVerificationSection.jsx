import React from "react";

const ConfigVerificationSection = ({ onValidate, validationState, className = "" }) => {
    return (
        <div className={`flex items-center mb-3 mt-2 w-full ${className}`}>
            <div className="w-1/4 px-3">
                <button
                    onClick={onValidate}
                    disabled={validationState.status === 'loading'}
                    className="w-full p-1 text-sm font-medium text-neutral-200 hover:text-white border border-neutral-500 bg-gradient-to-br from-neutral-700 to-blue-700 hover:bg-gradient-to-br hover:from-neutral-700 hover:to-blue-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {validationState.status === 'loading' ? 'Validating...' : 'Verify Configuration'}
                </button>
            </div>
            <div className="w-3/4 px-3">
                {validationState.status !== 'idle' && (
                    <div className={`p-1 rounded-md ${
                        validationState.status === 'success'
                            ? 'bg-green-900 text-green-200 border border-green-700'
                            : validationState.status === 'error'
                                ? 'bg-red-900 text-red-200 border border-red-700'
                                : 'bg-blue-900 text-blue-200 border border-blue-700'
                    }`}>
                        <div className="flex items-center">
                            {validationState.status === 'loading' && (
                                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
                                            strokeWidth="4" fill="none"/>
                                    <path className="opacity-75" fill="currentColor"
                                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                </svg>
                            )}
                            {validationState.status === 'success' && (
                                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                          clipRule="evenodd"/>
                                </svg>
                            )}
                            {validationState.status === 'error' && (
                                <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd"
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                          clipRule="evenodd"/>
                                </svg>
                            )}
                            <span className="text-sm">{validationState.message}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConfigVerificationSection;
