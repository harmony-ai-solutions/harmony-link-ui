import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug, LogError} from "../../utils/logger.js";
import {HarmonySpeechEnginePlugin} from "@harmony-ai/harmonyspeech";
import {getConfig, validateProviderConfig} from "../../services/management/configService.js";
import IntegrationDisplay from "../integrations/IntegrationDisplay.jsx";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import { MODULES, PROVIDERS } from '../../constants/modules.js';
import { useSelectedEntity } from '../../hooks/useEntitySettings.js';


const knownModelNames = {
    "faster-whisper-large-v3-turbo": "FasterWhisper Large v3 Turbo",
    "faster-whisper-large-v3": "FasterWhisper Large v3",
    "faster-whisper-medium": "FasterWhisper Medium",
    "faster-whisper-tiny": "FasterWhisper Tiny",
}

const STTHarmonySpeechSettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Use store for state management
    const { selectedEntityId } = useSelectedEntity();
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
    const [moduleSettings, setModuleSettings] = useState(initialSettings);

    // Integration State
    const [availableIntegrations, setAvailableIntegrations] = useState([]);

    // Validation State
    const [validationState, setValidationState] = useState({ status: 'idle', message: '' });

    // Harmonyspeech Plugin
    const [harmonySpeechPlugin, setHarmonySpeechPlugin] = useState(null);

    // model, language and voice options dynamically fetched from HSE
    const [modelOptions, setModelOptions] = useState([
        {name: "Error: no models available", value: null}
    ]);

    // Fields
    const [endpoint, setEndpoint] = useState(initialSettings.endpoint);
    const [model, setModel] = useState(initialSettings.model);

    // Validation Functions
    const validateEndpointAndUpdate = (value) => {
        const urlRegex = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?([a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}|localhost|\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3})(:[0-9]{1,5})?(\/.*)?$/;
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
        
        const currentConfig = {
            endpoint: moduleSettings.endpoint,
            model: moduleSettings.model,
        };
        
        try {
            const result = await validateProviderConfig(MODULES.STT, PROVIDERS.HARMONYSPEECH, currentConfig);
            setValidationState({
                status: result.valid ? 'success' : 'error',
                message: result.valid ? 'Configuration is valid!' : result.error || 'Configuration validation failed'
            });
        } catch (error) {
            setValidationState({ 
                status: 'error', 
                message: 'Validation failed: ' + error.message 
            });
        }
    };

    // Utility Functions
    const setupHarmonySpeechTooling = () => {
        try {
            // Get Harmony API Key from Base config
            getConfig().then((appConfig) => {
                const plugin = new HarmonySpeechEnginePlugin(appConfig.general.userapikey, moduleSettings.endpoint);
                setHarmonySpeechPlugin(plugin);

                // Fetch available toolchains from Endpoint (if available)
                refreshAvailableSTToolchains(plugin);
            });

        } catch (error) {
            LogError("Unable load application config");
            LogError(error);
            showModal("Error loading application config");
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
        // Reset Entity map
        setModuleSettings(initialSettings);

        // Setup Harmony Speech
        setupHarmonySpeechTooling();
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
                <IntegrationDisplay moduleName={MODULES.STT} providerName={PROVIDERS.HARMONYSPEECH} useIntegration={useIntegration} />
                <div className="flex flex-wrap items-center -px-10 w-full">
                    <div className="flex items-center mb-6 w-full">
                        <label className="block text-sm font-medium text-gray-300 w-1/6 px-3">
                            Endpoint
                            <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                The endpoint URL for the Harmony Speech-To-Text Backend.
                            </SettingsTooltip>
                        </label>
                        <div className="w-5/6 px-3">
                            <input type="text" name="endpoint"
                                   className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                   placeholder="Backend Service Endpoint" value={endpoint}
                                   onChange={(e) => setEndpoint(e.target.value)}
                                   onBlur={(e) => validateEndpointAndUpdate(e.target.value)}/>
                        </div>
                    </div>
                </div>
                <div className="flex items-center mb-6 w-full">
                    <label className="block text-sm font-medium text-gray-300 w-1/2 px-3">
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
                        className="block w-1/2 bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100 mx-3"
                    >
                        {modelOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {isModalVisible && (
                <div className="fixed inset-0 bg-gray-600/50">
                    <div
                        className="relative top-10 mx-auto p-5 border border-neutral-800 w-96 shadow-lg rounded-md bg-neutral-900">
                        <div className="mt-3 text-center">
                            <div
                                className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-200">
                                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24"
                                     stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                            </div>
                            <h3 className="text-lg leading-6 font-medium text-orange-500 mt-4">Invalid Input</h3>
                            <div className="mt-2 px-7 py-3">
                                <p className="text-sm text-gray-200">{modalMessage}</p>
                            </div>
                            <div className="items-center px-4 py-3">
                                <button onClick={() => setIsModalVisible(false)}
                                        className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default STTHarmonySpeechSettingsView;
