import React from 'react';
import ConfigurableJsonViewer from '../../widgets/ConfigurableJsonViewer';

// Enhanced Form Response Display Component
function FormResponseDisplay({ formState, onClear }) {
    if (!formState.loading && !formState.response && !formState.error) {
        return null;
    }

    return (
        <div className="mt-2 p-2 bg-neutral-600 rounded">
            <div className="flex justify-between items-center mb-1">
                <h5 className="text-sm font-medium text-orange-400">Response</h5>
                <button
                    onClick={onClear}
                    className="text-sm text-gray-400 hover:text-gray-200"
                >
                    Clear
                </button>
            </div>
            
            {formState.loading && (
                <div className="flex items-center text-yellow-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400 mr-2"></div>
                    Processing...
                </div>
            )}
            
            {formState.error && (
                <div className="text-red-400">
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
                        <span className="text-gray-400 px-2">Status:</span>
                        <span className={`font-medium ${
                            formState.response.event?.status === 'SUCCESS' ? 'text-green-400' : 
                            formState.response.event?.status === 'ERROR' ? 'text-red-400' : 
                            'text-yellow-400'
                        }`}>
                            {formState.response.event?.status || 'Unknown'}
                        </span>
                    </div>
                    <div className="flex items-center justify-start text-sm">
                        <span className="text-gray-400 px-2">Event:</span>
                        <span className="text-white font-mono">{formState.response.event?.event_type}</span>
                    </div>
                    <div className="flex items-center justify-start text-sm">
                        <span className="text-gray-400 px-2">Time:</span>
                        <span className="text-gray-300">{new Date(formState.response.timestamp).toLocaleTimeString()}</span>
                    </div>
                    {formState.response.event?.payload && (
                        <details className="mt-1">
                            <summary className="cursor-pointer text-orange-400 text-sm hover:text-orange-300">Response Data</summary>
                            <div className="mt-1 max-h-32 overflow-y-auto">
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
