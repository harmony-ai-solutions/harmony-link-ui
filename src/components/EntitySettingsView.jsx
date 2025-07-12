import {useEffect, useState} from 'react';
import {cloneDeep} from "lodash";

import {LogDebug} from "../../utils/logger.js";

import logo_harmony from '../assets/images/harmony-link-icon-256.png';
import logo_cai from '../assets/images/cai_50px.png';
import logo_openai from '../assets/images/ChatGPT_50px.png';
import logo_kajiwoto from '../assets/images/Kajiwoto_106px.png';
import logo_kindroid from '../assets/images/Kindroid_50px.png';
import logo_blank from '../assets/images/blank_50px.png';
import logo_elevenlabs from '../assets/images/elevenlabs_50px.png';

import SettingsTooltip from "./settings/SettingsTooltip.jsx";
import DynamicOptionsGroup from "./settings/DynamicOptionsGroup.jsx";

import BackendKajiwotoSettingsView from "./modules/BackendKajiwotoSettingsView.jsx";
import BackendOpenAICompatibleSettingsView from "./modules/BackendOpenAICompatibleSettingsView.jsx";
import BackendCharacterAISettingsView from "./modules/BackendCharacterAISettingsView.jsx";
import BackendKindroidSettingsView from "./modules/BackendKindroidAISettingsView.jsx";
import BackendOpenAISettingsView from "./modules/BackendOpenAISettingsView.jsx";

import MovementGeneralSettingsView from "./modules/MovementGeneralSettingsView.jsx";
import MovementOpenAICompatibleSettingsView from "./modules/MovementOpenAICompatibleSettingsView.jsx";

import CountenanceOpenAICompatibleSettingsView from "./modules/CountenanceOpenAICompatibleSettingsView.jsx";

import STTGeneralSettingsView from "./modules/STTGeneralSettingsView.jsx";
import STTHarmonySpeechSettingsView from "./modules/STTHarmonySpeechSettingsView.jsx";
import STTOpenAISettingsView from "./modules/STTOpenAISettingsView.jsx";

import TTSGeneralSettingsView from "./modules/TTSGeneralSettingsView.jsx";
import TTSElevenlabsSettingsView from "./modules/TTSElevenlabsSettingsView.jsx";
import TTSHarmonySpeechSettingsView from "./modules/TTSHarmonySpeechSettingsView.jsx";
import TTSOpenAISettingsView from "./modules/TTSOpenAISettingsView.jsx";
import TTSKindroidSettingsView from "./modules/TTSKindroidSettingsView.jsx";

import RAGGeneralSettingsView from "./modules/RAGGeneralSettingsView.jsx";
import RAGLocalAISettingsView from "./modules/RAGLocalAISettingsView.jsx";
import RAGOpenAISettingsView from "./modules/RAGOpenAISettingsView.jsx";
import RAGOpenAICompatibleSettingsView from "./modules/RAGOpenAICompatibleSettingsView.jsx";
import RAGMistralSettingsView from "./modules/RAGMistralSettingsView.jsx";
import RAGOllamaSettingsView from "./modules/RAGOllamaSettingsView.jsx";


