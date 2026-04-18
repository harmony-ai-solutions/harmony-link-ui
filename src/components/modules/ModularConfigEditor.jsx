import { useEffect, useState } from 'react';
import SettingsTooltip from '../settings/SettingsTooltip.jsx';
import { LogDebug, LogError } from '../../utils/logger.js';
import { validateProviderConfig, listProviderModels } from '../../services/management/configService.js';
import { HarmonySpeechEnginePlugin } from '@harmony-ai/harmonyspeech';
import { getConfig } from '../../services/management/configService.js';
import { isHarmonyLinkMode } from '../../config/appMode.js';
import IntegrationDisplay from '../integrations/IntegrationDisplay.jsx';
import ConfigVerificationSection from '../widgets/ConfigVerificationSection.jsx';
import { MODULES } from '../../constants/modules.js';
import { mergeConfigWithDefaults } from '../../utils/configUtils.js';
import { MODULE_DEFAULTS } from '../../constants/moduleDefaults.js';
import ErrorDialog from '../modals/ErrorDialog.jsx';
import { PROVIDER_FIELD_SCHEMAS, validateField } from '../../constants/providerFieldSchemas.jsx';
import { getNestedValue, setNestedValue } from '../../constants/moduleConfiguration.js';
import VoiceConfigManager from '../widgets/VoiceConfigManager.jsx';
import ThemedSelect from '../widgets/ThemedSelect.jsx';
import WorkflowProfileEditor, { EMPTY_PROFILE } from '../widgets/WorkflowProfileEditor.jsx';
import useHarmonySpeechClient from '../../hooks/useHarmonySpeechClient.js';

/**
 * HarmonySpeech Model Select component
 * Uses the useHarmonySpeechClient hook to fetch and display models
 */
const HarmonySpeechModelSelect = ({ endpoint, mode, value, onChange }) => {
    const { modelOptions, isLoading } = useHarmonySpeechClient(endpoint, mode);
    return (
        <ThemedSelect
            value={value}
            onChange={onChange}
            options={modelOptions.map(opt => ({ label: opt.name, value: opt.value }))}
            placeholder={isLoading ? 'Loading models...' : 'Select model...'}
        />
    );
};

/**
 * Universal configuration editor component using field schemas.
 * 
 * @param {string} schemaId - Key into PROVIDER_FIELD_SCHEMAS
 * @param {string} moduleType - e.g., 'backend', 'tts'
 * @param {string} providerId - e.g., 'openai', 'elevenlabs', 'general'
 * @param {object} initialSettings - Current settings values
 * @param {function} saveSettingsFunc - Callback with updated settings object
 */
