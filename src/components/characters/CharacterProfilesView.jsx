import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useCharacterProfileStore from '../../store/characterProfileStore';
import useEntityStore from '../../store/entityStore';
import usePersonaStore from '../../store/personaStore';
import * as characterService from '../../services/management/characterService.js';
import * as entityService from '../../services/management/entityService.js';
import { personaOwnedProfileIds } from '../../utils/personaProfileUtils';
import { deriveEntityId, deriveEntityAlias, nextEntityIdCandidate, isEntityIdConflictError } from '../../utils/entityIdUtils';
import CharacterProfileCard from './CharacterProfileCard';
import CharacterProfileEditor from './CharacterProfileEditor';
import CharacterCardImport from './CharacterCardImport';
import ConfirmDialog from '../modals/ConfirmDialog.jsx';

/** Max POST /entities attempts in the from-card id-conflict retry. */
const CREATE_ENTITY_MAX_ATTEMPTS = 5;

/**
 * Bounded auto-retry around the atomic from-card entity create. The entity
 * list only shows live rows (deletion is a soft delete that RETAINS the row's
 * primary key), so the `deriveEntityId` result can look free among visible
 * entities yet collide with a soft-deleted one — a conflict the client cannot
 * foresee. The engine (source of truth) answers that with a clean 400
 * ("entity id already exists"); on it, the id is bumped via
 * `nextEntityIdCandidate` and the alias is RECOMPUTED for the new id (its
 * fallback tracks the id; the visible live-alias set is static during the
 * loop — nothing is created until an attempt succeeds). Any non-conflict
 * error rethrows immediately; exhausting `CREATE_ENTITY_MAX_ATTEMPTS`
 * attempts rethrows the last conflict error.
 *
 * Module-level (not per-render): pure orchestration over the imported
 * derivation helpers — no component state involved.
 *
 * @param {Function} createFn - async (entityId, alias) => Promise; performs
 *   the atomic create for one attempt (service call differs per path).
 * @param {string} entityId - the first candidate id (already deduped against
 *   visible live ids and checked for reserved/empty by `deriveEntityId`).
 * @param {string} displayName - pretty name whose alias is derived per
 *   attempt via `deriveEntityAlias`.
 * @param {string[]} liveAliases - aliases of ALL visible live entities.
 * @returns {Promise<string>} the entity id of the successful attempt.
 */
const createEntityFromCardWithRetry = async (createFn, entityId, displayName, liveAliases) => {
    for (let attempt = 1; ; attempt += 1) {
        const alias = deriveEntityAlias(displayName, entityId, liveAliases);
        try {
            await createFn(entityId, alias);
            return entityId;
        } catch (error) {
            if (!isEntityIdConflictError(error) || attempt >= CREATE_ENTITY_MAX_ATTEMPTS) {
                throw error;
            }
            entityId = nextEntityIdCandidate(entityId);
        }
    }
};

/**
 * Main view for managing character profiles
 * @param {Object} props
 * @param {Function} [props.onCreatePersonaFromCard] - 2-4: "Create persona from
 *   this card" — the app performs the full-copy create here (duplicate profile
 *   → persona entity → alias sync), then calls this callback so the shell can
 *   switch to the Personas tab with the new persona open in the editor.
 * @param {Function} [props.onCreateEntityFromCard] - "Create AI entity from
 *   this card" — the app links the profile LIVE to a new AI entity (no card
 *   copy), then calls this callback so the shell can switch to the Entities
 *   tab with the new entity preselected.
 */
