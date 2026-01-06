import React, { useState, useEffect } from 'react';
import useModuleConfigStore from '../../store/moduleConfigStore';
import { MODULE_CONFIGS } from '../../constants/moduleConfiguration.js';
import { MODULE_DEFAULTS } from '../../constants/moduleDefaults.js';
import { mergeConfigWithDefaults } from '../../utils/configUtils.js';
import DynamicOptionsGroup from '../settings/DynamicOptionsGroup.jsx';

// Import all provider-specific settings components
import BackendKajiwotoSettingsView from './BackendKajiwotoSettingsView.jsx';
import BackendOpenAICompatibleSettingsView from './BackendOpenAICompatibleSettingsView.jsx';
import BackendCharacterAISettingsView from './BackendCharacterAISettingsView.jsx';
import BackendKindroidSettingsView from './BackendKindroidAISettingsView.jsx';
import BackendOpenAISettingsView from './BackendOpenAISettingsView.jsx';
import BackendOpenRouterSettingsView from "./BackendOpenRouterSettingsView.jsx";

import CountenanceOpenAISettingsView from "./CountenanceOpenAISettingsView.jsx";
import CountenanceOpenAICompatibleSettingsView from './CountenanceOpenAICompatibleSettingsView.jsx';
import CountenanceOpenRouterSettingsView from "./CountenanceOpenRouterSettingsView.jsx";

import MovementGeneralSettingsView from './MovementGeneralSettingsView.jsx';
import MovementOpenAISettingsView from "./MovementOpenAISettingsView.jsx";
import MovementOpenAICompatibleSettingsView from './MovementOpenAICompatibleSettingsView.jsx';
import MovementOpenRouterSettingsView from "./MovementOpenRouterSettingsView.jsx";

import STTGeneralSettingsView from './STTGeneralSettingsView.jsx';
import STTHarmonySpeechSettingsView from './STTHarmonySpeechSettingsView.jsx';
import STTOpenAISettingsView from './STTOpenAISettingsView.jsx';

import VADHarmonySpeechSettingsView from './VADHarmonySpeechSettingsView.jsx';
import VADOpenAISettingsView from './VADOpenAISettingsView.jsx';

import TTSGeneralSettingsView from './TTSGeneralSettingsView.jsx';
import TTSElevenlabsSettingsView from './TTSElevenlabsSettingsView.jsx';
import TTSHarmonySpeechSettingsView from './TTSHarmonySpeechSettingsView.jsx';
import TTSOpenAISettingsView from './TTSOpenAISettingsView.jsx';
import TTSKindroidSettingsView from './TTSKindroidSettingsView.jsx';

import RAGGeneralSettingsView from './RAGGeneralSettingsView.jsx';
import RAGLocalAISettingsView from './RAGLocalAISettingsView.jsx';
import RAGOpenAISettingsView from './RAGOpenAISettingsView.jsx';
import RAGOpenAICompatibleSettingsView from './RAGOpenAICompatibleSettingsView.jsx';
import RAGMistralSettingsView from './RAGMistralSettingsView.jsx';
import RAGOllamaSettingsView from './RAGOllamaSettingsView.jsx';

// Component mapping
const COMPONENT_MAP = {
    BackendKajiwotoSettingsView,
    BackendOpenAICompatibleSettingsView,
    BackendCharacterAISettingsView,
    BackendKindroidSettingsView,
    BackendOpenAISettingsView,
    BackendOpenRouterSettingsView,
    CountenanceOpenAISettingsView,
    CountenanceOpenAICompatibleSettingsView,
    CountenanceOpenRouterSettingsView,
    MovementGeneralSettingsView,
    MovementOpenAISettingsView,
    MovementOpenAICompatibleSettingsView,
    MovementOpenRouterSettingsView,
    STTGeneralSettingsView,
    STTHarmonySpeechSettingsView,
    STTOpenAISettingsView,
    VADHarmonySpeechSettingsView,
    VADOpenAISettingsView,
    TTSGeneralSettingsView,
    TTSElevenlabsSettingsView,
    TTSHarmonySpeechSettingsView,
    TTSOpenAISettingsView,
    TTSKindroidSettingsView,
    RAGGeneralSettingsView,    
    RAGLocalAISettingsView,
    RAGOpenAISettingsView,
    RAGOpenAICompatibleSettingsView,
    RAGMistralSettingsView,
    RAGOllamaSettingsView
};

