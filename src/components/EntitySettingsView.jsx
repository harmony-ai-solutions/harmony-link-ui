import {useEffect, useState} from 'react';
import {cloneDeep} from "lodash";

import {LogDebug} from "../utils/logger.js";
import {MODULE_CONFIGS} from '../constants/moduleConfiguration.js';

import SettingsTooltip from "./settings/SettingsTooltip.jsx";
import MultiProviderModuleView from "./modules/MultiProviderModuleView.jsx";
import { useEntitySettings } from '../hooks/useEntitySettings.js';


const EntitySettingsView = ({appName, entitySettings, saveEntitySettings}) => {
    // Use store for state management
    const {
        entities,
        selectedEntityId,
        selectedModuleId,
        isDirty,
        initializeStore,
        selectEntity,
        selectModule,
        addEntity,
        deleteEntity,
        renameEntity,
        duplicateEntity,
        exportSettings,
        resetStore,
        markClean,
        getEntityCount,
        getEntityIds
    } = useEntitySettings();

    const [tooltipVisible, setTooltipVisible] = useState(0);

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

    // Entity name for display (derived from selected entity)
    const [entityName, setEntityName] = useState("");

    // Sync entityName with selectedEntityId whenever it changes
    useEffect(() => {
        if (selectedEntityId) {
            setEntityName(selectedEntityId);
        }
    }, [selectedEntityId]);

    const handleEntityChange = (selectedEntityKey) => {
        selectEntity(selectedEntityKey);
        // entityName will be updated via useEffect
    };

    const handleModuleChange = (selectedModuleId) => {
        selectedModuleId = selectedModuleId !== "" ? selectedModuleId : "backend";
        selectModule(selectedModuleId);
    };

    // Module settings are now handled directly by the store through child components
    // No need for handleModuleSettingsChange callback

    // Validation Functions
    const validateEntityNameAndUpdate = (value) => {
        if (value.trim() === "") {
            showModal("EntityName cannot be empty.");
            setEntityName(selectedEntityId);
            return false;
        }
        // Update if validation successful
        renameEntity(selectedEntityId, value);
        setEntityName(value);
        return true;
    };

    const createNewEntity = () => {
        addEntity(); // Store will generate unique name and select it
        const newEntityIds = getEntityIds();
        const newEntityId = newEntityIds[newEntityIds.length - 1]; // Get the newly created entity
        setEntityName(newEntityId);
    }

    const deleteFromEntityMap = () => {
        deleteEntity(selectedEntityId);
        // Update entity name to match new selection
        const remainingIds = getEntityIds();
        if (remainingIds.length > 0) {
            setEntityName(remainingIds[0]);
        } else {
            setEntityName("");
        }
    }

    const copyEntity = () => {
        duplicateEntity(selectedEntityId);
        const entityIds = getEntityIds();
        const newEntityId = entityIds[entityIds.length - 1]; // Get the newly created entity
        setEntityName(newEntityId);
    }

    const setInitialValues = () => {
        // Initialize store with entity settings
        console.log('[EntitySettingsView] Initializing store with entitySettings:', entitySettings);
        initializeStore(entitySettings);
        
        // Log store state after initialization
        console.log('[EntitySettingsView] Store state after initialization:');
        console.log('  - entities:', entities);
        console.log('  - selectedEntityId:', selectedEntityId);
        console.log('  - selectedModuleId:', selectedModuleId);
        console.log('  - getEntityCount():', getEntityCount());
        console.log('  - getEntityIds():', getEntityIds());
        
        // Set initial entity name if entities exist
        const entityIds = Object.keys(entitySettings);
        if (entityIds.length > 0) {
            setEntityName(entityIds[0]);
        }
    };

    const saveSettingsWithBackup = () => {
        // Export current store state and save
        const currentSettings = exportSettings();
        // Update the original entitySettings object to maintain API compatibility
        Object.keys(entitySettings).forEach(key => delete entitySettings[key]);
        Object.entries(currentSettings).forEach(([entityKey, entityData]) => {
            entitySettings[entityKey] = entityData;
        });
        saveEntitySettings(entitySettings, true);
        markClean(); // Mark store as clean after successful save
    }
    
    const saveSettingsWithoutBackup = () => {
        // Export current store state and save
        const currentSettings = exportSettings();
        // Update the original entitySettings object to maintain API compatibility
        Object.keys(entitySettings).forEach(key => delete entitySettings[key]);
        Object.entries(currentSettings).forEach(([entityKey, entityData]) => {
            entitySettings[entityKey] = entityData;
        });
        saveEntitySettings(entitySettings, false);
        markClean(); // Mark store as clean after successful save
    }

    const updateSettingValues = () => {
        // Configure Modal Dialog whether a backup should be made
        setConfirmModalYes(() => saveSettingsWithBackup);
        setConfirmModalNo(() => saveSettingsWithoutBackup);
        showConfirmModal("Saving will overwrite the existing config.json file. Do you want to backup the existing file?");
    };

    const handleReset = () => {
        resetStore(entitySettings);
        // Reset entity name to match new selection
        const entityIds = Object.keys(entitySettings);
        if (entityIds.length > 0) {
            setEntityName(entityIds[0]);
        } else {
            setEntityName("");
        }
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
                            onClick={() => copyEntity()}
                            className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400">Copy
                        </button>
                        <button
                            onClick={() => deleteFromEntityMap()}
                            className="bg-red-700 hover:bg-red-500 font-bold py-1 px-2 mx-1 text-white">Delete
                        </button>
                    </div>
                    <div>
                        <div className="flex w-full justify-center pb-4">
                            <label className="block text-sm font-medium">
                                <span className="text-neutral-300">Total Entity count: </span><span
                                className="text-orange-400">{getEntityCount()}</span>
                            </label>
                        </div>
                        <select
                            value={selectedEntityId}
                            onChange={(e) => handleEntityChange(e.target.value)}
                            className="block w-full bg-neutral-700 border border-neutral-400 text-gray-200 py-2 px-4 leading-tight focus:outline-none overflow-y-auto"
                            size="10">
                            {getEntityIds().map((entityKey) => (
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
                            onClick={handleReset}
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
                                    <br/> Harmony Link can provide functionalities for both AI and and Human controlled
                                    Entities. The exact configuration pattern may differ between Plugins and Games using
                                    Harmony Link.
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
                                    <br/>For each module, you can select between different provider options. Later
                                    releases of {appName} will likely include additional options over time.
                                    <br/>If the selected entity does not require the selected module, it can also be
                                    disabled.
                                </SettingsTooltip>
                            </label>
                            <div className="w-4/5 px-3">
                                <select
                                    value={selectedModuleId}
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

                        {/* Universal Module Configuration using MultiProviderModuleView */}
                        {selectedEntityId && entities[selectedEntityId] && MODULE_CONFIGS[selectedModuleId] && (
                            <div className="flex items-center w-full border-t border-neutral-500">
                                <MultiProviderModuleView
                                    moduleConfig={MODULE_CONFIGS[selectedModuleId]}
                                    entityId={entityName}
                                />
                            </div>
                        )}
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
                    <div
                        className="relative top-10 mx-auto p-5 border border-neutral-800 w-96 shadow-lg rounded-md bg-neutral-900">
                        <div className="mt-3 text-center">
                            <h3 className="text-lg leading-6 font-medium text-orange-500">Confirmation Required</h3>
                            <div className="mt-2 px-7 py-3">
                                <p className="text-sm text-gray-200">{confirmModalMessage}</p>
                            </div>
                            <div className="flex justify-center gap-4 pt-3">
                                <button onClick={() => {
                                    setConfirmModalVisible(false);
                                    confirmModalYes();
                                }}
                                        className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400">
                                    Yes
                                </button>
                                <button onClick={() => {
                                    setConfirmModalVisible(false);
                                    confirmModalNo();
                                }}
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
