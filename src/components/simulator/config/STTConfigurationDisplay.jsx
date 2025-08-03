import React from 'react';

function STTConfigurationDisplay({ config, loading, error }) {
    if (loading) {
        return (
            <div className="bg-neutral-700 rounded p-2">
                <div className="flex items-center text-yellow-400 text-sm">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-400 mr-2"></div>
                    Loading STT configuration...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-neutral-700 rounded p-2">
                <div className="text-red-400 text-sm">
                    <strong>Error:</strong> {error}
                </div>
            </div>
        );
    }

    if (!config) {
        return (
            <div className="bg-neutral-700 rounded p-2">
                <div className="text-gray-400 text-sm">No STT configuration available</div>
            </div>
        );
    }

    const getProviderDisplayName = (provider) => {
        const providerNames = {
            'harmonyspeech': 'Harmony Speech',
            'openai': 'OpenAI'
        };
        return providerNames[provider] || provider;
    };

    const getProviderConfig = (config) => {
        switch (config.provider) {
            case 'harmonyspeech':
                return config.harmonyspeech;
            case 'openai':
                return config.openai;
            default:
                return null;
        }
    };

    const providerConfig = getProviderConfig(config);

    return (
        <div className="bg-neutral-700 rounded p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <h5 className="font-medium text-indigo-400 mb-1 text-sm">Provider Configuration</h5>
                    <div className="space-y-1 text-xs">
                        <div>
                            <span className="text-gray-400">Provider:</span>
                            <span className="ml-2 text-green-400 font-medium">
                                {getProviderDisplayName(config.provider)}
                            </span>
                        </div>
                        
                        {providerConfig && (
                            <>
                                {providerConfig.endpoint && (
                                    <div>
                                        <span className="text-gray-400">Endpoint:</span>
                                        <span className="ml-2 text-gray-300 font-mono text-xs">
                                            {providerConfig.endpoint}
                                        </span>
                                    </div>
                                )}
                                
                                {providerConfig.model && (
                                    <div>
                                        <span className="text-gray-400">Model:</span>
                                        <span className="ml-2 text-gray-300">
                                            {providerConfig.model}
                                        </span>
                                    </div>
                                )}
                                
                                {providerConfig.vadmodel && (
                                    <div>
                                        <span className="text-gray-400">VAD Model:</span>
                                        <span className="ml-2 text-gray-300">
                                            {providerConfig.vadmodel}
                                        </span>
                                    </div>
                                )}
                                
                                {providerConfig.openaiapikey && (
                                    <div>
                                        <span className="text-gray-400">OpenAI API Key:</span>
                                        <span className="ml-2 text-gray-300">
                                            {'*'.repeat(8)}...{providerConfig.openaiapikey.slice(-4)}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                        
                        <div className="mt-3 p-2 bg-neutral-600 rounded">
                            <div className="text-xs text-gray-400 mb-1">Status:</div>
                            <div className="flex items-center">
                                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                                <span className="text-green-400 text-xs">Configuration Loaded</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h5 className="font-medium text-indigo-400 mb-1 text-sm">Transcription Settings</h5>
                    <div className="space-y-1 text-xs">
                        {config.transcription && (
                            <>
                                {config.transcription.mainstreamtimemillis !== undefined && (
                                    <div>
                                        <span className="text-gray-400">Main Stream Time:</span>
                                        <span className="ml-2 text-gray-300">
                                            {config.transcription.mainstreamtimemillis}ms
                                        </span>
                                    </div>
                                )}
                                
                                {config.transcription.transitionstreamtimemillis !== undefined && (
                                    <div>
                                        <span className="text-gray-400">Transition Stream Time:</span>
                                        <span className="ml-2 text-gray-300">
                                            {config.transcription.transitionstreamtimemillis}ms
                                        </span>
                                    </div>
                                )}
                                
                                {config.transcription.maxbuffercount !== undefined && (
                                    <div>
                                        <span className="text-gray-400">Max Buffer Count:</span>
                                        <span className="ml-2 text-gray-300">
                                            {config.transcription.maxbuffercount}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default STTConfigurationDisplay;
