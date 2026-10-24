import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useCharacterProfileStore from '../../store/characterProfileStore';
import useUIModeStore, { isModeAllowed } from '../../store/uiModeStore.js';
import CharacterImage from '../common/CharacterImage.jsx';
import CharacterCardExport from './CharacterCardExport.jsx';
import ImageGallery from './ImageGallery.jsx';
import ConfirmDialog from '../modals/ConfirmDialog.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import PageHeader from '../ui/PageHeader.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import { MessageIcon, UsersIcon } from '../../constants/icons.jsx';
import { toast } from '../../store/toastStore.js';
import {
    buildGreetingSlides,
    copySiblingProfiles,
    countLinkedEntities,
    profileTagList,
    rawCardJson,
    resolveDetailTabs,
    splitLinkedEntities,
} from '../../utils/characterDetailUtils.js';

/**
 * Read-only character detail page (plan 03-4).
 *
 * Android has a public AI-profile page — avatar, description, gallery, copies.
 * This is the LOCAL equivalent: no likes, no comments, no marketplace. The value
 * is looking at a character before chatting, so the page leads with the hero,
 * the greeting the chat will actually open with, and a Chat button.
 *
 * ## Why it is a page, not a modal
 * The editor already owns the modal slot on this screen, and a detail page with
 * a gallery + carousel in a modal is two nested scrollers. It replaces the grid
 * like [`CharacterProfileEditor`](./CharacterProfileEditor.jsx)'s page variant.
 *
 * ## Mode behaviour (plan step 2)
 * - **Simple** — hero + description + greeting + Chat, and NO tab strip: tabs
 *   above three sections are chrome.
 * - **Pro** — adds the Gallery, Copies and Linked partners tabs.
 * - **Dev** — adds the raw card JSON tab.
 *
 * The tab list comes from `resolveDetailTabs` so the rule is unit-tested rather
 * than re-derived in JSX.
 *
 * @param {Object} props
 * @param {import('../../services/management/characterService').CharacterProfile} props.profile
 * @param {Array<Object>} [props.profiles] - every LIVE profile, for the Copies tab
 * @param {Array<Object>} [props.linkedEntities] - entities referencing this profile
 * @param {Function} props.onBack - return to the grid
 * @param {Function} [props.onEdit] - open the editor for this profile
 * @param {Function} [props.onStartChat] - start (or resume) a chat with this profile
 * @param {Function} [props.onOpenProfile] - open another profile's detail page
 * @param {Function} [props.onDuplicate] - duplicate a profile; resolves the copy
 * @param {Function} [props.onDelete] - delete a profile id; rejects on failure
 */
