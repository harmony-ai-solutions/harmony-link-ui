import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useEntityStore from '../store/entityStore';
import useModuleConfigStore from '../store/moduleConfigStore';
import useCharacterProfileStore from '../store/characterProfileStore';
import ThemedSelect from './widgets/ThemedSelect';
import CharacterProfilePreview from './widgets/CharacterProfilePreview';
import RAGCollectionManager from './modules/RAGCollectionManager';
import { supportsCharacterProfile } from '../constants/backendProviders';
import { updateEntity, renameEntity, resetEntityLifecycleConfig } from '../services/management/entityService';
import SettingsTooltip from "./settings/SettingsTooltip.jsx";
import ErrorDialog from "./modals/ErrorDialog.jsx";
import ConfirmDialog from "./modals/ConfirmDialog.jsx";
import InputDialog from "./modals/InputDialog.jsx";
import LifecycleConfigEditor from './settings/LifecycleConfigEditor.jsx';
import useAllIntegrationInstances from '../hooks/useAllIntegrationInstances';
import useDockerStatus from '../hooks/useDockerStatus';
import IntegrationStatusBanner from './integrations/IntegrationStatusBanner.jsx';


function ModuleConfigSelector({ label, moduleType, selectedConfigId, onChange, configs, isLoading, disabled }) {
    const { t } = useTranslation();
    const options = [
        { value: '', label: t('entitySettings:modules.disabled') },
        ...configs.map(config => ({ value: String(config.id), label: config.name }))
    ];

    return (
        <div className="flex items-center mb-4 w-full">
            <label className="block text-sm font-medium text-text-secondary w-1/5 px-3">
                {label}
            </label>
            <div className="w-4/5 px-3">
                <ThemedSelect
                    value={selectedConfigId || ''}
                    onChange={onChange}
                    options={options}
                    disabled={isLoading || disabled}
                />
            </div>
        </div>
    );
}


