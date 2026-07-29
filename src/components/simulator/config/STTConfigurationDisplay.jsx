import React from 'react';

function STTConfigurationDisplay({ config, loading, error }) {
    if (loading) {
        return (
            <div className="card-compact">
                <div className="flex items-center text-text-muted text-sm">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent-primary mr-2"></div>
                    Loading STT configuration...
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
                <div className="text-text-muted text-sm">No STT configuration available</div>
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
            case 'harmonyspeech': return config.harmonyspeech;
            case 'openai': return config.openai;
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
                                {providerConfig.endpoint && <ConfigRow label="Endpoint" value={providerConfig.endpoint} mono />}
                                {providerConfig.model && <ConfigRow label="Model" value={providerConfig.model} />}
                                {providerConfig.vadmodel && <ConfigRow label="VAD Model" value={providerConfig.vadmodel} />}
                                {providerConfig.apikey && <ConfigRow label="OpenAI API Key" value={'*'.repeat(8) + '...' + providerConfig.apikey.slice(-4)} />}
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
                    <h5 className="font-semibold text-accent-primary mb-1.5 text-sm">Transcription Settings</h5>
                    <div className="space-y-1 text-xs">
                        {config.transcription && (
                            <>
                                {config.transcription.mainstreamtimemillis !== undefined && <ConfigRow label="Main Stream Time" value={`${config.transcription.mainstreamtimemillis}ms`} />}
                                {config.transcription.transitionstreamtimemillis !== undefined && <ConfigRow label="Transition Stream Time" value={`${config.transcription.transitionstreamtimemillis}ms`} />}
                                {config.transcription.maxbuffercount !== undefined && <ConfigRow label="Max Buffer Count" value={config.transcription.maxbuffercount} />}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default STTConfigurationDisplay;
