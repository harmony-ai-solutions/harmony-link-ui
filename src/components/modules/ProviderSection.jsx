import React, { useState, useEffect } from 'react';
import DynamicOptionsGroup from '../settings/DynamicOptionsGroup.jsx';
import { useSelectedEntity, useEntityData } from '../../hooks/useEntitySettings.js';

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

import MovementOpenAISettingsView from "./MovementOpenAISettingsView.jsx";
import MovementOpenAICompatibleSettingsView from './MovementOpenAICompatibleSettingsView.jsx';
import MovementOpenRouterSettingsView from "./MovementOpenRouterSettingsView.jsx";

import STTHarmonySpeechSettingsView from './STTHarmonySpeechSettingsView.jsx';
import STTOpenAISettingsView from './STTOpenAISettingsView.jsx';

import VADHarmonySpeechSettingsView from './VADHarmonySpeechSettingsView.jsx';
import VADOpenAISettingsView from './VADOpenAISettingsView.jsx';

import TTSElevenlabsSettingsView from './TTSElevenlabsSettingsView.jsx';
import TTSHarmonySpeechSettingsView from './TTSHarmonySpeechSettingsView.jsx';
import TTSOpenAISettingsView from './TTSOpenAISettingsView.jsx';
import TTSKindroidSettingsView from './TTSKindroidSettingsView.jsx';

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
    MovementOpenAISettingsView,
    MovementOpenAICompatibleSettingsView,
    MovementOpenRouterSettingsView,
    STTHarmonySpeechSettingsView,
    STTOpenAISettingsView,
    VADHarmonySpeechSettingsView,
    VADOpenAISettingsView,
    TTSElevenlabsSettingsView,
    TTSHarmonySpeechSettingsView,
    TTSOpenAISettingsView,
    TTSKindroidSettingsView,
    RAGLocalAISettingsView,
    RAGOpenAISettingsView,
    RAGOpenAICompatibleSettingsView,
    RAGMistralSettingsView,
    RAGOllamaSettingsView
};

const ProviderSection = ({ 
    providerConfig,
    moduleId,
    entityId = null 
}) => {
    // Use store for state management
    const { selectedEntityId } = useSelectedEntity();
    const { updateSetting, getSetting } = useEntityData(selectedEntityId);
    
    const [selectedProvider, setSelectedProvider] = useState('disabled');

    useEffect(() => {
        // Construct the full path with module context
        const fullSettingsKey = `${moduleId}.${providerConfig.settingsKey}`;
        const currentProvider = getSetting(fullSettingsKey) || 'disabled';
        
        setSelectedProvider(currentProvider);
    }, [getSetting, providerConfig.settingsKey, selectedEntityId, moduleId]);

    const handleProviderChange = (providerId) => {
        setSelectedProvider(providerId);
        
        // Update the store directly with module context
        const fullSettingsKey = `${moduleId}.${providerConfig.settingsKey}`;
        updateSetting(fullSettingsKey, providerId);
    };

    const handleProviderSettingsChange = (updatedProviderSettings) => {
        // Update the store directly with module context
        const pathParts = providerConfig.settingsKey.split('.');
        if (pathParts.length > 1) {
            // Multi-level path like 'transcription.provider'
            const basePath = pathParts[0]; // 'transcription'
            const providerSettingsPath = `${moduleId}.${basePath}.${selectedProvider}`;
            
            // Update each field in the provider settings
            Object.entries(updatedProviderSettings).forEach(([key, value]) => {
                updateSetting(`${providerSettingsPath}.${key}`, value);
            });
        } else {
            // Single level path like 'provider'
            Object.entries(updatedProviderSettings).forEach(([key, value]) => {
                updateSetting(`${moduleId}.${selectedProvider}.${key}`, value);
            });
        }
    };

    const getProviderSettings = () => {
        if (selectedProvider === 'disabled') return null;
        
        const pathParts = providerConfig.settingsKey.split('.');
        if (pathParts.length > 1) {
            // Multi-level path like 'transcription.provider'
            const basePath = pathParts[0]; // 'transcription'
            return getSetting(`${moduleId}.${basePath}.${selectedProvider}`) || {};
        } else {
            // Single level path like 'provider'
            return getSetting(`${moduleId}.${selectedProvider}`) || {};
        }
    };

    const renderProviderSettings = () => {
        if (selectedProvider === 'disabled') return null;
        
        const componentName = providerConfig.components[selectedProvider];
        if (!componentName) return null;
        
        const SettingsComponent = COMPONENT_MAP[componentName];
        if (!SettingsComponent) {
            console.warn(`Component ${componentName} not found in COMPONENT_MAP`);
            return null;
        }
        
        const providerSettings = getProviderSettings();
        
        // Some components need additional props like entityId
        const additionalProps = {};
        if (componentName.includes('RAG') && entityId) {
            additionalProps.entityId = entityId;
        }
        
        // Add key prop to force re-render when entity or provider changes
        const componentKey = `${selectedEntityId}-${selectedProvider}`;
        
        return (
            <SettingsComponent
                key={componentKey}
                initialSettings={providerSettings}
                saveSettingsFunc={handleProviderSettingsChange}
                {...additionalProps}
            />
        );
    };

    return (
        <div className="border-t border-neutral-500">
            {/* Provider Selection */}
            <div className="flex items-center w-full py-4">
                <div className="w-1/5 px-3">
                    <label className="block text-sm font-medium text-gray-300">
                        {providerConfig.name}
                    </label>
                </div>
                <div className="w-4/5 px-3">
                    <DynamicOptionsGroup
                        options={providerConfig.providerOptions}
                        selectedOption={selectedProvider}
                        onSelectedChange={handleProviderChange}
                        groupName={`${moduleId}-${providerConfig.id}`}
                    />
                </div>
            </div>
            
            {/* Provider-Specific Settings */}
            {selectedProvider !== 'disabled' && (
                <div className="flex items-center w-full border-t border-neutral-400">
                    {renderProviderSettings()}
                </div>
            )}
        </div>
    );
};

export default ProviderSection;