const ModularConfigEditor = ({ schemaId, moduleType, providerId, initialSettings, saveSettingsFunc }) => {
    const schema = PROVIDER_FIELD_SCHEMAS[schemaId];
    
    if (!schema) {
        return (
            <div className="p-4 text-error">
                Error: No schema found for schemaId '{schemaId}'
            </div>
        );
    }

    // Get defaults for this module and provider
    // For general settings (providerId === 'general'), handle specially
    let defaults = {};
    if (providerId === 'general') {
        // For general settings, merge defaults from multiple paths if specified
        if (schema.defaultPaths && schema.defaultPaths.length > 0) {
            schema.defaultPaths.forEach(path => {
                const pathDefaults = MODULE_DEFAULTS[moduleType]?.[path];
                if (pathDefaults) {
                    defaults = { ...defaults, ...pathDefaults };
                }
            });
        } else {
            defaults = MODULE_DEFAULTS[moduleType]?.general || {};
        }
    } else {
        defaults = MODULE_DEFAULTS[moduleType]?.[providerId] || {};
    }
    const mergedSettings = mergeConfigWithDefaults(initialSettings, defaults);

    // Central settings state
    const [moduleSettings, setModuleSettings] = useState(mergedSettings);

    // Validation state
    const [validationState, setValidationState] = useState({ status: 'idle', message: '' });

    // Tooltip visibility tracking
    const [tooltipVisible, setTooltipVisible] = useState(0);

    // Modal dialog state
    const [modalMessage, setModalMessage] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Show Modal Function
    const showModal = (message) => {
        setModalMessage(message);
        setIsModalVisible(true);
    };

    // Model fetching state
    const [availableModels, setAvailableModels] = useState([]);
    const [modelsLoading, setModelsLoading] = useState(false);

    // Field display values for special field types (comma-list, key-value-textarea)
    const [fieldDisplayValues, setFieldDisplayValues] = useState({});
    
    // Determine if integration selector should be shown
    const shouldShowIntegration = schema.hasIntegrationSelector && (!schema.integrationSelectorCondition || (isHarmonyLinkMode()));

    // Helper: Get width class for field wrapper
    const getWidthClass = (width) => {
        switch (width) {
            case '1/2': return 'w-1/2';
            case 'full':
            default: return 'w-full';
        }
    };

    // Helper: Get label width class
    const getLabelWidthClass = (labelWidth) => {
        switch (labelWidth) {
            case '1/6': return 'w-1/6';
            case '1/3':
            default: return 'w-1/3';
        }
    };

    // Helper: Get input width class based on label width
    const getInputWidthClass = (width, labelWidth) => {
        // If full width with 1/6 label: input gets 5/6
        if (width === 'full') {
            switch (labelWidth) {
                case '1/6': return 'w-5/6';
                case '1/3':
                default: return 'w-2/3';
            }
        }
        // If half width: input always gets 2/3
        return 'w-2/3';
    };

    // Helper: Get display value for a field
    const getFieldDisplayValue = (field, currentValue) => {
        // If we have a stored display value, use it
        if (fieldDisplayValues[field.key] !== undefined) {
            return fieldDisplayValues[field.key];
        }
        
        // For array types (comma-list), join with commas
        if (Array.isArray(currentValue)) {
            return currentValue.join(', ');
        }
        
        // For object types (key-value-textarea), convert to key: value format
        if (currentValue && typeof currentValue === 'object') {
            return Object.entries(currentValue)
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n');
        }
        
        return currentValue || '';
    };

    // Handle field change
    const handleFieldChange = (field, value) => {
        const newDisplayValues = { ...fieldDisplayValues };
        newDisplayValues[field.key] = value;
        setFieldDisplayValues(newDisplayValues);
    };

    // Handle field blur with validation
    const handleFieldBlur = (field, value) => {
        // Get current value to check if previously had a value
        const currentValue = getNestedValue(moduleSettings, field.key);
        
        // Run validation
        const validationResult = validateField(value, field.validation, moduleSettings, field.key);
        
        if (!validationResult.valid) {
            // Show error modal and revert to previous value
            showModal(validationResult.message);
            
            // Clear display value to show previous value
            const newDisplayValues = { ...fieldDisplayValues };
            delete newDisplayValues[field.key];
            setFieldDisplayValues(newDisplayValues);
            return;
        }

        // Validation passed - convert value based on field type
        let processedValue = value;
        
        if (field.type === 'comma-list') {
            // Split by comma, filter empty strings
            processedValue = value.split(',').map(s => s.trim()).filter(s => s.length > 0);
        } else if (field.type === 'key-value-textarea') {
            // Parse lines by splitting on ':'
            const lines = value.split('\n').filter(line => line.trim().length > 0);
            const obj = {};
            lines.forEach(line => {
                const colonIndex = line.indexOf(':');
                if (colonIndex > 0) {
                    const key = line.substring(0, colonIndex).trim();
                    const val = line.substring(colonIndex + 1).trim();
                    if (key && val) {
                        obj[key] = val;
                    }
                }
            });
            processedValue = obj;
        } else if (field.type === 'number' || field.type === 'range') {
            processedValue = value === '' ? '' : parseFloat(value);
        }

        // Update settings
        const updatedSettings = { ...moduleSettings };
        setNestedValue(updatedSettings, field.key, processedValue);
        setModuleSettings(updatedSettings);
        
        // Clear display value since we stored the processed value
        const newDisplayValues = { ...fieldDisplayValues };
        delete newDisplayValues[field.key];
        setFieldDisplayValues(newDisplayValues);

        // Trigger model fetch if this is the trigger field
        if (schema.hasModelFetch && schema.modelFetchTriggerField === field.key) {
            fetchModels(updatedSettings);
        }

        // Call save callback
        saveSettingsFunc(updatedSettings);
    };

    // Handle checkbox change
    const handleCheckboxChange = (field, checked) => {
        const updatedSettings = { ...moduleSettings };
        setNestedValue(updatedSettings, field.key, checked);
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
    };

    // Handle select change
    const handleSelectChange = (field, value) => {
        const updatedSettings = { ...moduleSettings };
        setNestedValue(updatedSettings, field.key, value);
        setModuleSettings(updatedSettings);
        
        // Trigger model fetch if this is the trigger field
        if (schema.hasModelFetch && schema.modelFetchTriggerField === field.key) {
            fetchModels(updatedSettings);
        }
        
        saveSettingsFunc(updatedSettings);
    };

    // Handle integration apply
    const handleUseIntegration = (integrationOption, urlIndex) => {
        const apiURL = integrationOption.apiURLs[urlIndex];
        if (apiURL) {
            // Parse the URL to extract config values
            try {
                const url = new URL(apiURL);
                const updatedSettings = { ...moduleSettings };
                
                // Update settings based on integration
                if (schema.fields.some(f => f.key === 'baseurl')) {
                    setNestedValue(updatedSettings, 'baseurl', apiURL);
                }
                if (schema.fields.some(f => f.key === 'apikey')) {
                    setNestedValue(updatedSettings, 'apikey', integrationOption.apiKey || '');
                }
                
                setModuleSettings(updatedSettings);
                saveSettingsFunc(updatedSettings);
            } catch (error) {
                LogDebug('Failed to parse integration URL:', error);
            }
        }
    };

    // Fetch available models
    const fetchModels = async (currentSettings) => {
        if (!schema.hasModelFetch) return;
        
        setModelsLoading(true);
        setAvailableModels([{ id: 'loading', name: 'Loading models...' }]);
        
        try {
            const result = await listProviderModels(moduleType, providerId, currentSettings);
            const models = result.models || result || [];
            
            if (models.length > 0) {
                setAvailableModels(models);
                
                // Auto-select first model if current model not in list
                const currentModel = getNestedValue(currentSettings, schema.modelFetchProviderField);
                if (!currentModel || !models.some(m => m.id === currentModel)) {
                    const updatedSettings = { ...currentSettings };
                    setNestedValue(updatedSettings, schema.modelFetchProviderField, models[0].id);
                    setModuleSettings(updatedSettings);
                    saveSettingsFunc(updatedSettings);
                }
            } else {
                setAvailableModels([{ id: 'none', name: 'No models available' }]);
            }
        } catch (error) {
            LogDebug('Failed to fetch models:', error);
            setAvailableModels([{ id: 'error', name: 'Failed to load models' }]);
        } finally {
            setModelsLoading(false);
        }
    };

    // Handle config validation
    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' });

        try {
            // Check if schema has harmonySpeechMode for dual-mode validation
            if (schema.harmonySpeechMode) {
                if (isHarmonyLinkMode()) {
                    // Harmony Link mode: Use Management API validation
                    const result = await validateProviderConfig(moduleType, providerId, moduleSettings);
                    setValidationState({
                        status: result.valid ? 'success' : 'error',
                        message: result.valid ? 'Configuration is valid!' : result.error || 'Configuration validation failed'
                    });
                } else {
                    // Speech Engine mode: Test by fetching available models
                    const endpoint = getNestedValue(moduleSettings, 'endpoint');
                    if (!endpoint) {
                        setValidationState({
                            status: 'error',
                            message: 'Configuration error: No endpoint configured.'
                        });
                        return;
                    }

                    try {
                        const plugin = new HarmonySpeechEnginePlugin('', endpoint);
                        let response;
                        
                        if (schema.harmonySpeechMode === 'stt') {
                            response = await plugin.showAvailableTranscriptionModels();
                        } else if (schema.harmonySpeechMode === 'vad') {
                            response = await plugin.showAvailableVoiceActivityDetectionModels();
                        } else if (schema.harmonySpeechMode === 'tts') {
                            response = await plugin.showAvailableSpeechModels();
                        }
                        
                        const hasModels = response.data && response.data.length > 0;
                        setValidationState({
                            status: hasModels ? 'success' : 'error',
                            message: hasModels 
                                ? `Configuration is valid! Found ${response.data.length} model(s).`
                                : 'Configuration error: No models available from endpoint.'
                        });
                    } catch (error) {
                        setValidationState({
                            status: 'error',
                            message: 'Validation failed: ' + error.message
                        });
                    }
                }
            } else {
                // Default validation
                const result = await validateProviderConfig(moduleType, providerId, moduleSettings);
                setValidationState({
                    status: result.valid ? 'success' : 'error',
                    message: result.valid ? 'Configuration is valid!' : result.error || 'Configuration validation failed'
                });
            }
        } catch (error) {
            setValidationState({
                status: 'error',
                message: 'Validation failed: ' + error.message
            });
        }
    };

    // Reset and reinitialize when initialSettings changes
    useEffect(() => {
        LogDebug(JSON.stringify(initialSettings));
        
        const currentMergedSettings = mergeConfigWithDefaults(initialSettings, defaults);
        setModuleSettings(currentMergedSettings);
        
        // Reset field display values
        setFieldDisplayValues({});
        
        // Re-trigger model fetch if applicable
        if (schema.hasModelFetch) {
            const triggerField = schema.modelFetchTriggerField;
            const triggerValue = getNestedValue(currentMergedSettings, triggerField);
            if (triggerValue) {
                fetchModels(currentMergedSettings);
            }
        }
    }, [initialSettings, schemaId]);

    // Initial model fetch on mount
    useEffect(() => {
        if (schema.hasModelFetch) {
            const triggerField = schema.modelFetchTriggerField;
            const triggerValue = getNestedValue(moduleSettings, triggerField);
            if (triggerValue) {
                fetchModels(moduleSettings);
            }
        }
    }, []);

    // Render a single field
    const renderField = (field, index) => {
        const currentValue = getNestedValue(moduleSettings, field.key);
        const displayValue = getFieldDisplayValue(field, currentValue);
        const tooltipIndex = index + 1;

        switch (field.type) {
            case 'text':
            case 'password':
            case 'number':
                return (
                    <div key={field.key} className={`flex items-center mb-4 ${getWidthClass(field.width)}`}>
                        <label className={`block text-sm font-medium text-text-secondary ${getLabelWidthClass(field.labelWidth)} px-3`}>
                            {field.label}
                            <SettingsTooltip
                                tooltipIndex={tooltipIndex}
                                tooltipVisible={() => tooltipVisible}
                                setTooltipVisible={setTooltipVisible}
                            >
                                {field.tooltip}
                            </SettingsTooltip>
                        </label>
                        <div className={`${getInputWidthClass(field.width, field.labelWidth)} px-3`}>
                            <input
                                type={field.type}
                                name={field.key}
                                className="input-field w-full p-2 rounded"
                                placeholder={field.placeholder}
                                value={displayValue}
                                onChange={(e) => handleFieldChange(field, e.target.value)}
                                onBlur={(e) => handleFieldBlur(field, e.target.value)}
                                step={field.step}
                            />
                        </div>
                    </div>
                );

            case 'select':
                return (
                    <div key={field.key} className={`flex items-center mb-4 ${getWidthClass(field.width)}`}>
                        <label className={`block text-sm font-medium text-text-secondary ${getLabelWidthClass(field.labelWidth)} px-3`}>
                            {field.label}
                            <SettingsTooltip
                                tooltipIndex={tooltipIndex}
                                tooltipVisible={() => tooltipVisible}
                                setTooltipVisible={setTooltipVisible}
                            >
                                {field.tooltip}
                            </SettingsTooltip>
                        </label>
                        <div className={`${getInputWidthClass(field.width, field.labelWidth)} px-3`}>
                            <select
                                name={field.key}
                                className="input-field w-full p-2 rounded custom-scrollbar"
                                value={currentValue || ''}
                                onChange={(e) => handleSelectChange(field, e.target.value)}
                            >
                                {field.options.map(opt => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.name || opt.id}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                );

            case 'model-select':
                return (
                    <div key={field.key} className={`flex items-center mb-4 ${getWidthClass(field.width)}`}>
                        <label className={`block text-sm font-medium text-text-secondary ${getLabelWidthClass(field.labelWidth)} px-3`}>
                            {field.label}
                            <SettingsTooltip
                                tooltipIndex={tooltipIndex}
                                tooltipVisible={() => tooltipVisible}
                                setTooltipVisible={setTooltipVisible}
                            >
                                {field.tooltip}
                            </SettingsTooltip>
                        </label>
                        <div className={`${getInputWidthClass(field.width, field.labelWidth)} px-3 relative`}>
                            <select
                                name={field.key}
                                className="input-field w-full p-2 rounded custom-scrollbar"
                                value={currentValue || ''}
                                onChange={(e) => handleSelectChange(field, e.target.value)}
                            >
                                {availableModels.map(modelInfo => (
                                    <option key={modelInfo.id} value={modelInfo.id}>
                                        {modelInfo.name || modelInfo.id}
                                    </option>
                                ))}
                            </select>
                            {modelsLoading && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <svg className="animate-spin h-4 w-4 text-accent-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'checkbox':
                return (
                    <div key={field.key} className={`flex items-center mb-4 ${getWidthClass(field.width)}`}>
                        <label className={`block text-sm font-medium text-text-secondary ${getLabelWidthClass(field.labelWidth)} px-3`}>
                            {field.label}
                            <SettingsTooltip
                                tooltipIndex={tooltipIndex}
                                tooltipVisible={() => tooltipVisible}
                                setTooltipVisible={setTooltipVisible}
                            >
                                {field.tooltip}
                            </SettingsTooltip>
                        </label>
                        <div className={`${getInputWidthClass(field.width, field.labelWidth)} px-3`}>
                            <input
                                type="checkbox"
                                name={field.key}
                                className="h-4 w-4 rounded text-accent-primary focus:ring-accent-primary focus:ring-offset-0"
                                checked={!!currentValue}
                                onChange={(e) => handleCheckboxChange(field, e.target.checked)}
                            />
                        </div>
                    </div>
                );

            case 'comma-list':
                return (
                    <div key={field.key} className={`flex items-center mb-4 ${getWidthClass(field.width)}`}>
                        <label className={`block text-sm font-medium text-text-secondary ${getLabelWidthClass(field.labelWidth)} px-3`}>
                            {field.label}
                            <SettingsTooltip
                                tooltipIndex={tooltipIndex}
                                tooltipVisible={() => tooltipVisible}
                                setTooltipVisible={setTooltipVisible}
                            >
                                {field.tooltip}
                            </SettingsTooltip>
                        </label>
                        <div className={`${getInputWidthClass(field.width, field.labelWidth)} px-3`}>
                            <input
                                type="text"
                                name={field.key}
                                className="input-field w-full p-2 rounded"
                                placeholder={field.placeholder || 'Comma-separated values'}
                                value={displayValue}
                                onChange={(e) => handleFieldChange(field, e.target.value)}
                                onBlur={(e) => handleFieldBlur(field, e.target.value)}
                            />
                        </div>
                    </div>
                );

            case 'key-value-textarea':
                return (
                    <div key={field.key} className={`flex items-center mb-4 ${getWidthClass(field.width)}`}>
                        <label className={`block text-sm font-medium text-text-secondary ${getLabelWidthClass(field.labelWidth)} px-3`}>
                            {field.label}
                            <SettingsTooltip
                                tooltipIndex={tooltipIndex}
                                tooltipVisible={() => tooltipVisible}
                                setTooltipVisible={setTooltipVisible}
                            >
                                {field.tooltip}
                            </SettingsTooltip>
                        </label>
                        <div className={`${getInputWidthClass(field.width, field.labelWidth)} px-3`}>
                            <textarea
                                name={field.key}
                                className="input-field w-full p-2 rounded custom-scrollbar"
                                placeholder={field.placeholder || 'key: value\nkey2: value2'}
                                value={displayValue}
                                onChange={(e) => handleFieldChange(field, e.target.value)}
                                onBlur={(e) => handleFieldBlur(field, e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                );

            case 'resolution-input':
                // Handle both object format ({width, height}) and separate field format (resolutionwidth, resolutionheight)
                let widthValue, heightValue;
                if (typeof currentValue === 'object' && currentValue !== null) {
                    // Object format: { width: 512, height: 512 }
                    widthValue = currentValue.width;
                    heightValue = currentValue.height;
                } else {
                    // Separate fields format: resolutionwidth and resolutionheight
                    widthValue = getNestedValue(moduleSettings, field.key);
                    heightValue = getNestedValue(moduleSettings, field.key === 'resolutionwidth' ? 'resolutionheight' : 'resolutionheight');
                }
                const currentWidth = widthValue || 512;
                const currentHeight = heightValue || 512;
                
                const handleResolutionChange = (dimension, value) => {
                    const updatedSettings = { ...moduleSettings };
                    if (field.key === 'resolutionwidth') {
                        // Store as separate fields for Vision module compatibility
                        setNestedValue(updatedSettings, 'resolutionwidth', parseInt(value) || 0);
                    } else if (field.key.includes('.')) {
                        // Nested path format - store as object
                        const parentObj = getNestedValue(updatedSettings, field.key.split('.')[0]) || {};
                        setNestedValue(updatedSettings, field.key, { ...parentObj, [dimension]: parseInt(value) || 0 });
                    } else {
                        setNestedValue(updatedSettings, field.key, { ...updatedSettings[field.key], [dimension]: parseInt(value) || 0 });
                    }
                    setModuleSettings(updatedSettings);
                };
                
                const handleResolutionBlur = () => {
                    saveSettingsFunc(moduleSettings);
                };
                
                const setSquareResolution = (size) => {
                    const updatedSettings = { ...moduleSettings };
                    if (field.key === 'resolutionwidth') {
                        setNestedValue(updatedSettings, 'resolutionwidth', size);
                        setNestedValue(updatedSettings, 'resolutionheight', size);
                    } else if (field.key.includes('.')) {
                        const pathParts = field.key.split('.');
                        const parent = getNestedValue(updatedSettings, pathParts[0]) || {};
                        setNestedValue(updatedSettings, field.key, { width: size, height: size });
                    }
                    setModuleSettings(updatedSettings);
                    saveSettingsFunc(updatedSettings);
                };
                
                return (
                    <div key={field.key} className={`flex items-center mb-4 ${getWidthClass(field.width)}`}>
                        <label className={`block text-sm font-medium text-text-secondary ${getLabelWidthClass(field.labelWidth)} px-3`}>
                            {field.label}
                            <SettingsTooltip
                                tooltipIndex={tooltipIndex}
                                tooltipVisible={() => tooltipVisible}
                                setTooltipVisible={setTooltipVisible}
                            >
                                {field.tooltip}
                            </SettingsTooltip>
                        </label>
                        <div className={`${getInputWidthClass(field.width, field.labelWidth)} px-3 flex items-center gap-2`}>
                            <input
                                type="number"
                                name={`${field.key}_width`}
                                className="input-field w-20 p-2 rounded"
                                placeholder="Width"
                                value={currentWidth || ''}
                                onChange={(e) => handleResolutionChange('width', e.target.value)}
                                onBlur={handleResolutionBlur}
                                min={64}
                                max={4096}
                            />
                            <span className="text-text-secondary">×</span>
                            <input
                                type="number"
                                name={`${field.key}_height`}
                                className="input-field w-20 p-2 rounded"
                                placeholder="Height"
                                value={currentHeight || ''}
                                onChange={(e) => handleResolutionChange('height', e.target.value)}
                                onBlur={handleResolutionBlur}
                                min={64}
                                max={4096}
                            />
                            <div className="flex gap-1 ml-2">
                                {[640, 1280, 1920].map(size => (
                                    <button
                                        key={size}
                                        type="button"
                                        className="text-xs px-2 py-1 rounded bg-background-tertiary hover:bg-background-hover text-text-secondary"
                                        onClick={() => setSquareResolution(size)}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            case 'voice-config-manager':
                return (
                    <div key={field.key} className={`flex items-center mb-4 ${getWidthClass(field.width)}`}>
                        <label className={`block text-sm font-medium text-text-secondary ${getLabelWidthClass(field.labelWidth)} px-3`}>
                            {field.label}
                            <SettingsTooltip
                                tooltipIndex={tooltipIndex}
                                tooltipVisible={() => tooltipVisible}
                                setTooltipVisible={setTooltipVisible}
                            >
                                {field.tooltip}
                            </SettingsTooltip>
                        </label>
                        <div className={`${getInputWidthClass(field.width, field.labelWidth)} px-3`}>
                            <VoiceConfigManager
                                endpoint={getNestedValue(moduleSettings, 'endpoint')}
                                voiceConfigFile={getNestedValue(moduleSettings, 'voiceconfigfile')}
                                onSettingsChange={(updated) => {
                                    const newSettings = { ...moduleSettings, ...updated };
                                    setModuleSettings(newSettings);
                                    saveSettingsFunc(newSettings);
                                }}
                                initialSettings={moduleSettings}
                            />
                        </div>
                    </div>
                );

            case 'harmonyspeech-model-select':
                const endpoint = getNestedValue(moduleSettings, 'endpoint');
                const mode = schema.harmonySpeechMode || 'tts';
                return (
                    <div key={field.key} className={`flex items-center mb-4 ${getWidthClass(field.width)}`}>
                        <label className={`block text-sm font-medium text-text-secondary ${getLabelWidthClass(field.labelWidth)} px-3`}>
                            {field.label}
                            <SettingsTooltip
                                tooltipIndex={tooltipIndex}
                                tooltipVisible={() => tooltipVisible}
                                setTooltipVisible={setTooltipVisible}
                            >
                                {field.tooltip}
                            </SettingsTooltip>
                        </label>
                        <div className={`${getInputWidthClass(field.width, field.labelWidth)} px-3`}>
                            <HarmonySpeechModelSelect
                                endpoint={endpoint}
                                mode={mode}
                                value={currentValue}
                                onChange={(value) => handleSelectChange(field, value)}
                            />
                        </div>
                    </div>
                );

            case 'workflow-profile-editor':
                return (
                    <div key={field.key} className={`flex flex-col w-full ${getWidthClass(field.width)}`}>
                        <WorkflowProfileEditor
                            baseURL={getNestedValue(moduleSettings, 'baseurl')}
                            apiKey={getNestedValue(moduleSettings, 'apikey')}
                            workflowProfiles={getNestedValue(moduleSettings, 'workflowprofiles') || { default: { ...EMPTY_PROFILE } }}
                            onProfilesChange={(updatedProfiles) => {
                                const newSettings = { ...moduleSettings, workflowprofiles: updatedProfiles };
                                setModuleSettings(newSettings);
                                saveSettingsFunc(newSettings);
                            }}
                            onConnectionChange={({ baseurl, apikey }) => {
                                const newSettings = { ...moduleSettings, baseurl, apikey };
                                setModuleSettings(newSettings);
                                saveSettingsFunc(newSettings);
                            }}
                        />
                    </div>
                );

            default:
                return (
                    <div key={field.key} className="p-2 text-error">
                        Unknown field type: {field.type}
                    </div>
                );
        }
    };

    return (
        <>
            <div className="flex flex-wrap w-full pt-2">
                {schema.hasVerification !== false && (
                    <ConfigVerificationSection
                        onValidate={handleValidateConfig}
                        validationState={validationState}
                    />
                )}
                
                {/* Integration Display - conditional based on mode */}
                {shouldShowIntegration && (
                    <IntegrationDisplay
                        moduleName={moduleType}
                        providerName={providerId}
                        useIntegration={handleUseIntegration}
                    />
                )}
                
                <div className="flex flex-wrap items-center -px-10 w-full">
                    {schema.fields.map((field, idx) => renderField(field, idx))}
                </div>
            </div>
            
            <ErrorDialog
                isOpen={isModalVisible}
                title="Invalid Input"
                message={modalMessage}
                onClose={() => setIsModalVisible(false)}
                type="error"
            />
        </>
    );
};

export default ModularConfigEditor;