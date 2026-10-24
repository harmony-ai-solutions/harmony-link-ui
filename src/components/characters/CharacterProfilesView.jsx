import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useCharacterProfileStore from '../../store/characterProfileStore';
import useEntityStore from '../../store/entityStore';
import usePersonaStore from '../../store/personaStore';
import useChatStore from '../../store/chatStore';
import useCategoryStore from '../../store/categoryStore.js';
import useUIModeStore, { isModeAllowed } from '../../store/uiModeStore.js';
import * as characterService from '../../services/management/characterService.js';
import * as entityService from '../../services/management/entityService.js';
import { personaOwnedProfileIds } from '../../utils/personaProfileUtils';
import CharacterProfileCard from './CharacterProfileCard';
import CharacterProfileEditor from './CharacterProfileEditor';
import CharacterDetailView from './CharacterDetailView.jsx';
import CharacterCardImport from './CharacterCardImport';
import CategoryFilterDropdown from './CategoryFilterDropdown.jsx';
import ManageCategoriesModal from './ManageCategoriesModal.jsx';
import DuplicatePickerModal from './DuplicatePickerModal.jsx';
import ConfirmDialog from '../modals/ConfirmDialog.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import PageHeader from '../ui/PageHeader.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import Skeleton from '../ui/Skeleton.jsx';
import { MagnifierIcon, UsersIcon } from '../../constants/icons.jsx';
import { toast } from '../../store/toastStore.js';
import {
    FILTER_ALL,
    FILTER_FAVORITES,
    buildCategoryMemberIndex,
    categoryIdFromFilter,
    countFavorites,
    filterCharacterProfiles,
    resolveCharacterFilter,
} from '../../utils/characterFilterUtils.js';
import { duplicateCandidates } from '../../utils/duplicateNamePreview.js';

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
 * @param {Function} [props.onStartChatFromCard] - "Start chatting" on a card —
 *   the app resolves (or creates) the AI partner for the profile, stashes a
 *   start-chat request in chatStore, then calls this callback so the shell can
 *   switch to the Chat tab, where the new conversation opens.
 */
