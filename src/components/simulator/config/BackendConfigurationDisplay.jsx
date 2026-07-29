import React from 'react';

// Backend Configuration Display Component
function BackendConfigurationDisplay({ config, loading, error }) {
    if (loading) {
        return (
            <div className="card-compact">
                <div className="flex items-center text-text-muted text-sm">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-accent-primary mr-2"></div>
                    Loading backend configuration...
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
                <div className="text-text-muted text-sm">No backend configuration available</div>
            </div>
        );
    }

    const getProviderDisplayName = (provider) => {
        const providerNames = {
            'openai': 'OpenAI',
            'openaicompatible': 'OpenAI Compatible',
            'kindroid': 'Kindroid',
            'characterai': 'Character.AI',
            'kajiwoto': 'Kajiwoto'
        };
        return providerNames[provider] || provider;
    };

    const getProviderConfig = (config) => {
        switch (config.provider) {
            case 'openai':
                return config.openai;
            case 'openaicompatible':
                return config.openaicompatible;
            case 'kindroid':
                return config.kindroid;
            case 'characterai':
                return config.characterai;
            case 'kajiwoto':
                return config.kajiwoto;
            default:
                return null;
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
                {/* Provider Information */}
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
                                {providerConfig.model && <ConfigRow label="Model" value={providerConfig.model} />}
                                {providerConfig.apikey && <ConfigRow label="API Key" value={'*'.repeat(8) + '...' + providerConfig.apikey.slice(-4)} />}
                                {providerConfig.apitoken && <ConfigRow label="API Token" value={'*'.repeat(8) + '...' + providerConfig.apitoken.slice(-4)} />}
                                {providerConfig.chatroomurl && <ConfigRow label="Chat Room URL" value={providerConfig.chatroomurl} mono />}
                                {providerConfig.kajiroomurl && <ConfigRow label="Kaji Room URL" value={providerConfig.kajiroomurl} mono />}
                                {providerConfig.kindroidid && <ConfigRow label="Kindroid ID" value={providerConfig.kindroidid} />}
                                {providerConfig.username && <ConfigRow label="Username" value={providerConfig.username} />}
                                {providerConfig.password && <ConfigRow label="Password" value={'*'.repeat(8)} />}
                            </>
                        )}
                    </div>
                </div>

                {/* Model Settings */}
                <div>
                    <h5 className="font-semibold text-accent-primary mb-1.5 text-sm">Model Settings</h5>
                    <div className="space-y-1 text-xs">
                        {providerConfig?.temperature !== undefined && <ConfigRow label="Temperature" value={providerConfig.temperature} />}
                        {providerConfig?.maxtokens && <ConfigRow label="Max Tokens" value={providerConfig.maxtokens} />}
                        {providerConfig?.topp !== undefined && <ConfigRow label="Top P" value={providerConfig.topp} />}
                        {providerConfig?.n && <ConfigRow label="N (Completions)" value={providerConfig.n} />}
                        {providerConfig?.stoptokens && providerConfig.stoptokens.length > 0 && (
                            <div>
                                <span className="text-text-muted">Stop Tokens:</span>
                                <div className="ml-2 text-text-secondary text-xs">
                                    {providerConfig.stoptokens.join(', ')}
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
            </div>
        </div>
    );
}

export default BackendConfigurationDisplay;
