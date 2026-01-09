import React, { useState, useEffect, useMemo } from 'react';
import useEntityStore from '../store/entityStore';
import useCharacterProfileStore from '../store/characterProfileStore';
import useModuleConfigStore from '../store/moduleConfigStore';
import RAGCollectionManager from './modules/RAGCollectionManager';
import { supportsCharacterProfile } from '../constants/backendProviders';
import { updateEntity, renameEntity } from '../services/management/entityService';
import SettingsTooltip from "./settings/SettingsTooltip.jsx";
import ErrorDialog from "./modals/ErrorDialog.jsx";
import ConfirmDialog from "./modals/ConfirmDialog.jsx";
import InputDialog from "./modals/InputDialog.jsx";

function ModuleConfigSelector({ label, moduleType, selectedConfigId, onChange, configs, isLoading }) {
    return (
        <div className="flex items-center mb-4 w-full">
            <label className="block text-sm font-medium text-gray-300 w-1/5 px-3">
                {label}
            </label>
            <div className="w-4/5 px-3">
                <select
                    value={selectedConfigId || ''}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={isLoading}
                    className="mt-1 block w-full bg-neutral-800 shadow-sm focus:outline-none focus:border-orange-400 border border-neutral-600 text-neutral-100 p-2 rounded"
                >
                    <option value="">Disabled</option>
                    {configs.map(config => (
                        <option key={config.id} value={String(config.id)}>
                            {config.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

function CharacterProfilePreview({ profileId }) {
    const { getProfile, getImagesForProfile } = useCharacterProfileStore();
    const profile = getProfile(profileId);
    
    if (!profile) return null;
    
    const images = getImagesForProfile(profileId);
    const primaryImage = images?.find(img => img.is_primary) || images?.[0];
    
    return (
        <div className="mb-4 p-4 bg-neutral-900 rounded border border-neutral-700 flex items-start space-x-4">
            {primaryImage ? (
                <img
                    src={primaryImage.data_url}
                    alt={profile.name}
                    className="w-20 h-20 rounded object-cover border border-neutral-600"
                />
            ) : (
                <div className="w-20 h-20 rounded bg-neutral-800 border border-neutral-600 flex items-center justify-center text-gray-500 text-xs">
                    No Image
                </div>
            )}
            <div className="flex-1">
                <h3 className="text-lg font-semibold text-orange-400">
                    {profile.name}
                </h3>
                <p className="text-sm text-gray-400 mt-1 line-clamp-2 italic">
                    {profile.description || profile.personality || "No description provided."}
                </p>
            </div>
        </div>
    );
}

const EntitySettingsView = ({ appName }) => {
    const { 
        entities, 
        selectedEntityId, 
        loadEntities, 
        createEntity, 
        updateEntityMappings, 
        deleteEntity, 
        selectEntity,
        getEntity,
        isLoading: isEntityLoading
    } = useEntityStore();
    
    const { 
        profiles: characterProfiles, 
        loadProfiles: loadCharacterProfiles,
        loadImages: loadCharacterImages
    } = useCharacterProfileStore();
    
    const { 
        getConfigs, 
        loadConfigs, 
        getConfigById,
        isLoading: isModuleLoading
    } = useModuleConfigStore();

    const [entityMappings, setEntityMappings] = useState({
        backend: '',
        tts: '',
        stt: '',
        rag: '',
        movement: '',
        cognition: ''
    });
    const [selectedCharacterProfileId, setSelectedCharacterProfileId] = useState('');
    const [showRAGCollections, setShowRAGCollections] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [tooltipVisible, setTooltipVisible] = useState(0);
    
    // Modal states
    const [errorDialog, setErrorDialog] = useState({ isOpen: false, title: '', message: '', type: 'error' });
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [inputDialog, setInputDialog] = useState({ isOpen: false, title: '', message: '', defaultValue: '', onConfirm: null });

    useEffect(() => {
        loadEntities();
        loadCharacterProfiles();
        loadConfigs('backend');
        loadConfigs('tts');
        loadConfigs('stt');
        loadConfigs('rag');
        loadConfigs('movement');
        loadConfigs('cognition');
    }, []);

    // Auto-select first entity when entities are loaded
    useEffect(() => {
        if (entities && Array.isArray(entities) && entities.length > 0 && !selectedEntityId) {
            selectEntity(entities[0].id);
        }
    }, [entities, selectedEntityId, selectEntity]);

    const selectedEntity = useMemo(() => {
        if (!selectedEntityId || !entities || entities.length === 0) {
            return null;
        }
        return getEntity(selectedEntityId);
    }, [selectedEntityId, entities, getEntity]);

    useEffect(() => {
        if (selectedEntity) {
            // Extract config IDs from the nested modules structure
            setEntityMappings({
                backend: selectedEntity.modules?.backend?.id ? String(selectedEntity.modules.backend.id) : '',
                tts: selectedEntity.modules?.tts?.id ? String(selectedEntity.modules.tts.id) : '',
                stt: selectedEntity.modules?.stt?.id ? String(selectedEntity.modules.stt.id) : '',
                rag: selectedEntity.modules?.rag?.id ? String(selectedEntity.modules.rag.id) : '',
                movement: selectedEntity.modules?.movement?.id ? String(selectedEntity.modules.movement.id) : '',
                cognition: selectedEntity.modules?.cognition?.id ? String(selectedEntity.modules.cognition.id) : ''
            });
            // Extract character profile ID from nested structure
            setSelectedCharacterProfileId(selectedEntity.character_profile?.id || '');
            setError(null);
        } else {
            setEntityMappings({
                backend: '', tts: '', stt: '', rag: '', movement: '', cognition: ''
            });
            setSelectedCharacterProfileId('');
        }
    }, [selectedEntity]);

    const backendProvider = useMemo(() => {
        if (!entityMappings.backend) return null;
        const config = getConfigById('backend', parseInt(entityMappings.backend));
        return config?.provider;
    }, [entityMappings.backend, getConfigById]);

    const isProfileSupported = supportsCharacterProfile(backendProvider);

    // Load images for selected character profile
    useEffect(() => {
        if (selectedCharacterProfileId && isProfileSupported) {
            loadCharacterImages(selectedCharacterProfileId);
        }
    }, [selectedCharacterProfileId, isProfileSupported, loadCharacterImages]);

    // Additional effect to ensure images are loaded when profile is first set
    useEffect(() => {
        if (selectedCharacterProfileId) {
            loadCharacterImages(selectedCharacterProfileId);
        }
    }, [selectedCharacterProfileId, loadCharacterImages]);

    // Helper: Generate unique entity ID
    const generateUniqueEntityId = (baseName = 'new-entity') => {
        if (!entities) return baseName;
        
        // Convert entities array to object for easier checking
        const entityIds = {};
        entities.forEach(e => {
            entityIds[e.id] = true;
        });
        
        let newName = baseName;
        let counter = 0;
        
        while (entityIds[newName]) {
            counter++;
            newName = `${baseName}-${counter}`;
        }
        
        return newName;
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);
            setError(null);
            
            if (!selectedEntityId) {
                setError('No entity selected');
                return;
            }

            // Update character profile if changed
            const currentProfileId = selectedEntity.character_profile_id || '';
            const newProfileId = isProfileSupported ? (selectedCharacterProfileId || null) : null;
            if (currentProfileId !== (newProfileId || '')) {
                await updateEntity(selectedEntityId, newProfileId);
            }

            // Update module mappings
            const mappings = {
                backend_config_id: entityMappings.backend ? parseInt(entityMappings.backend) : null,
                tts_config_id: entityMappings.tts ? parseInt(entityMappings.tts) : null,
                stt_config_id: entityMappings.stt ? parseInt(entityMappings.stt) : null,
                rag_config_id: entityMappings.rag ? parseInt(entityMappings.rag) : null,
                movement_config_id: entityMappings.movement ? parseInt(entityMappings.movement) : null,
                cognition_config_id: entityMappings.cognition ? parseInt(entityMappings.cognition) : null
            };
            
            await updateEntityMappings(selectedEntityId, mappings);
            
            // Reload the entity to get updated data
            await loadEntities();
            
            setSuccessMessage('Entity saved successfully');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
            setError(`Failed to save entity: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        if (selectedEntity) {
            // Extract config IDs from the nested modules structure
            setEntityMappings({
                backend: selectedEntity.modules?.backend?.id ? String(selectedEntity.modules.backend.id) : '',
                tts: selectedEntity.modules?.tts?.id ? String(selectedEntity.modules.tts.id) : '',
                stt: selectedEntity.modules?.stt?.id ? String(selectedEntity.modules.stt.id) : '',
                rag: selectedEntity.modules?.rag?.id ? String(selectedEntity.modules.rag.id) : '',
                movement: selectedEntity.modules?.movement?.id ? String(selectedEntity.modules.movement.id) : '',
                cognition: selectedEntity.modules?.cognition?.id ? String(selectedEntity.modules.cognition.id) : ''
            });
            setSelectedCharacterProfileId(selectedEntity.character_profile?.id || '');
            setError(null);
        }
    };

    // Validation helper
    const validateEntityId = (id) => {
        if (!id || id.trim() === '') {
            return 'Entity ID cannot be empty';
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            return 'Entity ID can only contain letters, numbers, hyphens, and underscores';
        }
        if (getEntity(id)) {
            return 'Entity ID already exists';
        }
        return null;
    };

    const handleAdd = () => {
        const defaultName = generateUniqueEntityId('new-entity');
        setInputDialog({
            isOpen: true,
            title: 'Add Entity',
            message: 'Enter a unique ID for the new entity:',
            defaultValue: defaultName,
            onConfirm: async (entityId) => {
                setInputDialog({ ...inputDialog, isOpen: false });
                if (!entityId) return;
                
                const validationError = validateEntityId(entityId);
                if (validationError) {
                    setErrorDialog({
                        isOpen: true,
                        title: 'Invalid Entity ID',
                        message: validationError,
                        type: 'error'
                    });
                    return;
                }

                try {
                    await createEntity(entityId, null);
                    setSuccessMessage('Entity created successfully');
                    setTimeout(() => setSuccessMessage(null), 3000);
                } catch (error) {
                    setErrorDialog({
                        isOpen: true,
                        title: 'Creation Failed',
                        message: `Failed to create entity: ${error.message}`,
                        type: 'error'
                    });
                }
            }
        });
    };

    const handleDelete = async () => {
        if (!selectedEntityId) return;
        
        setConfirmDialog({
            isOpen: true,
            title: 'Confirm Delete',
            message: `Delete entity '${selectedEntityId}'?\n\nThis action cannot be undone.`,
            onConfirm: async () => {
                try {
                    await deleteEntity(selectedEntityId);
                    setSuccessMessage('Entity deleted successfully');
                    setTimeout(() => setSuccessMessage(null), 3000);
                    setConfirmDialog({ ...confirmDialog, isOpen: false });
                } catch (error) {
                    setConfirmDialog({ ...confirmDialog, isOpen: false });
                    setErrorDialog({
                        isOpen: true,
                        title: 'Deletion Failed',
                        message: `Failed to delete entity: ${error.message}`,
                        type: 'error'
                    });
                }
            }
        });
    };

    const handleCopy = () => {
        if (!selectedEntityId || !selectedEntity) return;
        
        const defaultName = generateUniqueEntityId(`${selectedEntityId}-copy`);
        setInputDialog({
            isOpen: true,
            title: 'Copy Entity',
            message: `Enter ID for the copy of '${selectedEntityId}':`,
            defaultValue: defaultName,
            onConfirm: async (newId) => {
                setInputDialog({ ...inputDialog, isOpen: false });
                if (!newId) return;

                const validationError = validateEntityId(newId);
                if (validationError) {
                    setErrorDialog({
                        isOpen: true,
                        title: 'Invalid Entity ID',
                        message: validationError,
                        type: 'error'
                    });
                    return;
                }

                try {
                    // Create entity with character profile from nested structure
                    const characterProfileId = selectedEntity.character_profile?.id || null;
                    await createEntity(newId, characterProfileId);
                    
                    // Copy module mappings from nested structure
                    const mappings = {
                        backend_config_id: selectedEntity.modules?.backend?.id || null,
                        tts_config_id: selectedEntity.modules?.tts?.id || null,
                        stt_config_id: selectedEntity.modules?.stt?.id || null,
                        rag_config_id: selectedEntity.modules?.rag?.id || null,
                        movement_config_id: selectedEntity.modules?.movement?.id || null,
                        cognition_config_id: selectedEntity.modules?.cognition?.id || null
                    };
                    await updateEntityMappings(newId, mappings);
                    
                    // Reload entities to get the updated list
                    await loadEntities();
                    
                    setSuccessMessage('Entity copied successfully');
                    setTimeout(() => setSuccessMessage(null), 3000);
                } catch (error) {
                    setErrorDialog({
                        isOpen: true,
                        title: 'Copy Failed',
                        message: `Failed to copy entity: ${error.message}`,
                        type: 'error'
                    });
                }
            }
        });
    };

    const handleRename = () => {
        if (!selectedEntityId || !selectedEntity) return;
        
        setInputDialog({
            isOpen: true,
            title: 'Rename Entity',
            message: `Enter new ID for '${selectedEntityId}':`,
            defaultValue: selectedEntityId,
            onConfirm: async (newId) => {
                setInputDialog({ ...inputDialog, isOpen: false });
                if (!newId || newId === selectedEntityId) return;

                const validationError = validateEntityId(newId);
                if (validationError) {
                    setErrorDialog({
                        isOpen: true,
                        title: 'Invalid Entity ID',
                        message: validationError,
                        type: 'error'
                    });
                    return;
                }

                setConfirmDialog({
                    isOpen: true,
                    title: 'Confirm Rename',
                    message: `Rename entity '${selectedEntityId}' to '${newId}'?\n\nThis will atomically:\n• Create a new entity with ID '${newId}'\n• Copy all configurations\n• Delete the old entity '${selectedEntityId}'\n\nThis action cannot be undone.`,
                    onConfirm: async () => {
                        try {
                            // Use atomic rename endpoint
                            await renameEntity(selectedEntityId, newId);
                            
                            // Reload entities to get updated list
                            await loadEntities();
                            
                            // Select the new entity
                            selectEntity(newId);
                            
                            setSuccessMessage(`Entity renamed from '${selectedEntityId}' to '${newId}'`);
                            setTimeout(() => setSuccessMessage(null), 3000);
                            setConfirmDialog({ ...confirmDialog, isOpen: false });
                        } catch (error) {
                            setConfirmDialog({ ...confirmDialog, isOpen: false });
                            setErrorDialog({
                                isOpen: true,
                                title: 'Rename Failed',
                                message: `Failed to rename entity: ${error.message}`,
                                type: 'error'
                            });
                        }
                    }
                });
            }
        });
    };

    const hasUnsavedChanges = () => {
        if (!selectedEntity) return false;
        const currentBackend = selectedEntity.modules?.backend?.id ? String(selectedEntity.modules.backend.id) : '';
        const currentTts = selectedEntity.modules?.tts?.id ? String(selectedEntity.modules.tts.id) : '';
        const currentStt = selectedEntity.modules?.stt?.id ? String(selectedEntity.modules.stt.id) : '';
        const currentRag = selectedEntity.modules?.rag?.id ? String(selectedEntity.modules.rag.id) : '';
        const currentMovement = selectedEntity.modules?.movement?.id ? String(selectedEntity.modules.movement.id) : '';
        const currentCognition = selectedEntity.modules?.cognition?.id ? String(selectedEntity.modules.cognition.id) : '';
        const currentProfile = selectedEntity.character_profile?.id || '';
        
        return (
            currentBackend != entityMappings.backend ||
            currentTts != entityMappings.tts ||
            currentStt != entityMappings.stt ||
            currentRag != entityMappings.rag ||
            currentMovement != entityMappings.movement ||
            currentCognition != entityMappings.cognition ||
            currentProfile != (isProfileSupported ? selectedCharacterProfileId : '')
        );
    };

    // Loading guard - only show spinner if entities haven't been loaded yet (null)
    if (isEntityLoading && entities === null) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading entities...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Error Dialog */}
            <ErrorDialog
                isOpen={errorDialog.isOpen}
                title={errorDialog.title}
                message={errorDialog.message}
                type={errorDialog.type}
                onClose={() => setErrorDialog({ ...errorDialog, isOpen: false })}
            />
            
            {/* Confirm Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                title={confirmDialog.title}
                message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
            />
            
            {/* Input Dialog */}
            <InputDialog
                isOpen={inputDialog.isOpen}
                title={inputDialog.title}
                message={inputDialog.message}
                defaultValue={inputDialog.defaultValue}
                onConfirm={inputDialog.onConfirm}
                onCancel={() => setInputDialog({ ...inputDialog, isOpen: false })}
            />
            
        <div className="flex">
            {/* Left Panel: Entity List */}
            <div className="w-1/4 p-4 space-y-4 border-r border-neutral-500 min-h-[600px]">
                <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleAdd} className="bg-neutral-700 hover:bg-neutral-600 font-bold py-1 px-2 text-orange-400 rounded text-sm">Add</button>
                    <button onClick={handleRename} disabled={!selectedEntityId} className="bg-neutral-700 hover:bg-neutral-600 font-bold py-1 px-2 text-orange-400 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed">Rename</button>
                    <button onClick={handleCopy} disabled={!selectedEntityId} className="bg-neutral-700 hover:bg-neutral-600 font-bold py-1 px-2 text-orange-400 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed">Copy</button>
                    <button onClick={handleDelete} disabled={!selectedEntityId} className="bg-red-700 hover:bg-red-600 font-bold py-1 px-2 text-white rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed">Delete</button>
                </div>
                
                <div className="flex flex-col space-y-2">
                    <div className="text-center">
                        <label className="text-sm font-medium text-neutral-300">
                            Total Entities: <span className="text-orange-400">{entities && Array.isArray(entities) ? entities.length : 0}</span>
                        </label>
                    </div>
                    <select
                        value={selectedEntityId || ''}
                        onChange={(e) => selectEntity(e.target.value)}
                        className="w-full bg-neutral-800 border border-neutral-600 text-gray-200 p-2 rounded focus:outline-none focus:border-orange-400"
                        size="15"
                    >
                        {entities && Array.isArray(entities) && entities.map((entity) => (
                            <option key={entity.id} value={entity.id} className="p-2 border-b border-neutral-700">
                                {entity.id}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center justify-center space-x-2">
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !hasUnsavedChanges()}
                        className={`font-bold py-1 px-6 rounded transition-colors ${
                            isSaving || !hasUnsavedChanges()
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                : 'bg-orange-500 hover:bg-orange-600 text-white'
                        }`}
                    >
                        {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                        onClick={handleReset}
                        disabled={!hasUnsavedChanges()}
                        className="bg-neutral-700 hover:bg-neutral-600 font-bold py-1 px-6 text-orange-400 rounded disabled:opacity-50"
                    >
                        Reset
                    </button>
                </div>
            </div>

            {/* Right Panel: Configuration */}
            <div className="w-3/4 p-6 space-y-6">
                {!selectedEntityId ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <svg className="w-16 h-16 mb-4 opacity-20" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                        <p className="text-xl">Select an entity to configure</p>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fadeIn">
                        {error && (
                            <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-400 text-sm">
                                {error}
                            </div>
                        )}
                        {successMessage && (
                            <div className="p-3 bg-green-900/30 border border-green-700 rounded text-green-400 text-sm">
                                {successMessage}
                            </div>
                        )}

                        <section className="space-y-4">
                            <h3 className="text-lg font-medium text-orange-400 border-b border-neutral-700 pb-2 flex items-center">
                                Identity Settings
                                <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                    Configure the character identity for this entity.
                                </SettingsTooltip>
                            </h3>
                            
                            <div className="flex items-center w-full">
                                <label className="block text-sm font-medium text-gray-300 w-1/5 px-3">
                                    Character Profile
                                </label>
                                <div className="w-4/5 px-3">
                                    <select
                                        value={selectedCharacterProfileId || ''}
                                        onChange={(e) => setSelectedCharacterProfileId(e.target.value)}
                                        disabled={!isProfileSupported}
                                        className={`w-full p-2 rounded border focus:outline-none transition-colors ${
                                            !isProfileSupported
                                                ? 'bg-neutral-800 border-neutral-700 text-gray-600 cursor-not-allowed'
                                                : 'bg-neutral-800 border-neutral-600 text-white focus:border-orange-400'
                                        }`}
                                    >
                                        <option value="">No Character Profile</option>
                                        {characterProfiles.map(profile => (
                                            <option key={profile.id} value={profile.id}>
                                                {profile.name}
                                            </option>
                                        ))}
                                    </select>
                                    {!isProfileSupported && (
                                        <p className="mt-2 text-xs text-blue-400 flex items-center">
                                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                            </svg>
                                            {backendProvider 
                                                ? `This backend provider (${backendProvider}) has built-in identity and doesn't use Harmony Link profiles.`
                                                : 'Character profiles require a backend configuration which supports custom prompting. Please select a backend module first.'}
                                        </p>
                                    )}
                                </div>
                            </div>
                            
                            {selectedCharacterProfileId && isProfileSupported && (
                                <div className="flex w-full">
                                    <div className="w-1/5"></div>
                                    <div className="w-4/5 px-3">
                                        <CharacterProfilePreview profileId={selectedCharacterProfileId} />
                                    </div>
                                </div>
                            )}
                        </section>

                        <section className="space-y-4">
                            <h3 className="text-lg font-medium text-orange-400 border-b border-neutral-700 pb-2 flex items-center">
                                Module Configurations
                                <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                    Select pre-configured module settings for this entity.
                                </SettingsTooltip>
                            </h3>

                            <ModuleConfigSelector
                                label="AI Backend / LLM"
                                moduleType="backend"
                                selectedConfigId={entityMappings.backend}
                                onChange={(id) => setEntityMappings(prev => ({ ...prev, backend: id }))}
                                configs={getConfigs('backend')}
                                isLoading={isModuleLoading}
                            />
                            
                            <ModuleConfigSelector
                                label="Text-to-Speech"
                                moduleType="tts"
                                selectedConfigId={entityMappings.tts}
                                onChange={(id) => setEntityMappings(prev => ({ ...prev, tts: id }))}
                                configs={getConfigs('tts')}
                                isLoading={isModuleLoading}
                            />
                            
                            <ModuleConfigSelector
                                label="Speech-to-Text"
                                moduleType="stt"
                                selectedConfigId={entityMappings.stt}
                                onChange={(id) => setEntityMappings(prev => ({ ...prev, stt: id }))}
                                configs={getConfigs('stt')}
                                isLoading={isModuleLoading}
                            />
                            
                            <div className="flex flex-wrap items-center w-full">
                                <ModuleConfigSelector
                                    label="RAG Settings"
                                    moduleType="rag"
                                    selectedConfigId={entityMappings.rag}
                                    onChange={(id) => setEntityMappings(prev => ({ ...prev, rag: id }))}
                                    configs={getConfigs('rag')}
                                    isLoading={isModuleLoading}
                                />
                                <div className="w-1/5"></div>
                                <div className="w-4/5 px-3">
                                    <button
                                        onClick={() => setShowRAGCollections(true)}
                                        className="bg-neutral-700 hover:bg-neutral-600 text-orange-400 text-sm py-1 px-3 rounded border border-neutral-600 transition-colors"
                                    >
                                        Manage RAG Collections
                                    </button>
                                </div>
                            </div>

                            <RAGCollectionManager
                                entityId={selectedEntityId}
                                isOpen={showRAGCollections}
                                onClose={() => setShowRAGCollections(false)}
                                onError={(msg) => setErrorDialog({
                                    isOpen: true,
                                    title: 'RAG Error',
                                    message: msg,
                                    type: 'error'
                                })}
                            />
                            
                            <ModuleConfigSelector
                                label="Movement"
                                moduleType="movement"
                                selectedConfigId={entityMappings.movement}
                                onChange={(id) => setEntityMappings(prev => ({ ...prev, movement: id }))}
                                configs={getConfigs('movement')}
                                isLoading={isModuleLoading}
                            />
                            
                            <ModuleConfigSelector
                                label="Cognition"
                                moduleType="cognition"
                                selectedConfigId={entityMappings.cognition}
                                onChange={(id) => setEntityMappings(prev => ({ ...prev, cognition: id }))}
                                configs={getConfigs('cognition')}
                                isLoading={isModuleLoading}
                            />
                        </section>
                    </div>
                )}
            </div>
        </div>
        </>
    );
};

export default EntitySettingsView;
