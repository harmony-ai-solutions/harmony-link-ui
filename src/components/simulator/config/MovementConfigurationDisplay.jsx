import React from 'react';

// Movement Configuration Display Component
function MovementConfigurationDisplay({ config, loading, error }) {
    if (loading) {
        return (
            <div className="bg-neutral-700 rounded p-4">
                <div className="flex items-center text-yellow-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400 mr-2"></div>
                    Loading movement configuration...
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
                <div className="text-gray-400">No movement configuration available</div>
            </div>
        );
    }

    const getProviderDisplayName = (provider) => {
        const providerNames = {
            'openaicompatible': 'OpenAI Compatible'
        };
        return providerNames[provider] || provider;
    };

    const getProviderConfig = (config) => {
        switch (config.provider) {
            case 'openaicompatible':
                return config.openaicompatible;
            default:
                return null;
        }
    };

    const providerConfig = getProviderConfig(config);

    return (
        <div className="bg-neutral-700 rounded p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Provider Information */}
                <div>
                    <h5 className="font-medium text-cyan-400 mb-2">Provider Configuration</h5>
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
                                
                                {providerConfig.model && (
                                    <div>
                                        <span className="text-gray-400">Model:</span>
                                        <span className="ml-2 text-gray-300">
                                            {providerConfig.model}
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
                            </>
                        )}
                    </div>
                </div>

                {/* Movement Settings */}
                <div>
                    <h5 className="font-medium text-cyan-400 mb-2">Movement Settings</h5>
                    <div className="space-y-2 text-sm">
                        {config.startupsynctimeout !== undefined && (
                            <div>
                                <span className="text-gray-400">Startup Sync Timeout:</span>
                                <span className="ml-2 text-gray-300">
                                    {config.startupsynctimeout}ms
                                </span>
                            </div>
                        )}
                        
                        {config.executionthreshold !== undefined && (
                            <div>
                                <span className="text-gray-400">Execution Threshold:</span>
                                <span className="ml-2 text-gray-300">
                                    {config.executionthreshold}
                                </span>
                            </div>
                        )}
                        
                        {providerConfig?.temperature !== undefined && (
                            <div>
                                <span className="text-gray-400">Temperature:</span>
                                <span className="ml-2 text-gray-300">
                                    {providerConfig.temperature}
                                </span>
                            </div>
                        )}
                        
                        {providerConfig?.maxtokens && (
                            <div>
                                <span className="text-gray-400">Max Tokens:</span>
                                <span className="ml-2 text-gray-300">
                                    {providerConfig.maxtokens}
                                </span>
                            </div>
                        )}
                        
                        {providerConfig?.topp !== undefined && (
                            <div>
                                <span className="text-gray-400">Top P:</span>
                                <span className="ml-2 text-gray-300">
                                    {providerConfig.topp}
                                </span>
                            </div>
                        )}
                        
                        {providerConfig?.stoptokens && providerConfig.stoptokens.length > 0 && (
                            <div>
                                <span className="text-gray-400">Stop Tokens:</span>
                                <div className="ml-2 text-gray-300 text-xs">
                                    {providerConfig.stoptokens.join(', ')}
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
            </div>
        </div>
    );
}

export default MovementConfigurationDisplay;
