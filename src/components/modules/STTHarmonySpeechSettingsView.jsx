import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug, LogError} from "../../utils/logger.js";
import {HarmonySpeechEnginePlugin} from "@harmony-ai/harmonyspeech";
import {getConfig, validateProviderConfig} from "../../services/management/configService.js";
import IntegrationDisplay from "../integrations/IntegrationDisplay.jsx";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import { MODULES, PROVIDERS } from '../../constants/modules.js';
import { isHarmonyLinkMode } from '../../config/appMode.js';
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";
import ErrorDialog from "../modals/ErrorDialog.jsx";


const knownModelNames = {
    "faster-whisper-large-v3-turbo": "FasterWhisper Large v3 Turbo",
    "faster-whisper-large-v3": "FasterWhisper Large v3",
    "faster-whisper-medium": "FasterWhisper Medium",
    "faster-whisper-tiny": "FasterWhisper Tiny",
}

const STTHarmonySpeechSettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Merge initial settings with defaults
    const defaults = MODULE_DEFAULTS[MODULES.STT][PROVIDERS.HARMONYSPEECH];
    const mergedSettings = mergeConfigWithDefaults(initialSettings, defaults);

    const [tooltipVisible, setTooltipVisible] = useState(0);

    // Modal dialog values
    const [modalMessage, setModalMessage] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);

    // Show Modal Functions
    const showModal = (message) => {
        setModalMessage(message);
        setIsModalVisible(true);
    };

    // Base Settings reference - now managed by store
    const [moduleSettings, setModuleSettings] = useState(mergedSettings);

    // Validation State
    const [validationState, setValidationState] = useState({ status: 'idle', message: '' });

    // Harmonyspeech Plugin
    const [harmonySpeechPlugin, setHarmonySpeechPlugin] = useState(null);

    // model, language and voice options dynamically fetched from HSE
    const [modelOptions, setModelOptions] = useState([
        {name: "Error: no models available", value: null}
    ]);

    // Fields
    const [endpoint, setEndpoint] = useState(mergedSettings.endpoint);
    const [model, setModel] = useState(mergedSettings.model);

    // Validation Functions
    const validateEndpointAndUpdate = (value) => {
        const urlRegex = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?([a-z0-9]+([\-.]{1}[a-z0-9]+)*\.[a-z]{2,5}|localhost|\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3})(:[0-9]{1,5})?(\/.*)?$/;
        if ((moduleSettings.endpoint.length > 0 && value.length === 0) || (value.length > 0 && urlRegex.test(value) === false)) {
            showModal("Endpoint must be a valid URL.");
            setEndpoint(moduleSettings.endpoint);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, endpoint: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);

        // Refresh Speech Tooling
        if (harmonySpeechPlugin) {
            harmonySpeechPlugin.setBaseURL(value);
            refreshAvailableSTToolchains(harmonySpeechPlugin);
        }
        return true;
    };

    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' });
        
        try {
            if (isHarmonyLinkMode()) {
                // Harmony Link mode: Use Management API validation
                const currentConfig = {
                    endpoint: moduleSettings.endpoint,
                    model: moduleSettings.model,
                };
                const result = await validateProviderConfig(MODULES.STT, PROVIDERS.HARMONYSPEECH, currentConfig);
                setValidationState({
                    status: result.valid ? 'success' : 'error',
                    message: result.valid ? 'Configuration is valid!' : result.error || 'Configuration validation failed'
                });
            } else {
                // Speech Engine mode: Test by fetching available models
                if (!harmonySpeechPlugin) {
                    throw new Error('Speech plugin not initialized');
                }
                const response = await harmonySpeechPlugin.showAvailableTranscriptionModels();
                const hasModels = response.data && response.data.length > 0;
                setValidationState({
                    status: hasModels ? 'success' : 'error',
                    message: hasModels 
                        ? `Configuration is valid! Found ${response.data.length} model(s).`
                        : 'Configuration error: No models available from endpoint.'
                });
            }
        } catch (error) {
            setValidationState({ 
                status: 'error', 
                message: 'Validation failed: ' + error.message 
            });
        }
    };

    // Utility Functions
    const setupHarmonySpeechTooling = (currentModuleSettings) => {
        try {
            if (isHarmonyLinkMode()) {
                // Harmony Link mode: Get API key from config
                getConfig().then((appConfig) => {
                    const plugin = new HarmonySpeechEnginePlugin(appConfig.general.userapikey, currentModuleSettings.endpoint);
                    setHarmonySpeechPlugin(plugin);

                    // Fetch available toolchains from Endpoint (if available)
                    refreshAvailableSTToolchains(plugin);
                });
            } else {
                // Speech Engine mode: Use empty API key
                const plugin = new HarmonySpeechEnginePlugin('', currentModuleSettings.endpoint);
                setHarmonySpeechPlugin(plugin);

                // Fetch available toolchains from Endpoint (if available)
                refreshAvailableSTToolchains(plugin);
            }

        } catch (error) {
            LogError("Unable to initialize Harmony Speech plugin");
            LogError(error);
            showModal("Error initializing speech plugin");
        }
    }

    const refreshAvailableSTToolchains = (harmonySpeechClient) => {
        if (!harmonySpeechClient) {
            LogError("Harmony Speech Client not initialized");
            return;
        }
        harmonySpeechClient.showAvailableTranscriptionModels().then((result) => {
            //LogDebug(JSON.stringify(result.data));

            // Search for Toolchains and add them to the list
            const newModelOptions = [];
            result.data.forEach((model) => {
                if (model.object === "model") {
                    if (model.id in knownModelNames) {
                        newModelOptions.push({name: knownModelNames[model.id], value: model.id});
                    } else {
                        newModelOptions.push({name: model.id, value: model.id});
                    }
                }
            });
            if (newModelOptions.length === 0) {
                newModelOptions.push({name: "Error: no models available", value: null});
            }
            setModelOptions(newModelOptions);

            // Refresh UI
            if (!newModelOptions.some((modelOption) => modelOption.value === model)) {
                handleModelSelectionChange(newModelOptions[0].value);
            }
        });
    }

    const setInitialValues = () => {
        const currentMergedSettings = mergeConfigWithDefaults(initialSettings, defaults);
        // Reset Entity map
        setModuleSettings(currentMergedSettings);

        // Update individual fields
        setEndpoint(currentMergedSettings.endpoint);
        setModel(currentMergedSettings.model);

        // Setup Harmony Speech
        setupHarmonySpeechTooling(currentMergedSettings);
    };

    const useIntegration = (integration, urlIndex = 0) => {
        const selectedURL = integration.apiURLs[urlIndex];
        setEndpoint(selectedURL);
        const updatedSettings = { ...moduleSettings, endpoint: selectedURL };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
    };

    const handleModelSelectionChange = (selectedModelId) => {
        setModel(selectedModelId);
        const updatedSettings = { ...moduleSettings, model: selectedModelId };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
        return true;
    }

    useEffect(() => {
        LogDebug(JSON.stringify(initialSettings));
        setInitialValues();
    }, [initialSettings]);

    return (
        <>
            <div className="flex flex-wrap w-full pt-2">
                <ConfigVerificationSection
                    onValidate={handleValidateConfig}
                    validationState={validationState}
                />
                {isHarmonyLinkMode() && (
                    <IntegrationDisplay moduleName={MODULES.STT} providerName={PROVIDERS.HARMONYSPEECH} useIntegration={useIntegration} />
                )}
                <div className="flex flex-wrap items-center -px-10 w-full">
                    <div className="flex items-center mb-6 w-full">
                        <label className="block text-sm font-medium text-text-secondary w-1/6 px-3">
                            Endpoint
                            <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                The endpoint URL for the Harmony Speech-To-Text Backend.
                            </SettingsTooltip>
                        </label>
                        <div className="w-5/6 px-3">
                            <input type="text" name="endpoint"
                                   className="input-field mt-1 block w-full"
                                   placeholder="Backend Service Endpoint" value={endpoint}
                                   onChange={(e) => setEndpoint(e.target.value)}
                                   onBlur={(e) => validateEndpointAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                </div>
                <div className="flex items-center mb-6 w-full">
                    <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                        Transcription Model
                        <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                         setTooltipVisible={setTooltipVisible}>
                            Select the AI model to use for speech transcription. <br/>
                            This model should be selected with a focus on quality over performance, since
                            it will be influencing how well the AI will understand you or other speakers.
                        </SettingsTooltip>
                    </label>
                    <select
                        value={model}
                        onChange={(e) => handleModelSelectionChange(e.target.value)}
                        className="input-field block w-1/2 mx-3"
                    >
                        {modelOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.name}
                            </option>
                        ))}
                    </select>
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
}

export default STTHarmonySpeechSettingsView;
