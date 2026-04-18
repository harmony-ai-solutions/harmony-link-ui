import { useEffect, useState } from 'react';
import SettingsTooltip from '../settings/SettingsTooltip.jsx';
import { LogDebug, LogError } from '../../utils/logger.js';
import { listVoiceConfigs, loadVoiceConfig, saveVoiceConfig, updateVoiceConfig, deleteVoiceConfig, renameVoiceConfig } from '../../services/storage/storageService.js';
import HarmonyAudioPlayer from './HarmonyAudioPlayer.jsx';
import Heatmap from './Heatmap.jsx';
import ErrorDialog from '../modals/ErrorDialog.jsx';
import ConfirmDialog from '../modals/ConfirmDialog.jsx';
import InputDialog from '../modals/InputDialog.jsx';
import ThemedSelect from './ThemedSelect.jsx';
import useHarmonySpeechClient from '../../hooks/useHarmonySpeechClient.js';

// Model name mappings
const knownModelNames = {
    "harmonyspeech": "HarmonySpeech V1",
    "openvoice_v1": "OpenVoice V1",
    "openvoice_v2": "OpenVoice V2",
    "kitten-tts-mini": "KittenTTS Mini",
    "kitten-tts-micro": "KittenTTS Micro",
    "kitten-tts-nano": "KittenTTS Nano",
    "kitten-tts-nano-int8": "KittenTTS Nano (int8)",
    "chatterbox": "Chatterbox TTS",
    "chatterbox_turbo": "Chatterbox Turbo TTS",
    "chatterbox_multilingual": "Chatterbox Multilingual TTS",
};

// Model family helper constants for conditional UI rendering
const KITTENTTS_MODEL_IDS = ['kitten-tts-mini', 'kitten-tts-micro', 'kitten-tts-nano', 'kitten-tts-nano-int8'];
const CHATTERBOX_TURBO_MODEL_IDS = ['chatterbox_turbo'];
const CHATTERBOX_TTS_MODEL_IDS = ['chatterbox', 'chatterbox_multilingual'];
const CHATTERBOX_ALL_MODEL_IDS = [...CHATTERBOX_TTS_MODEL_IDS, ...CHATTERBOX_TURBO_MODEL_IDS];

const isKittenTTSModel = (modelId) => KITTENTTS_MODEL_IDS.includes(modelId);
const isChatterboxTurboModel = (modelId) => CHATTERBOX_TURBO_MODEL_IDS.includes(modelId);
const isChatterboxTTSModel = (modelId) => CHATTERBOX_TTS_MODEL_IDS.includes(modelId);
const isChatterboxModel = (modelId) => CHATTERBOX_ALL_MODEL_IDS.includes(modelId);

// Embedding Status values
const embeddingStatusNone = "No embedding loaded.";
const embeddingStatusInProgress = "Embedding in progress...";
const embeddingStatusDone = "Embedding updated.";
const embeddingStatusFailed = "Embedding failed.";

const NEW_CONFIG_OPTION = "__NEW_VOICE_CONFIG__";

// Operation modes for different models
const modelOperationModes = {
    'harmonyspeech': [
        { name: 'Voice Cloning', value: 'voice_cloning' },
    ],
    'openvoice_v1': [
        { name: 'Single-Speaker TTS', value: 'single_speaker_tts' },
        { name: 'Voice Cloning', value: 'voice_cloning' },
    ],
    'openvoice_v2': [
        { name: 'Single-Speaker TTS', value: 'single_speaker_tts' },
        { name: 'Voice Cloning', value: 'voice_cloning' },
    ],
    'kitten-tts-mini': [
        { name: 'Single-Speaker TTS', value: 'single_speaker_tts' },
    ],
    'kitten-tts-micro': [
        { name: 'Single-Speaker TTS', value: 'single_speaker_tts' },
    ],
    'kitten-tts-nano': [
        { name: 'Single-Speaker TTS', value: 'single_speaker_tts' },
    ],
    'kitten-tts-nano-int8': [
        { name: 'Single-Speaker TTS', value: 'single_speaker_tts' },
    ],
    'chatterbox': [
        { name: 'Single-Speaker TTS', value: 'single_speaker_tts' },
        { name: 'Voice Cloning', value: 'voice_cloning' },
    ],
    'chatterbox_turbo': [
        { name: 'Single-Speaker TTS', value: 'single_speaker_tts' },
        { name: 'Voice Cloning', value: 'voice_cloning' },
    ],
    'chatterbox_multilingual': [
        { name: 'Single-Speaker TTS', value: 'single_speaker_tts' },
        { name: 'Voice Cloning', value: 'voice_cloning' },
    ],
};

