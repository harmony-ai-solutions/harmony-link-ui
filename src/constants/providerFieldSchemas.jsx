import React from 'react';

/**
 * Provider field schemas for the Modular Config Editor.
 * 
 * Each schema defines:
 * - fields: Array of field definitions with key, label, type, placeholder, tooltip, width, labelWidth, validation
 * - hasModelFetch: Boolean — whether this provider supports dynamic model fetching
 * - modelFetchTriggerField: String — which field triggers model refresh
 * - modelFetchProviderField: String — the field key that holds the selected model value
 * 
 * Field definition structure:
 * {
 *     key: 'fieldKey',
 *     label: 'Field Label',
 *     type: 'text' | 'password' | 'number' | 'select' | 'model-select' | 'checkbox' | 'comma-list' | 'key-value-textarea' | 'resolution-input',
 *     placeholder: 'Placeholder text',
 *     tooltip: 'Tooltip content',
 *     width: 'full' | '1/2',
 *     labelWidth: '1/3' | '1/6',
 *     validation: {
 *         type: 'required' | 'range' | 'url' | 'custom',
 *         message: 'Error message',
 *         min?: number,
 *         max?: number,
 *         disableValue?: number,
 *         noZero?: boolean,
 *         validator?: (value, currentSettings) => boolean
 *     }
 * }
 */

// URL regex pattern used throughout the existing components
const URL_REGEX = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?([a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}|localhost|\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3})(:[0-9]{1,5})?(\/.*)?$/;

