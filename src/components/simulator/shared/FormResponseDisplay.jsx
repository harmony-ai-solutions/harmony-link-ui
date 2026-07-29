import React from 'react';
import ConfigurableJsonViewer from '../../widgets/ConfigurableJsonViewer';

// Enhanced Form Response Display Component
function FormResponseDisplay({ formState, onClear }) {
    if (!formState.loading && !formState.response && !formState.error) {
        return null;
    }

    return (
        <div className="bg-background-surface/40 backdrop-blur-sm rounded-lg border border-border-glass p-3">
            <div className="flex justify-between items-center mb-2">
                <h5 className="text-sm font-semibold text-accent-primary">Response</h5>
                <button
                    onClick={onClear}
                    className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                    Clear
                </button>
            </div>
            
            {formState.loading && (
                <div className="flex items-center gap-2 text-text-muted text-sm">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-accent-primary"></div>
                    Processing...
                </div>
            )}
            
            {formState.error && (
                <div className="text-error">
                    <strong>Error:</strong>
                    {typeof formState.error === 'string' ? (
                        <span className="ml-2">{formState.error}</span>
                    ) : (
                        <div className="mt-2">
                            <ConfigurableJsonViewer 
                                data={formState.error} 
                                defaultDepth={2} 
                            />
                        </div>
                    )}
                </div>
            )}
            
            {formState.response && (
                <div className="space-y-1">
                    <div className="flex items-center justify-start text-sm">
                        <span className="text-text-muted w-16">Status:</span>
                        <span className={`font-semibold ${
                            formState.response.event?.status === 'SUCCESS' ? 'text-success' : 
                            formState.response.event?.status === 'ERROR' ? 'text-error' : 
                            'text-warning'
                        }`}>
                            {formState.response.event?.status || 'Unknown'}
                        </span>
                    </div>
                    <div className="flex items-center justify-start text-sm">
                        <span className="text-text-muted w-16">Event:</span>
                        <span className="text-text-primary font-mono text-xs">{formState.response.event?.event_type}</span>
                    </div>
                    <div className="flex items-center justify-start text-sm">
                        <span className="text-text-muted w-16">Time:</span>
                        <span className="text-text-secondary">{new Date(formState.response.timestamp).toLocaleTimeString()}</span>
                    </div>
                    {formState.response.event?.payload && (
                        <details className="mt-1">
                            <summary className="cursor-pointer text-accent-primary text-sm font-medium hover:text-accent-secondary transition-colors">Response Data</summary>
                            <div className="mt-1 max-h-32 overflow-y-auto custom-scrollbar">
                                <ConfigurableJsonViewer 
                                    data={formState.response.event.payload} 
                                    defaultDepth={1} 
                                />
                            </div>
                        </details>
                    )}
                </div>
            )}
        </div>
    );
}

export default FormResponseDisplay;
