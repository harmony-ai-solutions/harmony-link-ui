import React from 'react';

function TTSConfigurationDisplay({ config, loading, error }) {
    if (loading) {
        return (
            <div className="card-compact">
                <div className="flex items-center text-text-muted text-sm">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent-primary mr-2"></div>
                    Loading TTS configuration...
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
                <div className="text-text-muted text-sm">No TTS configuration available</div>
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
            case 'harmonyspeech': return config.harmonyspeech;
            case 'elevenlabs': return config.elevenlabs;
            case 'openai': return config.openai;
            case 'kindroid': return config.kindroid;
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

                        {config.outputtype && <ConfigRow label="Output Type" value={config.outputtype} />}
                        {config.vocalizenonverbal !== undefined && <ConfigRow label="Vocalize Non-verbal" value={config.vocalizenonverbal ? 'Yes' : 'No'} />}

                        {config.wordstoreplace && Object.keys(config.wordstoreplace).length > 0 && (
                            <div>
                                <span className="text-text-muted">Word Replacements:</span>
                                <div className="ml-2 text-text-secondary text-xs bg-background-surface/50 p-2 rounded-lg mt-1 max-h-20 overflow-y-auto custom-scrollbar border border-border-glass">
                                    {Object.entries(config.wordstoreplace).map(([from, to]) => (
                                        <div key={from}>{from} → {to}</div>
                                    ))}
                                </div>
                            </div>
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
                    <h5 className="font-semibold text-accent-primary mb-1.5 text-sm">Voice Settings</h5>
                    <div className="space-y-1 text-xs">
                        {providerConfig?.model && <ConfigRow label="Model" value={providerConfig.model} />}
                        {providerConfig?.voice && <ConfigRow label="Voice" value={providerConfig.voice} />}
                        {providerConfig?.voiceid && <ConfigRow label="Voice ID" value={providerConfig.voiceid} />}
                        {providerConfig?.speed !== undefined && <ConfigRow label="Speed" value={providerConfig.speed} />}
                        {providerConfig?.stability !== undefined && <ConfigRow label="Stability" value={providerConfig.stability} />}
                        {providerConfig?.similarityboost !== undefined && <ConfigRow label="Similarity Boost" value={providerConfig.similarityboost} />}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TTSConfigurationDisplay;
