import React from 'react';

function TTSConfigurationDisplay({ config, loading, error }) {
    if (loading) {
        return (
            <div className="bg-neutral-700 rounded p-2">
                <div className="flex items-center text-yellow-400 text-sm">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-400 mr-2"></div>
                    Loading TTS configuration...
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
                <div className="text-gray-400 text-sm">No TTS configuration available</div>
            </div>
        );
    }

    const getProviderDisplayName = (provider) => {
        const providerNames = {
            'harmonyspeech': 'Harmony Speech',
            'elevenlabs': 'ElevenLabs',
            'openai': 'OpenAI',
            'kindroid': 'Kindroid'
        };
        return providerNames[provider] || provider;
    };

    const getProviderConfig = (config) => {
        switch (config.provider) {
            case 'harmonyspeech':
                return config.harmonyspeech;
            case 'elevenlabs':
                return config.elevenlabs;
            case 'openai':
                return config.openai;
            case 'kindroid':
                return config.kindroid;
            default:
                return null;
        }
    };

    const providerConfig = getProviderConfig(config);

    return (
        <div className="bg-neutral-700 rounded p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <h5 className="font-medium text-emerald-400 mb-1 text-sm">Provider Configuration</h5>
                    <div className="space-y-1 text-xs">
                        <div>
                            <span className="text-gray-400">Provider:</span>
                            <span className="ml-2 text-green-400 font-medium">
                                {getProviderDisplayName(config.provider)}
                            </span>
                        </div>
                        
                        {config.outputtype && (
                            <div>
                                <span className="text-gray-400">Output Type:</span>
                                <span className="ml-2 text-gray-300">
                                    {config.outputtype}
                                </span>
                            </div>
                        )}
                        
                        {config.vocalizenonverbal !== undefined && (
                            <div>
                                <span className="text-gray-400">Vocalize Non-verbal:</span>
                                <span className="ml-2 text-gray-300">
                                    {config.vocalizenonverbal ? 'Yes' : 'No'}
                                </span>
                            </div>
                        )}

                        {config.wordstoreplace && Object.keys(config.wordstoreplace).length > 0 && (
                            <div>
                                <span className="text-gray-400">Word Replacements:</span>
                                <div className="ml-2 text-gray-300 text-xs bg-neutral-600 p-2 rounded mt-1 max-h-20 overflow-y-auto custom-scrollbar">
                                    {Object.entries(config.wordstoreplace).map(([from, to]) => (
                                        <div key={from}>{from} → {to}</div>
                                    ))}
                                </div>
                            </div>
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
                    <h5 className="font-medium text-emerald-400 mb-1 text-sm">Voice Settings</h5>
                    <div className="space-y-1 text-xs">
                        {providerConfig?.model && (
                            <div>
                                <span className="text-gray-400">Model:</span>
                                <span className="ml-2 text-gray-300">
                                    {providerConfig.model}
                                </span>
                            </div>
                        )}
                        
                        {providerConfig?.voice && (
                            <div>
                                <span className="text-gray-400">Voice:</span>
                                <span className="ml-2 text-gray-300">
                                    {providerConfig.voice}
                                </span>
                            </div>
                        )}
                        
                        {providerConfig?.voiceid && (
                            <div>
                                <span className="text-gray-400">Voice ID:</span>
                                <span className="ml-2 text-gray-300">
                                    {providerConfig.voiceid}
                                </span>
                            </div>
                        )}
                        
                        {providerConfig?.speed !== undefined && (
                            <div>
                                <span className="text-gray-400">Speed:</span>
                                <span className="ml-2 text-gray-300">
                                    {providerConfig.speed}
                                </span>
                            </div>
                        )}
                        
                        {providerConfig?.stability !== undefined && (
                            <div>
                                <span className="text-gray-400">Stability:</span>
                                <span className="ml-2 text-gray-300">
                                    {providerConfig.stability}
                                </span>
                            </div>
                        )}
                        
                        {providerConfig?.similarityboost !== undefined && (
                            <div>
                                <span className="text-gray-400">Similarity Boost:</span>
                                <span className="ml-2 text-gray-300">
                                    {providerConfig.similarityboost}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TTSConfigurationDisplay;
