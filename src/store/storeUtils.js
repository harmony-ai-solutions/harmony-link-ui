/**
 * Utility functions for deep object manipulation in the entity settings store
 */

/**
 * Deep clone an object to avoid reference issues
 * @param {any} obj - Object to clone
 * @returns {any} Deep cloned object
 */
export const deepClone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
};

/**
 * Get a nested value from an object using dot notation
 * @param {object} obj - Object to get value from
 * @param {string} path - Dot notation path (e.g., 'stt.transcription.provider')
 * @returns {any} Value at the specified path
 */
export const deepGet = (obj, path) => {
    if (!obj || !path) return undefined;
    
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return undefined;
        }
        current = current[key];
    }
    
    return current;
};

/**
 * Set a nested value in an object using dot notation
 * @param {object} obj - Object to set value in
 * @param {string} path - Dot notation path (e.g., 'stt.transcription.provider')
 * @param {any} value - Value to set
 */
export const deepSet = (obj, path, value) => {
    if (!obj || !path) return;
    
    const keys = path.split('.');
    let current = obj;
    
    // Navigate to the parent of the target property
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] === null || current[key] === undefined || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
    
    // Set the final value
    current[keys[keys.length - 1]] = value;
};

/**
 * Generate a new unique entity ID
 * @param {object} entities - Current entities object
 * @param {string} baseName - Base name for the entity (default: 'new-entity')
 * @returns {string} Unique entity ID
 */
export const generateNewEntityId = (entities, baseName = 'new-entity') => {
    let newName = baseName;
    let counter = 0;

    while (entities.hasOwnProperty(newName)) {
        counter++;
        newName = `${baseName}-${counter}`;
    }

    return newName;
};

/**
 * Create a default entity template with all module configurations
 * @returns {object} Default entity configuration
 */
export const createEntityTemplate = () => ({
    "backend": {
        "provider": "disabled",
        "kajiwoto": {
            "username": "",
            "password": "",
            "kajiroomurl": ""
        },
        "characterai": {
            "apitoken": "YOUR_CHARACTERAI_API_TOKEN",
            "chatroomurl": ""
        },
        "kindroid": {
            "apikey": "YOUR_KINDROID_API_KEY",
            "kindroidid": ""
        },
        "openaicompatible": {
            "baseurl": "",
            "apikey": "",
            "model": "",
            "maxtokens": 200,
            "temperature": -1.0,
            "topp": -1.0,
            "n": -1,
            "stoptokens": ["\\n"],
            "systemprompts": [
                "Your name is Claire, an AI Assistant optimized for Human-to-Machine interaction.",
                "Humans can talk and interact with you in a metaverse layer where you're controlling your own 3D Avatar.",
                "Your main task is to act as a companion for empathic, supportive and helpful conversation."
            ],
            "userprompts": []
        },
        "openai": {
            "openaiapikey": "YOUR_OPENAI_API_KEY",
            "model": "gpt-3.5-turbo",
            "maxtokens": 100,
            "temperature": -1.0,
            "topp": -1.0,
            "n": -1,
            "stoptokens": ["\\n"],
            "systemprompts": [
                "Your name is Claire, an AI Assistant optimized for Human-to-Machine interaction.",
                "Humans can talk and interact with you in a metaverse layer where you're controlling your own 3D Avatar.",
                "Your main task is to act as a companion for empathic, supportive and helpful conversation."
            ],
            "userprompts": []
        }
    },
    "countenance": {
        "provider": "disabled",
        "openaicompatible": {
            "baseurl": "",
            "apikey": "",
            "model": "",
            "maxtokens": 100,
            "temperature": -1.0,
            "topp": -1.0,
            "n": -1,
            "stoptokens": ["\\n"]
        }
    },
    "movement": {
        "provider": "disabled",
        "openaicompatible": {
            "baseurl": "",
            "apikey": "",
            "model": "",
            "maxtokens": 100,
            "temperature": -1.0,
            "topp": -1.0,
            "n": -1,
            "stoptokens": ["\\n"]
        },
        "startupsynctimeout": 30,
        "executionthreshold": 0.90
    },
    "rag": {
        "provider": "disabled",
        "chromem": {
            "embeddingconcurrency": 0
        },
        "providerlocalai": {
            "embeddingmodel": ""
        },
        "provideropenai": {
            "openaiapikey": "",
            "embeddingmodel": ""
        },
        "provideropenaicompatible": {
            "baseurl": "",
            "apikey": "",
            "embeddingmodel": ""
        },
        "providermistral": {
            "mistralapikey": ""
        },
        "providerollama": {
            "baseurl": "",
            "embeddingmodel": ""
        }
    },
    "stt": {
        "streamrecording": {
            "mainstreamtimemillis": 2000,
            "transitionstreamtimemillis": 2000,
            "maxbuffercount": 5
        },
        "transcription": {
            "provider": "disabled",
            "harmonyspeech": {
                "endpoint": "https://speech.project-harmony.ai",
                "model": "faster-whisper-large-v3-turbo"
            },
            "openai": {
                "openaiapikey": "YOUR_OPENAI_API_KEY"
            }
        },
        "vad": {
            "provider": "disabled",
            "harmonyspeech": {
                "endpoint": "https://speech.project-harmony.ai",
                "model": "faster-whisper-tiny"
            },
            "openai": {
                "openaiapikey": "YOUR_OPENAI_API_KEY"
            }
        }
    },
    "tts": {
        "provider": "disabled",
        "outputtype": "file",
        "wordstoreplace": {},
        "vocalizenonverbal": false,
        "harmonyspeech": {
            "endpoint": "https://speech.project-harmony.ai",
            "voiceconfigfile": "",
            "format": "",
            "samplerate": 0,
            "stream": false
        },
        "elevenlabs": {
            "elevenlabsapikey": "YOUR_ELEVENLABS_API_KEY",
            "voiceid": "",
            "modelid": "eleven_monolingual_v1",
            "stability": 0.0,
            "similarityboost": 0.0,
            "style": 0.0,
            "speakerboost": false
        },
        "openai": {
            "openaiapikey": "YOUR_OPENAI_API_KEY",
            "voice": "alloy",
            "model": "tts-1",
            "speed": 1.00,
            "format": "flac"
        },
        "kindroid": {
            "apikey": "YOUR_KINDROID_API_KEY",
            "kindroidid": ""
        }
    }
});