export default function ModuleConfigEditor({ moduleType, config, onClose }) {
    const { createConfig, updateConfig, isLoading } = useModuleConfigStore();
    const [name, setName] = useState(config?.name || '');
    const [moduleSettings, setModuleSettings] = useState(config?.config || {});
    const [selectedProviders, setSelectedProviders] = useState({});

    const moduleDef = MODULE_CONFIGS[moduleType];

    useEffect(() => {
        if (config) {
            setName(config.name);
            // Backend now returns flat structure - config data is directly in config object
            // Remove id and name fields to get just the settings
            const { id, name: configName, ...settings } = config;
            setModuleSettings(settings);
            
            // Initialize selected providers from config
            const providers = {};
            moduleDef.providers.forEach(p => {
                const currentProvider = getNestedValue(settings, p.settingsKey) || 'disabled';
                providers[p.id] = currentProvider;
            });
            setSelectedProviders(providers);
        } else {
            // No existing config - Merge general defaults immediately
            const generalDefaults = MODULE_DEFAULTS[moduleType]?.general || {};
            setModuleSettings(generalDefaults);

            // Default "disabled" for all providers
            const providers = {};
            moduleDef.providers.forEach(p => {
                providers[p.id] = 'disabled';
            });
            setSelectedProviders(providers);
        }
    }, [config, moduleDef, moduleType]);

    const handleProviderChange = (providerId, pDef) => {
        setSelectedProviders(prev => ({ ...prev, [pDef.id]: providerId }));
        
        const newSettings = { ...moduleSettings };
        setNestedValue(newSettings, pDef.settingsKey, providerId);
        
        // Merge defaults for the newly selected provider if we're creating a new config
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
            if (!newSettings[basePath]) newSettings[basePath] = {};
            newSettings[basePath][providerId] = { 
                ...(newSettings[basePath][providerId] || {}),
                ...updatedProviderSettings 
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
            if (config) {
                await updateConfig(moduleType, config.id, name, moduleSettings);
            } else {
                await createConfig(moduleType, name, moduleSettings);
            }
            onClose();
        } catch (error) {
            alert(`Failed to save configuration: ${error.message}`);
        }
    };

    // Helper functions (duplicated from moduleConfiguration.js to avoid export issues if any)
    function getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    function setNestedValue(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((current, key) => {
            if (!current[key]) current[key] = {};
            return current[key];
        }, obj);
        target[lastKey] = value;
    }

    const renderProviderSection = (pDef) => {
        const selectedProvider = selectedProviders[pDef.id] || 'disabled';
        const componentName = pDef.components[selectedProvider];
        const SettingsComponent = COMPONENT_MAP[componentName];
        
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
            <div key={pDef.id} className="mb-6 pb-6 border-b border-neutral-700 last:border-0 last:pb-0">
                <div className="flex items-center mb-4">
                    <label className="w-1/4 text-sm font-medium text-gray-300">
                        {pDef.name}
                    </label>
                    <div className="w-3/4">
                        <DynamicOptionsGroup
                            options={pDef.providerOptions}
                            selectedOption={selectedProvider}
                            onSelectedChange={(id) => handleProviderChange(id, pDef)}
                            groupName={`editor-${pDef.id}`}
                        />
                    </div>
                </div>

                {selectedProvider !== 'disabled' && SettingsComponent && (
                    <div className="bg-neutral-900 p-4 rounded border border-neutral-700">
                        <SettingsComponent
                            initialSettings={providerSettings}
                            saveSettingsFunc={(updated) => handleProviderSettingsChange(updated, selectedProvider, pDef)}
                        />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
            <div className="bg-neutral-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-neutral-700">
                <div className="p-6 border-b border-neutral-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">
                        {config ? 'Edit' : 'Create'} {moduleType.toUpperCase()} Configuration
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Configuration Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-neutral-900 border border-neutral-600 text-white p-2 rounded focus:border-orange-500 focus:outline-none"
                            placeholder="e.g. My Custom Backend"
                        />
                    </div>

                    <div className="space-y-4">
                        {moduleDef.generalSettingsComponent && (
                            <div className="mb-6">
                                <h3 className="text-lg font-medium text-orange-400 border-b border-neutral-700 pb-2 mb-4">
                                    General Settings
                                </h3>
                                <div className="bg-neutral-900 p-4 rounded border border-neutral-700">
                                    {React.createElement(COMPONENT_MAP[moduleDef.generalSettingsComponent], {
                                        initialSettings: moduleSettings,
                                        saveSettingsFunc: handleGeneralSettingsChange
                                    })}
                                </div>
                            </div>
                        )}

                        <h3 className="text-lg font-medium text-orange-400 border-b border-neutral-700 pb-2">
                            Provider Settings
                        </h3>
                        {moduleDef.providers.map(renderProviderSection)}
                    </div>
                </div>

                <div className="p-6 border-t border-neutral-700 flex justify-end space-x-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-neutral-700 text-white rounded hover:bg-neutral-600 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="px-6 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors disabled:opacity-50"
                    >
                        {isLoading ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </div>
    );
}
