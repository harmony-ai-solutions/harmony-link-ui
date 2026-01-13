import {useEffect, useState} from "react";
import SettingsTooltip from "../settings/SettingsTooltip.jsx";
import {LogDebug, LogError} from "../../utils/logger.js";
import {HarmonySpeechEnginePlugin} from "@harmony-ai/harmonyspeech";
import {getConfig, validateProviderConfig} from "../../services/management/configService.js";
import {listVoiceConfigs, loadVoiceConfig, saveVoiceConfig, deleteVoiceConfig, renameVoiceConfig} from "../../services/storage/storageService.js";
import HarmonyAudioPlayer from "../widgets/HarmonyAudioPlayer.jsx";
import Heatmap from "../widgets/Heatmap.jsx";
import IntegrationDisplay from "../integrations/IntegrationDisplay.jsx";
import ConfigVerificationSection from "../widgets/ConfigVerificationSection.jsx";
import { MODULES, PROVIDERS } from '../../constants/modules.js';
import { isHarmonyLinkMode } from "../../config/appMode.js";
import { mergeConfigWithDefaults } from "../../utils/configUtils.js";
import { MODULE_DEFAULTS } from "../../constants/moduleDefaults.js";
import ErrorDialog from "../modals/ErrorDialog.jsx";
import ConfirmDialog from "../modals/ConfirmDialog.jsx";
import InputDialog from "../modals/InputDialog.jsx";

const knownModelNames = {
    "harmonyspeech": "HarmonySpeech V1",
    "openvoice_v1": "OpenVoice V1",
    "openvoice_v2": "OpenVoice V2",
}

// Embedding Status values
const embeddingStatusNone = "No embedding loaded.";
const embeddingStatusInProgress = "Embedding in progress...";
const embeddingStatusDone = "Embedding updated.";
const embeddingStatusFailed = "Embedding failed.";