const VoiceConfigManager = ({ endpoint, voiceConfigFile, onSettingsChange, initialSettings }) => {
    const [tooltipVisible, setTooltipVisible] = useState(0);

    // Modal dialog values
    const [modalTitle, setModalTitle] = useState('Invalid Input');
    const [modalMessage, setModalMessage] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);

    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [confirmModalTitle, setConfirmModalTitle] = useState('Confirmation required');
    const [confirmModalMessage, setConfirmModalMessage] = useState('');
    const [confirmModalYes, setConfirmModalYes] = useState((confirmValue) => {});
    const [confirmModalNo, setConfirmModalNo] = useState(() => {});
    const [confirmModalHasInput, setConfirmModalHasInput] = useState(false);
    const [confirmModalInput, setConfirmModalInput] = useState('');

    // Show Modal Functions
    const showModal = (message, title = 'Invalid Input') => {
        setModalTitle(title);
        setModalMessage(message);
        setIsModalVisible(true);
    };

    const showConfirmModal = (message, hasInput = false, title = 'Confirmation required') => {
        setConfirmModalTitle(title);
        setConfirmModalMessage(message);
        setConfirmModalHasInput(hasInput);
        setConfirmModalVisible(true);
    };

    // Use the custom hook for TTS model fetching
    const { 
        harmonySpeechPlugin, 
        modelOptions, 
        modelLanguageOptions, 
        modelVoiceOptions, 
        refreshModels, 
        isLoading: isLoadingModels 
    } = useHarmonySpeechClient(endpoint, 'tts');

    // Internal State handling
    const [voiceConfigs, setVoiceConfigs] = useState([]);
    const [currentVoiceConfig, setCurrentVoiceConfig] = useState({
        model: "harmonyspeech",
        operation_mode: "voice_cloning",
        language: "",
        voice: "",
        style: 0,
        speed: 1.00,
        pitch: 1.00,
        energy: 1.00,
        seed: 42,
        target_embedding: "",
        exaggeration: 0.5,
        cfg_weight: 0.5,
        temperature: 0.8,
        repetition_penalty: 1.2,
        top_p: 1.0,
        min_p: 0.05,
        top_k: 1000,
        norm_loudness: true,
    });

    // Voice Config File state
    const [currentVoiceConfigFile, setCurrentVoiceConfigFile] = useState(voiceConfigFile || NEW_CONFIG_OPTION);

    // Voice Embedding States
    const [embeddingFile, setEmbeddingFile] = useState(null);
    const [embeddingFileAudio, setEmbeddingFileAudio] = useState(null);
    const [embeddingStatus, setEmbeddingStatus] = useState(embeddingStatusNone);

    // Testing Area States
    const [generationText, setGenerationText] = useState("This is a sample text");
    const [generatedAudio, setGeneratedAudio] = useState(null);

    // Utility Functions
    const loadDefaultVoiceConfig = () => {
        const defaultConfig = {
            model: "harmonyspeech",
            operation_mode: "voice_cloning",
            language: "",
            voice: "",
            style: 0,
            speed: 1.00,
            pitch: 1.00,
            energy: 1.00,
            seed: 42,
            target_embedding: "",
            exaggeration: 0.5,
            cfg_weight: 0.5,
            temperature: 0.8,
            repetition_penalty: 1.2,
            top_p: 1.0,
            min_p: 0.05,
            top_k: 1000,
            norm_loudness: true,
        };
        setCurrentVoiceConfig(defaultConfig);
    };

    const refreshVoiceConfigs = (preserveCurrentConfig = true, configFileName = null) => {
        try {
            listVoiceConfigs().then((result) => {
                setVoiceConfigs(result);

                const currentConfigFile = configFileName !== null ? configFileName : voiceConfigFile;

                if (preserveCurrentConfig && currentConfigFile) {
                    if (result.includes(currentConfigFile)) {
                        if (currentVoiceConfigFile !== currentConfigFile) {
                            changeVoiceConfigAndUpdate(currentConfigFile);
                        }
                    } else {
                        setCurrentVoiceConfigFile(NEW_CONFIG_OPTION);
                        loadDefaultVoiceConfig();
                    }
                } else {
                    setCurrentVoiceConfigFile(NEW_CONFIG_OPTION);
                    loadDefaultVoiceConfig();
                }
            });
        } catch (error) {
            LogError("Unable to load available voice configurations");
            LogError(error);
            showModal("Error loading voice config", "An Error occurred");
        }
    };

    // Initialize voice configs on mount
    useEffect(() => {
        refreshVoiceConfigs(true, voiceConfigFile);
    }, []);

    // Config Management Handlers
    const changeVoiceConfigAndUpdate = async (selectedConfig) => {
        if (selectedConfig === "" || selectedConfig === NEW_CONFIG_OPTION) {
            loadDefaultVoiceConfig();
            setCurrentVoiceConfigFile(NEW_CONFIG_OPTION);
            onSettingsChange({ voiceconfigfile: "" });
            return true;
        }

        try {
            const configData = await loadVoiceConfig(selectedConfig);
            const parsedConfig = JSON.parse(configData);
            setCurrentVoiceConfig(parsedConfig);
            setCurrentVoiceConfigFile(selectedConfig);
            onSettingsChange({ voiceconfigfile: selectedConfig });
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
                    refreshVoiceConfigs(true, configName);
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
    };

    const cancelSaveVoiceConfiguration = () => {
        setConfirmModalInput('');
        setConfirmModalVisible(false);
    };

    const updateVoiceConfiguration = (configName) => {
        try {
            const configString = JSON.stringify(currentVoiceConfig, null, 2);
            updateVoiceConfig(configName, configString)
                .then(() => {
                    showModal("Configuration updated successfully.", "Success");
                    setConfirmModalVisible(false);
                })
                .catch((error) => {
                    LogError("Failed to update voice configuration.");
                    LogError(error);
                    showModal("Failed to update the voice configuration.", "An Error occurred");
                });
            return true;
        } catch (error) {
            LogError("Error stringifying the voice configuration.");
            LogError(error);
            showModal("Failed to update the voice configuration.", "An Error occurred");
            return false;
        }
    };

    const handleSaveConfig = () => {
        if (currentVoiceConfigFile === NEW_CONFIG_OPTION) {
            setConfirmModalInput('');
            setConfirmModalYes(() => saveVoiceConfiguration);
            setConfirmModalNo(() => cancelSaveVoiceConfiguration);
            showConfirmModal("Please enter a name for the configuration", true, "Save voice configuration");
        } else {
            setConfirmModalInput('');
            setConfirmModalYes(() => () => updateVoiceConfiguration(currentVoiceConfigFile));
            setConfirmModalNo(() => () => setConfirmModalVisible(false));
            showConfirmModal(`Do you want to update the configuration "${currentVoiceConfigFile}"?`, false, "Update voice configuration");
        }
    };

    const handleSaveAsNew = () => {
        setConfirmModalInput('');
        setConfirmModalYes(() => saveVoiceConfiguration);
        setConfirmModalNo(() => cancelSaveVoiceConfiguration);
        showConfirmModal("Please enter a name for the new configuration", true, "Save voice configuration");
    };

    const handleVoiceSelectionChange = (selectedVoiceId) => {
        let voice = selectedVoiceId;
        if (!modelVoiceOptions[currentVoiceConfig.model] || 
            !modelVoiceOptions[currentVoiceConfig.model][currentVoiceConfig.language] || 
            modelVoiceOptions[currentVoiceConfig.model][currentVoiceConfig.language].length === 0) {
            voice = "";
        } else if (!modelVoiceOptions[currentVoiceConfig.model][currentVoiceConfig.language].some((voiceOption) => voiceOption.value === voice)) {
            voice = modelVoiceOptions[currentVoiceConfig.model][currentVoiceConfig.language][0].value;
        }

        const newConfig = {
            ...currentVoiceConfig,
            voice: voice,
        };
        setCurrentVoiceConfig(newConfig);
    };

    const handleLanguageSelectionChange = (selectedLanguageId) => {
        let language = selectedLanguageId;
        if (!modelLanguageOptions[currentVoiceConfig.model] || modelLanguageOptions[currentVoiceConfig.model].length === 0) {
            language = "";
        } else if (!modelLanguageOptions[currentVoiceConfig.model].some((langOption) => langOption.value === language)) {
            language = modelLanguageOptions[currentVoiceConfig.model][0].value;
        }

        let voice = currentVoiceConfig.voice;
        if (!modelVoiceOptions[currentVoiceConfig.model] || 
            !modelVoiceOptions[currentVoiceConfig.model][language] || 
            modelVoiceOptions[currentVoiceConfig.model][language].length === 0) {
            voice = "";
        } else if (!modelVoiceOptions[currentVoiceConfig.model][language].some((voiceOption) => voiceOption.value === voice)) {
            voice = modelVoiceOptions[currentVoiceConfig.model][language][0].value;
        }

        const newConfig = {
            ...currentVoiceConfig,
            language: language,
            voice: voice,
        };
        setCurrentVoiceConfig(newConfig);
    };

    const handleModelSelectionChange = (selectedModelId) => {
        let operationMode = currentVoiceConfig.operation_mode;
        const availableModes = modelOperationModes[selectedModelId] || [{ name: 'Default', value: 'single_speaker_tts' }];
        if (!availableModes.some((mode) => mode.value === currentVoiceConfig.operation_mode)) {
            operationMode = availableModes[0].value;
        }

        let language = currentVoiceConfig.language;
        if (!modelLanguageOptions[selectedModelId] || modelLanguageOptions[selectedModelId].length === 0) {
            language = "";
        } else if (!modelLanguageOptions[selectedModelId].some((langOption) => langOption.value === language)) {
            language = modelLanguageOptions[selectedModelId][0].value;
        }

        let voice = currentVoiceConfig.voice;
        if (!modelVoiceOptions[selectedModelId] || 
            !modelVoiceOptions[selectedModelId][language] || 
            modelVoiceOptions[selectedModelId][language].length === 0) {
            voice = "";
        } else if (!modelVoiceOptions[selectedModelId][language].some((voiceOption) => voiceOption.value === voice)) {
            voice = modelVoiceOptions[selectedModelId][language][0].value;
        }

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
    };

    const handleOperationModeChange = (selectedOperationMode) => {
        setCurrentVoiceConfig({
            ...currentVoiceConfig,
            operation_mode: selectedOperationMode,
            target_embedding: "",
        });
        setEmbeddingStatus(embeddingStatusNone);
    };

    const handleEmbeddingFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setEmbeddingFile(file);
            const reader = new FileReader();
            reader.onload = async () => {
                const dataUrl = reader.result;
                setEmbeddingFileAudio(dataUrl);
            };
            reader.readAsDataURL(file);
        }
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
            const response = await harmonySpeechPlugin.createSpeech({
                model: currentVoiceConfig.model,
                input: generationText,
                mode: currentVoiceConfig.operation_mode,
                language: currentVoiceConfig.language,
                voice: currentVoiceConfig.voice,
                input_embedding: currentVoiceConfig.target_embedding ? currentVoiceConfig.target_embedding : null,
                generation_options: {
                    seed: currentVoiceConfig.seed,
                    style: currentVoiceConfig.style,
                    speed: currentVoiceConfig.speed,
                    pitch: currentVoiceConfig.pitch,
                    energy: currentVoiceConfig.energy,
                    ...(isChatterboxTTSModel(currentVoiceConfig.model) && {
                        exaggeration: currentVoiceConfig.exaggeration,
                        cfg_weight: currentVoiceConfig.cfg_weight,
                        temperature: currentVoiceConfig.temperature,
                        repetition_penalty: currentVoiceConfig.repetition_penalty,
                        top_p: currentVoiceConfig.top_p,
                        min_p: currentVoiceConfig.min_p,
                    }),
                    ...(isChatterboxTurboModel(currentVoiceConfig.model) && {
                        temperature: currentVoiceConfig.temperature,
                        repetition_penalty: currentVoiceConfig.repetition_penalty,
                        top_p: currentVoiceConfig.top_p,
                        top_k: currentVoiceConfig.top_k,
                        norm_loudness: currentVoiceConfig.norm_loudness,
                    }),
                },
            });
            setGeneratedAudio(`data:audio/wav;base64,${response.data}`);
        } catch (error) {
            LogError("Text-to-Speech request failed.");
            LogError(error);
            showModal("Failed to generate speech: " + error.message, "An Error occurred");
        }
    };

    const handleDeleteConfig = () => {
        if (!currentVoiceConfigFile || !voiceConfigs || !voiceConfigs.includes(currentVoiceConfigFile)) {
            showModal("Please save a voice configuration first before attempting to delete it.", "No Configuration Selected");
            return;
        }
        setConfirmModalInput('');
        setConfirmModalYes(() => () => {
            deleteVoiceConfig(currentVoiceConfigFile)
                .then(() => {
                    refreshVoiceConfigs(false);
                    showModal("Configuration deleted successfully.", "Success");
                })
                .catch((error) => {
                    LogError("Failed to delete voice configuration.");
                    LogError(error);
                    showModal("Failed to delete the voice configuration: " + error.message, "An Error occurred");
                });
        });
        setConfirmModalNo(() => () => setConfirmModalVisible(false));
        showConfirmModal(`Are you sure you want to delete "${currentVoiceConfigFile}"?`, false, "Delete voice configuration");
    };

    const handleRenameConfig = () => {
        if (!currentVoiceConfigFile || !voiceConfigs || !voiceConfigs.includes(currentVoiceConfigFile)) {
            showModal("Please save a voice configuration first before attempting to rename it.", "No Configuration Selected");
            return;
        }
        setConfirmModalInput('');
        setConfirmModalYes(() => (newName) => {
            if (!newName) {
                showModal("Please enter a new name for the configuration.");
                return;
            }
            renameVoiceConfig(currentVoiceConfigFile, newName)
                .then(() => {
                    refreshVoiceConfigs(true, newName);
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
            <div className="flex flex-wrap w-full">
                {/* Voice Config Selector */}
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
                            value={currentVoiceConfigFile}
                            onChange={(e) => changeVoiceConfigAndUpdate(e.target.value)}
                            className="input-field block w-1/3"
                        >
                            <option value={NEW_CONFIG_OPTION}>New Voice Config</option>
                            {voiceConfigs && voiceConfigs.length > 0 && (
                                voiceConfigs.map((config) => (
                                    <option key={config} value={config}>
                                        {config}
                                    </option>
                                ))
                            )}
                        </select>
                        <button onClick={handleSaveConfig}
                            className="btn-primary py-1 px-2 mx-1 text-sm">
                            {currentVoiceConfigFile === NEW_CONFIG_OPTION ? 'Save' : 'Update'}
                        </button>
                        {currentVoiceConfigFile !== NEW_CONFIG_OPTION && (
                            <button onClick={handleSaveAsNew}
                                className="btn-secondary py-1 px-2 mx-1 text-sm">
                                Save New
                            </button>
                        )}
                        <button onClick={handleRenameConfig}
                            className={`btn-secondary font-semibold py-1 px-2 mx-1 text-sm ${!voiceConfigs || !voiceConfigs.includes(currentVoiceConfigFile) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={!voiceConfigs || !voiceConfigs.includes(currentVoiceConfigFile)}>
                            Rename
                        </button>
                        <button onClick={handleDeleteConfig}
                            className={`font-semibold py-1 px-2 mx-1 text-sm ${voiceConfigs && voiceConfigs.includes(currentVoiceConfigFile)
                                ? 'bg-error hover:bg-error/80 text-white'
                                : 'bg-surface-elevated text-text-muted cursor-not-allowed opacity-50'}`}
                            disabled={!voiceConfigs || !voiceConfigs.includes(currentVoiceConfigFile)}>
                            Delete
                        </button>
                    </div>
                </div>

                {/* Voice Config Editor - Basic Settings */}
                <div className="flex items-center mb-6 w-full border-t border-neutral-500">
                    <div className="flex items-center mt-2 mb-2 w-full">
                        <h2 className="text-l font-bold text-text-secondary">Basic Settings</h2>
                    </div>
                    <div className="flex items-center mb-6 w-1/2">
                        <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                            Model Selection
                            <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                setTooltipVisible={setTooltipVisible}>
                                Select the AI model for speech synthesis.
                            </SettingsTooltip>
                        </label>
                        <div className="w-1/2 px-3">
                            <ThemedSelect
                                value={currentVoiceConfig.model}
                                onChange={handleModelSelectionChange}
                                options={modelOptions.map(opt => ({
                                    label: opt.name,
                                    value: opt.value
                                }))}
                                placeholder={isLoadingModels ? "Loading models..." : "Select model..."}
                            />
                        </div>
                    </div>
                    <div className="flex items-center w-1/2">
                        <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                            Operation Mode
                            <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible}
                                setTooltipVisible={setTooltipVisible}>
                                Different models may support different operation modes, like voice cloning,
                                Single-Speaker-TTS, Realtime Speech-To-Speech etc.
                            </SettingsTooltip>
                        </label>
                        <div className="w-1/2 px-3">
                            <ThemedSelect
                                value={currentVoiceConfig.operation_mode}
                                onChange={handleOperationModeChange}
                                options={modelOperationModes[currentVoiceConfig.model] ?
                                    modelOperationModes[currentVoiceConfig.model].map(opt => ({
                                        label: opt.name,
                                        value: opt.value
                                    })) :
                                    [{ label: "Default", value: "" }]
                                }
                                placeholder="Select operation mode..."
                            />
                        </div>
                    </div>
                </div>

                {/* Voice Embedding Section */}
                {currentVoiceConfig.operation_mode === "voice_cloning" && (
                    <div className="w-full">
                        <div className="flex items-center mb-2 w-full">
                            <h2 className="text-l font-bold text-text-secondary">
                                Voice Embedding Settings
                                <SettingsTooltip tooltipIndex={4} tooltipVisible={() => tooltipVisible}
                                    setTooltipVisible={setTooltipVisible}>
                                    <span className="font-medium">
                                        A voice embedding stores the vocal characteristics of a speaker. AI
                                        Speech Frameworks can use this vocal data to align their output when performing
                                        voice cloning.
                                        <br />
                                        <br /><span className="text-warning">CAUTION: Embeddings of different models are usually not compatible with each other.</span>
                                    </span>
                                </SettingsTooltip>
                            </h2>
                        </div>
                        <div className="flex items-center mb-6 w-full">
                            <div className="flex items-center mt-2 w-2/3">
                                <label className="block text-sm font-medium text-text-secondary w-1/3 px-3">
                                    Voice File
                                    <SettingsTooltip tooltipIndex={5} tooltipVisible={() => tooltipVisible}
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
                                    <HarmonyAudioPlayer className="w-full" src={embeddingFileAudio} />
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
                                            <SettingsTooltip tooltipIndex={6} tooltipVisible={() => tooltipVisible}
                                                setTooltipVisible={setTooltipVisible}>
                                                This sends an embedding Request for the provided audio file to the
                                                endpoint provided.
                                                <br />The received embedding data will be stored in the current voice
                                                configuration.
                                                <br />
                                                <br /><span className="text-warning">CAUTION: Existing embedding data will be replaced.</span>
                                            </SettingsTooltip>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center w-1/3 px-3">
                                <div className="w-full flex items-center">
                                    <div className="w-1/2 px-3 flex items-center">
                                        {currentVoiceConfig && currentVoiceConfig.target_embedding &&
                                            <div style={{ width: '50px', height: '50px' }}>
                                                <Heatmap data={currentVoiceConfig.target_embedding}
                                                    colorRange={[0, 0.3]} />
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

                {/* Voice Generation Settings */}
                <div className="flex items-center mb-2 w-full">
                    <h2 className="text-l font-bold text-text-secondary">
                        Voice Generation Settings
                        <SettingsTooltip tooltipIndex={7} tooltipVisible={() => tooltipVisible}
                            setTooltipVisible={setTooltipVisible}>
                            <span className="font-medium">
                                Settings for the model when generating speech.
                                <br />
                                <br />ATTENTION: Not all models support all settings. Please refer to the <span
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
                        <SettingsTooltip tooltipIndex={8} tooltipVisible={() => tooltipVisible}
                            setTooltipVisible={setTooltipVisible}>
                            Select the target language for voice synthesis.
                            <br />Not all models support multiple languages.
                        </SettingsTooltip>
                    </label>
                    <div className="w-1/2 px-3">
                        <ThemedSelect
                            value={currentVoiceConfig.language}
                            onChange={handleLanguageSelectionChange}
                            options={modelLanguageOptions[currentVoiceConfig.model] ?
                                modelLanguageOptions[currentVoiceConfig.model].map(opt => ({
                                    label: opt.name,
                                    value: opt.value
                                })) :
                                [{ label: "Default", value: "" }]
                            }
                            placeholder="Select language..."
                        />
                    </div>
                </div>
                <div className="flex items-center mb-6 w-1/2">
                    <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                        Voice
                        <SettingsTooltip tooltipIndex={9} tooltipVisible={() => tooltipVisible}
                            setTooltipVisible={setTooltipVisible}>
                            Select the target voice for voice synthesis.
                            <br />Not all models support output voices.
                        </SettingsTooltip>
                    </label>
                    <div className="w-1/2 px-3">
                        <ThemedSelect
                            value={currentVoiceConfig.voice}
                            onChange={handleVoiceSelectionChange}
                            options={modelVoiceOptions[currentVoiceConfig.model] && modelVoiceOptions[currentVoiceConfig.model][currentVoiceConfig.language] ?
                                modelVoiceOptions[currentVoiceConfig.model][currentVoiceConfig.language].map(opt => ({
                                    label: opt.name,
                                    value: opt.value
                                })) :
                                [{ label: "Default", value: "" }]
                            }
                            placeholder="Select voice..."
                        />
                    </div>
                </div>

                {/* Seed - hide for KittenTTS and Chatterbox */}
                {!isKittenTTSModel(currentVoiceConfig.model) && !isChatterboxModel(currentVoiceConfig.model) && (
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
                )}

                {/* Style - hide for KittenTTS and Chatterbox */}
                {!isKittenTTSModel(currentVoiceConfig.model) && !isChatterboxModel(currentVoiceConfig.model) && (
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
                )}

                {/* Speed - hide for Chatterbox */}
                {!isChatterboxModel(currentVoiceConfig.model) && (
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
                )}

                {/* Pitch - hide for KittenTTS and Chatterbox */}
                {!isKittenTTSModel(currentVoiceConfig.model) && !isChatterboxModel(currentVoiceConfig.model) && (
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
                )}

                {/* Energy - hide for KittenTTS and Chatterbox */}
                {!isKittenTTSModel(currentVoiceConfig.model) && !isChatterboxModel(currentVoiceConfig.model) && (
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
                )}

                {/* Chatterbox-specific generation parameters */}
                {isChatterboxModel(currentVoiceConfig.model) && (
                    <>
                        <div className="flex items-center mb-2 w-full border-t border-neutral-500 mt-4">
                            <h2 className="text-l font-bold text-text-secondary">
                                Chatterbox Parameters
                            </h2>
                        </div>
                        {/* Exaggeration - show for Chatterbox/Chatterbox Multilingual, hide for Turbo */}
                        {isChatterboxTTSModel(currentVoiceConfig.model) && (
                            <div className="flex items-center mb-6 w-1/2">
                                <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                                    Exaggeration
                                    <SettingsTooltip tooltipIndex={10} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        Controls the exaggeration of prosody (0.0-1.0). Higher values make output more expressive.
                                    </SettingsTooltip>
                                </label>
                                <div className="w-1/2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="1"
                                        name="exaggeration"
                                        className="input-field mt-1 block w-full"
                                        placeholder="Exaggeration"
                                        value={currentVoiceConfig.exaggeration}
                                        onChange={(e) =>
                                            setCurrentVoiceConfig({
                                                ...currentVoiceConfig,
                                                exaggeration: parseFloat(e.target.value)
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        )}
                        {/* CFG Weight - show for Chatterbox/Chatterbox Multilingual, hide for Turbo */}
                        {isChatterboxTTSModel(currentVoiceConfig.model) && (
                            <div className="flex items-center mb-6 w-1/2">
                                <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                                    CFG Weight
                                    <SettingsTooltip tooltipIndex={11} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        Classifier-free guidance weight (0.0-1.0). Higher values increase adherence to reference voice.
                                    </SettingsTooltip>
                                </label>
                                <div className="w-1/2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="1"
                                        name="cfg_weight"
                                        className="input-field mt-1 block w-full"
                                        placeholder="CFG Weight"
                                        value={currentVoiceConfig.cfg_weight}
                                        onChange={(e) =>
                                            setCurrentVoiceConfig({
                                                ...currentVoiceConfig,
                                                cfg_weight: parseFloat(e.target.value)
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        )}
                        <div className="flex items-center mb-6 w-1/2">
                            <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                                Temperature
                                <SettingsTooltip tooltipIndex={12} tooltipVisible={() => tooltipVisible}
                                    setTooltipVisible={setTooltipVisible}>
                                    Sampling temperature (0.0-1.0). Higher values increase randomness.
                                </SettingsTooltip>
                            </label>
                            <div className="w-1/2">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="1"
                                    name="temperature"
                                    className="input-field mt-1 block w-full"
                                    placeholder="Temperature"
                                    value={currentVoiceConfig.temperature}
                                    onChange={(e) =>
                                        setCurrentVoiceConfig({
                                            ...currentVoiceConfig,
                                            temperature: parseFloat(e.target.value)
                                        })
                                    }
                                />
                            </div>
                        </div>
                        <div className="flex items-center mb-6 w-1/2">
                            <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                                Repetition Penalty
                                <SettingsTooltip tooltipIndex={13} tooltipVisible={() => tooltipVisible}
                                    setTooltipVisible={setTooltipVisible}>
                                    Penalty for repeating tokens (greater than or equal to 1.0). Higher values reduce repetition.
                                </SettingsTooltip>
                            </label>
                            <div className="w-1/2">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    name="repetition_penalty"
                                    className="input-field mt-1 block w-full"
                                    placeholder="Repetition Penalty"
                                    value={currentVoiceConfig.repetition_penalty}
                                    onChange={(e) =>
                                        setCurrentVoiceConfig({
                                            ...currentVoiceConfig,
                                            repetition_penalty: parseFloat(e.target.value)
                                        })
                                    }
                                />
                            </div>
                        </div>
                        <div className="flex items-center mb-6 w-1/2">
                            <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                                Top P
                                <SettingsTooltip tooltipIndex={14} tooltipVisible={() => tooltipVisible}
                                    setTooltipVisible={setTooltipVisible}>
                                    Nucleus sampling threshold (0.0-1.0). Combined with temperature.
                                </SettingsTooltip>
                            </label>
                            <div className="w-1/2">
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="1"
                                    name="top_p"
                                    className="input-field mt-1 block w-full"
                                    placeholder="Top P"
                                    value={currentVoiceConfig.top_p}
                                    onChange={(e) =>
                                        setCurrentVoiceConfig({
                                            ...currentVoiceConfig,
                                            top_p: parseFloat(e.target.value)
                                        })
                                    }
                                />
                            </div>
                        </div>
                        {/* Min P - show for Chatterbox Turbo */}
                        {isChatterboxTurboModel(currentVoiceConfig.model) && (
                            <div className="flex items-center mb-6 w-1/2">
                                <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                                    Min P
                                    <SettingsTooltip tooltipIndex={15} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        Minimum token probability threshold (0.0-1.0). Filters unlikely tokens.
                                    </SettingsTooltip>
                                </label>
                                <div className="w-1/2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="1"
                                        name="min_p"
                                        className="input-field mt-1 block w-full"
                                        placeholder="Min P"
                                        value={currentVoiceConfig.min_p}
                                        onChange={(e) =>
                                            setCurrentVoiceConfig({
                                                ...currentVoiceConfig,
                                                min_p: parseFloat(e.target.value)
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        )}
                        {/* Top K - show for Chatterbox Turbo */}
                        {isChatterboxTurboModel(currentVoiceConfig.model) && (
                            <div className="flex items-center mb-6 w-1/2">
                                <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                                    Top K
                                    <SettingsTooltip tooltipIndex={16} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        Number of highest probability tokens to consider (integer).
                                    </SettingsTooltip>
                                </label>
                                <div className="w-1/2">
                                    <input
                                        type="number"
                                        step="1"
                                        min="0"
                                        name="top_k"
                                        className="input-field mt-1 block w-full"
                                        placeholder="Top K"
                                        value={currentVoiceConfig.top_k}
                                        onChange={(e) =>
                                            setCurrentVoiceConfig({
                                                ...currentVoiceConfig,
                                                top_k: parseInt(e.target.value)
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        )}
                        {/* Normalize Loudness - show for Chatterbox Turbo */}
                        {isChatterboxTurboModel(currentVoiceConfig.model) && (
                            <div className="flex items-center mb-6 w-1/2">
                                <label className="block text-sm font-medium text-text-secondary w-1/2 px-3">
                                    Normalize Loudness
                                    <SettingsTooltip tooltipIndex={17} tooltipVisible={() => tooltipVisible}
                                        setTooltipVisible={setTooltipVisible}>
                                        Whether to normalize the loudness of the output audio.
                                    </SettingsTooltip>
                                </label>
                                <div className="w-1/2">
                                    <input
                                        type="checkbox"
                                        name="norm_loudness"
                                        className="input-field mt-1"
                                        checked={currentVoiceConfig.norm_loudness}
                                        onChange={(e) =>
                                            setCurrentVoiceConfig({
                                                ...currentVoiceConfig,
                                                norm_loudness: e.target.checked
                                            })
                                        }
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Generate Speech Section */}
                <div className="flex items-center mb-2 w-full">
                    <h2 className="text-l font-bold text-text-secondary">
                        Generate Speech
                        <SettingsTooltip tooltipIndex={18} tooltipVisible={() => tooltipVisible}
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
                            <SettingsTooltip tooltipIndex={19} tooltipVisible={() => tooltipVisible}
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
                                onBlur={(e) => setGenerationText(e.target.value)} />
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
                                <HarmonyAudioPlayer className="w-full" src={generatedAudio} />
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
};

export default VoiceConfigManager;