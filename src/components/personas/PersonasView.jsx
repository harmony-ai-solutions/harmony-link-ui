import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useEntityStore from '../../store/entityStore';
import useCharacterProfileStore from '../../store/characterProfileStore';
import useModuleConfigStore from '../../store/moduleConfigStore';
import usePersonaStore from '../../store/personaStore';
import * as entityService from '../../services/management/entityService.js';
import * as characterService from '../../services/management/characterService.js';
import CharacterProfileEditor from '../characters/CharacterProfileEditor.jsx';
import CharacterCardExport from '../characters/CharacterCardExport.jsx';
import { ModuleConfigSelector } from '../EntitySettingsView.jsx';
import ErrorDialog from '../modals/ErrorDialog.jsx';
import ConfirmDialog from '../modals/ConfirmDialog.jsx';

/**
 * PersonasView — 3-1 (Soulbits Engine frontend).
 *
 * Surfaces user-type (persona) entities as first-class citizens: list them
 * joined with their linked character profile, support create/edit/delete, and
 * expose ONE tab-level "Shared user modules" card that shows the canonical
 * `user` mapping's STT status and (reusing the module-mapping editor) lets the
 * user edit STT on the `user` entity — the single source of truth every
 * persona inherits (engine semantics: user entities inherit the `user`
 * mapping).
 *
 * Scope guard: personas never use generation/TTS/RAG (no module sections for
 * those). The shared card is STT-only.
 */