const TTSHarmonySpeechSettingsView = ({initialSettings, saveSettingsFunc}) => {
    // Merge initial settings with defaults
    const defaults = MODULE_DEFAULTS[MODULES.TTS][PROVIDERS.HARMONYSPEECH];
    const mergedSettings = mergeConfigWithDefaults(initialSettings, defaults);

    const [tooltipVisible, setTooltipVisible] = useState(0);

    // Modal dialog values
    const [modalTitle, setModalTitle] = useState('Invalid Input');
    const [modalMessage, setModalMessage] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);

    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [confirmModalTitle, setConfirmModalTitle] = useState('Confirmation required');
    const [confirmModalMessage, setConfirmModalMessage] = useState('');
    const [confirmModalYes, setConfirmModalYes] = useState((confirmValue)=>{});
    const [confirmModalNo, setConfirmModalNo] = useState(()=>{});
    const [confirmModalHasInput, setConfirmModalHasInput] = useState(false);
    const [confirmModalInput, setConfirmModalInput] = useState('');

    // Show Modal Functions
    const showModal = (message, title='Invalid Input') => {
        setModalTitle(title);
        setModalMessage(message);
        setIsModalVisible(true);
    };

    const showConfirmModal = (message, hasInput=false, title='Confirmation required') => {
        setConfirmModalTitle(title);
        setConfirmModalMessage(message);
        setConfirmModalHasInput(hasInput);
        setConfirmModalVisible(true);
    };

    // Base Settings reference
    const [moduleSettings, setModuleSettings] = useState(mergedSettings);

    // Validation State
    const [validationState, setValidationState] = useState({ status: 'idle', message: '' });

    // Harmonyspeech Plugin
    const [harmonySpeechPlugin, setHarmonySpeechPlugin] = useState(null);

    // model, language and voice options dynamically fetched from HSE
    const [modelOptions, setModelOptions] = useState([
        {name: "Error: no models available", value: null}
    ]);
    const [modelLanguageOptions, setModelLanguageOptions] = useState({});
    const [modelVoiceOptions, setModelVoiceOptions] = useState({});

    // TODO: Fetch operation modes dynamically from HSE
    const modelOperationModes = {
        'harmonyspeech': [
            {name: 'Voice Cloning', value: 'voice_cloning'},
        ],
        'openvoice_v1': [
            {name: 'Single-Speaker TTS', value: 'single_speaker_tts'},
            {name: 'Voice Cloning', value: 'voice_cloning'},
        ],
        'openvoice_v2': [
            {name: 'Single-Speaker TTS', value: 'single_speaker_tts'},
            {name: 'Voice Cloning', value: 'voice_cloning'},
        ]
    }

    // Internal State handling
    const [voiceConfigs, setVoiceConfigs] = useState([]);
    const [currentVoiceConfig, setCurrentVoiceConfig] = useState({
        // Basic Settings
        model: "harmonyspeech",
        operation_mode: "voice_cloning",
        language: "",
        voice: "",
        style: 0,
        speed: 1.00,
        pitch: 1.00,
        energy: 1.00,
        seed: 42,
        // Embedding Data
        // source_embedding: "",
        target_embedding: ""
    });

    // Setting Fields
    const [endpoint, setEndpoint] = useState(mergedSettings.endpoint);
    const [voiceConfigFile, setVoiceConfigFile] = useState(mergedSettings.voiceconfigfile);

    // Voice Embedding States
    const [embeddingFile, setEmbeddingFile] = useState(null);
    const [embeddingFileAudio, setEmbeddingFileAudio] = useState(null);
    const [embeddingStatus, setEmbeddingStatus] = useState(embeddingStatusNone);

    // Testing Area States
    const [generationText, setGenerationText] = useState("This is a sample text");
    const [generatedAudio, setGeneratedAudio] = useState(null);

    // Validation Functions
    const validateEndpointAndUpdate = (value) => {
        const urlRegex = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?([a-z0-9]+([\-.]{1}[a-z0-9]+)*\.[a-z]{2,5}|localhost|\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3})(:[0-9]{1,5})?(\/.*)?$/;
        if ((moduleSettings.endpoint.length > 0 && value.length === 0) || (value.length > 0 && urlRegex.test(value) === false)) {
            showModal("Endpoint URL must be a valid URL.");
            setEndpoint(moduleSettings.endpoint);
            return false;
        }
        // Update if validation successful
        const updatedSettings = { ...moduleSettings, endpoint: value };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);

        // Refresh Speech Tooling
        harmonySpeechPlugin.setBaseURL(value);
        refreshAvailableTTSToolchains(harmonySpeechPlugin);
        return true;
    };

    const handleValidateConfig = async () => {
        setValidationState({ status: 'loading', message: 'Validating configuration...' });
        
        try {
            if (isHarmonyLinkMode()) {
                // Harmony Link mode: Use Management API validation
                const currentConfig = {
                    endpoint: moduleSettings.endpoint,
                    voiceconfigfile: moduleSettings.voiceconfigfile
                };
                const result = await validateProviderConfig(MODULES.TTS, PROVIDERS.HARMONYSPEECH, currentConfig);
                setValidationState({
                    status: result.valid ? 'success' : 'error',
                    message: result.valid ? 'Configuration is valid!' : result.error || 'Configuration validation failed'
                });
            } else {
                // Speech Engine mode: Test by fetching available models
                if (!harmonySpeechPlugin) {
                    throw new Error('Speech plugin not initialized');
                }
                const response = await harmonySpeechPlugin.showAvailableSpeechModels();
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
                    refreshAvailableTTSToolchains(plugin);
                });
            } else {
                // Speech Engine mode: Use empty API key
                const plugin = new HarmonySpeechEnginePlugin('', currentModuleSettings.endpoint);
                setHarmonySpeechPlugin(plugin);

                // Fetch available toolchains from Endpoint (if available)
                refreshAvailableTTSToolchains(plugin);
            }

        } catch (error) {
            LogError("Unable to initialize Harmony Speech plugin");
            LogError(error);
            showModal("Error initializing speech plugin", "An Error occurred");
        }
    }

    const refreshVoiceConfigs = () => {
        try {
            listVoiceConfigs().then((result) => {
                setVoiceConfigs(result);
                if (result.length > 0) {
                    changeVoiceConfigAndUpdate(result[0]);
                }
            });
        } catch (error) {
            LogError("Unable to load available voice configurations");
            LogError(error);
            showModal("Error loading voice config", "An Error occurred");
        }
    }

    const refreshAvailableTTSToolchains = (harmonySpeechClient) => {
        if (!harmonySpeechClient) {
            LogError("Harmony Speech Client not initialized");
            return;
        }
        harmonySpeechClient.showAvailableSpeechModels().then((result) => {
            //LogDebug(JSON.stringify(result.data));

            // Search for Toolchains and add them to the list
            const newModelOptions = [];
            const newModelLanguageOptions = {};
            const newModelVoiceOptions = {};
            result.data.forEach((model) => {
                if (model.object === "toolchain") {
                    if (model.id in knownModelNames) {
                        newModelOptions.push({name: knownModelNames[model.id], value: model.id});
                    } else {
                        newModelOptions.push({name: model.id, value: model.id});
                    }

                    // Fetch language options
                    // If values are not set for a combination, UI needs to show default value (see UI code further below)
                    if (model.languages.length > 0) {
                        if (!newModelLanguageOptions[model.id]) {
                            newModelLanguageOptions[model.id] = []
                        }
                        model.languages.forEach((langOption) => {
                            newModelLanguageOptions[model.id].push({name: langOption.language, value: langOption.language})
                            // Fetch voice option for language
                            if (langOption.voices.length > 0) {
                                if (!newModelVoiceOptions[model.id]) {
                                    newModelVoiceOptions[model.id] = {}
                                }
                                langOption.voices.forEach((voiceOption) => {
                                    if (!newModelVoiceOptions[model.id][langOption.language]) {
                                        newModelVoiceOptions[model.id][langOption.language] = []
                                    }
                                    newModelVoiceOptions[model.id][langOption.language].push({name: voiceOption.voice, value: voiceOption.voice})
                                });
                            }
                        });
                    }
                }
            });
            if (newModelOptions.length === 0) {
                newModelOptions.push({name: "Error: no models available", value: null});
            }
            setModelOptions(newModelOptions);
            setModelLanguageOptions(newModelLanguageOptions);
            setModelVoiceOptions(newModelVoiceOptions);

            // Refresh UI
            if(!newModelOptions.some((modelOption) => modelOption.value === currentVoiceConfig.model)) {
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
        setVoiceConfigFile(currentMergedSettings.voiceconfigfile);

        // Setup Harmony Speech
        setupHarmonySpeechTooling(currentMergedSettings);

        // Update Voice Configs
        refreshVoiceConfigs();
    };

    const useIntegration = (integration, urlIndex = 0) => {
        const selectedURL = integration.apiURLs[urlIndex];
        setEndpoint(selectedURL);
        const updatedSettings = { ...moduleSettings, endpoint: selectedURL };
        setModuleSettings(updatedSettings);
        saveSettingsFunc(updatedSettings);
    };

    useEffect(() => {
        LogDebug(JSON.stringify(initialSettings));
        setInitialValues();
    }, [initialSettings]);

    // Config Management Handlers
    const changeVoiceConfigAndUpdate = async (selectedConfig) => {
        if (selectedConfig === "") {
            return false;
        }

        try {
            // Parse Data and Update current config data
            const configData = await loadVoiceConfig(selectedConfig);
            const parsedConfig = JSON.parse(configData);
            setCurrentVoiceConfig(parsedConfig);
            // Update Harmony Link Settings
            setVoiceConfigFile(selectedConfig);
            const updatedSettings = { ...moduleSettings, voiceconfigfile: selectedConfig };
            setModuleSettings(updatedSettings);
            saveSettingsFunc(updatedSettings);
            return true;
        } catch (error) {
            LogError("Failed to load voice configuration.");
            LogError(error);
            showModal("Failed to load the selected voice configuration.", "An Error occurred");
            return false;
        }
    };

    const saveVoiceConfiguration = (configName) => {
        if (!configName) {
            showModal("No config name provided");
            return false;
        }

        try {
            const configString = JSON.stringify(currentVoiceConfig, null, 2);
            saveVoiceConfig(configName, configString)
                .then(() => {
                    refreshVoiceConfigs();
                    showModal("Configuration saved successfully.", "Success");
                    setConfirmModalVisible(false);
                })
                .catch((error) => {
                    LogError("Failed to save voice configuration.");
                    LogError(error);
                    showModal("Failed to save the voice configuration.", "An Error occurred");
                });
            return true;
        } catch (error) {
            LogError("Error stringifying the voice configuration.");
            LogError(error);
            showModal("Failed to save the voice configuration.", "An Error occurred");
            return false;
        }
    }

    const cancelSaveVoiceConfiguration = () => {
        setConfirmModalInput('');
        setConfirmModalVisible(false);
    }

    const handleSaveConfig = () => {
        setConfirmModalInput('');
        setConfirmModalYes(() => saveVoiceConfiguration);
        setConfirmModalNo(() => cancelSaveVoiceConfiguration);
        showConfirmModal("Please enter a name for the configuration", true, "Save voice configuration");
    };

    const handleVoiceSelectionChange = (selectedVoiceId) => {
        // Ensure selected voice is valid
        let voice = selectedVoiceId;
        if (!modelVoiceOptions[currentVoiceConfig.model] || !modelVoiceOptions[currentVoiceConfig.model][currentVoiceConfig.language] || modelVoiceOptions[currentVoiceConfig.model][currentVoiceConfig.language].length === 0) {
            // Model has no defined voices
            voice = "";
        } else if (!modelVoiceOptions[currentVoiceConfig.model][currentVoiceConfig.language].some((voiceOption) => voiceOption.value === voice)) {
            // Model has voices, but selected one is not a valid one
            voice = modelVoiceOptions[currentVoiceConfig.model][currentVoiceConfig.language][0].value;
        }

        // Update config
        const newConfig = {
            ...currentVoiceConfig,
            voice: voice,
        };
        setCurrentVoiceConfig(newConfig);
    };

    const handleLanguageSelectionChange = (selectedLanguageId) => {
        // Ensure selected language is valid
        let language = selectedLanguageId;
        if (!modelLanguageOptions[currentVoiceConfig.model] || modelLanguageOptions[currentVoiceConfig.model].length === 0) {
            // Model has no valid languages
            language = ""
        } else if (!modelLanguageOptions[currentVoiceConfig.model].some((langOption) => langOption.value === language)) {
            // Model has languages, but selected one is not a valid one
            language = modelLanguageOptions[currentVoiceConfig.model][0].value;
        }

        // Ensure selected voice is valid
        let voice = currentVoiceConfig.voice;
        if (!modelVoiceOptions[currentVoiceConfig.model] || !modelVoiceOptions[currentVoiceConfig.model][language] || modelVoiceOptions[currentVoiceConfig.model][language].length === 0) {
            // Model has no defined voices
            voice = "";
        } else if (!modelVoiceOptions[currentVoiceConfig.model][language].some((voiceOption) => voiceOption.value === voice)) {
            // Model has voices, but selected one is not a valid one
            voice = modelVoiceOptions[currentVoiceConfig.model][language][0].value;
        }

        // Update config
        const newConfig = {
            ...currentVoiceConfig,
            language: language,
            voice: voice,
        };
        setCurrentVoiceConfig(newConfig);
    };

    const handleModelSelectionChange = (selectedModelId) => {
        // Ensure selected OperationMode is valid
        let operationMode = currentVoiceConfig.operation_mode;
        if (!modelOperationModes[selectedModelId].some((mode) => mode.value === currentVoiceConfig.operation_mode)) {
            operationMode = modelOperationModes[selectedModelId][0].value;
        }

        // Ensure selected language is valid
        let language = currentVoiceConfig.language;
        if (!modelLanguageOptions[selectedModelId] || modelLanguageOptions[selectedModelId].length === 0) {
            // Model has no valid languages
            language = ""
        } else if (!modelLanguageOptions[selectedModelId].some((langOption) => langOption.value === language)) {
            // Model has languages, but selected one is not a valid one
            language = modelLanguageOptions[selectedModelId][0].value;
        }

        // Ensure selected voice is valid
        let voice = currentVoiceConfig.voice;
        if (!modelVoiceOptions[selectedModelId] || !modelVoiceOptions[selectedModelId][language] || modelVoiceOptions[selectedModelId][language].length === 0) {
            // Model has no defined voices
            voice = "";
        } else if (!modelVoiceOptions[selectedModelId][language].some((voiceOption) => voiceOption.value === voice)) {
            // Model has voices, but selected one is not a valid one
            voice = modelVoiceOptions[selectedModelId][language][0].value;
        }

        // Update config
        const newConfig = {
            ...currentVoiceConfig,
            model: selectedModelId,
            operation_mode: operationMode,
            language: language,
            voice: voice,
            target_embedding: "",
        };
        setCurrentVoiceConfig(newConfig);
        setEmbeddingStatus(embeddingStatusNone);
        //LogDebug(JSON.stringify(newConfig));
    }

    const handleOperationModeChange = (selectedOperationMode) => {
        setCurrentVoiceConfig({
            ...currentVoiceConfig,
            operation_mode: selectedOperationMode,
            target_embedding: "",
        });
        setEmbeddingStatus(embeddingStatusNone);
    }

    const handleEmbeddingFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setEmbeddingFile(file);
            // Load into Player
            const reader = new FileReader();
            reader.onload = async () => {
                const dataUrl = reader.result;
                setEmbeddingFileAudio(dataUrl);
            }
            reader.readAsDataURL(file);
        };
    };

    const handleGenerateEmbedding = async () => {
        if (!embeddingFile) {
            showModal("Please select a voice file to embed.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            const dataUrl = reader.result;
            const base64Content = dataUrl.split(',')[1];
            try {
                setEmbeddingStatus(embeddingStatusInProgress);
                const response = await harmonySpeechPlugin.createEmbedding({
                    model: currentVoiceConfig.model,
                    input_audio: base64Content,
                });
                setCurrentVoiceConfig((prev) => ({
                    ...prev,
                    target_embedding: response.data,
                }));
                setEmbeddingStatus(embeddingStatusDone);
                LogDebug(JSON.stringify(currentVoiceConfig));
            } catch (error) {
                LogError("Embedding request failed.");
                LogError(error);
                setEmbeddingStatus(embeddingStatusFailed);
                showModal("Failed to perform embedding: " + error.message, "An Error occurred");
            }
        };
        reader.onerror = () => {
            showModal("Failed to read the selected file.", "An Error occurred");
        };
        reader.readAsDataURL(embeddingFile);
    };

    // Voice Synthesis Handlers
    const handleSynthesizeVoice = async () => {
        if (!generationText) {
            showModal("Please enter text to synthesize.");
            return;
        }
        if (currentVoiceConfig.operation_mode === "voice_cloning" && !currentVoiceConfig.target_embedding) {
            showModal("Please generate an embedding for voice cloning first");
            return;
        }

        try {
            // This sends a TTS Request
            // For voice cloning, we're assuming there has been an embedding generated already.
            // Cloning a voice starting from an existing embedding is always more performant than doing dynamic cloning.
            const response = await harmonySpeechPlugin.createSpeech({
                // Basic config
                model: currentVoiceConfig.model,
                input: generationText,
                mode: currentVoiceConfig.operation_mode,
                language: currentVoiceConfig.language,
                voice: currentVoiceConfig.voice,
                input_embedding: currentVoiceConfig.target_embedding ? currentVoiceConfig.target_embedding : null,
                // Generation Options
                generation_options: {
                    seed: currentVoiceConfig.seed,
                    style: currentVoiceConfig.style,
                    speed: currentVoiceConfig.speed,
                    pitch: currentVoiceConfig.pitch,
                    energy: currentVoiceConfig.energy,
                },
                // TODO: Output Options
                // TODO: Post generation filters
            });
            setGeneratedAudio(`data:audio/wav;base64,${response.data}`);
        } catch (error) {
            LogError("Text-to-Speech request failed.");
            LogError(error);
            showModal("Failed to generate speech: " + error.message, "An Error occurred");
        }
    };

    const handleDeleteConfig = () => {
        if (!voiceConfigFile || !voiceConfigs || !voiceConfigs.includes(voiceConfigFile)) {
            showModal("Please save a voice configuration first before attempting to delete it.", "No Configuration Selected");
            return;
        }
        setConfirmModalInput('');
        setConfirmModalYes(() => () => {
            deleteVoiceConfig(voiceConfigFile)
                .then(() => {
                    refreshVoiceConfigs();
                    showModal("Configuration deleted successfully.", "Success");
                })
                .catch((error) => {
                    LogError("Failed to delete voice configuration.");
                    LogError(error);
                    showModal("Failed to delete the voice configuration: " + error.message, "An Error occurred");
                });
        });
        setConfirmModalNo(() => () => setConfirmModalVisible(false));
        showConfirmModal(`Are you sure you want to delete "${voiceConfigFile}"?`, false, "Delete voice configuration");
    };

    const handleRenameConfig = () => {
        if (!voiceConfigFile || !voiceConfigs || !voiceConfigs.includes(voiceConfigFile)) {
            showModal("Please save a voice configuration first before attempting to rename it.", "No Configuration Selected");
            return;
        }
        setConfirmModalInput('');
        setConfirmModalYes(() => (newName) => {
            if (!newName) {
                showModal("Please enter a new name for the configuration.");
                return;
            }
            renameVoiceConfig(voiceConfigFile, newName)
                .then(() => {
                    refreshVoiceConfigs();
                    showModal("Configuration renamed successfully.", "Success");
                })
                .catch((error) => {
                    LogError("Failed to rename voice configuration.");
                    LogError(error);
                    showModal("Failed to rename the voice configuration: " + error.message, "An Error occurred");
                });
        });
        setConfirmModalNo(() => () => setConfirmModalVisible(false));
        showConfirmModal("Enter a new name for the configuration", true, "Rename voice configuration");
    };

    return (
        <>
            <div className="flex flex-wrap w-full pt-2">
                <ConfigVerificationSection
                    onValidate={handleValidateConfig}
                    validationState={validationState}
                />
                {isHarmonyLinkMode() && (
                    <IntegrationDisplay moduleName={MODULES.TTS} providerName={PROVIDERS.HARMONYSPEECH} useIntegration={useIntegration} />
                )}
                <div className="flex flex-wrap items-center -px-10 w-full">
                    <div className="flex items-center mb-6 w-full">
                        <div className="flex items-center mt-2 w-full">
                            <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                Voice Configuration
                                <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                                 setTooltipVisible={setTooltipVisible}>
                                    Select from existing voice configurations or manage your configurations
                                </SettingsTooltip>
                            </label>
                            <select
                                value={voiceConfigFile}
                                onChange={(e) => changeVoiceConfigAndUpdate(e.target.value)}
                                className="input-field block w-1/3"
                            >
                                {voiceConfigs && voiceConfigs.length > 0 ? (
                                    voiceConfigs.map((config) => (
                                        <option key={config} value={config}>
                                            {config}
                                        </option>
                                    ))
                                ) : (
                                    <option value="">No Configs Available</option>
                                )}
                            </select>
                            <button onClick={handleSaveConfig}
                                    className="btn-primary py-1 px-2 mx-1 text-sm">
                                Save
                            </button>
                            <button onClick={handleRenameConfig}
                                    className={`btn-secondary font-semibold py-1 px-2 mx-1 text-sm ${!voiceConfigs || !voiceConfigs.includes(voiceConfigFile) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    disabled={!voiceConfigs || !voiceConfigs.includes(voiceConfigFile)}>
                                Rename
                            </button>
                            <button onClick={handleDeleteConfig}
                                    className={`font-semibold py-1 px-2 mx-1 text-sm ${voiceConfigs && voiceConfigs.includes(voiceConfigFile)
                                        ? 'bg-error hover:bg-error/80 text-white'
                                        : 'bg-surface-elevated text-text-muted cursor-not-allowed opacity-50'}`}
                                    disabled={!voiceConfigs || !voiceConfigs.includes(voiceConfigFile)}>
                                Delete
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center mb-6 w-full border-t border-neutral-500">
                        <div className="flex items-center mt-2 mb-2 w-full">
                            <h2 className="text-l font-bold text-text-secondary">Basic Settings</h2>
                        </div>
                        <div className="flex items-center mb-6 w-full">
                            <div className="flex items-center w-full">
                                <label className="block text-sm font-medium text-text-secondary w-1/4 px-3">
                                    Endpoint URL
                                    <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                                     setTooltipVisible={setTooltipVisible}>
                                        Specify the endpoint for the Harmony Speech Engine API.
                                    </SettingsTooltip>
                                </label>
                                <div className="w-3/4">
                                    <input type="text" name="endpoint"
                                           className="input-field mt-1 block w-full"
                                           placeholder="Endpoint URL" value={endpoint}
                                           onChange={(e) => setEndpoint(e.target.value)}
                                           onBlur={(e) => validateEndpointAndUpdate(e.target.value)}/>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center mb-6 w-full">
                            <div className="flex items-center w-1/2">
                                <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                                    Model Selection
                                    <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                                     setTooltipVisible={setTooltipVisible}>
                                        Select the AI model for speech synthesis.
                                    </SettingsTooltip>
                                </label>
                                <select
                                    value={currentVoiceConfig.model}
                                    onChange={(e) => handleModelSelectionChange(e.target.value)}
                                    className="input-field block w-1/2"
                                >
                                    {modelOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                        <div className="flex items-center w-1/2">
                            <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                                Operation Mode
                                <SettingsTooltip tooltipIndex={4} tooltipVisible={() => tooltipVisible}
                                                 setTooltipVisible={setTooltipVisible}>
                                    Different models may support different operation modes, like voice cloning,
                                    Single-Speaker-TTS, Realtime Speech-To-Speech etc.
                                </SettingsTooltip>
                            </label>
                            <select
                                value={currentVoiceConfig.operation_mode}
                                onChange={(e) => handleOperationModeChange(e.target.value)}
                                className="input-field block w-1/2"
                            >
                                {modelOperationModes[currentVoiceConfig.model] ? (
                                    modelOperationModes[currentVoiceConfig.model].map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.name}
                                        </option>
                                    ))
                                ) : (
                                    <option key="" value="">Default</option>
                                )}
                            </select>
                        </div>
                    </div>
                    {currentVoiceConfig.operation_mode === "voice_cloning" && (
                        <div className="w-full">
                            <div className="flex items-center mb-2 w-full">
                                <h2 className="text-l font-bold text-text-secondary">
                                    Voice Embedding Settings
                                    <SettingsTooltip tooltipIndex={5} tooltipVisible={() => tooltipVisible}
                                                     setTooltipVisible={setTooltipVisible}>
                                            <span className="font-medium">
                                                A voice embedding stores the vocal characteristics of a speaker. AI
                                                Speech Frameworks can use this vocal data to align their output when performing
                                                voice cloning.
                                                <br/>
                                                <br/><span className="text-warning">CAUTION: Embeddings of different models are usually not compatible with each other.</span>
                                            </span>
                                    </SettingsTooltip>
                                </h2>
                            </div>
                            <div className="flex items-center mb-6 w-full">
                                <div className="flex items-center mt-2 w-2/3">
                                    <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                        Voice File
                                        <SettingsTooltip tooltipIndex={6} tooltipVisible={() => tooltipVisible}
                                                         setTooltipVisible={setTooltipVisible}>
                                            Select a local audio file to generate a voice embedding from.
                                        </SettingsTooltip>
                                    </label>
                                    <div className="w-2/3 px-3">
                                        <input
                                            type="file"
                                            accept=".wav,.mp3,.flac"
                                            onChange={handleEmbeddingFileChange}
                                            className="input-file"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center mt-2 w-1/3">
                                    <div className="w-full">
                                        <HarmonyAudioPlayer className="w-full" src={embeddingFileAudio}/>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center mb-6 w-full">
                                <div className="flex items-center w-2/3 px-3">
                                    <div className="flex items-center w-1/3">
                                    </div>
                                    <div className="flex items-center w-2/3 px-1">
                                        <div className="w-full flex items-center">
                                            <button
                                                onClick={handleGenerateEmbedding}
                                                className="btn-primary py-1 px-2 mx-1 text-sm"
                                            >
                                                Generate Embedding
                                            </button>
                                            <label className="text-sm font-medium text-text-secondary">
                                                <SettingsTooltip tooltipIndex={7} tooltipVisible={() => tooltipVisible}
                                                                 setTooltipVisible={setTooltipVisible}>
                                                    This sends an embedding Request for the provided audio file to the
                                                    endpoint provided.
                                                    <br/>The received embedding data will be stored in the current voice
                                                    configuration.
                                                    <br/>
                                                    <br/><span className="text-warning">CAUTION: Existing embedding data will be replaced.</span>
                                                </SettingsTooltip>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center w-1/3 px-3">
                                    <div className="w-full flex items-center">
                                        <div className="w-1/2 px-3 flex items-center">
                                            {currentVoiceConfig && currentVoiceConfig.target_embedding &&
                                                <div style={{width: '50px', height: '50px'}}>
                                                    <Heatmap data={currentVoiceConfig.target_embedding}
                                                             colorRange={[0, 0.3]}/>
                                                </div>
                                            }
                                        </div>
                                        <div className="w-1/2 px-3 flex items-center">
                                            <span className="text-sm text-warning">{embeddingStatus}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center mb-2 w-full">
                        <h2 className="text-l font-bold text-text-secondary">
                            Voice Generation Settings
                            <SettingsTooltip tooltipIndex={8} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                            <span className="font-medium">
                                                Settings for the model when generating speech.
                                                <br/>
                                                <br/>ATTENTION: Not all models support all settings. Please refer to the <span
                                                className="text-warning"><a
                                                href="https://github.com/harmony-ai-solutions/harmony-speech-engine/blob/main/docs/models.md"
                                                target="_blank">Documentation</a></span> for possible settings.
                                            </span>
                            </SettingsTooltip>
                        </h2>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                            Language
                            <SettingsTooltip tooltipIndex={9} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Select the target language for voice synthesis.
                                <br/>Not all models support multiple languages.
                            </SettingsTooltip>
                        </label>
                        <select
                            value={currentVoiceConfig.language}
                            onChange={(e) => handleLanguageSelectionChange(e.target.value)}
                            className="input-field block w-1/2"
                        >
                            {modelLanguageOptions[currentVoiceConfig.model] ? (
                                modelLanguageOptions[currentVoiceConfig.model].map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.name}
                                    </option>
                                ))
                            ) : (
                                <option key="" value="">Default</option>
                            )}
                        </select>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                            Voice
                            <SettingsTooltip tooltipIndex={10} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                Select the target voice for voice synthesis.
                                <br/>Not all models support output voices.
                            </SettingsTooltip>
                        </label>
                        <select
                            value={currentVoiceConfig.voice}
                            onChange={(e) => handleVoiceSelectionChange(e.target.value)}
                            className="input-field block w-1/2"
                        >
                            {modelVoiceOptions[currentVoiceConfig.model] && modelVoiceOptions[currentVoiceConfig.model][currentVoiceConfig.language] ? (
                                modelVoiceOptions[currentVoiceConfig.model][currentVoiceConfig.language].map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.name}
                                    </option>
                                ))
                            ) : (
                                <option key="" value="">Default</option>
                            )}
                        </select>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                            Seed
                        </label>
                        <div className="w-1/2">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                name="seed"
                                className="input-field mt-1 block w-full"
                                placeholder="Seed"
                                value={currentVoiceConfig.seed}
                                onChange={(e) =>
                                    setCurrentVoiceConfig({
                                        ...currentVoiceConfig,
                                        seed: parseInt(e.target.value)
                                    })
                                }
                            />
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                            Style
                        </label>
                        <div className="w-1/2">
                            <input
                                type="number"
                                min="0"
                                step="1"
                                name="style"
                                className="input-field mt-1 block w-full"
                                placeholder="Style"
                                value={currentVoiceConfig.style}
                                onChange={(e) =>
                                    setCurrentVoiceConfig({
                                        ...currentVoiceConfig,
                                        style: parseInt(e.target.value)
                                    })
                                }
                            />
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                            Speed
                        </label>
                        <div className="w-1/2">
                            <input
                                type="number"
                                step="0.01"
                                name="speed"
                                className="input-field mt-1 block w-full"
                                placeholder="Speed"
                                value={currentVoiceConfig.speed}
                                onChange={(e) =>
                                    setCurrentVoiceConfig({
                                        ...currentVoiceConfig,
                                        speed: parseFloat(e.target.value)
                                    })
                                }
                            />
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                            Pitch
                        </label>
                        <div className="w-1/2">
                            <input
                                type="number"
                                step="0.01"
                                name="pitch"
                                className="input-field mt-1 block w-full"
                                placeholder="Pitch"
                                value={currentVoiceConfig.pitch}
                                onChange={(e) =>
                                    setCurrentVoiceConfig({
                                        ...currentVoiceConfig,
                                        pitch: parseFloat(e.target.value)
                                    })
                                }
                            />
                        </div>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                            Energy
                        </label>
                        <div className="w-1/2">
                            <input
                                type="number"
                                step="0.01"
                                name="energy"
                                className="input-field mt-1 block w-full"
                                placeholder="Energy"
                                value={currentVoiceConfig.energy}
                                onChange={(e) =>
                                    setCurrentVoiceConfig({
                                        ...currentVoiceConfig,
                                        energy: parseFloat(e.target.value)
                                    })
                                }
                            />
                        </div>
                    </div>
                    <div className="flex items-center mb-2 w-full">
                        <h2 className="text-l font-bold text-text-secondary">
                            Generate Speech
                            <SettingsTooltip tooltipIndex={11} tooltipVisible={() => tooltipVisible}
                                             setTooltipVisible={setTooltipVisible}>
                                            <span className="font-medium">
                                                Here you can test above configuration for the speech engine by generating
                                                sample speech audio.
                                            </span>
                            </SettingsTooltip>
                        </h2>
                    </div>
                    <div className="flex items-center mb-2 w-full">
                        <div className="flex items-center w-2/3">
                            <label className="block text-sm font-medium text-text-secondary w-1/4 px-3">
                                Input Text
                                <SettingsTooltip tooltipIndex={12} tooltipVisible={() => tooltipVisible}
                                                 setTooltipVisible={setTooltipVisible}>
                                    Enter the text you want to convert to speech.
                                </SettingsTooltip>
                            </label>
                            <div className="w-3/4 px-3">
                                <textarea name="generation_text"
                                          className="input-field mt-1 block w-full min-h-24"
                                          placeholder="Type text to generate speech from here"
                                          value={generationText}
                                          onChange={(e) => setGenerationText(e.target.value)}
                                          onBlur={(e) => setGenerationText(e.target.value)}/>
                            </div>
                        </div>
                        <div className="flex items-center w-1/3">
                            <div className="flex flex-wrap items-center w-full">
                                <div className="w-full mb-2">
                                    <button
                                        onClick={handleSynthesizeVoice}
                                        className="btn-primary py-1 px-2 text-sm w-full"
                                    >
                                        Generate Speech
                                    </button>
                                </div>
                                <div className="w-full">
                                    <HarmonyAudioPlayer className="w-full" src={generatedAudio}/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ErrorDialog
                isOpen={isModalVisible}
                title={modalTitle}
                message={modalMessage}
                onClose={() => setIsModalVisible(false)}
                type={modalTitle === 'Success' ? 'success' : 'error'}
            />
            {confirmModalHasInput ? (
                <InputDialog
                    isOpen={confirmModalVisible}
                    title={confirmModalTitle}
                    message={confirmModalMessage}
                    defaultValue={confirmModalInput}
                    onConfirm={(value) => {
                        setConfirmModalVisible(false);
                        confirmModalYes(value);
                    }}
                    onCancel={() => {
                        setConfirmModalVisible(false);
                        confirmModalNo();
                    }}
                    confirmText="Confirm"
                    cancelText="Abort"
                />
            ) : (
                <ConfirmDialog
                    isOpen={confirmModalVisible}
                    title={confirmModalTitle}
                    message={confirmModalMessage}
                    onConfirm={() => {
                        setConfirmModalVisible(false);
                        confirmModalYes(null);
                    }}
                    onCancel={() => {
                        setConfirmModalVisible(false);
                        confirmModalNo();
                    }}
                    confirmText="Confirm"
                    cancelText="Abort"
                />
            )}
        </>
    );
}

export default TTSHarmonySpeechSettingsView;
