import logo_harmony from '../assets/images/harmony-link-icon-256.png';
import logo_cai from '../assets/images/cai_50px.png';
import logo_openai from '../assets/images/ChatGPT_50px.png';
import logo_kajiwoto from '../assets/images/Kajiwoto_106px.png';
import logo_kindroid from '../assets/images/Kindroid_50px.png';
import logo_blank from '../assets/images/blank_50px.png';
import logo_elevenlabs from '../assets/images/elevenlabs_50px.png';
import logo_openrouter from '../assets/images/or_50px.png';
import logo_google from '../assets/images/logo_google.svg';
import logo_xai from '../assets/images/logo_xai.svg';
import logo_anthropic from '../assets/images/logo_anthropic.svg';

export const MODULE_TYPE_OPTIONS = [
    { id: 'backend', name: 'Backend / LLM', emoji: '🧠', description: 'Core AI conversation engine powering character responses and dialogue' },
    { id: 'tts', name: 'Text-to-Speech', emoji: '🗣️', description: 'Converts text responses into spoken audio output' },
    { id: 'stt', name: 'Speech-to-Text', emoji: '🎙️', description: 'Transcribes voice input into text for processing' },
    { id: 'rag', name: 'RAG', emoji: '📚', description: 'Retrieval-Augmented Generation for context-aware knowledge retrieval' },
    { id: 'movement', name: 'Movement', emoji: '💃', description: 'Controls character animations, gestures and physical expressions' },
    { id: 'cognition', name: 'Cognition', emoji: '🧩', description: 'Advanced reasoning, memory consolidation and emotional processing' },
    { id: 'vision', name: 'Vision', emoji: '👁️', description: 'Visual perception and image understanding capabilities' },
    { id: 'imagination', name: 'Imagination', emoji: '🎨', description: 'AI-powered image generation and visual creativity' }
];

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
                    { id: 'openaicompatible', name: 'OpenAI Compatible', logo: logo_openai },
                    { id: 'google', name: 'Google Gemini', logo: logo_google },
                    { id: 'xai', name: 'xAI (Grok)', logo: logo_xai },
                    { id: 'anthropic', name: 'Anthropic (Claude)', logo: logo_anthropic },
                    { id: 'soulbitscloud', name: 'Soulbits Cloud', logo: logo_blank }
                ],
                components: {
                    kajiwoto: 'kajiwoto',
                    openaicompatible: 'openaicompatible',
                    characterai: 'characterai',
                    kindroid: 'kindroid',
                    openai: 'openai',
                    openrouter: 'openrouter',
                    google: 'google',
                    xai: 'xai',
                    anthropic: 'anthropic',
                    soulbitscloud: 'soulbitscloud'
                }
            }
        ]
    },
    cognition: {
        generalSettingsSchema: 'cognition_general',
        providers: [
            {
                id: 'cognition',
                name: 'Cognition Provider',
                settingsKey: 'provider',
                providerOptions: [
                    { id: 'disabled', name: 'Disabled', logo: logo_blank },
                    { id: 'openrouter', name: 'OpenRouter', logo: logo_openrouter },
                    { id: 'openai', name: 'OpenAI', logo: logo_openai },
                    { id: 'openaicompatible', name: 'OpenAI Compatible', logo: logo_openai },
                    { id: 'google', name: 'Google Gemini', logo: logo_google },
                    { id: 'xai', name: 'xAI (Grok)', logo: logo_xai },
                    { id: 'anthropic', name: 'Anthropic (Claude)', logo: logo_anthropic },
                    { id: 'soulbitscloud', name: 'Soulbits Cloud', logo: logo_blank }
                ],
                components: {
                    openaicompatible: 'openaicompatible',
                    openai: 'openai',
                    openrouter: 'openrouter',
                    google: 'google',
                    xai: 'xai',
                    anthropic: 'anthropic',
                    soulbitscloud: 'soulbitscloud'
                }
            }
        ]
    },
    movement: {
        generalSettingsSchema: 'movement_general',
        providers: [
            {
                id: 'movement',
                name: 'Movement Provider',
                settingsKey: 'provider',
                providerOptions: [
                    { id: 'disabled', name: 'Disabled', logo: logo_blank },
                    { id: 'openrouter', name: 'OpenRouter', logo: logo_openrouter },
                    { id: 'openai', name: 'OpenAI', logo: logo_openai },
                    { id: 'openaicompatible', name: 'OpenAI Compatible', logo: logo_openai },
                    { id: 'google', name: 'Google Gemini', logo: logo_google },
                    { id: 'xai', name: 'xAI (Grok)', logo: logo_xai },
                    { id: 'anthropic', name: 'Anthropic (Claude)', logo: logo_anthropic },
                    { id: 'soulbitscloud', name: 'Soulbits Cloud', logo: logo_blank }
                ],
                components: {
                    openaicompatible: 'openaicompatible',
                    openai: 'openai',
                    openrouter: 'openrouter',
                    google: 'google',
                    xai: 'xai',
                    anthropic: 'anthropic',
                    soulbitscloud: 'soulbitscloud'
                }
            }
        ]
    },
    rag: {
        generalSettingsSchema: 'rag_general',
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
                    localai: 'rag_localai',
                    openai: 'rag_openai',
                    openaicompatible: 'rag_openaicompatible',
                    mistral: 'rag_mistral',
                    ollama: 'rag_ollama'
                }
            }
        ]
    },
    stt: {
        generalSettingsSchema: 'stt_general',
        providers: [
            {
                id: 'transcription',
                name: 'Speech Transcription',
                settingsKey: 'transcription.provider',
                providerOptions: [
                    { id: 'disabled', name: 'Disabled', logo: logo_blank },
                    { id: 'harmonyspeech', name: 'Harmony Speech Engine', logo: logo_harmony },
                    { id: 'openai', name: 'OpenAI', logo: logo_openai },
                    { id: 'openrouter', name: 'OpenRouter', logo: logo_openrouter }
                ],
                components: {
                    harmonyspeech: 'harmonyspeech_stt',
                    openai: 'stt_openai',
                    openrouter: 'stt_openrouter'
                }
            },
            {
                id: 'vad',
                name: 'Voice Activity Detection',
                settingsKey: 'vad.provider',
                providerOptions: [
                    { id: 'disabled', name: 'Disabled', logo: logo_blank },
                    { id: 'harmonyspeech', name: 'Harmony Speech Engine', logo: logo_harmony },
                    { id: 'openai', name: 'OpenAI', logo: logo_openai },
                    { id: 'openrouter', name: 'OpenRouter', logo: logo_openrouter }
                ],
                components: {
                    harmonyspeech: 'harmonyspeech_vad',
                    openai: 'vad_openai',
                    openrouter: 'vad_openrouter'
                }
            }
        ]
    },
    tts: {
        generalSettingsSchema: 'tts_general',
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
                    { id: 'kindroid', name: 'Kindroid AI', logo: logo_kindroid },
                    { id: 'openrouter', name: 'OpenRouter', logo: logo_openrouter },
                    { id: 'soulbitscloud', name: 'Soulbits Cloud', logo: logo_blank }
                ],
                components: {
                    elevenlabs: 'elevenlabs',
                    harmonyspeech: 'harmonyspeech_tts',
                    openai: 'tts_openai',
                    kindroid: 'kindroid',
                    openrouter: 'tts_openrouter',
                    soulbitscloud: 'soulbitscloud'
                }
            }
        ]
    },
    imagination: {
        generalSettingsSchema: null,
        providers: [
            {
                id: 'imagination',
                name: 'Image Generation Provider',
                settingsKey: 'provider',
                providerOptions: [
                    { id: 'disabled', name: 'Disabled', logo: logo_blank },
                    { id: 'comfyui', name: 'ComfyUI', logo: logo_blank },
                    { id: 'openai', name: 'OpenAI', logo: logo_openai },
                    { id: 'openrouter', name: 'OpenRouter', logo: logo_openrouter },
                    { id: 'google', name: 'Google Gemini', logo: logo_google },
                    { id: 'xai', name: 'xAI (Grok Imagine)', logo: logo_xai },
                    { id: 'soulbitscloud', name: 'Soulbits Cloud', logo: logo_blank }
                ],
                components: {
                    comfyui: 'comfyui',
                    openai: 'openai_imagination',
                    openrouter: 'imagination_openrouter',
                    google: 'google_imagination',
                    xai: 'xai_imagination',
                    soulbitscloud: 'soulbitscloud'
                }
            }
        ]
    },
    vision: {
        generalSettingsSchema: 'vision_general',
        providers: [
            {
                id: 'vision',
                name: 'Vision Provider',
                settingsKey: 'provider',
                providerOptions: [
                    { id: 'disabled', name: 'Disabled', logo: logo_blank },
                    { id: 'openai', name: 'OpenAI', logo: logo_openai },
                    { id: 'openrouter', name: 'OpenRouter', logo: logo_openrouter },
                    { id: 'openaicompatible', name: 'OpenAI Compatible', logo: logo_openai },
                    { id: 'google', name: 'Google Gemini', logo: logo_google },
                    { id: 'xai', name: 'xAI (Grok)', logo: logo_xai },
                    { id: 'anthropic', name: 'Anthropic (Claude)', logo: logo_anthropic },
                    { id: 'soulbitscloud', name: 'Soulbits Cloud', logo: logo_blank }
                ],
                components: {
                    openai: 'openai',
                    openrouter: 'openrouter',
                    openaicompatible: 'openaicompatible',
                    google: 'google',
                    xai: 'xai',
                    anthropic: 'anthropic',
                    soulbitscloud: 'soulbitscloud'
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