export default function CharacterProfilesView({ onCreatePersonaFromCard, onCreateEntityFromCard, onStartChatFromCard }) {
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
    const [showManageCategories, setShowManageCategories] = useState(false);
    const [editingProfile, setEditingProfile] = useState(null);
    /**
     * 03-4: the profile whose DETAIL page is open.
     *
     * Held as an ID, not a row: the store row is the single source of truth, so
     * a favourite toggle, an edit or a sync refresh is reflected on the page
     * without copying state. A deleted profile resolves to `undefined` and the
     * page closes itself (see the guard below) rather than rendering a ghost.
     */
    const [detailProfileId, setDetailProfileId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilterRequest, setActiveFilterRequest] = useState(FILTER_ALL);
    const categories = useCategoryStore((state) => state.categories);
    const loadCategories = useCategoryStore((state) => state.loadCategories);
    const [cardSize, setCardSize] = useState(() => {
        return localStorage.getItem('characterProfileCardSize') || 'medium';
    });
    const [deleteTargetId, setDeleteTargetId] = useState(null);
    /**
     * 03-3: duplicate-with-preview picker visibility.
     *
     * The picker operates on AI ENTITIES, not character profiles: the engine's
     * duplicate flow (`POST /entities/:id/duplicate`) copies module mappings +
     * lifecycle and live-links the SAME character card, so a profile-level
     * duplicate would be the wrong thing entirely. The button therefore only
     * appears once at least one AI partner exists.
     */
    const [showDuplicatePicker, setShowDuplicatePicker] = useState(false);
    /**
     * Read the UI mode REACTIVELY (not `getState()` at call time). The result
     * actions offered by the picker differ per mode — Pro opens the new entity
     * in the Entities screen, Simple starts a chat instead — and the modal
     * holds the created row, so swapping the handler mid-flow would change the
     * buttons under the user's pointer.
     */
    const uiMode = useUIModeStore((state) => state.mode);
    const canOpenEntities = isModeAllowed(uiMode, 'pro');

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

    /**
     * 03-3: does the duplicate flow have anything to work on? Memoized because
     * the header button reads it on every render and it allocates a new array —
     * and it is the SAME predicate the picker applies internally, so the button
     * can never open a modal that immediately shows its empty state.
     */
    const hasDuplicateCandidates = useMemo(
        () => duplicateCandidates(entities).length > 0,
        [entities]
    );

    /**
     * Toolbar state — search AND the active filter (All / Favorites / one
     * category), composed so search always runs WITHIN the active filter
     * (03-2 step 5).
     *
     * The rules live in `characterFilterUtils` so they are unit-tested rather
     * than re-derived here. `activeFilterRequest` is the user's REQUEST;
     * `activeFilter` is what is actually honoured. They diverge when the request
     * has become STALE:
     *
     *  - Favourites active but nothing is favourited any more (the last heart was
     *    un-clicked, or that profile was deleted) → fall back to All rather than
     *    stranding the grid empty forever.
     *  - A category chip active but the category was deleted (here or in the
     *    Manage modal) → same fallback.
     *
     * A category that merely has ZERO members is NOT stale — the user may be
     * looking at the chip they just created, so an empty grid with a "no
     * characters in this category yet" message is the correct answer.
     */
    const categoryIndex = useMemo(() => buildCategoryMemberIndex(categories), [categories]);
    const categoryIds = useMemo(
        () => new Set((categories || []).map((category) => category.id)),
        [categories]
    );
    const favoriteCount = useMemo(() => countFavorites(visibleProfiles), [visibleProfiles]);
    const activeFilter = resolveCharacterFilter(activeFilterRequest, visibleProfiles, { categoryIds });
    const filteredProfiles = useMemo(
        () => filterCharacterProfiles(visibleProfiles, {
            search: searchQuery,
            filter: activeFilter,
            categoryIndex,
        }),
        [visibleProfiles, searchQuery, activeFilter, categoryIndex]
    );

    // Mirror the resolved filter back into the request once it goes stale, so
    // the chip row and the grid never disagree about what is selected.
    useEffect(() => {
        if (activeFilter !== activeFilterRequest) {
            setActiveFilterRequest(activeFilter);
        }
    }, [activeFilter, activeFilterRequest]);

    useEffect(() => {
        loadProfiles();
        // Needed for the "used by" badges / live-link hint (3-2).
        loadEntities();
        // 03-2: categories drive the chip row and the card menu's checkbox list.
        loadCategories();
    }, [loadProfiles, loadEntities, loadCategories]);

    // Cross-view handoff: the Chat welcome screen's "Create AI Character"
    // button sets a one-shot flag and switches to this tab. This view mounts
    // fresh on tab switch, so read the flag once on mount, clear it, and open
    // the create editor (no profile → CharacterProfileEditor starts blank).
    useEffect(() => {
        if (!useCharacterProfileStore.getState().createProfileRequested) return;
        useCharacterProfileStore.getState().clearRequestCreateProfile();
        setEditingProfile(null);
        setShowEditor(true);
    }, []);

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

    /** 03-4: open the read-only detail page for one profile. */
    const handleOpenDetail = (profile) => {
        if (!profile?.id) return;
        setDetailProfileId(profile.id);
    };

    const handleCloseDetail = () => setDetailProfileId(null);

    /**
     * 03-4: the detail page's Duplicate action.
     *
     * Calls the engine's full-card copy (the same route 2-4 uses) and refreshes
     * the list BEFORE resolving, so the Copies tab and the returned row are both
     * backed by real store state. The new profile is returned so the page can
     * navigate to it — the name comes from the server, never from the client.
     */
    const handleDetailDuplicate = async (profile) => {
        if (!profile?.id) return null;
        const created = await characterService.duplicateCharacterProfile(profile.id);
        await loadProfiles();
        return created;
    };

    /**
     * 03-4: the detail page's Delete action.
     *
     * Uses the STORE's `deleteProfile`, not the bare service: the store also
     * drops the profile's cached images and clears `selectedProfileId`, so a
     * deleted character cannot leave object URLs or a dangling selection behind.
     * The detail page owns its own busy state, so the `isLoading` flip this
     * causes cannot flash anything the user is looking at — the page closes on
     * success and the grid reloads anyway.
     */
    const handleDetailDelete = async (id) => {
        await deleteProfile(id);
    };

    /**
     * 03-4: Chat from the detail page.
     *
     * An explicit `entityId` (a linked partner row) is used as-is; without one
     * the behaviour matches the card's Chat button — resolve the existing AI
     * partner or create one, then hand the id to the Chat tab.
     */
    const handleDetailStartChat = async (profile, entityId = null) => {
        if (entityId) {
            useChatStore.getState().requestStartChat(entityId);
            onStartChatFromCard?.();
            return;
        }
        await handleStartChatFromCard(profile);
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
            toast.success(t('common:toast.characterDeleted'));
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
     * fields, images copied with the primary flag preserved), then create the
     * persona entity from the copy in ONE server-derived request, then open
     * the new persona in the Personas tab's editor. The old identity-prefill
     * stash flow is retired.
     *
     * D23/D66: the request carries the copy's RAW name (spaces included —
     * never charset-validated or id-ified client-side); the engine derives
     * the timestamped id and defaults the alias, auto-suffixed on live
     * collision (D30). No client-side id/alias derivation remains (D59).
     * Reserved/empty names surface as engine 400s in the alert below.
     * The create passes `dedupe_id_if_taken`: an id held by a SOFT-deleted
     * entity is invisible to the live-only entity list, and the engine
     * resolves such collisions in-transaction. Its 201 body echoes the
     * RESOLVED id — the persona-editor request uses `created.id`.
     */
    const handleCreatePersonaFromCard = async (profile) => {
        if (!profile?.id) return;
        let newProfile = null;
        try {
            newProfile = await characterService.duplicateCharacterProfile(profile.id);
            const created = await entityService.createPersonaEntity(newProfile.name, newProfile.id, { dedupeIdIfTaken: true });
            usePersonaStore.getState().requestEditPersona(created.id);
            onCreatePersonaFromCard();
        } catch (error) {
            // Compensation: once duplicateCharacterProfile resolved, the profile
            // COPY exists — so any failure after it (the atomic create,
            // anything else) would orphan an unowned card that resurfaces in
            // the Characters grid. Best-effort delete via the direct service
            // (NOT the store's deleteProfile — its isLoading side-effects must
            // not churn during error handling). Cleanup failures are
            // swallowed/logged so they never mask the original error surfaced
            // by the i18n'd alert below.
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
     * (engine 1:1 semantics, no card copy): create the entity from the
     * profile's RAW name via the server-derived contract in ONE request
     * (the engine derives the timestamped id and defaults the alias, D23/D30),
     * then refresh the entity list and preselect the new entity BEFORE the
     * shell switches to the Entities tab (EntitySettingsView's
     * selection-constraining effect then keeps it).
     *
     * The create passes `dedupe_id_if_taken`: an id held by a SOFT-deleted
     * entity is invisible to the live-only entity list, and the engine now
     * resolves such collisions in-transaction instead of rejecting the create.
     * Its 201 body echoes the RESOLVED id, so the preselection uses
     * `created.id`.
     */
    const handleCreateEntityFromCard = async (profile) => {
        if (!profile?.id) return;
        try {
            const created = await entityService.createEntity(profile.name, profile.id, { dedupeIdIfTaken: true });
            // Refresh first so the tab mounts with the new entity already in
            // the store — otherwise the selection constraint could override
            // the preselection while the list is still stale.
            await loadEntities();
            selectEntity(created.id);
            onCreateEntityFromCard();
        } catch (error) {
            alert(t('characters:createEntityFailed', { message: error.message }));
        }
    };

    /**
     * "Start chatting" on a card — the one-click path from a character to a
     * conversation. A card may not yet have an AI partner: if none of the
     * entities reference this profile LIVE, create one first (same contract as
     * handleCreateEntityFromCard). Then stash the partner id in chatStore and
     * ask the shell to switch to the Chat tab; ChatView consumes the request on
     * mount and opens a brand-new conversation.
     */
    const handleStartChatFromCard = async (profile) => {
        if (!profile?.id) return;
        try {
            const existing = (referencingByProfile[profile.id] || [])
                .find(entity => entity.entity_type !== 'user');
            let partnerId = existing?.id;
            if (!partnerId) {
                const created = await entityService.createEntity(profile.name, profile.id, { dedupeIdIfTaken: true });
                partnerId = created.id;
                // Refresh so the entity list (and the card's "used by" badge)
                // reflects the freshly created partner.
                await loadEntities();
            }
            useChatStore.getState().requestStartChat(partnerId);
            onStartChatFromCard?.();
        } catch (error) {
            alert(t('characters:startChatFailed', { message: error.message }));
        }
    };

    /**
     * 03-3 — refresh after a duplicate.
     *
     * Called by the picker the moment the 201 lands, NOT when it closes: the
     * follow-up actions ("Open in Entities" / "Start chatting") navigate away,
     * and a stale list would then mount without the copy in it. The engine
     * already re-read the row inside the duplicate transaction, so this is a
     * plain reload — no optimistic row is inserted, because the server is the
     * authority on both the id and the alias.
     */
    const handleEntityDuplicated = async () => {
        await loadEntities();
    };

    /**
     * Pro: open the freshly created copy in the Entities screen.
     *
     * The refresh is AWAITED here rather than trusted to the picker's
     * `onDuplicated` callback: both fire, but only awaiting guarantees the list
     * contains the copy before the tab switches. Selecting a not-yet-loaded id
     * loses the race with EntitySettingsView's selection-constraining effect,
     * which would then open the previously selected entity.
     */
    const handleOpenDuplicatedEntity = async (created) => {
        if (!created?.id) return;
        await loadEntities();
        selectEntity(created.id);
        setShowDuplicatePicker(false);
        onCreateEntityFromCard?.();
    };

    /** Simple: start a conversation with the copy instead of managing it. */
    const handleStartChatWithDuplicate = (created) => {
        const entityId = created?.id;
        setShowDuplicatePicker(false);
        if (!entityId) return;
        useChatStore.getState().requestStartChat(entityId);
        onStartChatFromCard?.();
    };

    const handleImportSuccess = async (result) => {
        setShowImport(false);
        // Import used to close silently — a themed toast confirms the card
        // landed before the editor opens on it.
        toast.success(t('common:toast.characterImported'));
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

    // While editing, the editor takes over as a dedicated page — it replaces the
    // card grid rather than covering it with a modal, so the form gets the full
    // width/height of the content area.
    if (showEditor) {
        return (
            <CharacterProfileEditor
                variant="page"
                profile={editingProfile}
                referencedEntities={editingProfile ? (referencingByProfile[editingProfile.id] || []) : []}
                onClose={() => { setShowEditor(false); setEditingProfile(null); }}
            />
        );
    }

    /**
     * 03-4: the DETAIL page takes over like the editor's page variant.
     *
     * Ordering matters — `showEditor` is checked first so Edit from the detail
     * page returns to the editor, and the detail page comes back afterwards
     * because `detailProfileId` is never cleared by that transition.
     *
     * The profile is resolved from the store on every render: if it disappears
     * (deleted here or by a sync), the page falls through to the grid instead
     * of rendering a ghost. `getProfile` is a plain lookup, so this costs
     * nothing.
     */
    const detailProfile = detailProfileId ? getProfile(detailProfileId) : null;
    if (detailProfile) {
        return (
            <CharacterDetailView
                profile={detailProfile}
                profiles={visibleProfiles}
                linkedEntities={referencingByProfile[detailProfile.id] || []}
                onBack={handleCloseDetail}
                onEdit={handleEdit}
                onStartChat={handleDetailStartChat}
                onOpenProfile={(id) => setDetailProfileId(id)}
                onDuplicate={handleDetailDuplicate}
                onDelete={handleDetailDelete}
            />
        );
    }

    return (
        <div className="flex flex-col min-h-full">
            <PageHeader
                title={t('characters:header.title')}
                subtitle={t('characters:header.subtitle')}
                actions={(
                    <>
                        {/* 03-3: duplicate-with-preview. Only meaningful when an
                            AI partner EXISTS — a character card with no entity
                            has nothing to duplicate (the flow copies the entity:
                            profile link, module mappings, lifecycle).
                            "Create AI partner from this card" on a card is how
                            the first one is made. */}
                        {hasDuplicateCandidates && (
                            <Tooltip content={t('characters:duplicate.headerButtonHint')}>
                                <button data-tutorial-id="char-duplicate-btn" onClick={() => setShowDuplicatePicker(true)}
                                    className="btn-secondary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors">
                                    <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    {t('characters:duplicate.headerButton')}
                                </button>
                            </Tooltip>
                        )}
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
                    </>
                )}
            />

            <div className="bg-background-surface px-6 py-4">
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

                    {/* Filter chips (03-1 favourites + 03-2 categories):
                        All · Favorites (n) · <category> (n) … · Manage.
                        Always rendered (not gated on `favoriteCount`) because
                        Manage is the only entry point to categories — hiding the
                        row until something is favourited would make the feature
                        unreachable. The component owns the per-chip visibility
                        rules (a zero-member category hides unless active). */}
                    <CategoryFilterDropdown
                        categories={categories}
                        categoryIndex={categoryIndex}
                        profiles={visibleProfiles}
                        activeFilter={activeFilter}
                        favoriteCount={favoriteCount}
                        onSelect={(filter) => setActiveFilterRequest(
                            // Clicking the ACTIVE chip clears it back to All —
                            // the same toggle affordance the favourites chip had.
                            filter === activeFilter && filter !== FILTER_ALL ? FILTER_ALL : filter
                        )}
                        onManage={() => setShowManageCategories(true)}
                    />

                    {/* Card Size Toggle */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-text-muted font-medium">{t('characters:cardSize')}</span>
                        <div className="flex gap-1">
                            {[
                                { size: 'small', title: t('characters:cardSizes.small'), path: "M2 3h4v5H2zM7 3h4v5H7zM12 3h4v5H12zM17 3h4v5H17zM2 9.5h4v5H2zM7 9.5h4v5H7zM12 9.5h4v5H12zM17 9.5h4v5H17zM2 16h4v5H2zM7 16h4v5H7zM12 16h4v5H12zM17 16h4v5H17z" },
                                { size: 'medium', title: t('characters:cardSizes.medium'), path: "M3 5h5v6H3zM10 5h5v6H10zM17 5h5v6H17zM3 13h5v6H3zM10 13h5v6H10zM17 13h5v6H17z" },
                                { size: 'large', title: t('characters:cardSizes.large'), path: "M3 3h8v8H3zM14 3h8v8H14zM3 14h8v8H3zM14 14h8v8H14z" },
                            ].map(({ size, title, path }) => (
                                <Tooltip key={size} content={title}>
                                    <button onClick={() => handleCardSizeChange(size)}
                                        style={cardSize === size ? { color: 'var(--color-accent-primary)' } : undefined}
                                        className={`settings-option-chip p-2 rounded-md ${cardSize === size ? 'settings-option-chip-active' : 'text-text-muted hover:text-text-primary'}`}>
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                            <path d={path} />
                                        </svg>
                                    </button>
                                </Tooltip>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-6">
                {isLoading && profiles.length === 0 ? (
                    /* The grid size is known, so show where the cards will land
                       instead of a spinner. `getGridClasses()` keeps the column
                       count identical to the real grid (and to the card-size
                       toggle), so nothing shifts when the profiles arrive. */
                    <div className={`grid ${getGridClasses()} gap-6`} aria-busy="true">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <div key={index} className="ui-skeleton-card">
                                <Skeleton className="ui-skeleton-card-media" height="auto" />
                                <Skeleton className="ui-skeleton-line" width="70%" />
                                <Skeleton className="ui-skeleton-line" width="45%" height="0.6rem" />
                            </div>
                        ))}
                    </div>
                ) : visibleProfiles.length > 0 ? (
                    filteredProfiles.length > 0 ? (
                        <div data-tutorial-id="char-profile-grid" className={`grid ${getGridClasses()} gap-6`}>
                            {filteredProfiles.map(profile => (
                                <CharacterProfileCard key={profile.id} profile={profile}
                                    onClick={() => handleEdit(profile)} onDelete={handleDeleteRequest}
                                    onOpenDetail={handleOpenDetail}
                                    referencingEntities={referencingByProfile[profile.id] || []}
                                    onCreatePersona={handleCreatePersonaFromCard}
                                    onCreateEntity={handleCreateEntityFromCard}
                                    onStartChat={handleStartChatFromCard} />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            icon={MagnifierIcon}
                            title={t('characters:empty.noResults')}
                            description={
                                activeFilter === FILTER_FAVORITES
                                    ? t('characters:empty.noFavoriteResults')
                                    : categoryIdFromFilter(activeFilter)
                                        ? t('characters:empty.noCategoryResults')
                                        : t('characters:empty.tryAdjustingSearch')
                            }
                            actionLabel={t('common:emptyState.clearFilters')}
                            /* Both the search AND the filter must clear: leaving
                               Favourites or a category active would make an
                               already-empty grid stay empty. */
                            onAction={() => { setSearchQuery(''); setActiveFilterRequest(FILTER_ALL); }}
                        />
                    )
                ) : (
                    <EmptyState
                        icon={UsersIcon}
                        title={t('characters:empty.title')}
                        description={profiles.length > 0
                            /* 2-1: the grid may be empty because every profile is
                               persona-owned — point at the Personas tab. */
                            ? `${t('characters:empty.getStarted')} ${t('characters:empty.personaOwnedHint')}`
                            : t('characters:empty.getStarted')}
                        actionLabel={t('characters:buttons.createProfile')}
                        onAction={() => { setEditingProfile(null); setShowEditor(true); }}
                        secondaryLabel={t('characters:buttons.importCard')}
                        onSecondary={() => setShowImport(true)}
                    />
                )}
            </div>

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

            {/* 03-3 duplicate picker. Receives the FULL entity list (not the
                filtered profile grid): copy-series slots are counted across
                every live AI alias, and the profile filters have no bearing on
                which partners can be copied. Result actions are mode-scoped —
                Pro manages the copy in Entities, Simple starts chatting. */}
            <DuplicatePickerModal
                isOpen={showDuplicatePicker}
                onClose={() => setShowDuplicatePicker(false)}
                entities={entities}
                onDuplicated={handleEntityDuplicated}
                onOpenEntity={canOpenEntities ? handleOpenDuplicatedEntity : null}
                onStartChat={canOpenEntities ? null : handleStartChatWithDuplicate}
            />

            <ManageCategoriesModal
                isOpen={showManageCategories}
                onClose={() => setShowManageCategories(false)}
                profiles={visibleProfiles}
                categoryIndex={categoryIndex}
            />

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
