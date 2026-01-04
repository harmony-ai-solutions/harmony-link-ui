import React, { useState, useEffect, useMemo } from 'react';
import useEntityStore from '../store/entityStore';
import useCharacterProfileStore from '../store/characterProfileStore';
import useModuleConfigStore from '../store/moduleConfigStore';
import { supportsCharacterProfile } from '../constants/backendProviders';
import { updateEntity } from '../services/management/entityService';
import SettingsTooltip from "./settings/SettingsTooltip.jsx";

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
                        <option key={config.id} value={config.id}>
                            {config.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}

function CharacterProfilePreview({ profileId }) {
    const { getCharacterProfile } = useCharacterProfileStore();
    const profile = getCharacterProfile(profileId);
    
    if (!profile) return null;
    
    const primaryImage = profile.images?.find(img => img.is_primary);
    
    return (
        <div className="mb-4 p-4 bg-neutral-900 rounded border border-neutral-700 flex items-start space-x-4">
            {primaryImage ? (
                <img
                    src={primaryImage.url}
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
        loadProfiles: loadCharacterProfiles 
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
        countenance: ''
    });
    const [selectedCharacterProfileId, setSelectedCharacterProfileId] = useState('');
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [tooltipVisible, setTooltipVisible] = useState(0);

    useEffect(() => {
        loadEntities();
        loadCharacterProfiles();
        loadConfigs('backend');
        loadConfigs('tts');
        loadConfigs('stt');
        loadConfigs('rag');
        loadConfigs('movement');
        loadConfigs('countenance');
    }, []);

    const selectedEntity = useMemo(() => getEntity(selectedEntityId), [selectedEntityId, entities]);

    useEffect(() => {
        if (selectedEntity) {
            setEntityMappings({
                backend: selectedEntity.backend_config_id || '',
                tts: selectedEntity.tts_config_id || '',
                stt: selectedEntity.stt_config_id || '',
                rag: selectedEntity.rag_config_id || '',
                movement: selectedEntity.movement_config_id || '',
                countenance: selectedEntity.countenance_config_id || ''
            });
            setSelectedCharacterProfileId(selectedEntity.character_profile_id || '');
            setError(null);
        } else {
            setEntityMappings({
                backend: '', tts: '', stt: '', rag: '', movement: '', countenance: ''
            });
            setSelectedCharacterProfileId('');
        }
    }, [selectedEntity]);

    const backendProvider = useMemo(() => {
        if (!entityMappings.backend) return null;
        const config = getConfigById('backend', parseInt(entityMappings.backend));
        return config?.config?.provider;
    }, [entityMappings.backend, getConfigById]);

    const isProfileSupported = supportsCharacterProfile(backendProvider);

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
                countenance_config_id: entityMappings.countenance ? parseInt(entityMappings.countenance) : null
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
            setEntityMappings({
                backend: selectedEntity.backend_config_id || '',
                tts: selectedEntity.tts_config_id || '',
                stt: selectedEntity.stt_config_id || '',
                rag: selectedEntity.rag_config_id || '',
                movement: selectedEntity.movement_config_id || '',
                countenance: selectedEntity.countenance_config_id || ''
            });
            setSelectedCharacterProfileId(selectedEntity.character_profile_id || '');
            setError(null);
        }
    };

    const handleAdd = async () => {
        const entityId = prompt('Enter new entity ID:');
        if (!entityId) return;
        
        if (getEntity(entityId)) {
            alert('Entity ID already exists');
            return;
        }

        try {
            await createEntity(entityId, null);
            setSuccessMessage('Entity created successfully');
        } catch (error) {
            alert(`Failed to create entity: ${error.message}`);
        }
    };

    const handleDelete = async () => {
        if (!selectedEntityId) return;
        if (!window.confirm(`Delete entity '${selectedEntityId}'? This cannot be undone.`)) return;

        try {
            await deleteEntity(selectedEntityId);
            setSuccessMessage('Entity deleted successfully');
        } catch (error) {
            alert(`Failed to delete entity: ${error.message}`);
        }
    };

    const handleCopy = async () => {
        if (!selectedEntityId || !selectedEntity) return;
        const newId = prompt('Enter new entity ID:', `${selectedEntityId}_copy`);
        if (!newId) return;

        try {
            await createEntity(newId, selectedEntity.character_profile_id);
            const mappings = {
                backend_config_id: selectedEntity.backend_config_id,
                tts_config_id: selectedEntity.tts_config_id,
                stt_config_id: selectedEntity.stt_config_id,
                rag_config_id: selectedEntity.rag_config_id,
                movement_config_id: selectedEntity.movement_config_id,
                countenance_config_id: selectedEntity.countenance_config_id
            };
            await updateEntityMappings(newId, mappings);
            setSuccessMessage('Entity copied successfully');
        } catch (error) {
            alert(`Failed to copy entity: ${error.message}`);
        }
    };

    const hasUnsavedChanges = () => {
        if (!selectedEntity) return false;
        return (
            (selectedEntity.backend_config_id || '') != entityMappings.backend ||
            (selectedEntity.tts_config_id || '') != entityMappings.tts ||
            (selectedEntity.stt_config_id || '') != entityMappings.stt ||
            (selectedEntity.rag_config_id || '') != entityMappings.rag ||
            (selectedEntity.movement_config_id || '') != entityMappings.movement ||
            (selectedEntity.countenance_config_id || '') != entityMappings.countenance ||
            (selectedEntity.character_profile_id || '') != (isProfileSupported ? selectedCharacterProfileId : '')
        );
    };

    return (
        <div className="flex">
            {/* Left Panel: Entity List */}
            <div className="w-1/4 p-4 space-y-4 border-r border-neutral-500 min-h-[600px]">
                <div className="flex items-center justify-center space-x-2">
                    <button onClick={handleAdd} className="bg-neutral-700 hover:bg-neutral-600 font-bold py-1 px-3 text-orange-400 rounded">Add</button>
                    <button onClick={handleCopy} className="bg-neutral-700 hover:bg-neutral-600 font-bold py-1 px-3 text-orange-400 rounded">Copy</button>
                    <button onClick={handleDelete} className="bg-red-700 hover:bg-red-600 font-bold py-1 px-3 text-white rounded">Delete</button>
                </div>
                
                <div className="flex flex-col space-y-2">
                    <div className="text-center">
                        <label className="text-sm font-medium text-neutral-300">
                            Total Entities: <span className="text-orange-400">{entities.length}</span>
                        </label>
                    </div>
                    <select
                        value={selectedEntityId || ''}
                        onChange={(e) => selectEntity(e.target.value)}
                        className="w-full bg-neutral-800 border border-neutral-600 text-gray-200 p-2 rounded focus:outline-none focus:border-orange-400"
                        size="15"
                    >
                        {entities.map((entity) => (
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
                                    {!isProfileSupported && backendProvider && (
                                        <p className="mt-2 text-xs text-blue-400 flex items-center">
                                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                            </svg>
                                            This backend provider ({backendProvider}) has built-in identity and doesn't use Harmony Link profiles.
                                        </p>
                                    )}
                                </div>
                            </div>
                            
                            {selectedCharacterProfileId && isProfileSupported && (
                                <div className="flex w-full">
                                    <div className="w-1/5"></div>
                                    <div className="w-4/5 px-3">
                                        <CharacterProfilePreview profileId={parseInt(selectedCharacterProfileId)} />
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
                            
                            <ModuleConfigSelector
                                label="RAG Settings"
                                moduleType="rag"
                                selectedConfigId={entityMappings.rag}
                                onChange={(id) => setEntityMappings(prev => ({ ...prev, rag: id }))}
                                configs={getConfigs('rag')}
                                isLoading={isModuleLoading}
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
                                label="Countenance"
                                moduleType="countenance"
                                selectedConfigId={entityMappings.countenance}
                                onChange={(id) => setEntityMappings(prev => ({ ...prev, countenance: id }))}
                                configs={getConfigs('countenance')}
                                isLoading={isModuleLoading}
                            />
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EntitySettingsView;
