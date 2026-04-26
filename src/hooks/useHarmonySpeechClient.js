import { useState, useEffect, useCallback } from 'react';
import { HarmonySpeechEnginePlugin } from '@harmony-ai/harmonyspeech';
import { getConfig } from '../services/management/configService.js';
import { isHarmonyLinkMode } from '../config/appMode.js';
import { LogError } from '../utils/logger.js';

// Known model names for display
const TTS_MODEL_NAMES = {
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

const STT_MODEL_NAMES = {
    "faster-whisper-large-v3-turbo": "FasterWhisper Large v3 Turbo",
    "faster-whisper-large-v3": "FasterWhisper Large v3",
    "faster-whisper-medium": "FasterWhisper Medium",
    "faster-whisper-tiny": "FasterWhisper Tiny",
};

/**
 * Custom hook for managing HarmonySpeech client and model fetching.
 * 
 * @param {string} endpoint - The endpoint URL for the Harmony Speech Engine API
 * @param {string} mode - The mode: 'tts', 'stt', or 'vad'
 * @returns {object} Hook interface with plugin, model options, and refresh function
 */
const useHarmonySpeechClient = (endpoint, mode) => {
    const [harmonySpeechPlugin, setHarmonySpeechPlugin] = useState(null);
    const [modelOptions, setModelOptions] = useState([
        { name: "Loading models...", value: null }
    ]);
    const [modelLanguageOptions, setModelLanguageOptions] = useState({});
    const [modelVoiceOptions, setModelVoiceOptions] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Refresh models based on mode
    const refreshModels = useCallback(async (client) => {
        if (!client) {
            LogError("Harmony Speech Client not initialized");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            let result;
            
            if (mode === 'tts') {
                result = await client.showAvailableSpeechModels();
                parseTTSModels(result);
            } else if (mode === 'stt') {
                result = await client.showAvailableTranscriptionModels();
                parseSTTModels(result);
            } else if (mode === 'vad') {
                result = await client.showAvailableVoiceActivityDetectionModels();
                parseVADModels(result);
            }
        } catch (err) {
            LogError(`Failed to fetch ${mode} models:`, err);
            setError(err.message);
            setModelOptions([{ name: "Error loading models", value: null }]);
        } finally {
            setIsLoading(false);
        }
    }, [mode]);

    // Parse TTS models (toolchains with languages and voices)
    const parseTTSModels = (result) => {
        const newModelOptions = [];
        const newModelLanguageOptions = {};
        const newModelVoiceOptions = {};

        if (!result?.data) {
            setModelOptions([{ name: "No models available", value: null }]);
            return;
        }

        result.data.forEach((model) => {
            if (model.object === "toolchain" || model.id in TTS_MODEL_NAMES) {
                // Add model to options
                if (model.id in TTS_MODEL_NAMES) {
                    newModelOptions.push({ name: TTS_MODEL_NAMES[model.id], value: model.id });
                } else {
                    newModelOptions.push({ name: model.id, value: model.id });
                }

                // Fetch language options
                if (model.languages && model.languages.length > 0) {
                    if (!newModelLanguageOptions[model.id]) {
                        newModelLanguageOptions[model.id] = [];
                    }
                    if (!newModelVoiceOptions[model.id]) {
                        newModelVoiceOptions[model.id] = {};
                    }

                    model.languages.forEach((langOption) => {
                        newModelLanguageOptions[model.id].push({
                            name: langOption.language,
                            value: langOption.language
                        });

                        // Fetch voice options for language
                        if (langOption.voices && langOption.voices.length > 0) {
                            if (!newModelVoiceOptions[model.id][langOption.language]) {
                                newModelVoiceOptions[model.id][langOption.language] = [];
                            }
                            langOption.voices.forEach((voiceOption) => {
                                newModelVoiceOptions[model.id][langOption.language].push({
                                    name: voiceOption.voice,
                                    value: voiceOption.voice
                                });
                            });
                        }
                    });
                }
            }
        });

        if (newModelOptions.length === 0) {
            newModelOptions.push({ name: "No models available", value: null });
        }

        setModelOptions(newModelOptions);
        setModelLanguageOptions(newModelLanguageOptions);
        setModelVoiceOptions(newModelVoiceOptions);
    };

    // Parse STT models
    const parseSTTModels = (result) => {
        const newModelOptions = [];

        if (!result?.data) {
            setModelOptions([{ name: "No models available", value: null }]);
            return;
        }

        result.data.forEach((model) => {
            if (model.object === "model") {
                if (model.id in STT_MODEL_NAMES) {
                    newModelOptions.push({ name: STT_MODEL_NAMES[model.id], value: model.id });
                } else {
                    newModelOptions.push({ name: model.id, value: model.id });
                }
            }
        });

        if (newModelOptions.length === 0) {
            newModelOptions.push({ name: "No models available", value: null });
        }

        setModelOptions(newModelOptions);
    };

    // Parse VAD models
    const parseVADModels = (result) => {
        const newModelOptions = [];

        if (!result?.data) {
            setModelOptions([{ name: "No models available", value: null }]);
            return;
        }

        result.data.forEach((model) => {
            if (model.object === "model") {
                if (model.id in STT_MODEL_NAMES) {
                    newModelOptions.push({ name: STT_MODEL_NAMES[model.id], value: model.id });
                } else {
                    newModelOptions.push({ name: model.id, value: model.id });
                }
            }
        });

        if (newModelOptions.length === 0) {
            newModelOptions.push({ name: "No models available", value: null });
        }

        setModelOptions(newModelOptions);
    };

    // Initialize plugin and fetch models
    useEffect(() => {
        let isMounted = true;
        let plugin = null;

        const initializePlugin = async () => {
            if (!endpoint) {
                setModelOptions([{ name: "No endpoint configured", value: null }]);
                setIsLoading(false);
                return;
            }

            try {
                let apiKey = '';
                
                if (isHarmonyLinkMode()) {
                    const appConfig = await getConfig();
                    apiKey = appConfig.general?.userapikey || '';
                }

                plugin = new HarmonySpeechEnginePlugin(apiKey, endpoint);
                
                if (isMounted) {
                    setHarmonySpeechPlugin(plugin);
                    await refreshModels(plugin);
                }
            } catch (err) {
                LogError("Failed to initialize Harmony Speech plugin:", err);
                if (isMounted) {
                    setError(err.message);
                    setModelOptions([{ name: "Error initializing plugin", value: null }]);
                    setIsLoading(false);
                }
            }
        };

        initializePlugin();

        return () => {
            isMounted = false;
        };
    }, [endpoint, mode, refreshModels]);

    return {
        harmonySpeechPlugin,
        modelOptions,
        modelLanguageOptions,
        modelVoiceOptions,
        refreshModels: () => refreshModels(harmonySpeechPlugin),
        isLoading,
        error
    };
};

export default useHarmonySpeechClient;