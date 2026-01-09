/**
 * Centralized validation rules for entity settings
 * Provides consistent validation logic across all components
 */

/**
 * URL validation regex pattern
 */
const URL_REGEX = /^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?([a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}|localhost|\d{1,3}.\d{1,3}.\d{1,3}.\d{1,3})(:[0-9]{1,5})?(\/.*)?$/;

/**
 * Email validation regex pattern
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * API key validation patterns
 */
const API_KEY_PATTERNS = {
    openai: /^sk-[a-zA-Z0-9]{48}$/,
    elevenlabs: /^[a-f0-9]{32}$/,
    // Add more patterns as needed
};

/**
 * Validation rule definitions
 */
export const validationRules = {
    // Required field validation
    required: (value, fieldName = 'Field') => {
        if (value === null || value === undefined || value === '') {
            return `${fieldName} is required`;
        }
        return null;
    },
    
    // Non-empty string validation
    nonEmpty: (value, fieldName = 'Field') => {
        if (typeof value === 'string' && value.trim() === '') {
            return `${fieldName} cannot be empty`;
        }
        return null;
    },
    
    // URL validation
    url: (value, fieldName = 'URL') => {
        if (value && typeof value === 'string' && value.length > 0) {
            if (!URL_REGEX.test(value)) {
                return `${fieldName} must be a valid URL`;
            }
        }
        return null;
    },
    
    // Email validation
    email: (value, fieldName = 'Email') => {
        if (value && typeof value === 'string' && value.length > 0) {
            if (!EMAIL_REGEX.test(value)) {
                return `${fieldName} must be a valid email address`;
            }
        }
        return null;
    },
    
    // Number validation
    number: (value, fieldName = 'Number') => {
        if (value !== null && value !== undefined && value !== '') {
            const num = Number(value);
            if (isNaN(num)) {
                return `${fieldName} must be a valid number`;
            }
        }
        return null;
    },
    
    // Positive number validation
    positiveNumber: (value, fieldName = 'Number') => {
        const numberError = validationRules.number(value, fieldName);
        if (numberError) return numberError;
        
        if (value !== null && value !== undefined && value !== '') {
            const num = Number(value);
            if (num <= 0) {
                return `${fieldName} must be a positive number`;
            }
        }
        return null;
    },
    
    // Range validation
    range: (min, max) => (value, fieldName = 'Number') => {
        const numberError = validationRules.number(value, fieldName);
        if (numberError) return numberError;
        
        if (value !== null && value !== undefined && value !== '') {
            const num = Number(value);
            if (num < min || num > max) {
                return `${fieldName} must be between ${min} and ${max}`;
            }
        }
        return null;
    },
    
    // Minimum length validation
    minLength: (minLen) => (value, fieldName = 'Field') => {
        if (value && typeof value === 'string' && value.length < minLen) {
            return `${fieldName} must be at least ${minLen} characters long`;
        }
        return null;
    },
    
    // Maximum length validation
    maxLength: (maxLen) => (value, fieldName = 'Field') => {
        if (value && typeof value === 'string' && value.length > maxLen) {
            return `${fieldName} must be no more than ${maxLen} characters long`;
        }
        return null;
    },
    
    // API key validation
    apiKey: (provider) => (value, fieldName = 'API Key') => {
        if (value && typeof value === 'string' && value.length > 0) {
            const pattern = API_KEY_PATTERNS[provider];
            if (pattern && !pattern.test(value)) {
                return `${fieldName} format is invalid for ${provider}`;
            }
        }
        return null;
    },
    
    // Entity name validation
    entityName: (value, existingNames = [], currentName = null) => {
        // Check if empty
        if (!value || value.trim() === '') {
            return 'Entity name cannot be empty';
        }
        
        // Check for duplicate names (excluding current name)
        if (existingNames.includes(value) && value !== currentName) {
            return 'Entity name already exists';
        }
        
        // Check for invalid characters
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
            return 'Entity name can only contain letters, numbers, hyphens, and underscores';
        }
        
        return null;
    }
};

/**
 * Module-specific validation configurations
 */
