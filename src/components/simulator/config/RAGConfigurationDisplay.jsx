import React from 'react';

function RAGConfigurationDisplay({ config, loading, error }) {
    if (loading) {
        return (
            <div className="card-compact">
                <div className="flex items-center text-text-muted text-sm">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent-primary mr-2"></div>
                    Loading RAG configuration...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card-compact-error">
                <div className="text-error text-sm">
                    <strong>Error:</strong> {error}
                </div>
            </div>
        );
    }

    if (!config) {
        return (
            <div className="card-compact">
                <div className="text-text-muted text-sm">No RAG configuration available</div>
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
            case 'localai': return config.providerlocalai;
            case 'openai': return config.provideropenai;
            case 'openaicompatible': return config.provideropenaicompatible;
            case 'mistral': return config.providermistral;
            case 'ollama': return config.providerollama;
            default: return null;
        }
    };

    const providerConfig = getProviderConfig(config);

    const ConfigRow = ({ label, value, mono }) => (
        <div>
            <span className="text-text-muted">{label}:</span>
            <span className={`ml-2 text-text-secondary ${mono ? 'font-mono text-xs' : ''}`}>
                {value}
            </span>
        </div>
    );

    return (
        <div className="bg-background-surface-translucent backdrop-blur-sm rounded-lg p-3 border border-border-glass">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <h5 className="font-semibold text-accent-primary mb-1.5 text-sm">Provider Configuration</h5>
                    <div className="space-y-1 text-xs">
                        <div>
                            <span className="text-text-muted">Provider:</span>
                            <span className="ml-2 text-success font-medium">
                                {getProviderDisplayName(config.provider)}
                            </span>
                        </div>

                        {providerConfig && (
                            <>
                                {providerConfig.baseurl && <ConfigRow label="Base URL" value={providerConfig.baseurl} mono />}
                                {providerConfig.model && <ConfigRow label="Embedding Model" value={providerConfig.model} />}
                                {providerConfig.apikey && <ConfigRow label="API Key" value={'*'.repeat(8) + '...' + providerConfig.apikey.slice(-4)} />}
                                {providerConfig.mistralapikey && <ConfigRow label="Mistral API Key" value={'*'.repeat(8) + '...' + providerConfig.mistralapikey.slice(-4)} />}
                            </>
                        )}

                        <div className="mt-3 p-2 bg-background-surface/50 rounded-lg border border-border-glass">
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-success"></div>
                                <span className="text-success text-xs font-medium">Configuration Loaded</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h5 className="font-semibold text-accent-primary mb-1.5 text-sm">Vector Database Settings</h5>
                    <div className="space-y-1 text-xs">
                        <ConfigRow label="Database" value="Chromem (Local)" />
                        <ConfigRow label="Embedding Concurrency" value={`${config.chromem?.embeddingconcurrency || 1} threads`} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RAGConfigurationDisplay;
