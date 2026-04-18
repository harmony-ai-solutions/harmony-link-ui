import React, { useState, useEffect } from 'react';
import useModuleConfigStore from '../../store/moduleConfigStore';
import { MODULE_CONFIGS, getNestedValue, setNestedValue } from '../../constants/moduleConfiguration.js';
import { MODULE_DEFAULTS } from '../../constants/moduleDefaults.js';
import { mergeConfigWithDefaults } from '../../utils/configUtils.js';
import DynamicOptionsGroup from '../settings/DynamicOptionsGroup.jsx';
import ModularConfigEditor from './ModularConfigEditor.jsx';

export default function ModuleConfigInlineEditor({ moduleType, mode, config, onSave, onCancel }) {
    const { createConfig, updateConfig, isLoading } = useModuleConfigStore();
    const [name, setName] = useState('');
    const [moduleSettings, setModuleSettings] = useState({});
    const [selectedProviders, setSelectedProviders] = useState({});

    const moduleDef = MODULE_CONFIGS[moduleType];

    // Initialize state based on mode
    useEffect(() => {
        if (config && mode === 'edit') {
            // Edit mode: load existing config
            setName(config.name);
            const { id, name: configName, ...settings } = config;
            setModuleSettings(settings);

            const providers = {};
            moduleDef.providers.forEach(p => {
                const currentProvider = getNestedValue(settings, p.settingsKey) || 'disabled';
                providers[p.id] = currentProvider;
            });
            setSelectedProviders(providers);
        } else if (config && mode === 'copy') {
            // Copy mode: pre-fill with copied config, rename
            setName(`Copy of ${config.name}`);
            const { id, name: configName, ...settings } = config;
            setModuleSettings(settings);

            const providers = {};
            moduleDef.providers.forEach(p => {
                const currentProvider = getNestedValue(settings, p.settingsKey) || 'disabled';
                providers[p.id] = currentProvider;
            });
            setSelectedProviders(providers);
        } else {
            // Create mode: start with defaults
            const generalDefaults = MODULE_DEFAULTS[moduleType]?.general || {};
            setModuleSettings(generalDefaults);
            setName('');

            const providers = {};
            moduleDef.providers.forEach(p => {
                providers[p.id] = 'disabled';
            });
            setSelectedProviders(providers);
        }
    }, [config, mode, moduleType, moduleDef]);

    const handleProviderChange = (providerId, pDef) => {
        setSelectedProviders(prev => ({ ...prev, [pDef.id]: providerId }));

        const newSettings = { ...moduleSettings };
        setNestedValue(newSettings, pDef.settingsKey, providerId);

        // Merge defaults for the newly selected provider if creating a new config
        // or if the provider wasn't previously configured
        if (providerId !== 'disabled') {
            const providerDefaults = MODULE_DEFAULTS[moduleType]?.[providerId];
            if (providerDefaults) {
                const pathParts = pDef.settingsKey.split('.');
                if (pathParts.length > 1) {
                    // Multi-level path like 'transcription.provider'
                    const basePath = pathParts[0];
                    newSettings[basePath] = {
                        ...(newSettings[basePath] || {}),
                        [providerId]: mergeConfigWithDefaults(newSettings[basePath]?.[providerId], providerDefaults)
                    };
                } else {
                    // Single level path like 'provider'
                    newSettings[providerId] = mergeConfigWithDefaults(newSettings[providerId], providerDefaults);
                }
            }
        }

        setModuleSettings(newSettings);
    };

    const handleProviderSettingsChange = (updatedProviderSettings, providerId, pDef) => {
        const newSettings = { ...moduleSettings };
        const pathParts = pDef.settingsKey.split('.');

        if (pathParts.length > 1) {
            // Multi-level path like 'transcription.provider'
            const basePath = pathParts[0]; // 'transcription'
            // Deep copy the nested object to avoid mutating frozen store objects
            newSettings[basePath] = {
                ...(newSettings[basePath] || {}),
                [providerId]: {
                    ...(newSettings[basePath]?.[providerId] || {}),
                    ...updatedProviderSettings
                }
            };
        } else {
            // Single level path like 'provider'
            newSettings[providerId] = {
                ...(newSettings[providerId] || {}),
                ...updatedProviderSettings
            };
        }
        setModuleSettings(newSettings);
    };

    const handleGeneralSettingsChange = (updatedGeneralSettings) => {
        setModuleSettings(prev => ({
            ...prev,
            ...updatedGeneralSettings
        }));
    };

    const handleSave = async () => {
        if (!name.trim()) {
            alert('Please enter a configuration name');
            return;
        }

        try {
            if (mode === 'edit') {
                await updateConfig(moduleType, config.id, name, moduleSettings);
            } else {
                // Both 'create' and 'copy' create a new config
                await createConfig(moduleType, name, moduleSettings);
            }
            onSave();
        } catch (error) {
            alert(`Failed to save configuration: ${error.message}`);
        }
    };

    const renderProviderSection = (pDef) => {
        const selectedProvider = selectedProviders[pDef.id] || 'disabled';
        const schemaId = pDef.components[selectedProvider];

        const pathParts = pDef.settingsKey.split('.');
        let providerSettings = {};
        if (selectedProvider !== 'disabled') {
            if (pathParts.length > 1) {
                const basePath = pathParts[0];
                providerSettings = moduleSettings[basePath]?.[selectedProvider] || {};
            } else {
                providerSettings = moduleSettings[selectedProvider] || {};
            }
        }

        return (
            <div key={pDef.id} className="module-inline-editor-provider">
                <div className="module-inline-editor-provider-header">
                    <label className="module-inline-editor-label">{pDef.name}</label>
                    <DynamicOptionsGroup
                        options={pDef.providerOptions}
                        selectedOption={selectedProvider}
                        onSelectedChange={(id) => handleProviderChange(id, pDef)}
                        groupName={`inline-${pDef.id}`}
                    />
                </div>

                {selectedProvider !== 'disabled' && (
                    <div className="module-inline-editor-provider-settings">
                        <ModularConfigEditor
                            schemaId={schemaId}
                            moduleType={moduleType}
                            providerId={selectedProvider}
                            initialSettings={providerSettings}
                            saveSettingsFunc={(updated) => handleProviderSettingsChange(updated, selectedProvider, pDef)}
                        />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="module-inline-editor">
            {/* ── Editor Header ──────────────────────────────────────── */}
            <div className="module-inline-editor-header">
                <span className="text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--color-text-secondary)' }}>
                    {mode === 'edit' ? 'Edit Configuration' : mode === 'copy' ? 'Copy Configuration' : 'New Configuration'}
                </span>
            </div>

            {/* ── Editor Body ────────────────────────────────────────── */}
            <div className="module-inline-editor-body custom-scrollbar">
                {/* Config Name */}
                <div className="module-inline-editor-field">
                    <label className="module-inline-editor-label">Configuration Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="input-field w-full p-2 rounded text-sm"
                        placeholder="e.g. My Custom Backend"
                    />
                </div>

                {/* General Settings */}
                {moduleDef.generalSettingsSchema && (
                    <div className="module-inline-editor-section">
                        <h4 className="module-inline-editor-section-title">General Settings</h4>
                        <div className="module-inline-editor-section-body">
                            <ModularConfigEditor
                                schemaId={moduleDef.generalSettingsSchema}
                                moduleType={moduleType}
                                providerId="general"
                                initialSettings={moduleSettings}
                                saveSettingsFunc={handleGeneralSettingsChange}
                            />
                        </div>
                    </div>
                )}

                {/* Provider Settings */}
                <div className="module-inline-editor-section">
                    <h4 className="module-inline-editor-section-title">Provider Settings</h4>
                    {moduleDef.providers.map(pDef => renderProviderSection(pDef))}
                </div>
            </div>

            {/* ── Editor Footer ─────────────────────────────────────── */}
            <div className="module-inline-editor-footer">
                <button onClick={onCancel} className="module-action-btn">
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={isLoading || !name.trim()}
                    className="module-action-btn-save"
                >
                    {isLoading ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>
        </div>
    );
}