export const PROVIDER_FIELD_SCHEMAS = {
    /**
     * Character AI provider schema
     * 2 fields: apitoken (password, required), chatroomurl (text, url validation)
     */
    characterai: {
        hasModelFetch: false,
        fields: [
            {
                key: 'apitoken',
                label: 'API Token',
                type: 'password',
                placeholder: 'Character AI API Token',
                tooltip: 'Your Character AI API Token',
                width: 'full',
                labelWidth: '1/3',
                validation: {
                    type: 'required',
                    message: 'API Token cannot be empty.'
                }
            },
            {
                key: 'chatroomurl',
                label: 'Chatroom URL',
                type: 'text',
                placeholder: 'CharacterAI Chatroom URL',
                tooltip: 'Web URL of the C.AI Chatroom you want to link this entity with. You can copy it directly from your browser\'s address bar. This currently only supports Chatrooms with a single AI.',
                width: 'full',
                labelWidth: '1/3',
                validation: {
                    type: 'url',
                    message: 'Chatroom URL must be a valid URL.'
                }
            }
        ]
    },

    /**
     * Kajiwoto provider schema
     * 3 fields: username (text, required), password (password, required), kajiroomurl (text, url validation)
     */
    kajiwoto: {
        hasModelFetch: false,
        fields: [
            {
                key: 'username',
                label: 'Username',
                type: 'text',
                placeholder: 'Kajiwoto Username',
                tooltip: 'Your Kajiwoto Username',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'required',
                    message: 'Username cannot be empty.'
                }
            },
            {
                key: 'password',
                label: 'Password',
                type: 'password',
                placeholder: 'Kajiwoto Password',
                tooltip: 'Your Kajiwoto Password',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'required',
                    message: 'Password cannot be empty.'
                }
            },
            {
                key: 'kajiroomurl',
                label: 'Chatroom URL',
                type: 'text',
                placeholder: 'Kajiwoto Chatroom URL',
                tooltip: 'Web URL of the Kajiwoto Chatroom you want to link this entity with. You can copy it directly from your browser\'s address bar. This currently only supports Chatrooms with a single AI.',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'url',
                    message: 'Kaji room URL must be a valid URL.'
                }
            }
        ]
    },

    /**
     * OpenAI provider schema
     * 7 fields: openaiapikey, model, maxtokens, temperature, topp, n, stoptokens
     */
    openai: {
        hasModelFetch: true,
        modelFetchTriggerField: 'openaiapikey',
        modelFetchProviderField: 'model',
        fields: [
            {
                key: 'openaiapikey',
                label: 'API Key',
                type: 'password',
                placeholder: 'sk-...',
                tooltip: 'Your OpenAI API Key',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'required',
                    message: 'API Key cannot be empty.'
                }
            },
            {
                key: 'model',
                label: 'Model',
                type: 'model-select',
                placeholder: 'Select a model',
                tooltip: 'OpenAI Model you want to use. Models are automatically loaded when you provide a valid API key.',
                width: '1/2',
                labelWidth: '1/3'
            },
            {
                key: 'maxtokens',
                label: 'Max Tokens',
                type: 'number',
                placeholder: '4096',
                tooltip: 'Maximum new tokens to generate per request.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 1,
                    message: 'Max tokens must be at least 1.'
                }
            },
            {
                key: 'temperature',
                label: 'Temperature',
                type: 'number',
                step: 0.01,
                placeholder: '1.0',
                tooltip: 'Temperature defines the likelihood of the model choosing tokens that are outside the context.\nThe higher the temperature, the more likely the model will produce creative or unexpected results.\nSet to -1 to disable.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 0,
                    max: 2,
                    disableValue: -1,
                    message: 'Temperature must be between 0 and 2, or -1 to disable.'
                }
            },
            {
                key: 'topp',
                label: 'Top P',
                type: 'number',
                step: 0.01,
                placeholder: '1.0',
                tooltip: 'Top P defines the probability of the model choosing the most likely next word.\nA higher value means the model is more deterministic, but it also can lead to repetition.\nSet to -1 to disable.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 0,
                    max: 1,
                    disableValue: -1,
                    message: 'Top P must be between 0 and 1, or -1 to disable.'
                }
            },
            {
                key: 'frequencypenalty',
                label: 'Frequency Penalty',
                type: 'number',
                step: 0.01,
                placeholder: '0',
                tooltip: 'Penalizes tokens based on how frequently they have appeared.\nPositive values reduce repetition of frequent tokens.\nRange: -2.0 to 2.0.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: -2,
                    max: 2,
                    message: 'Frequency Penalty must be between -2 and 2.'
                }
            },
            {
                key: 'presencepenalty',
                label: 'Presence Penalty',
                type: 'number',
                step: 0.01,
                placeholder: '0',
                tooltip: 'Penalizes tokens that have already appeared in the text.\nPositive values increase the likelihood of new topics.\nRange: -2.0 to 2.0.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: -2,
                    max: 2,
                    message: 'Presence Penalty must be between -2 and 2.'
                }
            },
            {
                key: 'maxcompletiontokens',
                label: 'Max Completion Tokens',
                type: 'number',
                placeholder: '(use Max Tokens)',
                tooltip: 'Upper bound for total completion tokens (including reasoning tokens).\nIf set, overrides Max Tokens for models that support it.\nLeave empty to use Max Tokens.',
                width: '1/2',
                labelWidth: '1/3'
            },
            {
                key: 'seed',
                label: 'Seed',
                type: 'number',
                placeholder: '(random)',
                tooltip: 'Sets a deterministic seed for sampling.\nUse the same seed and inputs to get reproducible results.\nLeave empty for random.',
                width: '1/2',
                labelWidth: '1/3'
            },
            {
                key: 'responseformat',
                label: 'Response Format',
                type: 'select',
                placeholder: 'Default',
                tooltip: 'Force the model to output a specific format.',
                width: '1/2',
                labelWidth: '1/3',
                options: [
                    { id: '', name: 'Default (text)' },
                    { id: '{"type":"json_object"}', name: 'JSON Object' },
                    { id: '{"type":"text"}', name: 'Text' }
                ]
            },
            {
                key: 'reasoningeffort',
                label: 'Reasoning Effort',
                type: 'select',
                placeholder: 'Default',
                tooltip: 'Controls reasoning effort for reasoning models (o1, o3, etc.).\nHigher values = more thorough reasoning but slower and more expensive.',
                width: '1/2',
                labelWidth: '1/3',
                options: [
                    { id: '', name: 'Default' },
                    { id: 'low', name: 'Low' },
                    { id: 'medium', name: 'Medium' },
                    { id: 'high', name: 'High' }
                ]
            },
            {
                key: 'n',
                label: 'Number of Results',
                type: 'number',
                step: 1,
                placeholder: '1',
                tooltip: 'How many chat completion choices / results to generate per request.\nSet to -1 to disable.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: -1,
                    disableValue: -1,
                    noZero: true,
                    message: 'Number of results must be at least 1, or -1 to disable.'
                }
            },
            {
                key: 'stoptokens',
                label: 'Stop Tokens',
                type: 'comma-list',
                placeholder: 'token1, token2',
                tooltip: 'List of Stop tokens, comma separated.\nIf the model encounters a stop token during generation, it will end the current generation.',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'required',
                    message: 'Stop tokens cannot be empty.'
                }
            }
        ]
    },

    /**
     * OpenAI Compatible provider schema
     * 8 fields: baseurl, apikey, model, maxtokens, temperature, topp, n, stoptokens
     */
    openaicompatible: {
        hasModelFetch: true,
        modelFetchTriggerField: 'baseurl',
        modelFetchProviderField: 'model',
        hasIntegrationSelector: true,
        fields: [
            {
                key: 'baseurl',
                label: 'Base URL',
                type: 'text',
                placeholder: 'https://api.example.com/v1',
                tooltip: 'The base URL for the OpenAI compatible API endpoint.',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'url',
                    message: 'Base URL must be a valid URL.'
                }
            },
            {
                key: 'apikey',
                label: 'API Key',
                type: 'password',
                placeholder: 'Your API Key',
                tooltip: 'Your API Key for the OpenAI compatible service (if required).',
                width: '1/2',
                labelWidth: '1/3'
            },
            {
                key: 'model',
                label: 'Model',
                type: 'model-select',
                placeholder: 'Select a model',
                tooltip: 'OpenAI Compatible Model you want to use. Models are automatically loaded when you provide a valid Base URL.',
                width: '1/2',
                labelWidth: '1/3'
            },
            {
                key: 'maxtokens',
                label: 'Max Tokens',
                type: 'number',
                placeholder: '4096',
                tooltip: 'Maximum new tokens to generate per request.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 1,
                    message: 'Max tokens must be at least 1.'
                }
            },
            {
                key: 'temperature',
                label: 'Temperature',
                type: 'number',
                step: 0.01,
                placeholder: '1.0',
                tooltip: 'Temperature defines the likelihood of the model choosing tokens that are outside the context.\nThe higher the temperature, the more likely the model will produce creative or unexpected results.\nSet to -1 to disable.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 0,
                    max: 2,
                    disableValue: -1,
                    message: 'Temperature must be between 0 and 2, or -1 to disable.'
                }
            },
            {
                key: 'topp',
                label: 'Top P',
                type: 'number',
                step: 0.01,
                placeholder: '1.0',
                tooltip: 'Top P defines the probability of the model choosing the most likely next word.\nA higher value means the model is more deterministic, but it also can lead to repetition.\nSet to -1 to disable.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 0,
                    max: 1,
                    disableValue: -1,
                    message: 'Top P must be between 0 and 1, or -1 to disable.'
                }
            },
            {
                key: 'frequencypenalty',
                label: 'Frequency Penalty',
                type: 'number',
                step: 0.01,
                placeholder: '0',
                tooltip: 'Penalizes tokens based on how frequently they have appeared.\nPositive values reduce repetition of frequent tokens.\nRange: -2.0 to 2.0.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: -2,
                    max: 2,
                    message: 'Frequency Penalty must be between -2 and 2.'
                }
            },
            {
                key: 'presencepenalty',
                label: 'Presence Penalty',
                type: 'number',
                step: 0.01,
                placeholder: '0',
                tooltip: 'Penalizes tokens that have already appeared in the text.\nPositive values increase the likelihood of new topics.\nRange: -2.0 to 2.0.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: -2,
                    max: 2,
                    message: 'Presence Penalty must be between -2 and 2.'
                }
            },
            {
                key: 'maxcompletiontokens',
                label: 'Max Completion Tokens',
                type: 'number',
                placeholder: '(use Max Tokens)',
                tooltip: 'Upper bound for total completion tokens (including reasoning tokens).\nIf set, overrides Max Tokens for models that support it.\nLeave empty to use Max Tokens.',
                width: '1/2',
                labelWidth: '1/3'
            },
            {
                key: 'seed',
                label: 'Seed',
                type: 'number',
                placeholder: '(random)',
                tooltip: 'Sets a deterministic seed for sampling.\nUse the same seed and inputs to get reproducible results.\nLeave empty for random.',
                width: '1/2',
                labelWidth: '1/3'
            },
            {
                key: 'responseformat',
                label: 'Response Format',
                type: 'select',
                placeholder: 'Default',
                tooltip: 'Force the model to output a specific format.',
                width: '1/2',
                labelWidth: '1/3',
                options: [
                    { id: '', name: 'Default (text)' },
                    { id: '{"type":"json_object"}', name: 'JSON Object' },
                    { id: '{"type":"text"}', name: 'Text' }
                ]
            },
            {
                key: 'chattemplatekwargs',
                label: 'Chat Template Kwargs',
                type: 'key-value-list',
                tooltip: 'Additional keyword arguments passed to the chat template.\nUse for provider-specific features like thinking mode.\nExample: enable_thinking = true',
                width: 'full',
                labelWidth: '1/6'
            },
            {
                key: 'n',
                label: 'Number of Results',
                type: 'number',
                step: 1,
                placeholder: '1',
                tooltip: 'How many chat completion choices / results to generate per request.\nSet to -1 to disable.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: -1,
                    disableValue: -1,
                    noZero: true,
                    message: 'Number of results must be at least 1, or -1 to disable.'
                }
            },
            {
                key: 'stoptokens',
                label: 'Stop Tokens',
                type: 'comma-list',
                placeholder: 'token1, token2',
                tooltip: 'List of Stop tokens, comma separated.\nIf the model encounters a stop token during generation, it will end the current generation.',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'required',
                    message: 'Stop tokens cannot be empty.'
                }
            }
        ]
    },

    /**
     * OpenRouter provider schema
     * 7 fields: openrouterapikey, model, maxtokens, temperature, topp, n, stoptokens
     */
    openrouter: {
        hasModelFetch: true,
        modelFetchTriggerField: 'openrouterapikey',
        modelFetchProviderField: 'model',
        fields: [
            {
                key: 'openrouterapikey',
                label: 'API Key',
                type: 'password',
                placeholder: 'sk-or-...',
                tooltip: 'Your OpenRouter API Key',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'required',
                    message: 'API Key cannot be empty.'
                }
            },
            {
                key: 'model',
                label: 'Model',
                type: 'model-select',
                placeholder: 'Select a model',
                tooltip: 'OpenRouter Model you want to use. Models are automatically loaded when you provide a valid API key.',
                width: '1/2',
                labelWidth: '1/3'
            },
            {
                key: 'maxtokens',
                label: 'Max Tokens',
                type: 'number',
                placeholder: '4096',
                tooltip: 'Maximum new tokens to generate per request.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 1,
                    message: 'Max tokens must be at least 1.'
                }
            },
            {
                key: 'temperature',
                label: 'Temperature',
                type: 'number',
                step: 0.01,
                placeholder: '1.0',
                tooltip: 'Temperature defines the likelihood of the model choosing tokens that are outside the context.\nThe higher the temperature, the more likely the model will produce creative or unexpected results.\nSet to -1 to disable.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 0,
                    max: 2,
                    disableValue: -1,
                    message: 'Temperature must be between 0 and 2, or -1 to disable.'
                }
            },
            {
                key: 'topp',
                label: 'Top P',
                type: 'number',
                step: 0.01,
                placeholder: '1.0',
                tooltip: 'Top P defines the probability of the model choosing the most likely next word.\nA higher value means the model is more deterministic, but it also can lead to repetition.\nSet to -1 to disable.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 0,
                    max: 1,
                    disableValue: -1,
                    message: 'Top P must be between 0 and 1, or -1 to disable.'
                }
            },
            {
                key: 'frequencypenalty',
                label: 'Frequency Penalty',
                type: 'number',
                step: 0.01,
                placeholder: '0',
                tooltip: 'Penalizes tokens based on how frequently they have appeared.\nPositive values reduce repetition of frequent tokens.\nRange: -2.0 to 2.0.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: -2,
                    max: 2,
                    message: 'Frequency Penalty must be between -2 and 2.'
                }
            },
            {
                key: 'presencepenalty',
                label: 'Presence Penalty',
                type: 'number',
                step: 0.01,
                placeholder: '0',
                tooltip: 'Penalizes tokens that have already appeared in the text.\nPositive values increase the likelihood of new topics.\nRange: -2.0 to 2.0.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: -2,
                    max: 2,
                    message: 'Presence Penalty must be between -2 and 2.'
                }
            },
            {
                key: 'maxcompletiontokens',
                label: 'Max Completion Tokens',
                type: 'number',
                placeholder: '(use Max Tokens)',
                tooltip: 'Upper bound for total completion tokens (including reasoning tokens).\nIf set, overrides Max Tokens for models that support it.\nLeave empty to use Max Tokens.',
                width: '1/2',
                labelWidth: '1/3'
            },
            {
                key: 'seed',
                label: 'Seed',
                type: 'number',
                placeholder: '(random)',
                tooltip: 'Sets a deterministic seed for sampling.\nUse the same seed and inputs to get reproducible results.\nLeave empty for random.',
                width: '1/2',
                labelWidth: '1/3'
            },
            {
                key: 'responseformat',
                label: 'Response Format',
                type: 'select',
                placeholder: 'Default',
                tooltip: 'Force the model to output a specific format.',
                width: '1/2',
                labelWidth: '1/3',
                options: [
                    { id: '', name: 'Default (text)' },
                    { id: '{"type":"json_object"}', name: 'JSON Object' },
                    { id: '{"type":"text"}', name: 'Text' }
                ]
            },
            {
                key: 'topk',
                label: 'Top K',
                type: 'number',
                placeholder: '(disabled)',
                tooltip: 'Limits sampling to the K most likely tokens.\nLeave empty or set to -1 to disable.',
                width: '1/2',
                labelWidth: '1/3'
            },
            {
                key: 'topa',
                label: 'Top A',
                type: 'number',
                step: 0.01,
                placeholder: '(disabled)',
                tooltip: 'Removes tokens with probability below threshold * max probability.\nRange: 0 to 1. Leave empty to disable.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 0,
                    max: 1,
                    message: 'Top A must be between 0 and 1.'
                }
            },
            {
                key: 'minp',
                label: 'Min P',
                type: 'number',
                step: 0.01,
                placeholder: '(disabled)',
                tooltip: 'Minimum probability threshold relative to max probability.\nRange: 0 to 1. Leave empty to disable.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 0,
                    max: 1,
                    message: 'Min P must be between 0 and 1.'
                }
            },
            {
                key: 'repetitionpenalty',
                label: 'Repetition Penalty',
                type: 'number',
                step: 0.01,
                placeholder: '(disabled)',
                tooltip: 'Penalizes repetition of any token regardless of frequency.\nRange: 0 to 2.0. Values > 1 reduce repetition.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 0,
                    max: 2,
                    message: 'Repetition Penalty must be between 0 and 2.'
                }
            },
            {
                key: 'chattemplatekwargs',
                label: 'Chat Template Kwargs',
                type: 'key-value-list',
                tooltip: 'Additional keyword arguments passed to the chat template.\nUse for provider-specific features like thinking mode.\nExample: enable_thinking = true',
                width: 'full',
                labelWidth: '1/6'
            },
            {
                key: 'n',
                label: 'Number of Results',
                type: 'number',
                step: 1,
                placeholder: '1',
                tooltip: 'How many chat completion choices / results to generate per request.\nSet to -1 to disable.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: -1,
                    disableValue: -1,
                    noZero: true,
                    message: 'Number of results must be at least 1, or -1 to disable.'
                }
            },
            {
                key: 'stoptokens',
                label: 'Stop Tokens',
                type: 'comma-list',
                placeholder: 'token1, token2',
                tooltip: 'List of Stop tokens, comma separated.\nIf the model encounters a stop token during generation, it will end the current generation.',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'required',
                    message: 'Stop tokens cannot be empty.'
                }
            }
        ]
    },

    /**
     * Kindroid provider schema
     * 2 fields: apikey, kindroidid
     */
    kindroid: {
        hasModelFetch: false,
        fields: [
            {
                key: 'apikey',
                label: 'Kindroid API Key',
                type: 'password',
                placeholder: 'Your Kindroid API Key',
                tooltip: 'Your Kindroid AI API Key',
                width: 'full',
                labelWidth: '1/3',
                validation: {
                    type: 'required',
                    message: 'API Key cannot be empty.'
                }
            },
            {
                key: 'kindroidid',
                label: 'Kindroid ID',
                type: 'text',
                placeholder: 'Kindroid Character ID',
                tooltip: 'The ID of the Kindroid character you want to link this entity with.',
                width: 'full',
                labelWidth: '1/3',
                validation: {
                    type: 'required',
                    message: 'Kindroid ID cannot be empty.'
                }
            }
        ]
    },

    /**
     * Elevenlabs TTS provider schema
     * 7 fields: elevenlabsapikey, modelid, voiceid, stability, similarityboost, style, speakerboost
     */
    elevenlabs: {
        hasModelFetch: false,
        fields: [
            {
                key: 'elevenlabsapikey',
                label: 'API Key',
                type: 'password',
                placeholder: 'Your Elevenlabs API Key',
                tooltip: 'Your Elevenlabs API Key',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'required',
                    message: 'API Key cannot be empty.'
                }
            },
            {
                key: 'modelid',
                label: 'Model ID',
                type: 'text',
                placeholder: 'eleven_monolingual_v1',
                tooltip: <span>Name / API ID of the Elevenlabs Model. Please check the <a href="https://elevenlabs.io/docs/api-reference/text-to-speech" target="_blank" rel="noopener noreferrer">Elevenlabs documentation</a> for possible values.</span>,
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'required',
                    message: 'Model ID cannot be empty.'
                }
            },
            {
                key: 'voiceid',
                label: 'Voice ID',
                type: 'text',
                placeholder: '21m00Tcm4TlvDq8ikWAM',
                tooltip: <span>Name / API ID of the Elevenlabs Voice. You can find it on the <a href="https://elevenlabs.io/voice-library" target="_blank" rel="noopener noreferrer">Elevenlabs Website</a>.</span>,
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'required',
                    message: 'Voice ID cannot be empty.'
                }
            },
            {
                key: 'stability',
                label: 'Stability',
                type: 'number',
                step: 0.01,
                placeholder: '0.5',
                tooltip: 'Modifier for Voice Stability.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 0,
                    max: 1,
                    message: 'Stability must be between 0 and 1.'
                }
            },
            {
                key: 'similarityboost',
                label: 'Similarity Boost',
                type: 'number',
                step: 0.01,
                placeholder: '0.5',
                tooltip: 'Modifier for Voice Similarity Boost.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 0,
                    max: 1,
                    message: 'Similarity Boost must be between 0 and 1.'
                }
            },
            {
                key: 'style',
                label: 'Style',
                type: 'number',
                step: 0.01,
                placeholder: '0.5',
                tooltip: 'Modifier for Voice Style.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 0,
                    max: 1,
                    message: 'Style must be between 0 and 1.'
                }
            },
            {
                key: 'speakerboost',
                label: 'Speaker Boost',
                type: 'checkbox',
                tooltip: 'Enables / Disables Speaker Boost.',
                width: '1/2',
                labelWidth: '1/2'
            }
        ]
    },

    /**
     * OpenAI TTS provider schema
     * 5 fields: openaiapikey, model, voice, speed, format
     */
    tts_openai: {
        hasModelFetch: false,
        fields: [
            {
                key: 'openaiapikey',
                label: 'API Key',
                type: 'password',
                placeholder: 'sk-...',
                tooltip: 'Your OpenAI API Key',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'required',
                    message: 'API Key cannot be empty.'
                }
            },
            {
                key: 'model',
                label: 'Model',
                type: 'select',
                placeholder: 'Select a model',
                tooltip: 'OpenAI TTS Model you want to use.',
                width: '1/2',
                labelWidth: '1/3',
                options: [
                    { id: 'tts-1', name: 'TTS-1' },
                    { id: 'tts-1-hd', name: 'TTS-1 HD' }
                ]
            },
            {
                key: 'voice',
                label: 'Voice',
                type: 'text',
                placeholder: 'alloy',
                tooltip: 'Name / ID of the OpenAI Voice.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'required',
                    message: 'Voice cannot be empty.'
                }
            },
            {
                key: 'speed',
                label: 'Speed',
                type: 'number',
                step: 0.01,
                placeholder: '1.0',
                tooltip: 'Modifier for Voice Speed.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'range',
                    min: 0.25,
                    max: 4.0,
                    message: 'Speed must be between 0.25 and 4.0.'
                }
            },
            {
                key: 'format',
                label: 'Output Format',
                type: 'text',
                placeholder: 'mp3',
                tooltip: 'Output File Format of the OpenAI Voice.',
                width: '1/2',
                labelWidth: '1/3'
            }
        ]
    },

    /**
     * OpenAI STT provider schema
     * 1 field: openaiapikey
     */
    stt_openai: {
        hasModelFetch: false,
        fields: [
            {
                key: 'openaiapikey',
                label: 'API Key',
                type: 'password',
                placeholder: 'sk-...',
                tooltip: 'Your OpenAI API Key',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'required',
                    message: 'API Key cannot be empty.'
                }
            }
        ]
    },

    /**
     * OpenAI VAD provider schema
     * 1 field: openaiapikey
     */
    vad_openai: {
        hasModelFetch: false,
        fields: [
            {
                key: 'openaiapikey',
                label: 'OpenAI API Key',
                type: 'password',
                placeholder: 'sk-...',
                tooltip: 'Your OpenAI API Key for Voice Activity Detection.',
                width: 'full',
                labelWidth: '1/6'
            }
        ]
    },

    /**
     * OpenAI RAG provider schema
     * 2 fields: openaiapikey, embeddingmodel
     */
    rag_openai: {
        hasModelFetch: false,
        fields: [
            {
                key: 'openaiapikey',
                label: 'OpenAI API Key',
                type: 'password',
                placeholder: 'sk-...',
                tooltip: 'Your OpenAI API Key for accessing embedding services.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'required',
                    message: 'API Key cannot be empty.'
                }
            },
            {
                key: 'embeddingmodel',
                label: 'Embedding Model',
                type: 'text',
                placeholder: 'text-embedding-3-small',
                tooltip: 'The OpenAI embedding model to use for generating vector embeddings.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'required',
                    message: 'Embedding Model cannot be empty.'
                }
            }
        ]
    },

    /**
     * OpenAI Compatible RAG provider schema
     * 3 fields: baseurl, apikey, embeddingmodel
     */
    rag_openaicompatible: {
        hasModelFetch: false,
        hasIntegrationSelector: true,
        fields: [
            {
                key: 'baseurl',
                label: 'Base URL',
                type: 'text',
                placeholder: 'https://api.example.com/v1',
                tooltip: 'The base URL for the OpenAI compatible API endpoint that provides embedding services.',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'url',
                    message: 'Base URL must be a valid URL.'
                }
            },
            {
                key: 'apikey',
                label: 'API Key',
                type: 'password',
                placeholder: 'Your API Key',
                tooltip: 'Your API Key for the OpenAI compatible embedding service (if required).',
                width: '1/2',
                labelWidth: '1/3'
            },
            {
                key: 'embeddingmodel',
                label: 'Embedding Model',
                type: 'text',
                placeholder: 'embedding-model-name',
                tooltip: 'The name of the embedding model to use.',
                width: '1/2',
                labelWidth: '1/3',
                validation: {
                    type: 'required',
                    message: 'Embedding Model cannot be empty.'
                }
            }
        ]
    },

    /**
     * Ollama RAG provider schema
     * 2 fields: baseurl, embeddingmodel
     */
    rag_ollama: {
        hasModelFetch: false,
        fields: [
            {
                key: 'baseurl',
                label: 'Base URL',
                type: 'text',
                placeholder: 'http://localhost:11434',
                tooltip: 'The base URL for your Ollama instance.',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'url',
                    message: 'Base URL must be a valid URL.'
                }
            },
            {
                key: 'embeddingmodel',
                label: 'Embedding Model',
                type: 'text',
                placeholder: 'nomic-embed-text',
                tooltip: 'The name of the embedding model available in your Ollama instance.',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'required',
                    message: 'Embedding Model cannot be empty.'
                }
            }
        ]
    },

    /**
     * Mistral RAG provider schema
     * 1 field: mistralapikey
     */
    rag_mistral: {
        hasModelFetch: false,
        fields: [
            {
                key: 'mistralapikey',
                label: 'Mistral API Key',
                type: 'password',
                placeholder: 'Your Mistral API Key',
                tooltip: 'Your Mistral API Key for accessing embedding services.',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'required',
                    message: 'API Key cannot be empty.'
                }
            }
        ]
    },

    /**
     * LocalAI RAG provider schema
     * 1 field: embeddingmodel
     */
    rag_localai: {
        hasModelFetch: false,
        fields: [
            {
                key: 'embeddingmodel',
                label: 'Embedding Model',
                type: 'text',
                placeholder: 'embedding-model-name',
                tooltip: 'The name of the embedding model to use with LocalAI.',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'required',
                    message: 'Embedding Model cannot be empty.'
                }
            }
        ]
    },

    // ============================================================
    // General Settings Schemas (Phase 4)
    // ============================================================

    /**
     * Cognition General Settings schema
     * 2 fields: maxcognitionevents, generateexpressions
     */
    cognition_general: {
        hasVerification: false,
        fields: [
            {
                key: 'maxcognitionevents',
                label: 'Max Cognition Events',
                type: 'number',
                width: '1/2',
                labelWidth: '1/3',
                tooltip: 'Maximum number of cognition events to include when building the system prompt.\nHigher values provide more context but increase token usage.',
                validation: {
                    type: 'range',
                    min: 1,
                    message: 'Max Cognition Events must be at least 1.'
                }
            },
            {
                key: 'generateexpressions',
                label: 'Generate Expressions',
                type: 'checkbox',
                width: 'full',
                labelWidth: '1/3',
                tooltip: 'When enabled, the Cognition module will automatically determine the character\'s emotional state and facial expression based on the conversation history.\nThese updates will be sent as events to the Harmony Plugin.'
            }
        ]
    },

    /**
     * TTS General Settings schema
     * 2 fields: vocalizenonverbal, wordstoreplace
     */
    tts_general: {
        hasVerification: false,
        fields: [
            {
                key: 'vocalizenonverbal',
                label: 'Vocalize Nonverbal Interaction',
                type: 'checkbox',
                width: '1/2',
                labelWidth: '1/2',
                tooltip: 'If this option is enabled, Harmony Link will also use TTS to vocalize nonverbal interaction...'
            },
            {
                key: 'wordstoreplace',
                label: 'Words to Replace',
                type: 'key-value-textarea',
                width: '1/2',
                labelWidth: '1/2',
                tooltip: 'Enter a list of words which you want to be replaced in the vocalized output...'
            }
        ]
    },

    /**
     * STT General Settings schema
     * 3 fields: streamrecording.mainstreamtimemillis, streamrecording.transitionstreamtimemillis, streamrecording.maxbuffercount
     */
    stt_general: {
        hasVerification: false,
        fields: [
            {
                key: 'streamrecording.mainstreamtimemillis',
                label: 'Main Stream Time (ms)',
                type: 'number',
                width: '1/2',
                labelWidth: '1/3',
                tooltip: 'Duration of the Primary Recording Stream Chunks in Milliseconds.\n\nCAUTION: It\'s recommended to not change this value unless you know what you\'re doing.',
                validation: {
                    type: 'range',
                    min: 500,
                    message: 'Main Stream Time must be at least 500ms.'
                }
            },
            {
                key: 'streamrecording.transitionstreamtimemillis',
                label: 'Transition Stream Time (ms)',
                type: 'number',
                width: '1/2',
                labelWidth: '1/3',
                tooltip: 'Duration of a chunk buffer transition frame in milliseconds. Needs to be a multiple of Main Stream Time.\n\nCAUTION: Setting this value too low may result in bad speech transcriptions.',
                validation: {
                    type: 'custom',
                    message: 'Duration of the transition stream chunks must be a multiple of the main stream chunks.',
                    validator: (value, allSettings) => {
                        const numValue = parseInt(value, 10);
                        const mainStream = allSettings.streamrecording?.mainstreamtimemillis || 2000;
                        return !isNaN(numValue) && numValue >= 500 && numValue >= mainStream && numValue % mainStream === 0;
                    }
                }
            },
            {
                key: 'streamrecording.maxbuffercount',
                label: 'Transcription Max Buffer Count',
                type: 'number',
                width: '1/2',
                labelWidth: '1/3',
                tooltip: 'Buffer for intermediate transcription processing...',
                validation: {
                    type: 'range',
                    min: 1,
                    message: 'Max Buffer Count must be at least 1.'
                }
            }
        ]
    },

    /**
     * Movement General Settings schema
     * 2 fields: startupsynctimeout, executionthreshold
     */
    movement_general: {
        hasVerification: false,
        fields: [
            {
                key: 'startupsynctimeout',
                label: 'Startup Sync Timeout',
                type: 'number',
                width: '1/2',
                labelWidth: '1/3',
                tooltip: 'This value defines how long the Movement module waits for the Calibration...',
                validation: {
                    type: 'range',
                    min: 3,
                    message: 'Startup Sync Timeout must be at least 3 seconds.'
                }
            },
            {
                key: 'executionthreshold',
                label: 'Execution Threshold',
                type: 'number',
                step: 0.01,
                width: '1/2',
                labelWidth: '1/3',
                tooltip: 'Execution Threshold determines the amount of percentage...',
                validation: {
                    type: 'range',
                    min: 0.01,
                    max: 1.0,
                    message: 'Execution Threshold must be between 0.01 and 1.00.'
                }
            }
        ]
    },

    /**
     * Vision General Settings schema
     * 1 field: resolutionwidth (uses resolution-input composite type)
     */
    vision_general: {
        hasVerification: false,
        fields: [
            {
                key: 'resolutionwidth',
                label: 'Resolution',
                type: 'resolution-input',
                width: 'full',
                labelWidth: '1/6',
                tooltip: 'Resolution settings define the internal image processing dimensions.',
                validation: {
                    type: 'range',
                    min: 1,
                    max: 3840,
                    message: 'Resolution width must be between 1 and 3840.'
                }
            }
        ]
    },

    /**
     * RAG General Settings schema
     * 1 field: chromem.embeddingconcurrency
     */
    rag_general: {
        hasVerification: false,
        defaultPaths: ['general', 'chromem'],
        fields: [
            {
                key: 'chromem.embeddingconcurrency',
                label: 'Embedding Concurrency',
                type: 'number',
                width: '1/2',
                labelWidth: '1/3',
                tooltip: 'Controls how many embedding operations can run concurrently.',
                validation: {
                    type: 'range',
                    min: 1,
                    max: 16,
                    message: 'Embedding Concurrency must be between 1 and 16.'
                }
            }
        ]
    },

    // ============================================================
    // Harmony Speech Engine Schemas (Phase 5)
    // ============================================================

    /**
     * HarmonySpeech TTS provider schema
     * 2 fields: endpoint, voiceconfigfile
     */
    harmonyspeech_tts: {
        hasModelFetch: false,
        hasVoiceConfigManager: true,
        hasIntegrationSelector: true,
        integrationSelectorCondition: 'harmonyLinkMode',
        fields: [
            {
                key: 'endpoint',
                label: 'Endpoint URL',
                type: 'text',
                placeholder: 'https://harmony-speech-engine.example.com',
                tooltip: 'Specify the endpoint for the Harmony Speech Engine API.',
                width: 'full',
                labelWidth: '1/4',
                validation: {
                    type: 'url',
                    message: 'Endpoint URL must be a valid URL.'
                }
            },
            {
                key: 'voiceconfigfile',
                label: 'Voice Configuration',
                type: 'voice-config-manager',
                width: 'full',
                tooltip: ''
            }
        ]
    },

    /**
     * HarmonySpeech STT provider schema
     * 2 fields: endpoint, model
     */
    harmonyspeech_stt: {
        hasIntegrationSelector: true,
        integrationSelectorCondition: 'harmonyLinkMode',
        harmonySpeechMode: 'stt',
        fields: [
            {
                key: 'endpoint',
                label: 'Endpoint',
                type: 'text',
                placeholder: 'https://harmony-speech-engine.example.com',
                tooltip: 'The endpoint URL for the Harmony Speech-To-Text Backend.',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'url',
                    message: 'Endpoint must be a valid URL.'
                }
            },
            {
                key: 'model',
                label: 'Transcription Model',
                type: 'harmonyspeech-model-select',
                placeholder: 'Select model...',
                tooltip: 'Select the AI model to use for speech transcription.',
                width: 'full',
                labelWidth: '1/2'
            }
        ]
    },

    /**
     * HarmonySpeech VAD provider schema
     * 2 fields: endpoint, model
     */
    harmonyspeech_vad: {
        hasIntegrationSelector: true,
        integrationSelectorCondition: 'harmonyLinkMode',
        harmonySpeechMode: 'vad',
        fields: [
            {
                key: 'endpoint',
                label: 'Endpoint',
                type: 'text',
                placeholder: 'https://harmony-speech-engine.example.com',
                tooltip: 'The endpoint URL for the Harmony Speech VAD Backend.',
                width: 'full',
                labelWidth: '1/6',
                validation: {
                    type: 'url',
                    message: 'Endpoint must be a valid URL.'
                }
            },
            {
                key: 'model',
                label: 'VAD Model',
                type: 'harmonyspeech-model-select',
                placeholder: 'Select model...',
                tooltip: 'Select the AI model to use for voice activity detection.',
                width: 'full',
                labelWidth: '1/2'
            }
        ]
    },

    // ============================================================
    // Imagination / ComfyUI Schemas (Phase 6)
    // ============================================================

    /**
     * ComfyUI provider schema
     * 3 fields: baseurl, apikey, workflowprofiles
     */
    comfyui: {
        hasIntegrationSelector: true,
        hasWorkflowProfileEditor: true,
        fields: [
            {
                key: 'baseurl',
                label: 'Base URL',
                type: 'text',
                placeholder: 'http://localhost:3000',
                tooltip: 'ComfyUI API base URL',
                width: 'full',
                labelWidth: '1/4',
                validation: {
                    type: 'url',
                    message: 'Base URL must be a valid URL.'
                }
            },
            {
                key: 'apikey',
                label: 'API Key',
                type: 'password',
                placeholder: '(optional)',
                tooltip: 'ComfyUI API Key (optional)',
                width: 'full',
                labelWidth: '1/4'
            },
            {
                key: 'workflowprofiles',
                label: 'Workflow Profiles',
                type: 'workflow-profile-editor',
                tooltip: '',
                width: 'full'
            }
        ]
    }
};

