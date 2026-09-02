import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useEntityStore from '../../store/entityStore';
import useCharacterProfileStore from '../../store/characterProfileStore';
import useModuleConfigStore from '../../store/moduleConfigStore';
import usePersonaStore from '../../store/personaStore';
import * as entityService from '../../services/management/entityService.js';
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

    // Persona create/edit form state
    const [showForm, setShowForm] = useState(false);
    const [editingPersona, setEditingPersona] = useState(null);
    const [form, setForm] = useState({ name: '', description: '', personality: '' });
    const [savingForm, setSavingForm] = useState(false);

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

    // 3-2 prefill: if "Create persona from this card" was invoked, open the
    // create form with the identity fields only, then clear the prefill.
    useEffect(() => {
        const prefill = usePersonaStore.getState().createPrefill;
        if (prefill) {
            setEditingPersona(null);
            setForm({
                name: prefill.name || '',
                description: prefill.description || '',
                personality: prefill.personality || '',
            });
            setShowForm(true);
            usePersonaStore.getState().clearCreatePrefill();
        }
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

    const validateName = (name) => {
        if (!name || name.trim() === '') return tes('validation.nameRequired');
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) return tes('validation.nameInvalid');
        if ((entities || []).find(e => e.id === name)) return tes('validation.nameExists');
        return null;
    };

    const openCreate = () => {
        setEditingPersona(null);
        setForm({ name: '', description: '', personality: '' });
        setShowForm(true);
    };

    const openEdit = (persona) => {
        setEditingPersona(persona);
        setForm({
            name: persona.profile?.name || persona.alias || persona.id,
            description: persona.profile?.description || '',
            personality: persona.profile?.personality || '',
        });
        setShowForm(true);
    };

    const handleSaveForm = async () => {
        const name = form.name.trim();
        const description = form.description.trim();
        const personality = form.personality.trim();

        if (editingPersona) {
            // EDIT = profile update + entity alias sync (identity fields only).
            try {
                setSavingForm(true);
                setErrorDialog({ ...errorDialog, isOpen: false });
                const profileId = editingPersona.character_profile_id || editingPersona.profile?.id || null;
                if (profileId) {
                    await updateProfile(profileId, { name, description, personality });
                }
                if (editingPersona.id) {
                    await entityService.updateEntity(editingPersona.id, profileId, null, name);
                }
                setShowForm(false);
                setEditingPersona(null);
                setSuccessMessage(tes('messages.updateSuccess'));
                setTimeout(() => setSuccessMessage(null), 3000);
                await Promise.all([loadEntities(), loadProfiles()]);
            } catch (error) {
                setErrorDialog({
                    isOpen: true,
                    title: tes('dialogs.errorTitles.updateFailed'),
                    message: error.message,
                    type: 'error',
                });
            } finally {
                setSavingForm(false);
            }
            return;
        }

        // CREATE — name is the entity id (unique). Engine surfaces collisions.
        const nameErr = validateName(name);
        if (nameErr) {
            setErrorDialog({
                isOpen: true,
                title: tes('dialogs.invalidName'),
                message: nameErr,
                type: 'error',
            });
            return;
        }
        try {
            setSavingForm(true);
            setErrorDialog({ ...errorDialog, isOpen: false });
            const newProfile = await createProfile({ name, description, personality });
            await entityService.createPersonaEntity(name, newProfile.id);
            // Sync alias so the persona displays by its name in the entity list.
            await entityService.updateEntity(name, newProfile.id, null, name);
            setShowForm(false);
            setSuccessMessage(tes('messages.createSuccess'));
            setTimeout(() => setSuccessMessage(null), 3000);
            await Promise.all([loadEntities(), loadProfiles()]);
        } catch (error) {
            setErrorDialog({
                isOpen: true,
                title: tes('dialogs.errorTitles.createFailed'),
                message: error.message,
                type: 'error',
            });
        } finally {
            setSavingForm(false);
        }
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

                {/* Persona List */}
                <div className="flex-1 p-6">
                    {personas.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {personas.map(persona => {
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
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <h3 className="mt-2 text-sm font-medium text-text-primary">{tes('list.empty')}</h3>
                        </div>
                    )}
                </div>
            </div>

            {/* Create / Edit persona modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="modal-content w-full max-w-lg overflow-hidden">
                        <div className="px-6 py-4 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-accent-primary">
                                {editingPersona ? tes('dialogs.editTitle') : tes('dialogs.createTitle')}
                            </h2>
                            <button onClick={() => { setShowForm(false); setEditingPersona(null); }}
                                className="text-text-muted hover:text-text-primary transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">{tes('fields.name')}</label>
                                <input type="text" value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    disabled={!!editingPersona}
                                    className="input-field w-full p-2 rounded text-sm disabled:opacity-60"
                                    placeholder={tes('fields.namePlaceholder')} />
                                <p className="text-xs text-text-muted mt-1">{editingPersona ? '' : tes('fields.nameHint')}</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">{tes('fields.description')}</label>
                                <textarea value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    rows={3} className="input-field w-full p-2 rounded text-sm"
                                    placeholder={tes('fields.descriptionPlaceholder')} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">{tes('fields.personality')}</label>
                                <textarea value={form.personality}
                                    onChange={(e) => setForm({ ...form, personality: e.target.value })}
                                    rows={3} className="input-field w-full p-2 rounded text-sm"
                                    placeholder={tes('fields.personalityPlaceholder')} />
                                <p className="text-xs text-text-muted mt-1">{tes('fields.personalityHint')}</p>
                            </div>
                        </div>
                        <div className="px-6 py-4 flex justify-end gap-3">
                            <button onClick={() => { setShowForm(false); setEditingPersona(null); }}
                                className="btn-secondary px-4 py-2 rounded-md text-sm font-medium">
                                {tes('buttons.cancel')}
                            </button>
                            <button onClick={handleSaveForm} disabled={savingForm}
                                className="btn-primary px-5 py-2 rounded-md text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                {savingForm ? tes('buttons.saving') : tes('buttons.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
