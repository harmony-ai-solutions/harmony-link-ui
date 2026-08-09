import { PROVIDERS } from "./modules.js";

/**
 * Default configurations for all modules and providers.
 */
export const MODULE_DEFAULTS = {
    backend: {
        [PROVIDERS.OPENAI]: {
            apikey: "",
            model: "gpt-4o",
            maxtokens: 200,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"],
            // New LLM params (Migration 20) - -1 to disable
            frequencypenalty: -1,
            presencepenalty: -1,
            maxcompletiontokens: -1,
            seed: -1,
            responseformat: "",
            reasoningeffort: "",
            topk: -1,
            topa: -1,
            minp: -1,
            repetitionpenalty: -1,
            samplingpresetname: "",
            extraparams: {}
        },
        [PROVIDERS.OPENAI_COMPATIBLE]: {
            baseurl: "http://localhost:8080/v1",
            apikey: "",
            model: "example-model",
            maxtokens: 200,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"],
            // New LLM params (Migration 20) - -1 to disable
            frequencypenalty: -1,
            presencepenalty: -1,
            maxcompletiontokens: -1,
            seed: -1,
            responseformat: "",
            topk: -1,
            topa: -1,
            minp: -1,
            repetitionpenalty: -1,
            samplingpresetname: "",
            extraparams: {}
        },
        [PROVIDERS.OPENROUTER]: {
            apikey: "",
            model: "google/gemini-flash-2.5",
            maxtokens: 200,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"],
            // New LLM params (Migration 20) - -1 to disable
            frequencypenalty: -1,
            presencepenalty: -1,
            maxcompletiontokens: -1,
            seed: -1,
            responseformat: "",
            topk: -1,
            topa: -1,
            minp: -1,
            repetitionpenalty: -1,
            samplingpresetname: "",
            extraparams: {}
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
        },
        [PROVIDERS.GOOGLE]: {
            model: 'gemini-2.0-flash',
            temperature: 1.0,
            topp: 0.95,
            topk: 40,
            maxoutputtokens: 8192,
            responsemimetype: 'text/plain',
        },
        [PROVIDERS.XAI]: {
            model: 'grok-3-mini',
            temperature: 0.7,
            topp: 1.0,
            maxtokens: 4096,
            frequencypenalty: 0,
            presencepenalty: 0,
            reasoningeffort: '',
        },
        [PROVIDERS.ANTHROPIC]: {
            model: 'claude-sonnet-4-6',
            temperature: 0.7,
            topp: 0.9,
            maxtokens: 4096,
        }
    },
    tts: {
        [PROVIDERS.OPENAI]: {
            apikey: "",
            model: "tts-1",
            voice: "alloy",
            speed: 1.0,
            format: "flac"
        },
        [PROVIDERS.HARMONYSPEECH]: {
            endpoint: "",
            apikey: "",
            voiceconfigfile: "",
            format: "wav",
            samplerate: 16000,
            stream: false
        },
        [PROVIDERS.ELEVENLABS]: {
            apikey: "",
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
        [PROVIDERS.OPENROUTER]: {
            model: 'openai/tts-1',
            voice: 'alloy',
            speed: 1.0,
            format: 'mp3',
        },
        general: {
            outputtype: "file",
            wordstoreplace: {},
            vocalizenonverbal: false
        }
    },
    stt: {
        [PROVIDERS.OPENAI]: {
            apikey: ""
        },
        [PROVIDERS.HARMONYSPEECH]: {
            endpoint: "",
            apikey: "",
            model: "faster-whisper-large-v3-turbo"
        },
        [PROVIDERS.OPENROUTER]: {
            model: 'openai/whisper-1',
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
            apikey: ""
        },
        [PROVIDERS.HARMONYSPEECH]: {
            endpoint: "",
            apikey: "",
            model: "silero_vad"
        },
        [PROVIDERS.OPENROUTER]: {
            model: 'openai/whisper-1',
        }
    },
    rag: {
        [PROVIDERS.OPENAI]: {
            apikey: "",
            model: "text-embedding-3-small"
        },
        [PROVIDERS.OPENAI_COMPATIBLE]: {
            baseurl: "http://localhost:8080/v1",
            apikey: "",
            model: "default"
        },
        [PROVIDERS.OLLAMA]: {
            baseurl: "http://localhost:11434",
            model: "mxbai-embed-large"
        },
        [PROVIDERS.MISTRAL]: {
            mistralapikey: ""
        },
        [PROVIDERS.LOCALAI]: {
            model: "default"
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
            apikey: "",
            model: "gpt-4o",
            maxtokens: 100,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"],
            // New LLM params (Migration 20) - -1 to disable
            frequencypenalty: -1,
            presencepenalty: -1,
            maxcompletiontokens: -1,
            seed: -1,
            responseformat: "",
            reasoningeffort: "",
            topk: -1,
            topa: -1,
            minp: -1,
            repetitionpenalty: -1,
            samplingpresetname: "",
            extraparams: {}
        },
        [PROVIDERS.OPENAI_COMPATIBLE]: {
            baseurl: "http://127.0.0.1:5000",
            apikey: "",
            model: "example-model",
            maxtokens: 100,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"],
            // New LLM params (Migration 20) - -1 to disable
            frequencypenalty: -1,
            presencepenalty: -1,
            maxcompletiontokens: -1,
            seed: -1,
            responseformat: "",
            topk: -1,
            topa: -1,
            minp: -1,
            repetitionpenalty: -1,
            samplingpresetname: "",
            extraparams: {}
        },
        [PROVIDERS.OPENROUTER]: {
            apikey: "",
            model: "gpt-4o",
            maxtokens: 100,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"],
            // New LLM params (Migration 20) - -1 to disable
            frequencypenalty: -1,
            presencepenalty: -1,
            maxcompletiontokens: -1,
            seed: -1,
            responseformat: "",
            topk: -1,
            topa: -1,
            minp: -1,
            repetitionpenalty: -1,
            samplingpresetname: "",
            extraparams: {}
        },
        [PROVIDERS.GOOGLE]: {
            model: 'gemini-2.0-flash',
            temperature: 0.7,
            topp: 0.95,
            topk: 40,
            maxoutputtokens: 4096,
            responsemimetype: 'text/plain',
        },
        [PROVIDERS.XAI]: {
            model: 'grok-3-mini',
            temperature: 0.7,
            topp: 1.0,
            maxtokens: 4096,
            frequencypenalty: 0,
            presencepenalty: 0,
            reasoningeffort: '',
        },
        [PROVIDERS.ANTHROPIC]: {
            model: 'claude-sonnet-4-6',
            temperature: 0.7,
            topp: 0.9,
            maxtokens: 2048,
        },
        general: {
            maxcognitionevents: 20,
            generateexpressions: true
        }
    },
    movement: {
        [PROVIDERS.OPENAI]: {
            apikey: "",
            model: "gpt-4o",
            maxtokens: 200,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"],
            // New LLM params (Migration 20) - -1 to disable
            frequencypenalty: -1,
            presencepenalty: -1,
            maxcompletiontokens: -1,
            seed: -1,
            responseformat: "",
            reasoningeffort: "",
            topk: -1,
            topa: -1,
            minp: -1,
            repetitionpenalty: -1,
            samplingpresetname: "",
            extraparams: {}
        },
        [PROVIDERS.OPENAI_COMPATIBLE]: {
            baseurl: "http://127.0.0.1:5000",
            apikey: "",
            model: "example-model",
            maxtokens: 200,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"],
            // New LLM params (Migration 20) - -1 to disable
            frequencypenalty: -1,
            presencepenalty: -1,
            maxcompletiontokens: -1,
            seed: -1,
            responseformat: "",
            topk: -1,
            topa: -1,
            minp: -1,
            repetitionpenalty: -1,
            samplingpresetname: "",
            extraparams: {}
        },
        [PROVIDERS.OPENROUTER]: {
            apikey: "",
            model: "gpt-4o",
            maxtokens: 200,
            temperature: 0.7,
            topp: 1.0,
            n: -1,
            stoptokens: ["\\n"],
            // New LLM params (Migration 20) - -1 to disable
            frequencypenalty: -1,
            presencepenalty: -1,
            maxcompletiontokens: -1,
            seed: -1,
            responseformat: "",
            topk: -1,
            topa: -1,
            minp: -1,
            repetitionpenalty: -1,
            samplingpresetname: "",
            extraparams: {}
        },
        [PROVIDERS.GOOGLE]: {
            model: 'gemini-2.0-flash',
            temperature: 1.0,
            topp: 0.95,
            topk: 40,
            maxoutputtokens: 200,
            responsemimetype: 'text/plain',
        },
        [PROVIDERS.XAI]: {
            model: 'grok-3-mini',
            temperature: 0.7,
            topp: 1.0,
            maxtokens: 200,
            frequencypenalty: 0,
            presencepenalty: 0,
            reasoningeffort: '',
        },
        [PROVIDERS.ANTHROPIC]: {
            model: 'claude-sonnet-4-6',
            temperature: 0.7,
            topp: 0.9,
            maxtokens: 200,
        },
        general: {
            startupsynctimeout: 30,
            executionthreshold: 0.5
        }
    },
    imagination: {
        [PROVIDERS.COMFYUI]: {
            baseurl: "http://localhost:3000",
            apikey: "",
            workflowprofiles: {
                default: {
                    workflowjson: "",
                    promptnodeid: "",
                    promptfieldname: "text",
                    negativenodeid: "",
                    negativefieldname: "text",
                    negativeprompt: "",
                    seednodeid: "",
                    seedfieldname: "seed",
                    width: 512,
                    height: 512,
                    trigger: "",
                    baseprompt: "",
                    systempromphint: ""
                }
            }
        },
        [PROVIDERS.OPENAI]: {
            model: 'gpt-image-1',
            extraparams: {
                size: 'auto',
                quality: 'auto',
                output_format: 'png',
                background: 'opaque',
            },
        },
        [PROVIDERS.OPENROUTER]: {
            model: 'openai/dall-e-3',
            imageaspectratio: '1:1',
            imagesize: '1024x1024',
            maxtokens: 4096,
            temperature: 0.7,
        },
        [PROVIDERS.GOOGLE]: {
            model: 'gemini-2.0-flash-exp-image-generation',
            numberofimages: 1,
            aspectratio: '1:1',
        },
        [PROVIDERS.XAI]: {
            model: 'grok-imagine-image-quality',
            imageaspectratio: 'auto',
            imageresolution: '1k',
        }
    },
    vision: {
        provider: null,
        resolution_width: 640,
        resolution_height: 480,
        [PROVIDERS.OPENAI]: {
            apikey: "",
            model: "gpt-4o",
            maxtokens: 500,
            temperature: 0.7,
            topp: 1.0,
            n: 1,
            stoptokens: [],
            // New LLM params (Migration 20) - -1 to disable
            frequencypenalty: -1,
            presencepenalty: -1,
            maxcompletiontokens: -1,
            seed: -1,
            responseformat: "",
            reasoningeffort: "",
            topk: -1,
            topa: -1,
            minp: -1,
            repetitionpenalty: -1,
            samplingpresetname: "",
            extraparams: {}
        },
        [PROVIDERS.OPENROUTER]: {
            apikey: "",
            model: "google/gemini-2.0-flash-exp",
            maxtokens: 500,
            temperature: 0.7,
            topp: 1.0,
            n: 1,
            stoptokens: [],
            // New LLM params (Migration 20) - -1 to disable
            frequencypenalty: -1,
            presencepenalty: -1,
            maxcompletiontokens: -1,
            seed: -1,
            responseformat: "",
            topk: -1,
            topa: -1,
            minp: -1,
            repetitionpenalty: -1,
            samplingpresetname: "",
            extraparams: {}
        },
        [PROVIDERS.OPENAI_COMPATIBLE]: {
            baseurl: "http://localhost:8080/v1",
            apikey: "",
            model: "",
            maxtokens: 500,
            temperature: 0.7,
            topp: 1.0,
            n: 1,
            stoptokens: [],
            // New LLM params (Migration 20) - -1 to disable
            frequencypenalty: -1,
            presencepenalty: -1,
            maxcompletiontokens: -1,
            seed: -1,
            responseformat: "",
            topk: -1,
            topa: -1,
            minp: -1,
            repetitionpenalty: -1,
            samplingpresetname: "",
            extraparams: {}
        },
        [PROVIDERS.GOOGLE]: {
            model: 'gemini-2.0-flash',
            temperature: 0.4,
            topp: 0.95,
            topk: 40,
            maxoutputtokens: 4096,
            responsemimetype: 'text/plain',
        },
        [PROVIDERS.XAI]: {
            model: 'grok-3-mini',
            temperature: 0.4,
            topp: 1.0,
            maxtokens: 4096,
            frequencypenalty: 0,
            presencepenalty: 0,
            reasoningeffort: '',
        },
        [PROVIDERS.ANTHROPIC]: {
            model: 'claude-sonnet-4-6',
            temperature: 0.4,
            topp: 0.9,
            maxtokens: 1024,
        }
    }
};