// Helper function to validate field value based on validation rule
export const validateField = (value, validation, currentSettings, fieldKey) => {
    if (!validation) return { valid: true };

    switch (validation.type) {
        case 'required':
            // Check if field must not be empty when it previously had a value
            // The fieldKey is passed explicitly since validation object doesn't contain it
            const previousValue = currentSettings?.[fieldKey];
            const hasPreviousValue = previousValue && previousValue.length > 0;
            const isEmpty = value.trim() === '';
            if (hasPreviousValue && isEmpty) {
                return { valid: false, message: validation.message };
            }
            return { valid: true };

        case 'range':
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                return { valid: false, message: 'Value must be a number.' };
            }
            // Allow disableValue (e.g., -1) to pass regardless of min/max bounds
            if (validation.disableValue !== undefined && numValue === validation.disableValue) {
                return { valid: true };
            }
            if (validation.min !== undefined && numValue < validation.min) {
                return { valid: false, message: `Value must be at least ${validation.min}.` };
            }
            if (validation.max !== undefined && numValue > validation.max) {
                return { valid: false, message: `Value must be at most ${validation.max}.` };
            }
            if (validation.noZero && numValue === 0) {
                return { valid: false, message: 'Value cannot be zero.' };
            }
            return { valid: true };

        case 'url':
            // URL is optional - only validate if value is present
            if (!value || value.length === 0) {
                return { valid: true };
            }
            if (!URL_REGEX.test(value)) {
                return { valid: false, message: validation.message };
            }
            return { valid: true };

        case 'custom':
            if (validation.validator && typeof validation.validator === 'function') {
                const isValid = validation.validator(value, currentSettings);
                if (!isValid) {
                    return { valid: false, message: validation.message };
                }
            }
            return { valid: true };

        default:
            return { valid: true };
    }
};

// Export URL_REGEX for use in other modules
export { URL_REGEX };