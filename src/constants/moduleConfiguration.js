import logo_harmony from '../assets/images/harmony-link-icon-256.png';
import logo_cai from '../assets/images/cai_50px.png';
import logo_openai from '../assets/images/ChatGPT_50px.png';
import logo_kajiwoto from '../assets/images/Kajiwoto_106px.png';
import logo_kindroid from '../assets/images/Kindroid_50px.png';
import logo_blank from '../assets/images/blank_50px.png';
import logo_elevenlabs from '../assets/images/elevenlabs_50px.png';
import logo_openrouter from '../assets/images/or_50px.png';

export const MODULE_CONFIGS = {
    backend: {
        generalSettingsComponent: null,
        providers: [
            {
                id: 'backend',
                name: 'AI Backend Provider',
                settingsKey: 'provider',
                providerOptions: [
                    { id: 'disabled', name: 'Disabled', logo: logo_blank },
                    { id: 'openrouter', name: 'OpenRouter', logo: logo_openrouter },
                    { id: 'openai', name: 'OpenAI', logo: logo_openai },
                    { id: 'kajiwoto', name: 'Kajiwoto AI', logo: logo_kajiwoto },
                    { id: 'characterai', name: 'Character AI', logo: logo_cai },
                    { id: 'kindroid', name: 'Kindroid AI', logo: logo_kindroid },
                    { id: 'openaicompatible', name: 'OpenAI Compatible', logo: logo_openai }
                ],
                components: {
                    kajiwoto: 'BackendKajiwotoSettingsView',
                    openaicompatible: 'BackendOpenAICompatibleSettingsView',
                    characterai: 'BackendCharacterAISettingsView',
                    kindroid: 'BackendKindroidSettingsView',
                    openai: 'BackendOpenAISettingsView'
                }
            }
        ]
    },
    countenance: {
        generalSettingsComponent: null,
        providers: [
            {
                id: 'countenance',
                name: 'Countenance Provider',
                settingsKey: 'provider',
                providerOptions: [
                    { id: 'disabled', name: 'Disabled', logo: logo_blank },
                    { id: 'openrouter', name: 'OpenRouter', logo: logo_openrouter },
                    { id: 'openai', name: 'OpenAI', logo: logo_openai },
                    { id: 'openaicompatible', name: 'OpenAI Compatible', logo: logo_openai }
                ],
                components: {
                    openaicompatible: 'CountenanceOpenAICompatibleSettingsView',
                    openai: 'CountenanceOpenAISettingsView'
                }
            }
        ]
    },
    movement: {
        generalSettingsComponent: 'MovementGeneralSettingsView',
        providers: [
            {
                id: 'movement',
                name: 'Movement Provider',
                settingsKey: 'provider',
                providerOptions: [
                    { id: 'disabled', name: 'Disabled', logo: logo_blank },
                    { id: 'openrouter', name: 'OpenRouter', logo: logo_openrouter },
                    { id: 'openai', name: 'OpenAI', logo: logo_openai },
                    { id: 'openaicompatible', name: 'OpenAI Compatible', logo: logo_openai }
                ],
                components: {
                    openaicompatible: 'MovementOpenAICompatibleSettingsView',
                    openai: 'MovementOpenAISettingsView'
                }
            }
        ]
    },
    rag: {
        generalSettingsComponent: 'RAGGeneralSettingsView',
        providers: [
            {
                id: 'rag',
                name: 'RAG Provider',
                settingsKey: 'provider',
                providerOptions: [
                    { id: 'disabled', name: 'Disabled', logo: logo_blank },
                    { id: 'localai', name: 'LocalAI', logo: logo_blank },
                    { id: 'openai', name: 'OpenAI', logo: logo_openai },
                    { id: 'openaicompatible', name: 'OpenAI Compatible', logo: logo_openai },
                    { id: 'mistral', name: 'Mistral', logo: logo_blank },
                    { id: 'ollama', name: 'Ollama', logo: logo_blank }
                ],
                components: {
                    localai: 'RAGLocalAISettingsView',
                    openai: 'RAGOpenAISettingsView',
                    openaicompatible: 'RAGOpenAICompatibleSettingsView',
                    mistral: 'RAGMistralSettingsView',
                    ollama: 'RAGOllamaSettingsView'
                }
            }
        ]
    },
    stt: {
        generalSettingsComponent: 'STTGeneralSettingsView',
        providers: [
            {
                id: 'transcription',
                name: 'Speech Transcription',
                settingsKey: 'transcription.provider',
                providerOptions: [
                    { id: 'disabled', name: 'Disabled', logo: logo_blank },
                    { id: 'harmonyspeech', name: 'Harmony Speech Engine', logo: logo_harmony },
                    { id: 'openai', name: 'OpenAI', logo: logo_openai }
                ],
                components: {
                    harmonyspeech: 'STTHarmonySpeechSettingsView',
                    openai: 'STTOpenAISettingsView'
                }
            },
            {
                id: 'vad',
                name: 'Voice Activity Detection',
                settingsKey: 'vad.provider',
                providerOptions: [
                    { id: 'disabled', name: 'Disabled', logo: logo_blank },
                    { id: 'harmonyspeech', name: 'Harmony Speech Engine', logo: logo_harmony },
                    { id: 'openai', name: 'OpenAI', logo: logo_openai }
                ],
                components: {
                    harmonyspeech: 'VADHarmonySpeechSettingsView',
                    openai: 'VADOpenAISettingsView'
                }
            }
        ]
    },
    tts: {
        generalSettingsComponent: 'TTSGeneralSettingsView',
        providers: [
            {
                id: 'tts',
                name: 'Text-to-Speech Provider',
                settingsKey: 'provider',
                providerOptions: [
                    { id: 'disabled', name: 'Disabled', logo: logo_blank },
                    { id: 'elevenlabs', name: 'Elevenlabs', logo: logo_elevenlabs },
                    { id: 'harmonyspeech', name: 'Harmony Speech Engine', logo: logo_harmony },
                    { id: 'openai', name: 'OpenAI', logo: logo_openai },
                    { id: 'kindroid', name: 'Kindroid AI', logo: logo_kindroid }
                ],
                components: {
                    elevenlabs: 'TTSElevenlabsSettingsView',
                    harmonyspeech: 'TTSHarmonySpeechSettingsView',
                    openai: 'TTSOpenAISettingsView',
                    kindroid: 'TTSKindroidSettingsView'
                }
            }
        ]
    }
};

// Helper function to get nested property value using dot notation
export const getNestedValue = (obj, path) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
};

// Helper function to set nested property value using dot notation
export const setNestedValue = (obj, path, value) => {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
        if (!current[key]) current[key] = {};
        return current[key];
    }, obj);
    target[lastKey] = value;
};
