import { useState, useEffect, useCallback } from 'react';
import { fetchLogLevels, updateLogLevels, fetchLogComponents } from '../../services/management/logService.js';

/**
 * Log level settings panel for runtime control of per-component log levels
 * and prompt verbosity.
 */
export default function LogLevelSettings({ isOpen, onClose }) {
    const [config, setConfig] = useState({
        defaultLevel: 'debug',
        componentLevels: {},
        promptVerbosity: 'summary',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [availableComponents, setAvailableComponents] = useState([]);
    const [addingComponent, setAddingComponent] = useState('');

    // Load current config on open
    useEffect(() => {
        if (isOpen) {
            fetchLogLevels().then(data => {
                setConfig({
                    defaultLevel: data.defaultLevel || 'debug',
                    componentLevels: data.componentLevels || {},
                    promptVerbosity: data.promptVerbosity || 'summary',
                });
            }).catch(err => {
                console.error('Failed to load log levels:', err);
            });

            fetchLogComponents().then(data => {
                setAvailableComponents(data.components || []);
            }).catch(err => {
                console.error('Failed to load components:', err);
            });
        }
    }, [isOpen]);

    const handleSave = useCallback(async () => {
        setIsSaving(true);
        try {
            await updateLogLevels(config);
        } catch (error) {
            console.error('Failed to update log levels:', error);
        } finally {
            setIsSaving(false);
        }
    }, [config]);

    const handleReset = useCallback(async () => {
        const defaults = {
            defaultLevel: 'debug',
            componentLevels: {},
            promptVerbosity: 'summary',
        };
        setConfig(defaults);
        try {
            await updateLogLevels(defaults);
        } catch (error) {
            console.error('Failed to reset log levels:', error);
        }
    }, []);

    const handleAddComponent = useCallback(() => {
        if (addingComponent && !config.componentLevels[addingComponent]) {
            setConfig(prev => ({
                ...prev,
                componentLevels: {
                    ...prev.componentLevels,
                    [addingComponent]: 'debug',
                },
            }));
            setAddingComponent('');
        }
    }, [addingComponent, config.componentLevels]);

    if (!isOpen) return null;

    // Filter available components to those not already overridden
    const unusedComponents = availableComponents.filter(
        c => !config.componentLevels[c]
    );

    return (
        <div className="log-settings-panel mb-3 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-text-primary">Log Level Settings</h3>
                <button className="module-action-btn text-sm" onClick={onClose}>✕</button>
            </div>

            {/* Default Level */}
            <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-text-secondary w-32">Default Level</label>
                <select
                    value={config.defaultLevel}
                    onChange={(e) => setConfig({ ...config, defaultLevel: e.target.value })}
                    className="input-field text-sm py-1 w-32"
                >
                    <option value="trace">TRACE</option>
                    <option value="debug">DEBUG</option>
                    <option value="info">INFO</option>
                    <option value="warn">WARN</option>
                    <option value="error">ERROR</option>
                </select>
            </div>

            {/* Component Overrides */}
            <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Per-Component Overrides</label>
                {Object.entries(config.componentLevels).map(([comp, level]) => (
                    <div key={comp} className="flex items-center gap-2">
                        <span className="text-xs text-accent-primary font-semibold w-32">{comp}</span>
                        <select
                            value={level}
                            onChange={(e) => setConfig({
                                ...config,
                                componentLevels: { ...config.componentLevels, [comp]: e.target.value }
                            })}
                            className="input-field text-xs py-1 w-24"
                        >
                            <option value="trace">TRACE</option>
                            <option value="debug">DEBUG</option>
                            <option value="info">INFO</option>
                            <option value="warn">WARN</option>
                            <option value="error">ERROR</option>
                        </select>
                        <button
                            className="module-action-btn text-[10px] text-red-400"
                            onClick={() => {
                                const next = { ...config.componentLevels };
                                delete next[comp];
                                setConfig({ ...config, componentLevels: next });
                            }}
                        >
                            ✕
                        </button>
                    </div>
                ))}

                {/* Add override */}
                {unusedComponents.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                        <select
                            value={addingComponent}
                            onChange={(e) => setAddingComponent(e.target.value)}
                            className="input-field text-xs py-1 w-40"
                        >
                            <option value="">Select component...</option>
                            {unusedComponents.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <button
                            className="module-action-btn text-xs"
                            onClick={handleAddComponent}
                            disabled={!addingComponent}
                        >
                            + Add Override
                        </button>
                    </div>
                )}
            </div>

            {/* Prompt Verbosity */}
            <div className="space-y-2">
                <label className="text-xs font-medium text-text-secondary">Prompt Logging</label>
                <div className="flex gap-2">
                    {['summary', 'full', 'off'].map(v => (
                        <button
                            key={v}
                            onClick={() => setConfig({ ...config, promptVerbosity: v })}
                            className={`text-xs px-3 py-1.5 rounded border transition-all ${
                                config.promptVerbosity === v
                                    ? 'bg-accent-primary/20 text-accent-primary border-accent-primary/30 font-bold'
                                    : 'bg-background-surface text-text-muted border-white/10'
                            }`}
                        >
                            {v.charAt(0).toUpperCase() + v.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button className="btn-secondary text-sm py-1.5" onClick={handleReset}>
                    Reset to Defaults
                </button>
                <button className="btn-primary text-sm py-1.5" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Apply'}
                </button>
            </div>
        </div>
    );
}