export default function CharacterProfilesView({ onCreatePersonaFromCard, onCreateEntityFromCard }) {
    const { t } = useTranslation();
    const { profiles, isLoading, loadProfiles, loadImages, deleteProfile, getProfile } = useCharacterProfileStore();
    const { entities, loadEntities, selectEntity } = useEntityStore();

    /**
     * 3-2: map character_profile_id → the entities (AI or persona) that
     * reference it. Entity↔profile is a LIVE reference (edits to a profile
     * change the linked entity's behavior immediately) — these map drives the
     * "used by" badges and the editor's live-link hint.
     */
    const referencingByProfile = useMemo(() => {
        const map = {};
        (entities || []).forEach(entity => {
            const pid = entity.character_profile_id || entity.character_profile?.id;
            if (pid) {
                if (!map[pid]) map[pid] = [];
                map[pid].push(entity);
            }
        });
        return map;
    }, [entities]);
    const [showEditor, setShowEditor] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [editingProfile, setEditingProfile] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [cardSize, setCardSize] = useState(() => {
        return localStorage.getItem('characterProfileCardSize') || 'medium';
    });
    const [deleteTargetId, setDeleteTargetId] = useState(null);

    /**
     * 2-1: ids of profiles owned by personas (referenced by ≥1 user entity).
     * Those cards are managed in the Personas tab — they must not show in this
     * grid, must not resurface via search, and (defensively) hide even if an AI
     * entity also references them (persona ownership wins).
     */
    const personaOwnedIds = useMemo(
        () => personaOwnedProfileIds(entities, profiles),
        [entities, profiles]
    );

    /** Profiles visible in this tab: persona-owned cards excluded. */
    const visibleProfiles = useMemo(
        () => (profiles || []).filter(p => !personaOwnedIds.has(p.id)),
        [profiles, personaOwnedIds]
    );

    /** Filter visible profiles by search query — matches name and description */
    const filteredProfiles = useMemo(() => {
        if (!searchQuery.trim()) return visibleProfiles;
        const query = searchQuery.toLowerCase().trim();
        return visibleProfiles.filter(p =>
            p.name?.toLowerCase().includes(query) ||
            p.description?.toLowerCase().includes(query)
        );
    }, [visibleProfiles, searchQuery]);

    useEffect(() => {
        loadProfiles();
        // Needed for the "used by" badges / live-link hint (3-2).
        loadEntities();
    }, [loadProfiles, loadEntities]);

    useEffect(() => {
        if (visibleProfiles && visibleProfiles.length > 0) {
            visibleProfiles.forEach(profile => {
                if (profile && profile.id) {
                    loadImages(profile.id);
                }
            });
        }
    }, [visibleProfiles, loadImages]);

    const handleEdit = (profile) => {
        setEditingProfile(profile);
        setShowEditor(true);
    };

    const handleDeleteRequest = (id) => {
        setDeleteTargetId(id);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTargetId) return;
        const id = deleteTargetId;
        setDeleteTargetId(null);
        try {
            await deleteProfile(id);
        } catch (error) {
            alert(t('characters:deleteFailed', { message: error.message }));
        }
    };

    const handleDeleteCancel = () => {
        setDeleteTargetId(null);
    };

    /**
     * 2-4: "Create persona from this card" — IMMEDIATE full copy (decision 7):
     * duplicate the whole card via the engine 1-3 endpoint (all spec + Soulbits
     * fields, images copied with the primary flag preserved), atomically create
     * the persona entity named after the copy WITH its deduped display alias
     * (single engine transaction), then open the new persona in the Personas
     * tab's editor. The old identity-prefill stash flow is retired.
     *
     * The create step auto-retries (bounded): an id held by a SOFT-deleted
     * entity is invisible to the live-only entity list, so the engine's 400
     * ("entity id already exists") bumps the id and retries — see
     * `createEntityFromCardWithRetry`. The whole retry sequence runs INSIDE
     * this try, so the duplicate-profile compensation below still fires
     * exactly once if every attempt is exhausted.
     */
    const handleCreatePersonaFromCard = async (profile) => {
        if (!profile?.id) return;
        let newProfile = null;
        try {
            newProfile = await characterService.duplicateCharacterProfile(profile.id);
            // The copy's name (e.g. "Max 2") can contain characters that are
            // invalid in an entity id or collide with an existing id — derive a
            // safe, unique id (reserved/empty checks throw BEFORE any create
            // attempt). Its display alias is deduped the same way:
            // entities.alias is UNIQUE among non-empty live aliases, so two
            // personas from the same profile must not share a raw name.
            const entityName = deriveEntityId(newProfile.name, (entities || []).map(e => e.id), {
                reservedMessage: t('characters:createPersonaReservedUser'),
                emptyMessage: t('characters:entityIdInvalidName', { name: newProfile.name }),
            });
            // Atomic create (engine eb1124e): id + profile + alias in ONE
            // request — an alias collision surfaces as a clean 400 ("entity
            // alias is already in use") before anything is created, instead of
            // a mid-flow unique-index 500 after the entity already exists.
            // An id conflict (soft-deleted row) is retried with a bumped id.
            const createdId = await createEntityFromCardWithRetry(
                (id, alias) => entityService.createPersonaEntity(id, newProfile.id, alias),
                entityName,
                newProfile.name,
                (entities || []).map(e => e.alias)
            );
            usePersonaStore.getState().requestEditPersona(createdId);
            onCreatePersonaFromCard();
        } catch (error) {
            // Compensation: once duplicateCharacterProfile resolved, the profile
            // COPY exists — so any failure after it (id/alias derivation, the
            // atomic create, anything else) would orphan an unowned card that
            // resurfaces in the Characters grid. Best-effort delete via the
            // direct service (NOT the store's deleteProfile — its isLoading
            // side-effects must not churn during error handling). Cleanup
            // failures are swallowed/logged so they never mask the original
            // error surfaced by the i18n'd alert below.
            if (newProfile?.id) {
                try {
                    await characterService.deleteCharacterProfile(newProfile.id);
                } catch (cleanupError) {
                    console.error('Failed to clean up duplicated character profile after failed persona creation:', cleanupError);
                }
            }
            alert(t('characters:createPersonaFailed', { message: error.message }));
        }
    };

    /**
     * "Create AI entity from this card" — AI entities link profiles LIVE
     * (engine 1:1 semantics, no card copy): derive an unused entity id from
     * the profile name, atomically create the entity pointing at THIS profile
     * with a deduped display alias (single request: id + profile + alias),
     * then refresh the entity list and preselect the new entity BEFORE the
     * shell switches to the Entities tab (EntitySettingsView's
     * selection-constraining effect then keeps it).
     *
     * The create step auto-retries (bounded): an id held by a SOFT-deleted
     * entity is invisible to the live-only entity list, so the engine's 400
     * ("entity id already exists") bumps the id and retries — see
     * `createEntityFromCardWithRetry`.
     */
    const handleCreateEntityFromCard = async (profile) => {
        if (!profile?.id) return;
        try {
            const entityId = deriveEntityId(profile.name, (entities || []).map(e => e.id), {
                reservedMessage: t('characters:createEntityReservedUser'),
                emptyMessage: t('characters:entityIdInvalidName', { name: profile.name }),
            });
            // Atomic create (engine eb1124e): id + profile + alias in ONE
            // request — an alias collision surfaces as a clean 400 ("entity
            // alias is already in use") before anything is created, instead of
            // a mid-flow unique-index 500 after the entity already exists.
            // An id conflict (soft-deleted row) is retried with a bumped id.
            const createdId = await createEntityFromCardWithRetry(
                (id, alias) => entityService.createEntity(id, profile.id, alias),
                entityId,
                profile.name,
                (entities || []).map(e => e.alias)
            );
            // Refresh first so the tab mounts with the new entity already in
            // the store — otherwise the selection constraint could override
            // the preselection while the list is still stale.
            await loadEntities();
            selectEntity(createdId);
            onCreateEntityFromCard();
        } catch (error) {
            alert(t('characters:createEntityFailed', { message: error.message }));
        }
    };

    const handleImportSuccess = async (result) => {
        setShowImport(false);
        await loadProfiles();
        if (result && result.id) {
            const profile = getProfile(result.id);
            if (profile) {
                handleEdit(profile);
            }
        }
    };

    const handleCardSizeChange = (size) => {
        setCardSize(size);
        localStorage.setItem('characterProfileCardSize', size);
    };

    const getGridClasses = () => {
        switch (cardSize) {
            case 'small': return 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12';
            case 'large': return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
            case 'medium':
            default: return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';
        }
    };

    const colorFirstWord = (text) => {
        const spaceIdx = text.indexOf(' ');
        if (spaceIdx === -1) return <span className="text-gradient-primary">{text}</span>;
        return <><span className="text-gradient-primary">{text.slice(0, spaceIdx)}</span>{text.slice(spaceIdx)}</>;
    };

    return (
        <div className="flex flex-col min-h-full">
            <div className="bg-background-surface/30 backdrop-blur-sm px-6 py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight">
                            {colorFirstWord(t('characters:header.title'))}
                        </h1>
                        <p className="text-xs text-text-muted mt-0.5 font-medium">
                            {t('characters:header.subtitle')}
                        </p>
                    </div>
                    
                    <div className="flex gap-3">
                        <button data-tutorial-id="char-import-btn" onClick={() => setShowImport(true)}
                            className="btn-secondary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors">
                            <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            {t('characters:buttons.importCard')}
                        </button>
                        <button data-tutorial-id="char-create-btn" onClick={() => { setEditingProfile(null); setShowEditor(true); }}
                            className="btn-primary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors">
                            <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            {t('characters:buttons.createProfile')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-background-surface/50 px-6 py-4 backdrop-blur-md">
                <div className="flex items-center justify-between gap-4">
                    {/* Search Bar */}
                    <div data-tutorial-id="char-search" className="search-bar-wrapper">
                        <svg className="search-bar-icon w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            className="search-bar-input"
                            placeholder={t('characters:searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label={t('characters:searchPlaceholder')}
                        />
                    </div>

                    {/* Card Size Toggle */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-text-muted font-medium">{t('characters:cardSize')}</span>
                        <div className="flex bg-background-elevated/50 rounded-lg p-1 gap-1">
                            {[
                                { size: 'small', title: t('characters:cardSizes.small'), path: "M2 3h4v5H2zM7 3h4v5H7zM12 3h4v5H12zM17 3h4v5H17zM2 9.5h4v5H2zM7 9.5h4v5H7zM12 9.5h4v5H12zM17 9.5h4v5H17zM2 16h4v5H2zM7 16h4v5H7zM12 16h4v5H12zM17 16h4v5H17z" },
                                { size: 'medium', title: t('characters:cardSizes.medium'), path: "M3 5h5v6H3zM10 5h5v6H10zM17 5h5v6H17zM3 13h5v6H3zM10 13h5v6H10zM17 13h5v6H17z" },
                                { size: 'large', title: t('characters:cardSizes.large'), path: "M3 3h8v8H3zM14 3h8v8H14zM3 14h8v8H3zM14 14h8v8H14z" },
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

            <div className="flex-1 p-6">
                {isLoading && profiles.length === 0 ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
                    </div>
                ) : visibleProfiles.length > 0 ? (
                    filteredProfiles.length > 0 ? (
                        <div data-tutorial-id="char-profile-grid" className={`grid ${getGridClasses()} gap-6`}>
                            {filteredProfiles.map(profile => (
                                <CharacterProfileCard key={profile.id} profile={profile}
                                    onClick={() => handleEdit(profile)} onDelete={handleDeleteRequest}
                                    referencingEntities={referencingByProfile[profile.id] || []}
                                    onCreatePersona={handleCreatePersonaFromCard}
                                    onCreateEntity={handleCreateEntityFromCard} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24">
                            <svg className="w-16 h-16 text-text-muted/25 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <p className="text-lg font-semibold text-text-primary mb-1.5">{t('characters:empty.noResults')}</p>
                            <p className="text-sm text-text-muted">{t('characters:empty.tryAdjustingSearch')}</p>
                        </div>
                    )
                ) : (
                    <div className="text-center py-20 bg-background-surface/30 rounded-lg border-2 border-dashed border-white/10">
                        <svg className="mx-auto h-12 w-12 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-text-primary">{t('characters:empty.title')}</h3>
                        <p className="mt-1 text-sm text-text-muted">{t('characters:empty.getStarted')}</p>
                        {/* 2-1: the grid may be empty because every profile is
                            persona-owned — point at the Personas tab. */}
                        {profiles.length > 0 && (
                            <p className="mt-2 text-sm text-accent-secondary italic font-medium">
                                {t('characters:empty.personaOwnedHint')}
                            </p>
                        )}
                        <div className="mt-6 flex justify-center gap-3">
                            <button onClick={() => setShowImport(true)} className="btn-secondary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors">
                                {t('characters:buttons.importCard')}
                            </button>
                            <button onClick={() => { setEditingProfile(null); setShowEditor(true); }} className="btn-primary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors">
                                {t('characters:buttons.createProfile')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showEditor && (
                <CharacterProfileEditor profile={editingProfile}
                    referencedEntities={editingProfile ? (referencingByProfile[editingProfile.id] || []) : []}
                    onClose={() => { setShowEditor(false); setEditingProfile(null); }} />
            )}

            {showImport && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="modal-content w-full max-w-xl overflow-hidden">
                        <div className="px-6 py-4 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-accent-primary">{t('characters:importTitle')}</h2>
                            <button onClick={() => setShowImport(false)} className="text-text-muted hover:text-text-primary transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6">
                            <CharacterCardImport onSuccess={handleImportSuccess} />
                        </div>
                        <div className="px-6 py-4 flex justify-end">
                            <button onClick={() => setShowImport(false)} className="btn-secondary px-4 py-2 rounded-md text-sm font-medium transition-colors">
                                {t('common:buttons.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={deleteTargetId !== null}
                title={t('characters:deleteDialog.title')}
                message={t('characters:deleteDialog.message')}
                confirmText={t('characters:deleteDialog.confirm')}
                cancelText={t('characters:deleteDialog.cancel')}
                onConfirm={handleDeleteConfirm}
                onCancel={handleDeleteCancel}
            />
        </div>
    );
}