export default function CharacterDetailView({
    profile,
    profiles = [],
    linkedEntities = [],
    onBack,
    onEdit,
    onStartChat,
    onOpenProfile,
    onDuplicate,
    onDelete,
}) {
    const { t } = useTranslation('characters');
    const mode = useUIModeStore((state) => state.mode);
    const isPro = isModeAllowed(mode, 'pro');
    const isDev = isModeAllowed(mode, 'dev');

    const loadImages = useCharacterProfileStore((state) => state.loadImages);
    const primaryImage = useCharacterProfileStore((state) =>
        profile?.id ? state.getPrimaryImage(profile.id) : null
    );

    const [activeTab, setActiveTab] = useState('overview');
    const [greetingIndex, setGreetingIndex] = useState(0);
    const [showDelete, setShowDelete] = useState(false);
    const [busyAction, setBusyAction] = useState(null); // null | 'duplicate' | 'delete'

    // The page can be opened straight from the grid, where images are already
    // loaded, but also from a copy row — one call keeps the hero honest.
    useEffect(() => {
        if (profile?.id) loadImages(profile.id);
    }, [profile?.id, loadImages]);

    // Switching profiles must not leave the user on a Pro tab or a stale slide.
    useEffect(() => {
        setActiveTab('overview');
        setGreetingIndex(0);
        setShowDelete(false);
    }, [profile?.id]);

    const tabs = resolveDetailTabs({ isPro, isDev });
    // `tabs` is a fresh array each render, so it can never be an effect
    // dependency — the joined key changes only when the MODE does.
    const tabsKey = tabs.join(',');

    // A mode switch while the page is open can drop the active tab (Dev → Pro
    // removes `raw`). Fall back to the overview rather than rendering nothing.
    useEffect(() => {
        if (!tabsKey.split(',').includes(activeTab)) setActiveTab('overview');
    }, [tabsKey, activeTab]);

    const slides = useMemo(() => buildGreetingSlides(profile), [profile]);
    const tags = useMemo(() => profileTagList(profile), [profile]);
    const copies = useMemo(() => copySiblingProfiles(profile, profiles), [profile, profiles]);
    const { partners, personas } = useMemo(() => splitLinkedEntities(linkedEntities), [linkedEntities]);
    const linkedCount = countLinkedEntities(linkedEntities);

    const slide = slides[Math.min(greetingIndex, Math.max(slides.length - 1, 0))] || null;

    const handleDuplicate = async (source) => {
        if (!source?.id || busyAction) return;
        setBusyAction('duplicate');
        try {
            const created = await onDuplicate?.(source);
            toast.success(t('detail.toast.duplicated', {
                name: created?.name || source.name,
            }));
            if (created?.id) onOpenProfile?.(created.id);
        } catch (error) {
            toast.error(t('detail.toast.duplicateFailed', { message: error.message }));
        } finally {
            setBusyAction(null);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!profile?.id || busyAction) return;
        setBusyAction('delete');
        try {
            await onDelete?.(profile.id);
            setShowDelete(false);
            toast.success(t('common:toast.characterDeleted'));
            onBack?.();
        } catch (error) {
            // Keep the dialog open on failure: the user asked to delete, so the
            // answer is either "gone" or "here is why not".
            toast.error(t('deleteFailed', { message: error.message }));
        } finally {
            setBusyAction(null);
        }
    };

    const creatorLine = [profile?.creator, profile?.character_version]
        .filter((value) => typeof value === 'string' && value.trim() !== '')
        .join(' · ');

    const metaLine = [creatorLine, profile?.nickname].filter(Boolean).join(' · ');

    const headerActions = (
        <button
            type="button"
            onClick={onBack}
            data-tutorial-id="char-detail-back"
            className="btn-secondary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors"
        >
            <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t('detail.back')}
        </button>
    );

    const renderGreeting = () => {
        if (!slide) {
            return (
                <p className="char-detail-muted">{t('detail.greeting.none')}</p>
            );
        }
        return (
            <div className="char-detail-greeting">
                <div className="char-detail-greeting-head">
                    <span className="char-detail-greeting-label">
                        {slide.kind === 'default'
                            ? t('detail.greeting.default')
                            : t('detail.greeting.alternate', { index: slide.index })}
                    </span>
                    {slides.length > 1 && (
                        <div className="char-detail-greeting-nav">
                            <button
                                type="button"
                                onClick={() => setGreetingIndex((index) => Math.max(index - 1, 0))}
                                disabled={greetingIndex === 0}
                                className="char-detail-greeting-arrow"
                                aria-label={t('detail.greeting.previous')}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <span className="char-detail-greeting-count">
                                {t('detail.greeting.position', {
                                    current: Math.min(greetingIndex + 1, slides.length),
                                    total: slides.length,
                                })}
                            </span>
                            <button
                                type="button"
                                onClick={() => setGreetingIndex((index) => Math.min(index + 1, slides.length - 1))}
                                disabled={greetingIndex >= slides.length - 1}
                                className="char-detail-greeting-arrow"
                                aria-label={t('detail.greeting.next')}
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>
                <p className="char-detail-greeting-text">{slide.text}</p>
            </div>
        );
    };

    const renderOverview = () => (
        <div className="char-detail-stack">
            <CollapsibleSection title={t('detail.section.description')} defaultOpen>
                <p className="char-detail-text">
                    {profile?.description || <span className="char-detail-muted">{t('noDescription')}</span>}
                </p>
            </CollapsibleSection>

            {profile?.personality ? (
                <CollapsibleSection title={t('detail.section.personality')}>
                    <p className="char-detail-text">{profile.personality}</p>
                </CollapsibleSection>
            ) : null}

            {profile?.scenario ? (
                <CollapsibleSection title={t('detail.section.scenario')}>
                    <p className="char-detail-text">{profile.scenario}</p>
                </CollapsibleSection>
            ) : null}

            <CollapsibleSection title={t('detail.section.greeting')} defaultOpen>
                {renderGreeting()}
            </CollapsibleSection>

            {/* Simple mode is this page — the mode rule says gallery/copies/
                partners are Pro-only, so their entry points stay hidden here
                rather than sending the user to an empty tab. */}
            {!isPro && (
                <p className="char-detail-muted char-detail-mode-hint">{t('detail.modeHint')}</p>
            )}
        </div>
    );

    const renderGallery = () => {
        if (profile?.vision_config_id) {
            return (
                <div className="char-detail-stack">
                    <ImageGallery profileId={profile.id} visionConfigId={profile.vision_config_id} readOnly />
                    <p className="char-detail-muted char-detail-hint">{t('detail.gallery.hint')}</p>
                </div>
            );
        }
        return (
            <div className="char-detail-stack">
                <ImageGallery profileId={profile.id} visionConfigId={null} readOnly />
                <p className="char-detail-muted char-detail-hint">{t('detail.gallery.noVision')}</p>
            </div>
        );
    };

    const renderCopies = () => (
        <div className="char-detail-stack">
            <p className="char-detail-muted char-detail-hint">{t('detail.copies.hint')}</p>
            {copies.length === 0 ? (
                <EmptyState
                    icon={UsersIcon}
                    size="compact"
                    title={t('detail.copies.emptyTitle')}
                    description={t('detail.copies.emptyDescription', { name: profile?.name || '' })}
                />
            ) : (
                <ul className="char-detail-copy-list">
                    {copies.map((copy) => (
                        <li key={copy.id} className="char-detail-copy-row">
                            <div className="char-detail-copy-art">
                                <CharacterImage
                                    profileId={copy.id}
                                    alt={copy.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="char-detail-copy-text">
                                <span className="char-detail-copy-name">{copy.name}</span>
                                <span className="char-detail-copy-desc">
                                    {copy.description || t('noDescription')}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => onOpenProfile?.(copy.id)}
                                className="btn-secondary px-3 py-1.5 text-xs font-semibold"
                            >
                                {t('detail.copies.open')}
                            </button>
                            <Tooltip content={t('detail.copies.duplicateHint')}>
                                <button
                                    type="button"
                                    onClick={() => handleDuplicate(copy)}
                                    disabled={busyAction !== null}
                                    className="btn-secondary px-3 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {t('detail.copies.duplicate')}
                                </button>
                            </Tooltip>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );

    const renderPartners = () => (
        <div className="char-detail-stack">
            {linkedCount === 0 ? (
                <EmptyState
                    icon={UsersIcon}
                    size="compact"
                    title={t('detail.partners.emptyTitle')}
                    description={t('detail.partners.emptyDescription')}
                />
            ) : (
                <>
                    <h3 className="char-detail-subhead">{t('detail.partners.heading')}</h3>
                    <ul className="char-detail-partner-list">
                        {partners.map((entity) => (
                            <li key={entity.id} className="char-detail-partner-row">
                                <span className="char-detail-partner-name">
                                    {entity.alias || entity.id}
                                </span>
                                <span className="char-detail-partner-meta">{t('detail.partners.ai')}</span>
                                <button
                                    type="button"
                                    onClick={() => onStartChat?.(profile, entity.id)}
                                    className="btn-primary px-3 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5"
                                >
                                    <MessageIcon className="w-3.5 h-3.5" />
                                    {t('detail.partners.chat')}
                                </button>
                            </li>
                        ))}
                    </ul>

                    {personas.length > 0 && (
                        <>
                            {/* Personas reference the card too, but they cannot be
                                chatted with as partners — listing them with a Chat
                                button would offer a guaranteed error. */}
                            <h3 className="char-detail-subhead">{t('detail.partners.personasHeading')}</h3>
                            <ul className="char-detail-partner-list">
                                {personas.map((entity) => (
                                    <li key={entity.id} className="char-detail-partner-row">
                                        <span className="char-detail-partner-name">
                                            {entity.alias || entity.id}
                                        </span>
                                        <span className="char-detail-partner-meta">
                                            {t('detail.partners.persona')}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </>
            )}
        </div>
    );

    const renderRaw = () => (
        <div className="char-detail-stack">
            <p className="char-detail-muted char-detail-hint">{t('detail.raw.hint')}</p>
            <pre className="char-detail-raw">{rawCardJson(profile)}</pre>
        </div>
    );

    const renderTab = () => {
        switch (activeTab) {
            case 'gallery': return renderGallery();
            case 'copies': return renderCopies();
            case 'partners': return renderPartners();
            case 'raw': return renderRaw();
            default: return renderOverview();
        }
    };

    const tabLabels = {
        overview: t('detail.tabs.overview'),
        gallery: t('detail.tabs.gallery'),
        copies: t('detail.tabs.copies'),
        partners: t('detail.tabs.partners'),
        raw: t('detail.tabs.raw'),
    };

    return (
        <div className="char-detail-page">
            <PageHeader
                sticky
                icon={!primaryImage ? UsersIcon : undefined}
                title={profile?.name || t('detail.untitled')}
                subtitle={metaLine || undefined}
                actions={headerActions}
            />

            <div className="char-detail-scroll">
                <div className="char-detail-pane">
                    {/* ── Hero ─────────────────────────────────────────── */}
                    <section className="char-detail-hero">
                        <div className="char-detail-hero-art">
                            <CharacterImage
                                profileId={profile?.id}
                                imageId={primaryImage?.id}
                                variant={null}
                                alt={profile?.name || ''}
                                className="w-full h-full object-cover"
                                fallback={(
                                    <div className="char-detail-hero-fallback">
                                        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                )}
                            />
                        </div>

                        <div className="char-detail-hero-body">
                            <h2 className="char-detail-hero-name">{profile?.name}</h2>
                            {profile?.nickname && (
                                <p className="char-detail-hero-nickname">{profile.nickname}</p>
                            )}
                            {creatorLine && (
                                <p className="char-detail-hero-meta">{creatorLine}</p>
                            )}

                            {tags.length > 0 && (
                                <ul className="char-detail-tags">
                                    {tags.map((tag) => (
                                        <li key={tag} className="char-detail-tag">{tag}</li>
                                    ))}
                                </ul>
                            )}

                            <div className="char-detail-hero-stats">
                                <span>{t('detail.stats.linked', { count: linkedCount })}</span>
                                {slides.length > 0 && (
                                    <span>{t('detail.stats.greetings', { count: slides.length })}</span>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => onStartChat?.(profile)}
                                data-tutorial-id="char-detail-chat"
                                className="btn-primary char-detail-hero-chat inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold"
                            >
                                <MessageIcon className="w-4 h-4" />
                                {t('detail.chat')}
                            </button>
                        </div>
                    </section>

                    {/* ── Tabs (Pro/Dev only) ──────────────────────────── */}
                    {tabs.length > 1 && (
                        <div className="char-detail-tabs" role="tablist">
                            {tabs.map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`char-detail-tab${activeTab === tab ? ' is-active' : ''}`}
                                >
                                    {tabLabels[tab]}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="char-detail-body" role="tabpanel">
                        {renderTab()}
                    </div>
                </div>
            </div>

            {/* ── Footer actions ──────────────────────────────────────── */}
            <div className="char-detail-footer">
                <button
                    type="button"
                    onClick={() => setShowDelete(true)}
                    disabled={busyAction !== null}
                    className="char-detail-footer-delete"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    {t('buttons.delete')}
                </button>

                <div className="char-detail-footer-main">
                    <button
                        type="button"
                        onClick={() => onStartChat?.(profile)}
                        className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                    >
                        <MessageIcon className="w-4 h-4" />
                        {t('detail.chat')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onEdit?.(profile)}
                        className="btn-secondary px-4 py-2 text-sm font-semibold"
                    >
                        {t('detail.edit')}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleDuplicate(profile)}
                        disabled={busyAction !== null}
                        className="btn-secondary px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {busyAction === 'duplicate' ? t('detail.duplicating') : t('detail.duplicate')}
                    </button>
                    {/* Export reuses the editor's variant so the two formats and
                        their busy states stay identical everywhere. */}
                    <CharacterCardExport profile={profile} variant="editor" />
                </div>
            </div>

            <ConfirmDialog
                isOpen={showDelete}
                title={t('detail.deleteDialog.title', { name: profile?.name || '' })}
                message={
                    linkedCount > 0
                        ? t('detail.deleteDialog.linkedMessage', {
                            count: linkedCount,
                            name: profile?.name || '',
                        })
                        : t('detail.deleteDialog.message')
                }
                confirmText={busyAction === 'delete'
                    ? t('detail.deleteDialog.deleting')
                    : t('detail.deleteDialog.confirm')}
                cancelText={t('detail.deleteDialog.cancel')}
                onConfirm={handleDeleteConfirm}
                onCancel={() => setShowDelete(false)}
            />
        </div>
    );
}

/**
 * Collapsible description block. Local to this page on purpose: the editor's
 * `Section` is coupled to its own open-state map and icon set, and this page
 * needs three self-contained blocks that default differently.
 */
function CollapsibleSection({ title, defaultOpen = false, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <section className="char-detail-section">
            <button
                type="button"
                className="char-detail-section-head"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
            >
                <span>{title}</span>
                <svg
                    className="char-detail-section-chevron w-4 h-4"
                    style={{ transform: open ? 'rotate(180deg)' : 'none' }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {open && <div className="char-detail-section-body">{children}</div>}
        </section>
    );
}