export const moduleValidationConfig = {
    backend: {
        openai: {
            openaiapikey: [validationRules.required, validationRules.nonEmpty],
            model: [validationRules.required, validationRules.nonEmpty],
            maxtokens: [validationRules.positiveNumber],
            temperature: [validationRules.range(-2, 2)],
            topp: [validationRules.range(0, 1)]
        },
        openaicompatible: {
            baseurl: [validationRules.required, validationRules.url],
            apikey: [validationRules.required, validationRules.nonEmpty],
            model: [validationRules.required, validationRules.nonEmpty],
            maxtokens: [validationRules.positiveNumber],
            temperature: [validationRules.range(-2, 2)],
            topp: [validationRules.range(0, 1)]
        },
        characterai: {
            apitoken: [validationRules.required, validationRules.nonEmpty],
            chatroomurl: [validationRules.required, validationRules.url]
        },
        kajiwoto: {
            username: [validationRules.required, validationRules.nonEmpty],
            password: [validationRules.required, validationRules.nonEmpty],
            kajiroomurl: [validationRules.required, validationRules.url]
        },
        kindroid: {
            apikey: [validationRules.required, validationRules.nonEmpty],
            kindroidid: [validationRules.required, validationRules.nonEmpty]
        }
    },
    
    stt: {
        transcription: {
            harmonyspeech: {
                endpoint: [validationRules.required, validationRules.url],
                model: [validationRules.required, validationRules.nonEmpty]
            },
            openai: {
                openaiapikey: [validationRules.required, validationRules.nonEmpty]
            }
        },
        vad: {
            harmonyspeech: {
                endpoint: [validationRules.required, validationRules.url],
                model: [validationRules.required, validationRules.nonEmpty]
            },
            openai: {
                openaiapikey: [validationRules.required, validationRules.nonEmpty]
            }
        }
    },
    
    tts: {
        harmonyspeech: {
            endpoint: [validationRules.required, validationRules.url]
        },
        elevenlabs: {
            elevenlabsapikey: [validationRules.required, validationRules.nonEmpty],
            voiceid: [validationRules.required, validationRules.nonEmpty],
            stability: [validationRules.range(0, 1)],
            similarityboost: [validationRules.range(0, 1)],
            style: [validationRules.range(0, 1)]
        },
        openai: {
            openaiapikey: [validationRules.required, validationRules.nonEmpty],
            voice: [validationRules.required, validationRules.nonEmpty],
            speed: [validationRules.range(0.25, 4.0)]
        },
        kindroid: {
            apikey: [validationRules.required, validationRules.nonEmpty],
            kindroidid: [validationRules.required, validationRules.nonEmpty]
        }
    },
    
    cognition: {
        openaicompatible: {
            baseurl: [validationRules.required, validationRules.url],
            apikey: [validationRules.required, validationRules.nonEmpty],
            model: [validationRules.required, validationRules.nonEmpty],
            maxtokens: [validationRules.positiveNumber],
            temperature: [validationRules.range(-2, 2)],
            topp: [validationRules.range(0, 1)]
        }
    },
    
    movement: {
        openaicompatible: {
            baseurl: [validationRules.required, validationRules.url],
            apikey: [validationRules.required, validationRules.nonEmpty],
            model: [validationRules.required, validationRules.nonEmpty],
            maxtokens: [validationRules.positiveNumber],
            temperature: [validationRules.range(-2, 2)],
            topp: [validationRules.range(0, 1)]
        },
        startupsynctimeout: [validationRules.positiveNumber],
        executionthreshold: [validationRules.range(0, 1)]
    },
    
    rag: {
        chromem: {
            embeddingconcurrency: [validationRules.number]
        },
        provideropenai: {
            openaiapikey: [validationRules.required, validationRules.nonEmpty],
            embeddingmodel: [validationRules.required, validationRules.nonEmpty]
        },
        provideropenaicompatible: {
            baseurl: [validationRules.required, validationRules.url],
            apikey: [validationRules.required, validationRules.nonEmpty],
            embeddingmodel: [validationRules.required, validationRules.nonEmpty]
        },
        providermistral: {
            mistralapikey: [validationRules.required, validationRules.nonEmpty]
        },
        providerollama: {
            baseurl: [validationRules.required, validationRules.url],
            embeddingmodel: [validationRules.required, validationRules.nonEmpty]
        },
        providerlocalai: {
            embeddingmodel: [validationRules.required, validationRules.nonEmpty]
        }
    }
};

/**
 * Validate a single field value
 * @param {string} moduleId - Module identifier
 * @param {string} providerId - Provider identifier
 * @param {string} fieldName - Field name
 * @param {any} value - Field value
 * @returns {string|null} Error message or null if valid
 */