export default function PersonasView() {
    const { t } = useTranslation();

    const {
        entities,
        loadEntities,
        deleteEntity,
        updateEntityMappings,
        isLoading: isEntityLoading,
    } = useEntityStore();

    const {
        profiles,
        loadProfiles,
        createProfile,
        updateProfile,
        loadImages: loadCharacterImages,
        getPrimaryImage,
    } = useCharacterProfileStore();

    const {
        getConfigs,
        loadConfigs,
        getConfigById,
        isLoading: isModuleLoading,
    } = useModuleConfigStore();

    // Shared user modules card state
    const [sharedModulesEdit, setSharedModulesEdit] = useState(false);
    const [userSttConfigId, setUserSttConfigId] = useState('');
    const [savingSharedModules, setSavingSharedModules] = useState(false);
    const [userEntityFull, setUserEntityFull] = useState(null);

    // Persona card editor state (2-3): the full CharacterProfileEditor in
    // personaMode replaces the old 3-field create/edit form.
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingPersona, setEditingPersona] = useState(null);
    const [editorProfile, setEditorProfile] = useState(null);
    const [editorLoadingProfile, setEditorLoadingProfile] = useState(false);

    // View controls (search + card size) — mirror of the Characters toolbar.
    const [searchQuery, setSearchQuery] = useState('');
    const [cardSize, setCardSize] = useState(() => {
        return localStorage.getItem('personaCardSize') || 'large';
    });

    // Feedback / modal state
    const [successMessage, setSuccessMessage] = useState(null);
    const [errorDialog, setErrorDialog] = useState({ isOpen: false, title: '', message: '', type: 'error' });
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

    const loadedImageIds = useRef(new Set());

    // Helper for translated keys (personas namespace)
    const tes = (key, opts) => t(`personas:${key}`, opts);

    useEffect(() => {
        loadEntities();
        loadProfiles();
        loadConfigs('stt');
    }, [loadEntities, loadProfiles, loadConfigs]);

    // Load the full canonical `user` entity config — the list payload doesn't
    // include resolved modules, so we fetch it directly to read the STT mapping.
    useEffect(() => {
        entityService.getEntity('user')
            .then((full) => {
                setUserEntityFull(full);
                const sttId = full?.modules?.stt?.id ? String(full.modules.stt.id) : '';
                setUserSttConfigId(sttId);
            })
            .catch(() => setUserEntityFull(null));
    }, []);

    const personas = useMemo(() => {
        const profileMap = {};
        (profiles || []).forEach(p => { profileMap[p.id] = p; });
        const list = (entities || [])
            .filter(e => e.entity_type === 'user')
            .map(e => ({ ...e, profile: profileMap[e.character_profile_id] || null }));
        // Defensive: the seeder guarantees the canonical `user` row, but if it
        // ever isn't in the cached list (e.g. mid-sync) still surface it.
        if (!list.some(e => e.id === 'user') && userEntityFull) {
            list.unshift({
                id: 'user',
                entity_type: 'user',
                alias: userEntityFull.alias || '',
                character_profile_id: userEntityFull.character_profile_id || '',
                profile: profileMap[userEntityFull.character_profile_id] || null,
                modules: userEntityFull.modules,
            });
        }
        return list;
    }, [entities, profiles, userEntityFull]);

    // Filter personas by the search query — matches the display name
    // (persona.profile?.name || persona.alias || persona.id) and the linked
    // profile description, case-insensitive (Characters parity).
    const filteredPersonas = useMemo(() => {
        if (!searchQuery.trim()) return personas;
        const query = searchQuery.toLowerCase().trim();
        return personas.filter(persona => {
            const name = persona.profile?.name || persona.alias || persona.id;
            return name.toLowerCase().includes(query) ||
                (persona.profile?.description || '').toLowerCase().includes(query);
        });
    }, [personas, searchQuery]);

    // Load primary images for persona profiles (for the row avatar).
    useEffect(() => {
        (personas || []).forEach(p => {
            const pid = p.profile?.id;
            if (pid && !loadedImageIds.current.has(pid)) {
                loadedImageIds.current.add(pid);
                loadCharacterImages(pid);
            }
        });
    }, [personas, loadCharacterImages]);

    const userSttName = useMemo(() => {
        const id = userEntityFull?.modules?.stt?.id;
        if (!id) return null;
        const cfg = getConfigById('stt', String(id));
        return cfg?.name || String(id);
    }, [userEntityFull, getConfigById]);

    const handleToggleSharedModules = () => {
        if (sharedModulesEdit) {
            // cancel — reset to the current persisted STT id
            const sttId = userEntityFull?.modules?.stt?.id ? String(userEntityFull.modules.stt.id) : '';
            setUserSttConfigId(sttId);
            setSharedModulesEdit(false);
        } else {
            setSharedModulesEdit(true);
        }
    };

    const handleSaveSharedModules = async () => {
        try {
            setSavingSharedModules(true);
            setErrorDialog({ ...errorDialog, isOpen: false });
            // Editing entity `user` is allowed (canonical); the API 400s any
            // other user entity with "user entities share the built-in user
            // module mapping" — surface that verbatim if it ever returns.
            await updateEntityMappings('user', { stt_config_id: userSttConfigId || null });
            const full = await entityService.getEntity('user');
            setUserEntityFull(full);
            setSharedModulesEdit(false);
            setSuccessMessage(tes('messages.sharedModulesSaved'));
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error) {
            setErrorDialog({
                isOpen: true,
                title: tes('dialogs.errorTitles.sharedModulesFailed'),
                message: error.message,
                type: 'error',
            });
        } finally {
            setSavingSharedModules(false);
        }
    };

    // 2-3: the persona name doubles as the entity id. Reserved-name validation
    // (decision 14): creating a persona named "user" is blocked client-side
    // with a clear message; the engine PK collision stays as the backstop.
    const validatePersonaName = (name, excludeId = null) => {
        const trimmed = (name || '').trim();
        if (!trimmed) return tes('validation.nameRequired');
        if (trimmed.toLowerCase() === 'user') return tes('validation.nameReservedUser');
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return tes('validation.nameInvalid');
        if ((entities || []).find(e => e.id === trimmed && e.id !== excludeId)) return tes('validation.nameExists');
        return null;
    };

    const openCreate = () => {
        setEditingPersona(null);
        setEditorProfile(null);
        setEditorLoadingProfile(false);
        setEditorOpen(true);
    };

    // 2-3: edit loads the FULL profile (getCharacterProfile) so untouched
    // columns — including card_provenance — round-trip on save. Falls back to
    // the list payload if the fetch fails (same DTO shape).
    const openEdit = (persona) => {
        setEditingPersona(persona);
        setEditorProfile(null);
        setEditorLoadingProfile(true);
        setEditorOpen(true);
        const profileId = persona.character_profile_id || persona.profile?.id || null;
        if (!profileId) {
            setEditorLoadingProfile(false);
            return;
        }
        characterService.getCharacterProfile(profileId)
            .then(full => setEditorProfile(full))
            .catch(() => setEditorProfile(persona.profile || null))
            .finally(() => setEditorLoadingProfile(false));
    };

    const closeEditor = () => {
        setEditorOpen(false);
        setEditingPersona(null);
        setEditorProfile(null);
        setEditorLoadingProfile(false);
    };

    // 2-4: when the Characters tab created a persona from a card, it stashes the
    // new persona's id here and switches to this tab. Once the persona shows up
    // in the (re)loaded list, open its full card editor, then clear the request
    // so it never re-fires. Note: declared after `openEdit` — the dependency
    // array reads it during render (no TDZ).
    useEffect(() => {
        const personaId = usePersonaStore.getState().requestEditPersonaId;
        if (!personaId) return;
        const persona = personas.find(p => p.id === personaId);
        if (!persona) return;
        usePersonaStore.getState().clearRequestEditPersona();
        openEdit(persona);
    }, [personas, openEdit]);

    /**
     * 2-3 persona save path (full card editor, personaMode):
     *  - CREATE: reserved-name check → createCharacterProfile(full) →
     *    createPersonaEntity(name, profileId) → alias sync.
     *  - EDIT: if the name changed → renameEntity(oldId, newId) FIRST (engine is
     *    type-preserving; built-in 'user' is locked → nameReadOnly in the
     *    editor), then updateCharacterProfile(profileId, full) → alias sync on
     *    the (possibly new) id.
     * Errors (engine 400s — collisions, built-in protection) throw so the
     * editor surfaces them in its error UI.
     */
    const handlePersonaSave = async (payload) => {
        const name = (payload.name || '').trim();
        const isCreate = !editingPersona;
        const isBuiltIn = editingPersona?.id === 'user';

        if (isCreate) {
            const nameErr = validatePersonaName(name, null);
            if (nameErr) throw new Error(nameErr);
        } else if (!isBuiltIn) {
            const oldName = editingPersona.id;
            if (name !== oldName) {
                const nameErr = validatePersonaName(name, oldName);
                if (nameErr) throw new Error(nameErr);
            }
        }

        if (isCreate) {
            const newProfile = await createProfile(payload);
            await entityService.createPersonaEntity(name, newProfile.id);
            // Sync alias so the persona displays by its name in the entity list.
            await entityService.updateEntity(name, newProfile.id, null, name);
            setSuccessMessage(tes('messages.createSuccess'));
        } else {
            const profileId = editingPersona.character_profile_id || editingPersona.profile?.id || null;
            const oldName = editingPersona.id;
            let entityId = oldName;
            if (!isBuiltIn && name !== oldName) {
                // Rename FIRST — the engine is type-preserving; collisions
                // surface as 400s in the editor's error UI.
                await entityService.renameEntity(oldName, name);
                entityId = name;
                // Keep the editor's persona id in sync so a retry after a
                // partial failure (rename OK, profile update failed) never
                // tries to rename the now-nonexistent old id again.
                setEditingPersona(prev => (prev ? { ...prev, id: name } : prev));
            }
            if (profileId) {
                await updateProfile(profileId, payload);
            }
            await entityService.updateEntity(entityId, profileId, null, name);
            setSuccessMessage(tes('messages.updateSuccess'));
        }
        setTimeout(() => setSuccessMessage(null), 3000);
        await Promise.all([loadEntities(), loadProfiles()]);
    };

    const handleDeleteRequest = (persona) => {
        if (persona.id === 'user') return; // built-in locked
        setConfirmDialog({
            isOpen: true,
            title: tes('dialogs.deleteTitle'),
            message: tes('dialogs.deleteMessage', { name: persona.profile?.name || persona.id }),
            onConfirm: async () => {
                try {
                    await deleteEntity(persona.id);
                    setConfirmDialog({ ...confirmDialog, isOpen: false });
                    setSuccessMessage(tes('messages.deleteSuccess'));
                    setTimeout(() => setSuccessMessage(null), 3000);
                } catch (error) {
                    setConfirmDialog({ ...confirmDialog, isOpen: false });
                    setErrorDialog({
                        isOpen: true,
                        title: tes('dialogs.errorTitles.deleteFailed'),
                        message: error.message,
                        type: 'error',
                    });
                }
            },
        });
    };

    const colorFirstWord = (text) => {
        const spaceIdx = text.indexOf(' ');
        if (spaceIdx === -1) return <span className="text-gradient-primary">{text}</span>;
        return <><span className="text-gradient-primary">{text.slice(0, spaceIdx)}</span>{text.slice(spaceIdx)}</>;
    };

    const handleCardSizeChange = (size) => {
        setCardSize(size);
        localStorage.setItem('personaCardSize', size);
    };

    const getGridClasses = () => {
        switch (cardSize) {
            case 'small': return 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12';
            case 'large': return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
            case 'medium':
            default: return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';
        }
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

    return (
        <>
            <ErrorDialog isOpen={errorDialog.isOpen} title={errorDialog.title} message={errorDialog.message}
                type={errorDialog.type} onClose={() => setErrorDialog({ ...errorDialog, isOpen: false })} />
            <ConfirmDialog isOpen={confirmDialog.isOpen} title={confirmDialog.title} message={confirmDialog.message}
                onConfirm={confirmDialog.onConfirm} onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })} />

            <div className="flex flex-col min-h-full">
                {/* View Header */}
                <div className="bg-background-surface/30 backdrop-blur-sm px-6 py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-extrabold tracking-tight">
                                {colorFirstWord(tes('header.title'))}
                            </h1>
                            <p className="text-xs text-text-muted mt-0.5 font-medium">
                                {tes('header.subtitle')}
                            </p>
                        </div>
                        <button data-tutorial-id="persona-create-btn" onClick={openCreate}
                            className="btn-primary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors">
                            <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            {tes('buttons.createPersona')}
                        </button>
                    </div>
                </div>

                {/* Shared user modules card (tab-level, STT-only) */}
                <div data-tutorial-id="persona-shared-modules-card" className="mx-6 mt-6 p-5 rounded-xl border border-white/10 bg-background-surface/30 backdrop-blur-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                            <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                                <span className="text-gradient-primary">{tes('sharedModules.title')}</span>
                            </h3>
                            <p className="text-xs text-text-muted mt-1 font-medium">{tes('sharedModules.description')}</p>
                            <div className="mt-3 flex items-center gap-2">
                                <span className="text-sm font-medium text-text-secondary">{tes('sharedModules.sttLabel')}:</span>
                                <span className="text-sm font-semibold text-accent-primary">
                                    {userSttName ? userSttName : tes('sharedModules.sttDisabled')}
                                </span>
                            </div>
                            {!sharedModulesEdit && (
                                <p className="mt-2 text-xs text-text-muted italic">{tes('sharedModules.hint')}</p>
                            )}
                        </div>
                        <button onClick={handleToggleSharedModules}
                            className="btn-secondary text-sm py-1.5 px-3 flex-shrink-0">
                            {sharedModulesEdit ? tes('sharedModules.cancel') : tes('sharedModules.edit')}
                        </button>
                    </div>

                    {sharedModulesEdit && (
                        <div className="mt-4 pt-4 border-t border-white/10">
                            <ModuleConfigSelector
                                label={tes('sharedModules.sttLabel')}
                                moduleType="stt"
                                selectedConfigId={userSttConfigId}
                                onChange={(id) => setUserSttConfigId(id)}
                                configs={getConfigs('stt')}
                                isLoading={isModuleLoading}
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={handleToggleSharedModules}
                                    className="btn-secondary text-sm py-1.5 px-3">{tes('sharedModules.cancel')}</button>
                                <button onClick={handleSaveSharedModules} disabled={savingSharedModules}
                                    className="btn-primary text-sm py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {savingSharedModules ? tes('sharedModules.saving') : tes('sharedModules.save')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Feedback */}
                <div className="px-6 mt-4">
                    {successMessage && (
                        <div className="p-3 bg-success-bg/30 border border-success-bg rounded text-success text-sm">{successMessage}</div>
                    )}
                </div>

                {/* Search + Card Size toolbar */}
                <div className="bg-background-surface/50 px-6 py-4 backdrop-blur-md">
                    <div className="flex items-center justify-between gap-4">
                        {/* Search Bar */}
                        <div data-tutorial-id="persona-search" className="search-bar-wrapper">
                            <svg className="search-bar-icon w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                className="search-bar-input"
                                placeholder={tes('searchPlaceholder')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                aria-label={tes('searchPlaceholder')}
                            />
                        </div>

                        {/* Card Size Toggle */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-text-muted font-medium">{tes('cardSize')}</span>
                            <div className="flex bg-background-elevated/50 rounded-lg p-1 gap-1">
                                {[
                                    { size: 'small', title: tes('cardSizes.small'), path: "M2 3h4v5H2zM7 3h4v5H7zM12 3h4v5H12zM17 3h4v5H17zM2 9.5h4v5H2zM7 9.5h4v5H7zM12 9.5h4v5H12zM17 9.5h4v5H17zM2 16h4v5H2zM7 16h4v5H7zM12 16h4v5H12zM17 16h4v5H17z" },
                                    { size: 'medium', title: tes('cardSizes.medium'), path: "M3 5h5v6H3zM10 5h5v6H10zM17 5h5v6H17zM3 13h5v6H3zM10 13h5v6H10zM17 13h5v6H17z" },
                                    { size: 'large', title: tes('cardSizes.large'), path: "M3 3h8v8H3zM14 3h8v8H14zM3 14h8v8H3zM14 14h8v8H14z" },
                                ].map(({ size, title, path }) => (
                                    <button key={size} onClick={() => handleCardSizeChange(size)}
                                        className={`p-2 rounded transition-all ${cardSize === size ? 'bg-accent-primary/25 text-accent-primary shadow-sm ring-1 ring-accent-primary/30' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
                                        title={title}>
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d={path} />
                                        </svg>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Persona List */}
                <div className="flex-1 p-6">
                    {personas.length > 0 ? (
                        filteredPersonas.length > 0 ? (
                            <div data-tutorial-id="persona-grid" className={`grid ${getGridClasses()} gap-5`}>
                                {filteredPersonas.map(persona => {
                                const avatar = persona.profile?.id ? getPrimaryImage(persona.profile.id) : null;
                                const isBuiltIn = persona.id === 'user';
                                return (
                                    <div key={persona.id}
                                        className="rounded-xl border border-white/10 bg-background-surface/30 backdrop-blur-sm overflow-hidden group hover:border-accent-primary/40 transition-all duration-200">
                                        <div className="aspect-[3/4] relative bg-elevated">
                                            {avatar ? (
                                                <img src={avatar?.data_url} alt={persona.profile?.name || persona.id}
                                                    className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-text-disabled">
                                                    <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </div>
                                            )}
                                            <div className="absolute inset-0 bg-accent-primary opacity-0 group-hover:opacity-10 transition-opacity" />
                                            <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-secondary/15 text-accent-secondary">
                                                    {tes('list.personaBadge')}
                                                </span>
                                                {isBuiltIn && (
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-primary/15 text-accent-primary">
                                                        {tes('list.builtIn')}
                                                    </span>
                                                )}
                                            </div>
                                            {/* 2-4: per-persona card export (mirrors the Characters UX:
                                                PNG / JSON format choice). Anchored top-right — the
                                                badges own the top-left. */}
                                            {persona.profile && (
                                                <CharacterCardExport
                                                    profile={persona.profile}
                                                    variant="card"
                                                    wrapperClassName="top-2 right-2"
                                                    menuAnchorClassName="right-0"
                                                />
                                            )}
                                        </div>
                                        <div className="p-4">
                                            <div className="flex items-center justify-between gap-2">
                                                <h3 className="font-semibold text-accent-primary truncate">
                                                    {persona.profile?.name || persona.alias || persona.id}
                                                </h3>
                                                {isBuiltIn && (
                                                    <span className="text-[10px] text-text-muted italic font-medium flex-shrink-0"
                                                        title={tes('dialogs.deleteBuiltIn')}>{tes('list.builtIn')}</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-text-muted line-clamp-2 mt-1 min-h-[2.5rem]">
                                                {persona.profile?.description || tes('list.noProfile')}
                                            </p>
                                            <div className="flex gap-2 mt-3">
                                                <button onClick={() => openEdit(persona)}
                                                    className="btn-secondary flex-1 text-xs py-1.5 px-2">{tes('buttons.edit')}</button>
                                                <button onClick={() => handleDeleteRequest(persona)} disabled={isBuiltIn}
                                                    className={`btn-danger flex-1 text-xs py-1.5 px-2 font-bold disabled:opacity-40 disabled:cursor-not-allowed`}
                                                    title={isBuiltIn ? tes('dialogs.deleteBuiltIn') : ''}>
                                                    {tes('buttons.delete')}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-background-surface/30 rounded-lg border-2 border-dashed border-white/10">
                            <svg className="mx-auto h-12 w-12 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <h3 className="mt-2 text-sm font-medium text-text-primary">{tes('empty.noResults')}</h3>
                            <p className="mt-1 text-sm text-text-muted">{tes('empty.tryAdjustingSearch')}</p>
                        </div>
                    )
                    ) : (
                        <div className="text-center py-20 bg-background-surface/30 rounded-lg border-2 border-dashed border-white/10">
                            <svg className="mx-auto h-12 w-12 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <h3 className="mt-2 text-sm font-medium text-text-primary">{tes('list.empty')}</h3>
                        </div>
                    )}
                </div>
            </div>

            {/* 2-3: full card editor (personaMode) — replaces the old 3-field
                create/edit form. Profile loading is gated so the editor never
                flashes create-mode while the full profile is fetched. */}
            {editorOpen && editorLoadingProfile && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
                </div>
            )}
            {editorOpen && !editorLoadingProfile && (
                <CharacterProfileEditor
                    profile={editorProfile}
                    personaMode
                    nameReadOnly={editingPersona?.id === 'user'}
                    referencedEntities={editingPersona ? [editingPersona] : []}
                    onSave={handlePersonaSave}
                    onClose={closeEditor}
                />
            )}
        </>
    );
}