const EntitySettingsView = ({appName, entitySettings, saveEntitySettings}) => {
    const [tooltipVisible, setTooltipVisible] = useState(0);

    // Default Entity Template
    const entityTemplate = {
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
            "provider": "disabled",
            "transcription": {
                "mainstreamtimemillis": 2000,
                "transitionstreamtimemillis": 2000,
                "maxbuffercount": 5
            },
            "harmonyspeech": {
                "endpoint": "https://speech.project-harmony.ai",
                "model": "faster-whisper-large-v3-turbo",
                "vadmodel": "faster-whisper-tiny"
            },
            "openai": {
                "openaiapikey": "YOUR_OPENAI_API_KEY"
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
    }

    // Option Group Configuration
    const backendProviders = [
        { id: 'disabled', name: 'Disabled', logo: logo_blank },
        { id: 'openai', name: 'OpenAI', logo: logo_openai },
        { id: 'kajiwoto', name: 'Kajiwoto AI', logo: logo_kajiwoto },
        { id: 'characterai', name: 'Character AI', logo: logo_cai },
        { id: 'kindroid', name: 'Kindroid AI', logo: logo_kindroid },
        { id: 'openaicompatible', name: 'OpenAI Compatible', logo: logo_openai },
        // Add more options as needed
    ];
    const ttsProviders = [
        { id: 'disabled', name: 'Disabled', logo: logo_blank },
        { id: 'elevenlabs', name: 'Elevenlabs', logo: logo_elevenlabs },
        { id: 'harmonyspeech', name: 'Harmony Speech Engine', logo: logo_harmony },
        { id: 'openai', name: 'OpenAI', logo: logo_openai },
        { id: 'kindroid', name: 'Kindroid AI', logo: logo_kindroid },
        // Add more options as needed
    ];
    const sttProviders = [
        { id: 'disabled', name: 'Disabled', logo: logo_blank },
        { id: 'harmonyspeech', name: 'Harmony Speech Engine', logo: logo_harmony },
        { id: 'openai', name: 'OpenAI', logo: logo_openai },
        // Add more options as needed
    ];
    const countenanceProviders = [
        { id: 'disabled', name: 'Disabled', logo: logo_blank },
        { id: 'openaicompatible', name: 'OpenAI Compatible', logo: logo_openai },
        // Add more options as needed
    ];
    const movementProviders = [
        { id: 'disabled', name: 'Disabled', logo: logo_blank },
        { id: 'openaicompatible', name: 'OpenAI Compatible', logo: logo_openai },
        // Add more options as needed
    ];
    const ragProviders = [
        { id: 'disabled', name: 'Disabled', logo: logo_blank },
        { id: 'localai', name: 'LocalAI', logo: logo_blank },
        { id: 'openai', name: 'OpenAI', logo: logo_openai },
        { id: 'openaicompatible', name: 'OpenAI Compatible', logo: logo_openai },
        { id: 'mistral', name: 'Mistral', logo: logo_blank },
        { id: 'ollama', name: 'Ollama', logo: logo_blank },
        // Add more options as needed
    ];

    // Modal dialog values
    const [modalMessage, setModalMessage] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);

    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [confirmModalMessage, setConfirmModalMessage] = useState('');
    const [confirmModalYes, setConfirmModalYes] = useState(() => {});
    const [confirmModalNo, setConfirmModalNo] = useState(() => {});

    // Show Modal Functions
    const showModal = (message) => {
        setModalMessage(message);
        setIsModalVisible(true);
    };
    const showConfirmModal = (message) => {
        setConfirmModalMessage(message);
        setConfirmModalVisible(true);
    };

    // Fields
    const [entityMap, setEntityMap] = useState(cloneDeep(entitySettings));

    const [selectedEntity, setSelectedEntity] = useState('');
    const [selectedModule, setSelectedModule] = useState("backend");
    const [selectedProvider, setSelectedProvider] = useState("disabled");

    const [entityName, setEntityName] = useState("");

    const handleEntityChange = (selectedEntityKey, entityMap) => {
        //LogDebug(selectedEntityKey);
        setSelectedEntity(selectedEntityKey);
        setEntityName(selectedEntityKey);
        //LogDebug(JSON.stringify(entityMap[selectedEntityKey][selectedModule]));
        const selectedModuleOptionValue = entityMap[selectedEntityKey][selectedModule]["provider"] !== "" ? entityMap[selectedEntityKey][selectedModule]["provider"] : "disabled";
        if (selectedModuleOptionValue !== "disabled" && selectedModuleOptionValue === selectedProvider) {
            // Force refresh using timeout
            setSelectedProvider("disabled");
            setTimeout(() => setSelectedProvider(selectedModuleOptionValue), 0);
        } else {
            setSelectedProvider(selectedModuleOptionValue);
        }
    };

    const handleModuleChange = (selectedModuleId) => {
        selectedModuleId = selectedModuleId !== "" ? selectedModuleId : "backend";
        setSelectedModule(selectedModuleId);
        const selectedProviderValue = entityMap[selectedEntity][selectedModuleId]["provider"] !== "" ? entityMap[selectedEntity][selectedModuleId]["provider"] : "disabled";
        if (selectedProviderValue !== "disabled" && selectedProviderValue === selectedProvider) {
            // Force refresh using timeout
            setSelectedProvider("disabled");
            setTimeout(() => setSelectedProvider(selectedProviderValue), 0);
        } else {
            setSelectedProvider(selectedProviderValue);
        }
    };

    const handleSelectedProviderChange = (selectedProviderId) => {
        //LogDebug(selectedProviderId);
        selectedProviderId = selectedProviderId !== "" ? selectedProviderId : "disabled";
        setSelectedProvider(selectedProviderId);
        // Update Entity Data
        entityMap[selectedEntity][selectedModule]["provider"] = selectedProviderId;
    };

    // Validation Functions
    const validateEntityNameAndUpdate = (value) => {
        if (value.trim() === "") {
            showModal("EntityName cannot be empty.");
            setEntityName(selectedEntity);
            return false;
        }
        // Update if validation successful
        updateEntityName(value);
        return true;
    };

    const updateEntityName = (newName) => {
        // Rebuild entity map
        const newEntityMap = {};
        Object.entries(entityMap).forEach(([entityKey, entityData]) =>
        {
            if (entityKey === selectedEntity) {
                newEntityMap[newName] = entityData;
            } else {
                newEntityMap[entityKey] = entityData;
            }
        });
        // Refresh entity list
        setEntityMap(newEntityMap);
        // Update selected entity
        setSelectedEntity(newName);
    };

    const createNewEntity = () => {
        let newName = "new-entity";
        let counter = 0;

        while (entityMap.hasOwnProperty(newName)) {
            counter++;
            newName = `new-entity-${counter}`;
        }

        const newEntityMap = cloneDeep(entityMap);
        newEntityMap[newName] = cloneDeep(entityTemplate);
        // Refresh entity list
        setEntityMap(newEntityMap);
        handleEntityChange(newName, newEntityMap);
    }

    const deleteFromEntityMap = (selectedEntity) => {
        // Rebuild entity map
        const newEntityMap = {};
        Object.entries(entityMap).forEach(([entityKey, entityData]) =>
        {
            if (entityKey !== selectedEntity) {
                newEntityMap[entityKey] = entityData;
            }
        });
        // Refresh entity list
        setEntityMap(newEntityMap);
        // Trigger Manual Select on Page load if there is an entity existing
        if (Object.keys(newEntityMap).length > 0) {
            handleEntityChange(Object.keys(newEntityMap)[0], newEntityMap);
        }
    }

    const copyEntity = (selectedEntity) => {
        // Rebuild entity map - To avoid reference clash that breaks reset function
        const newEntityMap = {};
        Object.entries(entityMap).forEach(([entityKey, entityData]) =>
        {
            newEntityMap[entityKey] = entityData;
        });
        // Add copied entity
        const newName = selectedEntity + '-Copy';
        newEntityMap[newName] = newEntityMap[selectedEntity];
        setEntityMap(newEntityMap);
        // Update selected entity
        handleEntityChange(newName, newEntityMap);
    }

    // Config update functions
    const saveModuleOptionSettings = (updatedModuleOptionSettings) => {
        if (selectedProvider !== "disabled") {
            entityMap[selectedEntity][selectedModule][selectedProvider] = updatedModuleOptionSettings;
        }
    };

    const saveModuleGeneralSettings = (updatedModuleGeneralSettings) => {
        // Retrieve the current module options based on the selected module
        let currentModuleOptions;
        switch (selectedModule) {
            case 'backend':
                currentModuleOptions = backendProviders;
                break;
            case 'tts':
                currentModuleOptions = ttsProviders;
                break;
            case 'stt':
                currentModuleOptions = sttProviders;
                break;
            case 'countenance':
                currentModuleOptions = countenanceProviders;
                break;
            case 'movement':
                currentModuleOptions = movementProviders;
                break;
            case 'rag':
                currentModuleOptions = ragProviders;
                break;
            default:
                currentModuleOptions = [];
        }

        // Convert the options array to a map for faster lookup
        const optionsMap = currentModuleOptions.reduce((acc, option) => {
            acc[option.id] = true;
            return acc;
        }, {});

        // Iterate over the keys of the updated settings object
        Object.keys(updatedModuleGeneralSettings).forEach(key => {
            // If the key is not in the options map, update the value in entityMap
            if (!optionsMap[key]) {
                entityMap[selectedEntity][selectedModule][key] = updatedModuleGeneralSettings[key];
            }
        });
    };

    const setInitialValues = () => {
        // Reset Entity map
        const newEntityMap = cloneDeep(entitySettings);
        setEntityMap(newEntityMap);
        // Trigger Manual Select on Page load if there is an entity existing
        if (Object.keys(entitySettings).length > 0) {
            handleEntityChange(Object.keys(entitySettings)[0], newEntityMap);
        }
    };

    const saveSettingsWithBackup = () => {
        saveEntitySettings(entitySettings, true);
    }
    const saveSettingsWithoutBackup = () => {
        saveEntitySettings(entitySettings, false);
    }

    const updateSettingValues = () => {
        // LogDebug(JSON.stringify(entityMap));
        // Attention: Settings parameter is implicit CONST object, so we cannot re-assign the map pointer. Instead we need to clear the object and fill it with the new entries
        Object.keys(entitySettings).forEach(key => delete entitySettings[key]);
        Object.entries(entityMap).forEach(([entityKey, entityData]) =>
        {
            entitySettings[entityKey] = entityData;
        });
        // Configure Modal Dialog whether a backup should be made
        setConfirmModalYes(() => saveSettingsWithBackup);
        setConfirmModalNo(() => saveSettingsWithoutBackup);
        showConfirmModal("Saving will overwrite the existing config.json file. Do you want to backup the existing file?");
    };

    useEffect(() => {
        LogDebug(JSON.stringify(entitySettings));
        setInitialValues();
    }, []);

    return (
        <>
            <div className="flex">
                <div className="w-1/4 p-4 space-y-4 border-r border-neutral-500">
                    <div className="flex items-center justify-center">
                        <button
                            onClick={() => createNewEntity()}
                            className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400">Add
                        </button>
                        <button
                            onClick={() => copyEntity(selectedEntity)}
                            className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400">Copy
                        </button>
                        <button
                            onClick={() => deleteFromEntityMap(selectedEntity)}
                            className="bg-red-700 hover:bg-red-500 font-bold py-1 px-2 mx-1 text-white">Delete
                        </button>
                    </div>
                    <div>
                        <div className="flex w-full justify-center pb-4">
                            <label className="block text-sm font-medium">
                                <span className="text-neutral-300">Total Entity count: </span><span className="text-orange-400">{Object.keys(entityMap).length}</span>
                            </label>
                        </div>
                        <select
                            value={selectedEntity}
                            onChange={(e) => handleEntityChange(e.target.value, entityMap)}
                            className="block w-full bg-neutral-700 border border-neutral-400 text-gray-200 py-2 px-4 leading-tight focus:outline-none overflow-y-auto"
                            size="10">
                            {Object.keys(entityMap).map((entityKey) => (
                                <option key={entityKey} value={entityKey}
                                        className="border-b border-orange-400 font-semibold">
                                    {entityKey}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center justify-center">
                        <button
                            onClick={updateSettingValues}
                            className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400">Save
                        </button>
                        <button
                            onClick={setInitialValues}
                            className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400">Reset
                        </button>
                    </div>
                </div>
                <div className="w-3/4 p-4">
                    <div>
                        <div className="flex items-center w-full">
                            <label className="block text-sm font-medium text-gray-300 w-1/5 px-3">
                                Entity name
                                <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible}
                                                 setTooltipVisible={setTooltipVisible}>
                                    Name of the Controlled Entity. This Name is also being used to identify the Entity
                                    in the Plugin or Game connecting to {appName}.
                                    <br/> Harmony Link can provide functionalities for both AI and and Human controlled Entities. The exact configuration pattern may differ between Plugins and Games using Harmony Link.
                                    <br/>
                                    <br/><span className="text-orange-400">CAUTION: Changing this value requires changing the entity identifier in the Plugin or Game as well, otherwise the connection will fail.</span>
                                </SettingsTooltip>
                            </label>
                            <div className="w-4/5 px-3">
                                <input type="text" name="entityName"
                                       className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100"
                                       placeholder="Entity Name" value={entityName}
                                       onChange={(e) => setEntityName(e.target.value)}
                                       onBlur={(e) => validateEntityNameAndUpdate(e.target.value)}/>
                            </div>
                        </div>

                        <div className="flex items-center mb-4 w-full">
                            <label className="block text-sm font-medium text-gray-300 w-1/5 px-3">
                                Module
                                <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible}
                                                 setTooltipVisible={setTooltipVisible}>
                                    Select the entity's module which you want to configure here.
                                    <br/>For each module, you can select between different provider options. Later releases of {appName} will likely include additional options over time.
                                    <br/>If the selected entity does not require the selected module, it can also be disabled.
                                </SettingsTooltip>
                            </label>
                            <div className="w-4/5 px-3">
                                <select
                                    value={selectedModule}
                                    onChange={(e) => handleModuleChange(e.target.value)}
                                    className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100">
                                    <option value="backend">AI Backend / LLM Engine</option>
                                    <option value="countenance">Character nonverbal Expression / Countenance</option>
                                    <option value="movement">Character Movement</option>
                                    <option value="rag">Retrieval Augmented Generation (RAG)</option>
                                    <option value="stt">Speech-to-Text (STT)</option>
                                    <option value="tts">Text-to-Speech (TTS)</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center w-full border-t border-neutral-500">
                            {entityMap[selectedEntity] && selectedModule === "backend" &&
                                <DynamicOptionsGroup
                                    options={backendProviders}
                                    selectedOption={selectedProvider}
                                    onSelectedChange={handleSelectedProviderChange}
                                />
                            }
                            {entityMap[selectedEntity] && selectedModule === "countenance" &&
                                <DynamicOptionsGroup
                                    options={countenanceProviders}
                                    selectedOption={selectedProvider}
                                    onSelectedChange={handleSelectedProviderChange}
                                />
                            }
                            {entityMap[selectedEntity] && selectedModule === "movement" &&
                                <DynamicOptionsGroup
                                    options={movementProviders}
                                    selectedOption={selectedProvider}
                                    onSelectedChange={handleSelectedProviderChange}
                                />
                            }
                            {entityMap[selectedEntity] && selectedModule === "rag" &&
                                <DynamicOptionsGroup
                                    options={ragProviders}
                                    selectedOption={selectedProvider}
                                    onSelectedChange={handleSelectedProviderChange}
                                />
                            }
                            {entityMap[selectedEntity] && selectedModule === "tts" &&
                                <DynamicOptionsGroup
                                    options={ttsProviders}
                                    selectedOption={selectedProvider}
                                    onSelectedChange={handleSelectedProviderChange}
                                />
                            }
                            {entityMap[selectedEntity] && selectedModule === "stt" &&
                                <DynamicOptionsGroup
                                    options={sttProviders}
                                    selectedOption={selectedProvider}
                                    onSelectedChange={handleSelectedProviderChange}
                                />
                            }
                        </div>

                        {/*Global Module Settings*/}
                        {entityMap[selectedEntity] && selectedModule === "movement" && selectedProvider !== "disabled" &&
                            <div className="flex items-center w-full border-t border-neutral-500">
                                <MovementGeneralSettingsView initialSettings={entityMap[selectedEntity][selectedModule]} saveSettingsFunc={saveModuleGeneralSettings}></MovementGeneralSettingsView>
                            </div>
                        }
                        {entityMap[selectedEntity] && selectedModule === "stt" && selectedProvider !== "disabled" &&
                            <div className="flex items-center w-full border-t border-neutral-500">
                                <STTGeneralSettingsView initialSettings={entityMap[selectedEntity][selectedModule]} saveSettingsFunc={saveModuleGeneralSettings}></STTGeneralSettingsView>
                            </div>
                        }
                        {entityMap[selectedEntity] && selectedModule === "tts" && selectedProvider !== "disabled" &&
                            <div className="flex items-center w-full border-t border-neutral-500">
                                <TTSGeneralSettingsView initialSettings={entityMap[selectedEntity][selectedModule]} saveSettingsFunc={saveModuleGeneralSettings}></TTSGeneralSettingsView>
                            </div>
                        }
                        {entityMap[selectedEntity] && selectedModule === "rag" && selectedProvider !== "disabled" &&
                            <div className="flex items-center w-full border-t border-neutral-500">
                                <RAGGeneralSettingsView initialSettings={entityMap[selectedEntity][selectedModule]} saveSettingsFunc={saveModuleGeneralSettings}></RAGGeneralSettingsView>
                            </div>
                        }

                        <div className="flex items-center w-full border-t border-neutral-500">
                            {/*Backend Modules*/}
                            {entityMap[selectedEntity] && selectedModule === "backend" && selectedProvider === "kajiwoto" &&
                                <BackendKajiwotoSettingsView initialSettings={entityMap[selectedEntity][selectedModule]["kajiwoto"]} saveSettingsFunc={saveModuleOptionSettings}></BackendKajiwotoSettingsView>
                            }
                            {entityMap[selectedEntity] && selectedModule === "backend" && selectedProvider === "openaicompatible" &&
                                <BackendOpenAICompatibleSettingsView initialSettings={entityMap[selectedEntity][selectedModule]["openaicompatible"]} saveSettingsFunc={saveModuleOptionSettings}></BackendOpenAICompatibleSettingsView>
                            }
                            {entityMap[selectedEntity] && selectedModule === "backend" && selectedProvider === "characterai" &&
                                <BackendCharacterAISettingsView initialSettings={entityMap[selectedEntity][selectedModule]["characterai"]} saveSettingsFunc={saveModuleOptionSettings}></BackendCharacterAISettingsView>
                            }
                            {entityMap[selectedEntity] && selectedModule === "backend" && selectedProvider === "kindroid" &&
                                <BackendKindroidSettingsView initialSettings={entityMap[selectedEntity][selectedModule]["kindroid"]} saveSettingsFunc={saveModuleOptionSettings}></BackendKindroidSettingsView>
                            }
                            {entityMap[selectedEntity] && selectedModule === "backend" && selectedProvider === "openai" &&
                                <BackendOpenAISettingsView initialSettings={entityMap[selectedEntity][selectedModule]["openai"]} saveSettingsFunc={saveModuleOptionSettings}></BackendOpenAISettingsView>
                            }

                            {/*Countenance Modules*/}
                            {entityMap[selectedEntity] && selectedModule === "countenance" && selectedProvider === "openaicompatible" &&
                                <CountenanceOpenAICompatibleSettingsView initialSettings={entityMap[selectedEntity][selectedModule]["openaicompatible"]} saveSettingsFunc={saveModuleOptionSettings}></CountenanceOpenAICompatibleSettingsView>
                            }

                            {/*Movement Modules*/}
                            {entityMap[selectedEntity] && selectedModule === "movement" && selectedProvider === "openaicompatible" &&
                                <MovementOpenAICompatibleSettingsView initialSettings={entityMap[selectedEntity][selectedModule]["openaicompatible"]} saveSettingsFunc={saveModuleOptionSettings}></MovementOpenAICompatibleSettingsView>
                            }

                            {/*STT Modules*/}
                            {entityMap[selectedEntity] && selectedModule === "stt" && selectedProvider === "harmonyspeech" &&
                                <STTHarmonySpeechSettingsView initialSettings={entityMap[selectedEntity][selectedModule]["harmonyspeech"]} saveSettingsFunc={saveModuleOptionSettings}></STTHarmonySpeechSettingsView>
                            }
                            {entityMap[selectedEntity] && selectedModule === "stt" && selectedProvider === "openai" &&
                                <STTOpenAISettingsView initialSettings={entityMap[selectedEntity][selectedModule]["openai"]} saveSettingsFunc={saveModuleOptionSettings}></STTOpenAISettingsView>
                            }

                            {/*TTS Modules*/}
                            {entityMap[selectedEntity] && selectedModule === "tts" && selectedProvider === "elevenlabs" &&
                                <TTSElevenlabsSettingsView initialSettings={entityMap[selectedEntity][selectedModule]["elevenlabs"]} saveSettingsFunc={saveModuleOptionSettings}></TTSElevenlabsSettingsView>
                            }
                            {entityMap[selectedEntity] && selectedModule === "tts" && selectedProvider === "harmonyspeech" &&
                                <TTSHarmonySpeechSettingsView initialSettings={entityMap[selectedEntity][selectedModule]["harmonyspeech"]} saveSettingsFunc={saveModuleOptionSettings}></TTSHarmonySpeechSettingsView>
                            }
                            {entityMap[selectedEntity] && selectedModule === "tts" && selectedProvider === "openai" &&
                                <TTSOpenAISettingsView initialSettings={entityMap[selectedEntity][selectedModule]["openai"]} saveSettingsFunc={saveModuleOptionSettings}></TTSOpenAISettingsView>
                            }
                            {entityMap[selectedEntity] && selectedModule === "tts" && selectedProvider === "kindroid" &&
                                <TTSKindroidSettingsView initialSettings={entityMap[selectedEntity][selectedModule]["kindroid"]} saveSettingsFunc={saveModuleOptionSettings}></TTSKindroidSettingsView>
                            }

                            {/*RAG Modules*/}
                            {entityMap[selectedEntity] && selectedModule === "rag" && selectedProvider === "localai" &&
                                <RAGLocalAISettingsView initialSettings={entityMap[selectedEntity][selectedModule]["providerlocalai"]} saveSettingsFunc={saveModuleOptionSettings}></RAGLocalAISettingsView>
                            }
                            {entityMap[selectedEntity] && selectedModule === "rag" && selectedProvider === "openai" &&
                                <RAGOpenAISettingsView initialSettings={entityMap[selectedEntity][selectedModule]["provideropenai"]} saveSettingsFunc={saveModuleOptionSettings}></RAGOpenAISettingsView>
                            }
                            {entityMap[selectedEntity] && selectedModule === "rag" && selectedProvider === "openaicompatible" &&
                                <RAGOpenAICompatibleSettingsView initialSettings={entityMap[selectedEntity][selectedModule]["provideropenaicompatible"]} saveSettingsFunc={saveModuleOptionSettings}></RAGOpenAICompatibleSettingsView>
                            }
                            {entityMap[selectedEntity] && selectedModule === "rag" && selectedProvider === "mistral" &&
                                <RAGMistralSettingsView initialSettings={entityMap[selectedEntity][selectedModule]["providermistral"]} saveSettingsFunc={saveModuleOptionSettings}></RAGMistralSettingsView>
                            }
                            {entityMap[selectedEntity] && selectedModule === "rag" && selectedProvider === "ollama" &&
                                <RAGOllamaSettingsView initialSettings={entityMap[selectedEntity][selectedModule]["providerollama"]} saveSettingsFunc={saveModuleOptionSettings}></RAGOllamaSettingsView>
                            }
                        </div>
                    </div>

                </div>
            </div>
            {isModalVisible && (
                <div className="fixed inset-0 bg-gray-600/50">
                    <div
                        className="relative top-10 mx-auto p-5 border border-neutral-800 w-96 shadow-lg rounded-md bg-neutral-900">
                        <div className="mt-3 text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-200">
                                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24"
                                     stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                </svg>
                            </div>
                            <h3 className="text-lg leading-6 font-medium text-orange-500 mt-4">Invalid Input</h3>
                            <div className="mt-2 px-7 py-3">
                                <p className="text-sm text-gray-200">{modalMessage}</p>
                            </div>
                            <div className="items-center px-4 py-3">
                                <button onClick={() => setIsModalVisible(false)}
                                        className="px-4 py-2 bg-gray-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {confirmModalVisible && (
                <div className="fixed inset-0 bg-gray-600/50">
                    <div className="relative top-10 mx-auto p-5 border border-neutral-800 w-96 shadow-lg rounded-md bg-neutral-900">
                        <div className="mt-3 text-center">
                            <h3 className="text-lg leading-6 font-medium text-orange-500">Confirmation Required</h3>
                            <div className="mt-2 px-7 py-3">
                                <p className="text-sm text-gray-200">{confirmModalMessage}</p>
                            </div>
                            <div className="flex justify-center gap-4 pt-3">
                                <button onClick={() => { setConfirmModalVisible(false); confirmModalYes();}}
                                        className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400">
                                    Yes
                                </button>
                                <button onClick={() => { setConfirmModalVisible(false); confirmModalNo(); }}
                                        className="bg-red-700 hover:bg-red-500 font-bold py-1 px-2 mx-1 text-white">
                                    No
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default EntitySettingsView;
