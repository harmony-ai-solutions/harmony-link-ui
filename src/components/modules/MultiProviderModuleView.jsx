import React, { useState, useEffect } from 'react';
import { cloneDeep } from 'lodash';
import ProviderSection from './ProviderSection.jsx';
import { useSelectedEntity, useEntityData } from '../../hooks/useEntitySettings.js';

// Import general settings components
import MovementGeneralSettingsView from './MovementGeneralSettingsView.jsx';
import STTGeneralSettingsView from './STTGeneralSettingsView.jsx';
import TTSGeneralSettingsView from './TTSGeneralSettingsView.jsx';
import RAGGeneralSettingsView from './RAGGeneralSettingsView.jsx';

// Component mapping for general settings
const GENERAL_SETTINGS_COMPONENT_MAP = {
    MovementGeneralSettingsView,
    STTGeneralSettingsView,
    TTSGeneralSettingsView,
    RAGGeneralSettingsView
};

const MultiProviderModuleView = ({ 
    moduleConfig,
    entityId = null 
}) => {
    // Use store for state management
    const { selectedEntityId, selectedModuleId } = useSelectedEntity();
    const { updateSetting, getSetting, updateModule, getModule } = useEntityData(selectedEntityId);
    
    // Get current module settings from store
    const currentSettings = getModule(selectedModuleId);

    const handleGeneralSettingsChange = (updatedModuleSettings) => {
        // Update the entire module settings in the store
        updateModule(selectedModuleId, updatedModuleSettings);
    };

    const renderGeneralSettings = () => {
        if (!moduleConfig.generalSettingsComponent) return null;
        
        const GeneralSettingsComponent = GENERAL_SETTINGS_COMPONENT_MAP[moduleConfig.generalSettingsComponent];
        if (!GeneralSettingsComponent) {
            console.warn(`General settings component ${moduleConfig.generalSettingsComponent} not found`);
            return null;
        }
        
        // Some components need additional props like entityId
        const additionalProps = {};
        if (moduleConfig.generalSettingsComponent.includes('RAG') && entityId) {
            additionalProps.entityId = entityId;
        }
        
        return (
            <div className="border-t border-neutral-500">
                <div className="flex items-center w-full py-4">
                    <div className="w-1/5 px-3">
                        <label className="block text-sm font-medium text-gray-300">
                            General Settings
                        </label>
                    </div>
                    <div className="w-4/5">
                        <GeneralSettingsComponent
                            key={selectedEntityId}
                            initialSettings={currentSettings}
                            saveSettingsFunc={handleGeneralSettingsChange}
                            {...additionalProps}
                        />
                    </div>
                </div>
            </div>
        );
    };

    const renderProviders = () => {
        return moduleConfig.providers.map((providerConfig, index) => (
            <ProviderSection
                key={providerConfig.id}
                providerConfig={providerConfig}
                moduleId={selectedModuleId}
                entityId={entityId}
            />
        ));
    };

    return (
        <div className="w-full">
            {/* General Settings Section */}
            {renderGeneralSettings()}
            
            {/* Provider Sections */}
            {renderProviders()}
        </div>
    );
};

export default MultiProviderModuleView;
