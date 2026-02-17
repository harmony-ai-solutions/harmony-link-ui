import { PROVIDERS } from "./modules.js";

/**
 * Default configurations for all modules and providers.
 */
export const MODULE_DEFAULTS = {
    backend: {
        [PROVIDERS.OPENAI]: {
            openaiapikey: "",
            model: "gpt-4o",
            maxtokens: 200,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"]
        },
        [PROVIDERS.OPENAI_COMPATIBLE]: {
            baseurl: "http://localhost:8080/v1",
            apikey: "",
            model: "example-model",
            maxtokens: 200,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"]
        },
        [PROVIDERS.OPENROUTER]: {
            openrouterapikey: "",
            model: "google/gemini-flash-2.5",
            maxtokens: 200,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"]
        },
        [PROVIDERS.KAJIWOTO]: {
            username: "",
            password: "",
            kajiroomurl: ""
        },
        [PROVIDERS.KINDROID]: {
            apikey: "",
            kindroidid: ""
        },
        [PROVIDERS.CHARACTERAI]: {
            apitoken: "",
            chatroomurl: ""
        }
    },
    tts: {
        [PROVIDERS.OPENAI]: {
            openaiapikey: "",
            model: "tts-1",
            voice: "alloy",
            speed: 1.0,
            format: "flac"
        },
        [PROVIDERS.HARMONYSPEECH]: {
            endpoint: "https://speech.project-harmony.ai",
            voiceconfigfile: "",
            format: "wav",
            samplerate: 16000,
            stream: false
        },
        [PROVIDERS.ELEVENLABS]: {
            elevenlabsapikey: "",
            voiceid: "",
            modelid: "eleven_monolingual_v1",
            stability: 0.0,
            similarityboost: 0.0,
            style: 0.0,
            speakerboost: false
        },
        [PROVIDERS.KINDROID]: {
            apikey: "",
            kindroidid: ""
        },
        general: {
            outputtype: "file",
            wordstoreplace: {},
            vocalizenonverbal: false
        }
    },
    stt: {
        [PROVIDERS.OPENAI]: {
            openaiapikey: ""
        },
        [PROVIDERS.HARMONYSPEECH]: {
            endpoint: "https://speech.project-harmony.ai",
            model: "faster-whisper-large-v3-turbo"
        },
        general: {
            streamrecording: {
                mainstreamtimemillis: 2000,
                transitionstreamtimemillis: 1000,
                maxbuffercount: 5
            }
        }
    },
    vad: {
        [PROVIDERS.OPENAI]: {
            openaiapikey: ""
        },
        [PROVIDERS.HARMONYSPEECH]: {
            endpoint: "https://speech.project-harmony.ai",
            model: "silero_vad"
        }
    },
    rag: {
        [PROVIDERS.OPENAI]: {
            openaiapikey: "",
            embeddingmodel: "text-embedding-3-small"
        },
        [PROVIDERS.OPENAI_COMPATIBLE]: {
            baseurl: "http://localhost:8080/v1",
            apikey: "",
            embeddingmodel: "default"
        },
        [PROVIDERS.OLLAMA]: {
            baseurl: "http://localhost:11434",
            embeddingmodel: "mxbai-embed-large"
        },
        [PROVIDERS.MISTRAL]: {
            mistralapikey: ""
        },
        [PROVIDERS.LOCALAI]: {
            embeddingmodel: "default"
        },
        chromem: {
            embeddingconcurrency: 4
        },
        general: {
            provider: "disabled"
        }
    },
    cognition: {
        [PROVIDERS.OPENAI]: {
            openaiapikey: "",
            model: "gpt-4o",
            maxtokens: 100,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"]
        },
        [PROVIDERS.OPENAI_COMPATIBLE]: {
            baseurl: "http://127.0.0.1:5000",
            apikey: "",
            model: "example-model",
            maxtokens: 100,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"]
        },
        [PROVIDERS.OPENROUTER]: {
            openrouterapikey: "",
            model: "gpt-4o",
            maxtokens: 100,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"]
        },
        general: {
            maxcognitionevents: 20,
            generateexpressions: true
        }
    },
    movement: {
        [PROVIDERS.OPENAI]: {
            openaiapikey: "",
            model: "gpt-4o",
            maxtokens: 200,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"]
        },
        [PROVIDERS.OPENAI_COMPATIBLE]: {
            baseurl: "http://127.0.0.1:5000",
            apikey: "",
            model: "example-model",
            maxtokens: 200,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"]
        },
        [PROVIDERS.OPENROUTER]: {
            openrouterapikey: "",
            model: "gpt-4o",
            maxtokens: 200,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"]
        },
        general: {
            startupsynctimeout: 30,
            executionthreshold: 0.5
        }
    },
    vision: {
        provider: null,
        resolution_width: 640,
        resolution_height: 480,
        [PROVIDERS.OPENAI]: {
            openaiapikey: "",
            model: "gpt-4o",
            maxtokens: 500,
            temperature: 0.7,
            topp: 1.0,
            n: 1,
            stoptokens: []
        },
        [PROVIDERS.OPENROUTER]: {
            openrouterapikey: "",
            model: "google/gemini-2.0-flash-exp",
            maxtokens: 500,
            temperature: 0.7,
            topp: 1.0,
            n: 1,
            stoptokens: []
        },
        [PROVIDERS.OPENAI_COMPATIBLE]: {
            baseurl: "http://localhost:8080/v1",
            apikey: "",
            model: "",
            maxtokens: 500,
            temperature: 0.7,
            topp: 1.0,
            n: 1,
            stoptokens: []
        }
    }
};