export const validateField = (moduleId, providerId, fieldName, value) => {
    const moduleConfig = moduleValidationConfig[moduleId];
    if (!moduleConfig) return null;
    
    const providerConfig = moduleConfig[providerId];
    if (!providerConfig) return null;
    
    const fieldRules = providerConfig[fieldName];
    if (!fieldRules) return null;
    
    // Run all validation rules for this field
    for (const rule of fieldRules) {
        const error = rule(value, fieldName);
        if (error) return error;
    }
    
    return null;
};

/**
 * Validate all fields in a provider configuration
 * @param {string} moduleId - Module identifier
 * @param {string} providerId - Provider identifier
 * @param {object} settings - Provider settings object
 * @returns {object} Object with field names as keys and error messages as values
 */
export const validateProviderSettings = (moduleId, providerId, settings) => {
    const errors = {};
    const moduleConfig = moduleValidationConfig[moduleId];
    
    if (!moduleConfig || !moduleConfig[providerId]) {
        return errors;
    }
    
    const providerConfig = moduleConfig[providerId];
    
    // Validate each configured field
    Object.entries(providerConfig).forEach(([fieldName, rules]) => {
        const value = settings[fieldName];
        
        for (const rule of rules) {
            const error = rule(value, fieldName);
            if (error) {
                errors[fieldName] = error;
                break; // Stop at first error for this field
            }
        }
    });
    
    return errors;
};

/**
 * Validate an entire entity configuration
 * @param {object} entityConfig - Complete entity configuration
 * @param {string} entityId - Entity identifier for error context
 * @returns {object} Object with paths as keys and error messages as values
 */
export const validateEntityConfig = (entityConfig, entityId) => {
    const errors = {};
    
    // Validate each module
    Object.entries(entityConfig).forEach(([moduleId, moduleConfig]) => {
        if (typeof moduleConfig !== 'object' || !moduleConfig) return;
        
        // Check if module has a provider
        const provider = moduleConfig.provider;
        if (!provider || provider === 'disabled') return;
        
        // Validate provider-specific settings
        const providerSettings = moduleConfig[provider];
        if (providerSettings) {
            const providerErrors = validateProviderSettings(moduleId, provider, providerSettings);
            
            // Add errors with full path
            Object.entries(providerErrors).forEach(([fieldName, error]) => {
                const path = `${moduleId}.${provider}.${fieldName}`;
                errors[path] = error;
            });
        }
        
        // Validate module-level settings (like movement.executionthreshold)
        const moduleValidation = moduleValidationConfig[moduleId];
        if (moduleValidation) {
            Object.entries(moduleValidation).forEach(([fieldName, rules]) => {
                // Skip provider-specific configurations
                if (typeof moduleConfig[fieldName] === 'object') return;
                
                const value = moduleConfig[fieldName];
                if (value !== undefined) {
                    for (const rule of rules) {
                        const error = rule(value, fieldName);
                        if (error) {
                            const path = `${moduleId}.${fieldName}`;
                            errors[path] = error;
                            break;
                        }
                    }
                }
            });
        }
    });
    
    return errors;
};

/**
 * Check if a provider is enabled for a module
 * @param {object} moduleConfig - Module configuration
 * @returns {boolean} True if provider is enabled
 */
export const isProviderEnabled = (moduleConfig) => {
    return moduleConfig && moduleConfig.provider && moduleConfig.provider !== 'disabled';
};

/**
 * Get human-readable field names for display
 */
export const fieldDisplayNames = {
    openaiapikey: 'OpenAI API Key',
    elevenlabsapikey: 'ElevenLabs API Key',
    mistralapikey: 'Mistral API Key',
    baseurl: 'Base URL',
    apikey: 'API Key',
    endpoint: 'Endpoint',
    model: 'Model',
    embeddingmodel: 'Embedding Model',
    maxtokens: 'Max Tokens',
    temperature: 'Temperature',
    topp: 'Top P',
    voiceid: 'Voice ID',
    stability: 'Stability',
    similarityboost: 'Similarity Boost',
    style: 'Style',
    speed: 'Speed',
    chatroomurl: 'Chat Room URL',
    kajiroomurl: 'Kaji Room URL',
    username: 'Username',
    password: 'Password',
    kindroidid: 'Kindroid ID',
    voice: 'Voice',
    startupsynctimeout: 'Startup Sync Timeout',
    executionthreshold: 'Execution Threshold',
    embeddingconcurrency: 'Embedding Concurrency'
};

/**
 * Get display name for a field
 * @param {string} fieldName - Field name
 * @returns {string} Human-readable field name
 */
export const getFieldDisplayName = (fieldName) => {
    return fieldDisplayNames[fieldName] || fieldName;
};
