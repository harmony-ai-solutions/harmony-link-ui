import React from 'react';

function RAGConfigurationDisplay({ config, loading, error }) {
    if (loading) {
        return (
            <div className="bg-neutral-700 rounded p-4">
                <div className="flex items-center text-yellow-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400 mr-2"></div>
                    Loading RAG configuration...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-neutral-700 rounded p-4">
                <div className="text-red-400">
                    <strong>Error:</strong> {error}
                </div>
            </div>
        );
    }

    if (!config) {
        return (
            <div className="bg-neutral-700 rounded p-4">
                <div className="text-gray-400">No RAG configuration available</div>
            </div>
        );
    }

    const getProviderDisplayName = (provider) => {
        const providerNames = {
            'localai': 'LocalAI',
            'openai': 'OpenAI',
            'openaicompatible': 'OpenAI Compatible',
            'mistral': 'Mistral',
            'ollama': 'Ollama'
        };
        return providerNames[provider] || provider;
    };

    const getProviderConfig = (config) => {
        switch (config.provider) {
            case 'localai':
                return config.providerlocalai;
            case 'openai':
                return config.provideropenai;
            case 'openaicompatible':
                return config.provideropenaicompatible;
            case 'mistral':
                return config.providermistral;
            case 'ollama':
                return config.providerollama;
            default:
                return null;
        }
    };

    const providerConfig = getProviderConfig(config);

    return (
        <div className="bg-neutral-700 rounded p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <h5 className="font-medium text-orange-400 mb-2">Provider Configuration</h5>
                    <div className="space-y-2 text-sm">
                        <div>
                            <span className="text-gray-400">Provider:</span>
                            <span className="ml-2 text-green-400 font-medium">
                                {getProviderDisplayName(config.provider)}
                            </span>
                        </div>
                        
                        {providerConfig && (
                            <>
                                {providerConfig.baseurl && (
                                    <div>
                                        <span className="text-gray-400">Base URL:</span>
                                        <span className="ml-2 text-gray-300 font-mono text-xs">
                                            {providerConfig.baseurl}
                                        </span>
                                    </div>
                                )}
                                
                                {providerConfig.embeddingmodel && (
                                    <div>
                                        <span className="text-gray-400">Embedding Model:</span>
                                        <span className="ml-2 text-gray-300">
                                            {providerConfig.embeddingmodel}
                                        </span>
                                    </div>
                                )}
                                
                                {providerConfig.apikey && (
                                    <div>
                                        <span className="text-gray-400">API Key:</span>
                                        <span className="ml-2 text-gray-300">
                                            {'*'.repeat(8)}...{providerConfig.apikey.slice(-4)}
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
                                
                                {providerConfig.mistralapikey && (
                                    <div>
                                        <span className="text-gray-400">Mistral API Key:</span>
                                        <span className="ml-2 text-gray-300">
                                            {'*'.repeat(8)}...{providerConfig.mistralapikey.slice(-4)}
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
                    <h5 className="font-medium text-orange-400 mb-2">Vector Database Settings</h5>
                    <div className="space-y-2 text-sm">
                        <div>
                            <span className="text-gray-400">Database:</span>
                            <span className="ml-2 text-gray-300">Chromem (Local)</span>
                        </div>
                        <div>
                            <span className="text-gray-400">Embedding Concurrency:</span>
                            <span className="ml-2 text-gray-300">
                                {config.chromem?.embeddingconcurrency || 1} threads
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RAGConfigurationDisplay;