const EntitySettingsView = ({ appName }) => {
    const { t } = useTranslation();
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

    const { allInstances, refresh: refreshInstances } = useAllIntegrationInstances();
    const { dockerStatus } = useDockerStatus();

    const [entityMappings, setEntityMappings] = useState({
        backend: '',
        cognition: '',
        imagination: '',
        movement: '',
        rag: '',
        stt: '',
        tts: '',
        vision: ''
    });
    const [selectedCharacterProfileId, setSelectedCharacterProfileId] = useState('');
    const [showRAGCollections, setShowRAGCollections] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [tooltipVisible, setTooltipVisible] = useState(0);

    // Alias state
    const [entityAlias, setEntityAlias] = useState('');

    // Lifecycle config state
    const [entityLifecycleConfig, setEntityLifecycleConfig] = useState(null);
    const [isLifecycleLoaded, setIsLifecycleLoaded] = useState(false);

    // Modal states
    const [errorDialog, setErrorDialog] = useState({ isOpen: false, title: '', message: '', type: 'error' });
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
    const [inputDialog, setInputDialog] = useState({ isOpen: false, title: '', message: '', defaultValue: '', onConfirm: null });

    // Helper for translated keys
    const tes = (key, opts) => t(`entitySettings:${key}`, opts);

    useEffect(() => {
        loadEntities();
        loadCharacterProfiles();
        loadConfigs('backend');
        loadConfigs('cognition');
        loadConfigs('imagination');
        loadConfigs('movement');
        loadConfigs('rag');
        loadConfigs('stt');
        loadConfigs('tts');
        loadConfigs('vision');
    }, []);

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
            setEntityMappings({
                backend: selectedEntity.modules?.backend?.id ? String(selectedEntity.modules.backend.id) : '',
                cognition: selectedEntity.modules?.cognition?.id ? String(selectedEntity.modules.cognition.id) : '',
                imagination: selectedEntity.modules?.imagination?.id ? String(selectedEntity.modules.imagination.id) : '',
                movement: selectedEntity.modules?.movement?.id ? String(selectedEntity.modules.movement.id) : '',
                rag: selectedEntity.modules?.rag?.id ? String(selectedEntity.modules.rag.id) : '',
                stt: selectedEntity.modules?.stt?.id ? String(selectedEntity.modules.stt.id) : '',
                tts: selectedEntity.modules?.tts?.id ? String(selectedEntity.modules.tts.id) : '',
                vision: selectedEntity.modules?.vision?.id ? String(selectedEntity.modules.vision.id) : ''
            });
            setSelectedCharacterProfileId(selectedEntity.character_profile?.id || '');
            setEntityAlias(selectedEntity.alias || '');
            if (selectedEntity.lifecycle_config) {
                try {
                    const parsed = typeof selectedEntity.lifecycle_config === 'string'
                        ? JSON.parse(selectedEntity.lifecycle_config)
                        : selectedEntity.lifecycle_config;
                    setEntityLifecycleConfig(parsed);
                } catch (e) {
                    setEntityLifecycleConfig(null);
                }
            } else {
                setEntityLifecycleConfig(null);
            }
            setIsLifecycleLoaded(true);
            setError(null);
        } else {
            setEntityMappings({
                backend: '', cognition: '', imagination: '', movement: '', rag: '', stt: '', tts: '', vision: ''
            });
            setSelectedCharacterProfileId('');
            setEntityAlias('');
            setEntityLifecycleConfig(null);
            setIsLifecycleLoaded(false);
        }
    }, [selectedEntity]);

    const backendProvider = useMemo(() => {
        if (!entityMappings.backend) return null;
        const config = getConfigById('backend', entityMappings.backend);
        return config?.provider;
    }, [entityMappings.backend, getConfigById]);

    const isProfileSupported = supportsCharacterProfile(backendProvider);

    useEffect(() => {
        if (selectedCharacterProfileId && isProfileSupported) {
            loadCharacterImages(selectedCharacterProfileId);
        }
    }, [selectedCharacterProfileId, isProfileSupported, loadCharacterImages]);

    useEffect(() => {
        if (selectedCharacterProfileId) {
            loadCharacterImages(selectedCharacterProfileId);
        }
    }, [selectedCharacterProfileId, loadCharacterImages]);

    const generateUniqueEntityId = (baseName = 'new-entity') => {
        if (!entities) return baseName;
        const entityIds = {};
        entities.forEach(e => { entityIds[e.id] = true; });
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
                setError(tes('validation.noEntitySelected'));
                return;
            }

            const currentProfileId = selectedEntity.character_profile_id || '';
            const currentAlias = selectedEntity.alias || '';
            const newProfileId = isProfileSupported ? (selectedCharacterProfileId || null) : null;
            if (currentProfileId !== (newProfileId || '') || currentAlias !== entityAlias) {
                await updateEntity(selectedEntityId, newProfileId, null, entityAlias);
            }

            const mappings = {
                backend_config_id: entityMappings.backend || null,
                cognition_config_id: entityMappings.cognition || null,
                imagination_config_id: entityMappings.imagination || null,
                movement_config_id: entityMappings.movement || null,
                rag_config_id: entityMappings.rag || null,
                stt_config_id: entityMappings.stt || null,
                tts_config_id: entityMappings.tts || null,
                vision_config_id: entityMappings.vision || null
            };

            await updateEntityMappings(selectedEntityId, mappings);
            await loadEntities();

            setSuccessMessage(tes('messages.saveSuccess'));
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
            setError(tes('messages.saveFailed', { message: error.message }));
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        if (selectedEntity) {
            setEntityMappings({
                backend: selectedEntity.modules?.backend?.id ? String(selectedEntity.modules.backend.id) : '',
                cognition: selectedEntity.modules?.cognition?.id ? String(selectedEntity.modules.cognition.id) : '',
                imagination: selectedEntity.modules?.imagination?.id ? String(selectedEntity.modules.imagination.id) : '',
                movement: selectedEntity.modules?.movement?.id ? String(selectedEntity.modules.movement.id) : '',
                rag: selectedEntity.modules?.rag?.id ? String(selectedEntity.modules.rag.id) : '',
                stt: selectedEntity.modules?.stt?.id ? String(selectedEntity.modules.stt.id) : '',
                tts: selectedEntity.modules?.tts?.id ? String(selectedEntity.modules.tts.id) : '',
                vision: selectedEntity.modules?.vision?.id ? String(selectedEntity.modules.vision.id) : ''
            });
            setSelectedCharacterProfileId(selectedEntity.character_profile?.id || '');
            setEntityAlias(selectedEntity.alias || '');
            if (selectedEntity.lifecycle_config) {
                try {
                    const parsed = typeof selectedEntity.lifecycle_config === 'string'
                        ? JSON.parse(selectedEntity.lifecycle_config)
                        : selectedEntity.lifecycle_config;
                    setEntityLifecycleConfig(parsed);
                } catch (e) {
                    setEntityLifecycleConfig(null);
                }
            } else {
                setEntityLifecycleConfig(null);
            }
            setError(null);
        }
    };

    const handleResetToCharacterDefaults = async () => {
        if (!selectedEntityId) return;
        try {
            const result = await resetEntityLifecycleConfig(selectedEntityId);
            if (result.lifecycle_config) {
                try {
                    const parsed = typeof result.lifecycle_config === 'string'
                        ? JSON.parse(result.lifecycle_config)
                        : result.lifecycle_config;
                    setEntityLifecycleConfig(parsed);
                } catch (e) {
                    setEntityLifecycleConfig(null);
                }
            }
            setSuccessMessage(tes('messages.lifecycleReset'));
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
            setError(tes('messages.lifecycleResetFailed', { message: error.message }));
        }
    };

    const handleSaveLifecycleConfig = async () => {
        if (!selectedEntityId || !entityLifecycleConfig) return;
        try {
            await updateEntity(selectedEntityId, null, JSON.stringify(entityLifecycleConfig));
            await loadEntities();
            setSuccessMessage(tes('messages.lifecycleSaved'));
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
            setError(tes('messages.lifecycleSaveFailed', { message: error.message }));
        }
    };

    const handleLifecycleConfigChange = (newConfig) => {
        setEntityLifecycleConfig(newConfig);
    };

    const validateEntityId = (id) => {
        if (!id || id.trim() === '') {
            return tes('validation.empty');
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
            return tes('validation.invalidChars');
        }
        if (getEntity(id)) {
            return tes('validation.alreadyExists');
        }
        return null;
    };

    const handleAdd = () => {
        const defaultName = generateUniqueEntityId('new-entity');
        setInputDialog({
            isOpen: true,
            title: tes('dialogs.add.title'),
            message: tes('dialogs.add.message'),
            defaultValue: defaultName,
            onConfirm: async (entityId) => {
                setInputDialog({ ...inputDialog, isOpen: false });
                if (!entityId) return;

                const validationError = validateEntityId(entityId);
                if (validationError) {
                    setErrorDialog({
                        isOpen: true,
                        title: tes('dialogs.invalidEntityId.title'),
                        message: validationError,
                        type: 'error'
                    });
                    return;
                }

                try {
                    await createEntity(entityId, null);
                    setSuccessMessage(tes('messages.createSuccess'));
                    setTimeout(() => setSuccessMessage(null), 3000);
                } catch (error) {
                    setErrorDialog({
                        isOpen: true,
                        title: tes('dialogs.creationFailed.title'),
                        message: tes('messages.createFailed', { message: error.message }),
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
            title: tes('dialogs.confirmDelete.title'),
            message: tes('dialogs.confirmDelete.message', { entityId: selectedEntityId }),
            onConfirm: async () => {
                try {
                    await deleteEntity(selectedEntityId);
                    setSuccessMessage(tes('messages.deleteSuccess'));
                    setTimeout(() => setSuccessMessage(null), 3000);
                    setConfirmDialog({ ...confirmDialog, isOpen: false });
                } catch (error) {
                    setConfirmDialog({ ...confirmDialog, isOpen: false });
                    setErrorDialog({
                        isOpen: true,
                        title: tes('dialogs.deletionFailed.title'),
                        message: tes('messages.deleteFailed', { message: error.message }),
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
            title: tes('dialogs.copy.title'),
            message: tes('dialogs.copy.message', { entityId: selectedEntityId }),
            defaultValue: defaultName,
            onConfirm: async (newId) => {
                setInputDialog({ ...inputDialog, isOpen: false });
                if (!newId) return;
                const validationError = validateEntityId(newId);
                if (validationError) {
                    setErrorDialog({
                        isOpen: true,
                        title: tes('dialogs.invalidEntityId.title'),
                        message: validationError,
                        type: 'error'
                    });
                    return;
                }
                try {
                    const characterProfileId = selectedEntity.character_profile?.id || null;
                    await createEntity(newId, characterProfileId);
                    const mappings = {
                        backend_config_id: selectedEntity.modules?.backend?.id || null,
                        cognition_config_id: selectedEntity.modules?.cognition?.id || null,
                        imagination_config_id: selectedEntity.modules?.imagination?.id || null,
                        movement_config_id: selectedEntity.modules?.movement?.id || null,
                        rag_config_id: selectedEntity.modules?.rag?.id || null,
                        stt_config_id: selectedEntity.modules?.stt?.id || null,
                        tts_config_id: selectedEntity.modules?.tts?.id || null,
                        vision_config_id: selectedEntity.modules?.vision?.id || null
                    };
                    await updateEntityMappings(newId, mappings);
                    const sourceAlias = selectedEntity.alias || '';
                    if (sourceAlias) {
                        await updateEntity(newId, null, null, sourceAlias);
                    }
                    await loadEntities();
                    setSuccessMessage(tes('messages.copySuccess'));
                    setTimeout(() => setSuccessMessage(null), 3000);
                } catch (error) {
                    setErrorDialog({
                        isOpen: true,
                        title: tes('dialogs.copyFailed.title'),
                        message: tes('messages.copyFailedDetail', { message: error.message }),
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
            title: tes('dialogs.rename.title'),
            message: tes('dialogs.rename.message', { entityId: selectedEntityId }),
            defaultValue: selectedEntityId,
            onConfirm: async (newId) => {
                setInputDialog({ ...inputDialog, isOpen: false });
                if (!newId || newId === selectedEntityId) return;
                const validationError = validateEntityId(newId);
                if (validationError) {
                    setErrorDialog({
                        isOpen: true,
                        title: tes('dialogs.invalidEntityId.title'),
                        message: validationError,
                        type: 'error'
                    });
                    return;
                }
                setConfirmDialog({
                    isOpen: true,
                    title: tes('dialogs.confirmRename.title'),
                    message: tes('dialogs.confirmRename.message', { oldId: selectedEntityId, newId: newId }),
                    onConfirm: async () => {
                        try {
                            await renameEntity(selectedEntityId, newId);
                            await loadEntities();
                            selectEntity(newId);
                            setSuccessMessage(tes('messages.renamedFrom', { oldId: selectedEntityId, newId: newId }));
                            setTimeout(() => setSuccessMessage(null), 3000);
                            setConfirmDialog({ ...confirmDialog, isOpen: false });
                        } catch (error) {
                            setConfirmDialog({ ...confirmDialog, isOpen: false });
                            setErrorDialog({
                                isOpen: true,
                                title: tes('dialogs.renameFailed.title'),
                                message: tes('messages.renameFailedDetail', { message: error.message }),
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
        const currentCognition = selectedEntity.modules?.cognition?.id ? String(selectedEntity.modules.cognition.id) : '';
        const currentImagination = selectedEntity.modules?.imagination?.id ? String(selectedEntity.modules.imagination.id) : '';
        const currentMovement = selectedEntity.modules?.movement?.id ? String(selectedEntity.modules.movement.id) : '';
        const currentRag = selectedEntity.modules?.rag?.id ? String(selectedEntity.modules.rag.id) : '';
        const currentStt = selectedEntity.modules?.stt?.id ? String(selectedEntity.modules.stt.id) : '';
        const currentTts = selectedEntity.modules?.tts?.id ? String(selectedEntity.modules.tts.id) : '';
        const currentVision = selectedEntity.modules?.vision?.id ? String(selectedEntity.modules.vision.id) : '';
        const currentProfile = selectedEntity.character_profile?.id || '';
        const currentAlias = selectedEntity.alias || '';
        return (
            currentBackend != entityMappings.backend ||
            currentCognition != entityMappings.cognition ||
            currentImagination != entityMappings.imagination ||
            currentMovement != entityMappings.movement ||
            currentRag != entityMappings.rag ||
            currentStt != entityMappings.stt ||
            currentTts != entityMappings.tts ||
            currentVision != entityMappings.vision ||
            currentProfile != (isProfileSupported ? selectedCharacterProfileId : '') ||
            currentAlias != entityAlias
        );
    };

    if (isEntityLoading && entities === null) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
                    <p className="text-text-muted">{t('common:status.loading')}</p>
                </div>
            </div>
        );
    }

    const colorFirstWord = (text) => {
        const spaceIdx = text.indexOf(' ');
        if (spaceIdx === -1) return <span className="text-gradient-primary">{text}</span>;
        return <><span className="text-gradient-primary">{text.slice(0, spaceIdx)}</span>{text.slice(spaceIdx)}</>;
    };

    return (
        <>
            <ErrorDialog isOpen={errorDialog.isOpen} title={errorDialog.title} message={errorDialog.message}
                type={errorDialog.type} onClose={() => setErrorDialog({ ...errorDialog, isOpen: false })} />
            <ConfirmDialog isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} />
            <InputDialog isOpen={inputDialog.isOpen} title={inputDialog.title} message={inputDialog.message}
                defaultValue={inputDialog.defaultValue} onConfirm={inputDialog.onConfirm}
                onCancel={() => setInputDialog({ ...inputDialog, isOpen: false })} />

            <div className="flex flex-col min-h-full bg-background-base">
                {/* View Header */}
                <div className="bg-background-surface/30 backdrop-blur-sm px-6 py-4">
                    <h1 className="text-2xl font-extrabold tracking-tight">
                        {colorFirstWord(tes('header.title'))}
                    </h1>
                    <p className="text-xs text-text-muted mt-0.5 font-medium">
                        {tes('header.subtitle')}
                    </p>
                </div>

                <div className="flex flex-1">
                    {/* Left Panel: Entity List */}
                    <div className="w-1/4 p-4 space-y-4 border-r border-white/10 min-h-[600px]">
                        <div className="grid grid-cols-2 gap-2">
                            <button data-tutorial-id="entity-add-btn" onClick={handleAdd} className="btn-secondary text-sm py-1.5 px-3">{tes('buttons.add')}</button>
                            <button onClick={handleRename} disabled={!selectedEntityId} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed">{tes('buttons.rename')}</button>
                            <button onClick={handleCopy} disabled={!selectedEntityId} className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed">{tes('buttons.copy')}</button>
                            <button onClick={handleDelete} disabled={!selectedEntityId} className="btn-danger text-sm py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed font-bold">{tes('buttons.delete')}</button>
                        </div>

                        <div className="flex flex-col space-y-2">
                            <div className="text-center">
                                <label className="text-sm font-medium text-text-secondary">
                                    {tes('entityList.totalEntities', { count: entities && Array.isArray(entities) ? entities.length : 0 })}
                                </label>
                            </div>
                            <div data-tutorial-id="entity-list" className="input-field w-full custom-scrollbar border-white/10 h-[384px] overflow-y-auto p-1 space-y-0.5">
                                {entities && Array.isArray(entities) && entities.map((entity) => (
                                    <div key={entity.id} onClick={() => selectEntity(entity.id)}
                                        className={`px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-200 flex items-center justify-between group relative border ${selectedEntityId === entity.id
                                            ? 'bg-accent-primary/20 border-accent-primary/40 text-accent-primary font-bold shadow-sm'
                                            : 'text-text-primary hover:bg-white/5 border-transparent'
                                            }`}>
                                        <div className="flex items-center gap-3">
                                            {selectedEntityId === entity.id && (
                                                <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-accent-primary rounded-r-full" />
                                            )}
                                            <span className="truncate">{entity.id}</span>
                                            {entity.alias && (
                                                <span className="text-xs text-text-muted truncate ml-1">({entity.alias})</span>
                                            )}
                                        </div>
                                        {selectedEntityId === entity.id && (
                                            <svg className="w-4 h-4 text-accent-primary" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </div>
                                ))}
                                {(!entities || entities.length === 0) && (
                                    <div className="h-full flex items-center justify-center text-text-muted italic text-xs">
                                        {tes('entityList.noEntities')}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-center space-x-2">
                            <button data-tutorial-id="entity-save-btn" onClick={handleSave}
                                disabled={isSaving || !hasUnsavedChanges()}
                                className={`btn-primary ${isSaving || !hasUnsavedChanges() ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                {isSaving ? tes('buttons.saving') : tes('buttons.save')}
                            </button>
                            <button onClick={handleReset} disabled={!hasUnsavedChanges()}
                                className={`btn-secondary ${!hasUnsavedChanges() ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                {tes('buttons.reset')}
                            </button>
                        </div>
                    </div>

                    {/* Right Panel: Configuration */}
                    <div className="w-3/4 p-6 space-y-6">
                        {!selectedEntityId ? (
                            <div className="flex flex-col items-center justify-center h-full text-text-muted">
                                <svg className="w-16 h-16 mb-4 opacity-20" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                </svg>
                                <p className="text-xl text-text-primary">{tes('entityList.selectPlaceholder')}</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-fadeIn">
                                {error && (
                                    <div className="p-3 bg-error-bg/30 border border-error-bg rounded text-error text-sm">{error}</div>
                                )}
                                {successMessage && (
                                    <div className="p-3 bg-success-bg/30 border border-success-bg rounded text-success text-sm">{successMessage}</div>
                                )}

                                <section className="space-y-4">
                                    <h3 data-tutorial-id="entity-identity-section" className="text-lg font-bold text-text-primary pb-2 flex items-center gap-2 w-full mb-6">
                                        <span className="text-gradient-primary">{tes('sections.identitySettings')}</span>
                                        <SettingsTooltip tooltipIndex={1} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                            {tes('sections.identityTooltip')}
                                        </SettingsTooltip>
                                    </h3>

                                    <div className="flex items-center mb-4 w-full">
                                        <label className="block text-sm font-medium text-text-secondary w-1/5 px-3">
                                            {tes('fields.entityAlias.label')}
                                            <SettingsTooltip tooltipIndex={4} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                                {tes('fields.entityAlias.tooltip')}
                                            </SettingsTooltip>
                                        </label>
                                        <div className="w-4/5 px-3">
                                            <input type="text" value={entityAlias} onChange={(e) => setEntityAlias(e.target.value)}
                                                className="input-field w-full p-2 rounded text-sm" placeholder={tes('fields.entityAlias.placeholder')} />
                                        </div>
                                    </div>

                                    <div className="flex items-center mb-4 w-full">
                                        <label className="block text-sm font-medium text-text-secondary w-1/5 px-3">
                                            {tes('fields.characterProfile.label')}
                                        </label>
                                        <div className="w-4/5 px-3" data-tutorial-id="entity-char-profile-select">
                                            <ThemedSelect
                                                value={selectedCharacterProfileId || ''}
                                                onChange={(val) => setSelectedCharacterProfileId(val)}
                                                options={[
                                                    { value: '', label: tes('fields.characterProfile.noProfile') },
                                                    ...characterProfiles.map(profile => ({ value: profile.id, label: profile.name }))
                                                ]}
                                                disabled={!isProfileSupported}
                                                placeholder={tes('fields.characterProfile.selectPlaceholder')}
                                            />
                                            {!isProfileSupported && (
                                                <p className="mt-2 text-xs text-accent-secondary flex items-center italic font-medium">
                                                    <svg className="w-4 h-4 mr-1 text-accent-secondary" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                                    </svg>
                                                    {backendProvider
                                                        ? tes('fields.characterProfile.unsupportedBackend', { provider: backendProvider })
                                                        : tes('fields.characterProfile.unsupportedNoBackend')}
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

                                <IntegrationStatusBanner
                                    entityMappings={entityMappings} getConfigById={getConfigById}
                                    allInstances={allInstances} onRefresh={refreshInstances} dockerStatus={dockerStatus} />

                                <section className="space-y-4">
                                    <h3 data-tutorial-id="entity-module-section" className="text-lg font-bold text-text-primary pb-2 flex items-center gap-2 w-full mb-6 mt-8">
                                        <span className="text-gradient-primary">{tes('sections.moduleConfigurations')}</span>
                                        <SettingsTooltip tooltipIndex={2} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                            {tes('sections.moduleTooltip')}
                                        </SettingsTooltip>
                                    </h3>

                                    <div data-tutorial-id="entity-module-backend">
                                        <ModuleConfigSelector label={tes('modules.backend')} moduleType="backend"
                                            selectedConfigId={entityMappings.backend}
                                            onChange={(id) => setEntityMappings(prev => ({ ...prev, backend: id }))}
                                            configs={getConfigs('backend')} isLoading={isModuleLoading} />
                                    </div>
                                    <div data-tutorial-id="entity-module-tts">
                                        <ModuleConfigSelector label={tes('modules.tts')} moduleType="tts"
                                            selectedConfigId={entityMappings.tts}
                                            onChange={(id) => setEntityMappings(prev => ({ ...prev, tts: id }))}
                                            configs={getConfigs('tts')} isLoading={isModuleLoading} />
                                    </div>
                                    <div data-tutorial-id="entity-module-stt">
                                        <ModuleConfigSelector label={tes('modules.stt')} moduleType="stt"
                                            selectedConfigId={entityMappings.stt}
                                            onChange={(id) => setEntityMappings(prev => ({ ...prev, stt: id }))}
                                            configs={getConfigs('stt')} isLoading={isModuleLoading} />
                                    </div>
                                    <div data-tutorial-id="entity-module-rag" className="flex flex-wrap items-center w-full">
                                        <ModuleConfigSelector label={tes('modules.rag')} moduleType="rag"
                                            selectedConfigId={entityMappings.rag}
                                            onChange={(id) => setEntityMappings(prev => ({ ...prev, rag: id }))}
                                            configs={getConfigs('rag')} isLoading={isModuleLoading} />
                                        <div className="w-1/5"></div>
                                        <div className="w-4/5 px-3">
                                            <button onClick={() => setShowRAGCollections(true)} className="btn-accent-gradient text-sm py-1.5 px-4 font-bold">
                                                {tes('buttons.manageRagCollections')}
                                            </button>
                                        </div>
                                    </div>
                                    <RAGCollectionManager entityId={selectedEntityId} isOpen={showRAGCollections}
                                        onClose={() => setShowRAGCollections(false)}
                                        onError={(msg) => setErrorDialog({ isOpen: true, title: tes('dialogs.ragError.title'), message: msg, type: 'error' })} />
                                    <div data-tutorial-id="entity-module-movement">
                                        <ModuleConfigSelector label={tes('modules.movement')} moduleType="movement"
                                            selectedConfigId={entityMappings.movement}
                                            onChange={(id) => setEntityMappings(prev => ({ ...prev, movement: id }))}
                                            configs={getConfigs('movement')} isLoading={isModuleLoading} />
                                    </div>
                                    <div data-tutorial-id="entity-module-cognition">
                                        <ModuleConfigSelector label={tes('modules.cognition')} moduleType="cognition"
                                            selectedConfigId={entityMappings.cognition}
                                            onChange={(id) => setEntityMappings(prev => ({ ...prev, cognition: id }))}
                                            configs={getConfigs('cognition')} isLoading={isModuleLoading} />
                                    </div>
                                    <div data-tutorial-id="entity-module-imagination">
                                        <ModuleConfigSelector label={tes('modules.imagination')} moduleType="imagination"
                                            selectedConfigId={entityMappings.imagination}
                                            onChange={(id) => setEntityMappings(prev => ({ ...prev, imagination: id }))}
                                            configs={getConfigs('imagination')} isLoading={isModuleLoading} />
                                    </div>
                                    <div data-tutorial-id="entity-module-vision">
                                        <ModuleConfigSelector label={tes('modules.vision')} moduleType="vision"
                                            selectedConfigId={entityMappings.vision}
                                            onChange={(id) => setEntityMappings(prev => ({ ...prev, vision: id }))}
                                            configs={getConfigs('vision')} isLoading={isModuleLoading} />
                                    </div>
                                </section>

                                {/* Lifecycle Settings Section */}
                                <section data-tutorial-id="entity-lifecycle-section" className="space-y-4">
                                    <h3 data-tutorial-id="entity-lifecycle-header" className="text-lg font-bold text-text-primary pb-2 flex items-center gap-2 w-full mb-6 mt-8">
                                        <span className="text-gradient-primary">{tes('sections.lifecycleSettings')}</span>
                                        <SettingsTooltip tooltipIndex={3} tooltipVisible={() => tooltipVisible} setTooltipVisible={setTooltipVisible}>
                                            {tes('sections.lifecycleTooltip')}
                                        </SettingsTooltip>
                                    </h3>

                                    {selectedCharacterProfileId && (
                                        <div className="flex items-center gap-3 mb-4">
                                            <button onClick={handleResetToCharacterDefaults} className="btn-secondary text-sm py-1.5 px-3"
                                                title={tes('buttons.resetToCharacterDefaults')}>
                                                {tes('buttons.resetToCharacterDefaults')}
                                            </button>
                                            <p className="text-xs text-text-muted italic">{tes('buttons.resetToCharacterDefaultsHint')}</p>
                                        </div>
                                    )}

                                    {entityLifecycleConfig ? (
                                        <div className="space-y-4">
                                            <LifecycleConfigEditor config={entityLifecycleConfig} onChange={handleLifecycleConfigChange} />
                                            <div className="flex justify-end pt-4">
                                                <button onClick={handleSaveLifecycleConfig} className="btn-primary px-5 py-2 text-sm font-semibold">
                                                    {tes('buttons.saveLifecycleConfig')}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8 text-text-muted">
                                            <p>{tes('lifecycle.noConfig')}</p>
                                            <p className="text-sm mt-2">
                                                {selectedCharacterProfileId
                                                    ? tes('lifecycle.clickToCopy')
                                                    : tes('lifecycle.assignProfile')}
                                            </p>
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default EntitySettingsView;
