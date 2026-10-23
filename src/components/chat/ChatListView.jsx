import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageIcon, RobotIcon, PlusIcon, SearchIcon, ChevronDownIcon } from '../../constants/icons.jsx';
import useChatStore from '../../store/chatStore.js';
import useEntityStore from '../../store/entityStore.js';
import EmptyState from '../ui/EmptyState.jsx';
import Skeleton from '../ui/Skeleton.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import CharacterImage from '../common/CharacterImage.jsx';
import {
    partitionChatEntities,
    entityDisplayName,
    conversationPreview,
    conversationDisplayName,
    conversationAvatarProfileId,
    isConversationLastMessageOutgoing,
    truncatePreview,
} from '../../store/chatStoreUtils.js';
import {
    filterByPartner,
    groupByDay,
    partnerChips,
    rowUnreadBadge,
} from '../../store/inboxUtils.js';

/** Short time-of-day label for a row (`14:05`), or the date when older. */
function formatRowTime(value, now = new Date()) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const sameDay = date.toDateString() === now.toDateString();
    return sameDay
        ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
}

/**
 * Chat list (F1) — the desktop GLOBAL INBOX (Task 02-4).
 *
 * ONE list, every thread across every AI companion, exactly the mobile app's
 * inbox: the engine returns the rows already deduped by `participant_key`,
 * flagged (pinned / archived / muted / disabled) and ordered
 * `pinned DESC, last_activity_at DESC`. The client never re-sorts — live
 * updates patch rows in place, and a client-side sort would make a row jump
 * under the pointer.
 *
 * Presented for scanning rather than filtered by a required "pick an entity
 * first" step:
 *  - a **partner chip row** (All + one chip per companion, shown only when
 *    there are ≥2 partners) narrows the list client-side,
 *  - rows are grouped into Today / Yesterday / Earlier,
 *  - each row is avatar · name · preview · time · status column · unread badge,
 *  - archived threads are hidden behind a collapsible "Archived (N)" section.
 *
 * @param {{ onOpenConversation: (conversation: object) => void,
 *   onNavigate: (tab: string) => void,
 *   onOpenArchived?: () => void }} props
 */
const ChatListView = ({ onOpenConversation, onNavigate, onOpenArchived }) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    const conversations = useChatStore((s) => s.conversations);
    const archivedConversations = useChatStore((s) => s.archivedConversations);
    const chatEntities = useChatStore((s) => s.chatEntities);
    const loadingConversations = useChatStore((s) => s.loadingConversations);
    const listEntityId = useChatStore((s) => s.listEntityId);
    const setListEntityFilter = useChatStore((s) => s.setListEntityFilter);
    const loadChatEntities = useChatStore((s) => s.loadChatEntities);
    const loadInbox = useChatStore((s) => s.loadInbox);
    const entities = useEntityStore((s) => s.entities);
    const loadEntities = useEntityStore((s) => s.loadEntities);

    // The inbox is still loading while its rows are in flight, or while the
    // chat-entity list it names rows from has not arrived yet (an empty
    // `chatEntities` array is indistinguishable from "not fetched"). Global
    // rows carry their own companion name, so the entity list only affects the
    // New Chat picker — but the first paint should still wait for it.
    const [entitiesFetched, setEntitiesFetched] = useState(false);

    const { partners } = useMemo(() => partitionChatEntities(chatEntities), [chatEntities]);

    // Load chat entities + entity list once, then the GLOBAL inbox. The global
    // endpoint needs no partner ids — it returns every companion's threads in
    // one call — so a failure of the entity list can no longer blank the list.
    useEffect(() => {
        let active = true;
        if (entities === null) loadEntities();
        (async () => {
            await loadChatEntities();
            if (!active) return;
            setEntitiesFetched(true);
            await loadInbox({ includeArchived: true });
        })();
        return () => { active = false; };
    }, []);

    const entityById = useMemo(() => {
        const map = {};
        for (const entity of chatEntities) map[entity.id] = entity;
        return map;
    }, [chatEntities]);

    // Partner chips come from the ROWS, so a chip can never lead to an empty
    // screen. Shown only when there is more than one partner to choose from —
    // a single-partner chip row would be pure noise.
    const chips = useMemo(
        () => partnerChips(conversations, entityById),
        [conversations, entityById]
    );
    const showChips = chips.length >= 2;

    // A stale filter (partner no longer has a thread) must not hide the whole
    // inbox — fall back to "All" instead of rendering "no matches" forever.
    const activeFilter = showChips && chips.some((chip) => chip.id === listEntityId)
        ? listEntityId
        : null;

    // Shared by both lists: the search term is matched against the SAME display
    // name the row renders, so what you see is what you can search.
    const matchesSearch = useCallback((conversation) => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        const name = conversationDisplayName(conversation, entityById).toLowerCase();
        const preview = conversationPreview(conversation.last_message).toLowerCase();
        return name.includes(term) || preview.includes(term);
    }, [search, entityById]);

    const filtered = useMemo(() => {
        const byPartner = filterByPartner(conversations, activeFilter);
        return byPartner.filter((conversation) => {
            if (unreadOnly && !conversation.unread_count) return false;
            return matchesSearch(conversation);
        });
    }, [conversations, activeFilter, unreadOnly, matchesSearch]);

    const archivedFiltered = useMemo(() => {
        const byPartner = filterByPartner(archivedConversations, activeFilter);
        return byPartner.filter(matchesSearch);
    }, [archivedConversations, activeFilter, matchesSearch]);

    // Day buckets over the SERVER order — grouping is a view, never a re-sort.
    const dayGroups = useMemo(() => groupByDay(filtered), [filtered]);

    const startNewChat = (partner) => {
        const participantIds = [partner.id];
        onOpenConversation?.({
            interactionId: null, // resolved by the engine on INIT_ENTITY
            entityId: partner.id,
            participantIds,
            partnerEntityId: partner.id,
            isNew: true,
        });
    };

    /**
     * Status column: 📌 pinned · 🔇 muted · 🚫 disabled.
     *
     * Glyphs (matching the Android inbox) rather than new SVG icons, each with a
     * translated accessible label + tooltip so the meaning is not guesswork.
     * Rendered only when at least one flag is set — a quiet row stays quiet.
     */
    const renderStatus = (conversation) => {
        const flags = [];
        if (conversation.pinned) {
            flags.push({ key: 'pinned', glyph: '📌', label: t('chat:list.statusPinned') });
        }
        if (conversation.muted) {
            flags.push({ key: 'muted', glyph: '🔇', label: t('chat:list.statusMuted') });
        }
        if (conversation.entity_disabled) {
            flags.push({ key: 'disabled', glyph: '🚫', label: t('chat:list.statusDisabled') });
        }
        if (flags.length === 0) return null;
        return (
            <span className="chat-list-status">
                {flags.map((flag) => (
                    <Tooltip key={flag.key} content={flag.label}>
                        <span className="chat-list-status-icon" aria-label={flag.label} role="img">
                            {flag.glyph}
                        </span>
                    </Tooltip>
                ))}
            </span>
        );
    };

    const renderRow = (conversation) => {
        // Name/avatar by the AI companion that OWNS the row, not by
        // partner_entity_id (the persona "user").
        const name = conversationDisplayName(conversation, entityById);
        const avatarProfileId = conversationAvatarProfileId(conversation, entityById);
        const preview = conversationPreview(conversation.last_message);
        const isOutgoing = isConversationLastMessageOutgoing(conversation, entityById);
        const previewPrefix = isOutgoing ? `${t('chat:list.you')}: ` : '';
        // Suppress the badge when muted — the Android rule. A muted thread
        // still sorts and still shows its preview; it just stops shouting.
        const badge = rowUnreadBadge(conversation);

        return (
            <li key={conversation.participant_key}>
                <button
                    type="button"
                    className={`chat-list-row ${badge > 0 ? 'chat-list-row-unread' : ''}`}
                    onClick={() => onOpenConversation?.({
                        interactionId: conversation.interaction_id,
                        entityId: conversation.entity_id,
                        participantIds: conversation.participant_ids,
                        partnerEntityId: conversation.partner_entity_id,
                        participantKey: conversation.participant_key,
                    })}
                >
                    <span className="chat-list-avatar-ring">
                        <CharacterImage
                            profileId={avatarProfileId}
                            alt={name}
                            className="chat-list-avatar"
                            fallback={<span className="chat-list-avatar-fallback"><RobotIcon className="w-5 h-5" /></span>}
                        />
                    </span>
                    <span className="chat-list-body">
                        <span className="chat-list-row-top">
                            <span className="chat-list-name">{name}</span>
                            {renderStatus(conversation)}
                            <span className="chat-list-time">
                                {formatRowTime(conversation.last_activity_at || conversation.last_message?.created_at)}
                            </span>
                        </span>
                        <span className="chat-list-preview">
                            {preview
                                ? `${previewPrefix}${truncatePreview(preview)}`
                                : t('chat:list.noMessages')}
                        </span>
                    </span>
                    {badge > 0 && <span className="chat-list-badge">{badge}</span>}
                </button>
            </li>
        );
    };

    return (
        <div className="chat-list">
            <div className="chat-list-toolbar">
                <div className="chat-list-search">
                    <SearchIcon className="w-4 h-4 text-text-muted" />
                    <input
                        type="text"
                        value={search}
                        placeholder={t('chat:list.searchPlaceholder')}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <button
                    type="button"
                    className={`chat-list-filter ${unreadOnly ? 'chat-list-filter-active' : ''}`}
                    onClick={() => setUnreadOnly((v) => !v)}
                >
                    {unreadOnly ? t('chat:list.filterUnread') : t('chat:list.filterAll')}
                </button>
                <button
                    type="button"
                    className="btn-primary chat-list-new"
                    onClick={() => setShowPicker(true)}
                >
                    <PlusIcon className="w-4 h-4" />
                    {t('chat:list.newChat')}
                </button>
            </div>

            {/* Partner filter chips — the inbox's replacement for "pick an
                entity first". Only rendered with ≥2 partners. */}
            {showChips && (
                <div className="chat-inbox-chips" role="group" aria-label={t('chat:list.filterByPartner')}>
                    <button
                        type="button"
                        className={`chat-inbox-chip ${!activeFilter ? 'chat-inbox-chip-active' : ''}`}
                        onClick={() => setListEntityFilter(null)}
                        aria-pressed={!activeFilter}
                    >
                        {t('chat:list.allPartners')}
                    </button>
                    {chips.map((chip) => (
                        <button
                            key={chip.id}
                            type="button"
                            className={`chat-inbox-chip ${activeFilter === chip.id ? 'chat-inbox-chip-active' : ''}`}
                            onClick={() => setListEntityFilter(activeFilter === chip.id ? null : chip.id)}
                            aria-pressed={activeFilter === chip.id}
                        >
                            {chip.name}
                        </button>
                    ))}
                </div>
            )}

            {!entitiesFetched || loadingConversations ? (
                /* Row-shaped skeletons, matching `.chat-list-row` so the list
                   does not jump when the rows arrive. */
                <div className="chat-list-rows" aria-busy="true">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="ui-skeleton-row">
                            <Skeleton className="ui-skeleton-circle" width="46px" height="46px" />
                            <div className="ui-skeleton-row-body">
                                <Skeleton className="ui-skeleton-line" width="45%" />
                                <Skeleton className="ui-skeleton-line" width="75%" height="0.6rem" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState
                    icon={MessageIcon}
                    title={conversations.length > 0 ? t('chat:list.noMatches') : t('chat:list.empty')}
                    description={conversations.length > 0
                        ? t('chat:list.noMatchesHint')
                        : t('chat:list.emptyHint')}
                    actionLabel={conversations.length > 0
                        ? t('common:emptyState.clearFilters')
                        : t('chat:list.openCharacters')}
                    onAction={() => (conversations.length > 0
                        ? (setSearch(''), setUnreadOnly(false), setListEntityFilter(null))
                        : onNavigate?.('characters'))}
                />
            ) : (
                <div className="chat-list-scroll">
                    {dayGroups.map((group) => (
                        <div key={group.key} className="chat-inbox-daygroup">
                            <h3 className="chat-inbox-dayhead">{t(`chat:list.day.${group.key}`)}</h3>
                            <ul className="chat-list-rows">
                                {group.rows.map(renderRow)}
                            </ul>
                        </div>
                    ))}

                    {/* Archived threads: hidden behind a toggle, with a link to
                        the dedicated screen for the full, paged list. */}
                    {archivedFiltered.length > 0 && (
                        <div className="chat-inbox-archived">
                            <button
                                type="button"
                                className="chat-inbox-archived-head"
                                onClick={() => setShowArchived((v) => !v)}
                                aria-expanded={showArchived}
                            >
                                <ChevronDownIcon
                                    className={`w-4 h-4 chat-inbox-archived-chevron ${showArchived ? 'chat-inbox-archived-chevron-open' : ''}`}
                                />
                                <span>{t('chat:list.archivedSection', { count: archivedFiltered.length })}</span>
                            </button>
                            {showArchived && (
                                <>
                                    <ul className="chat-list-rows">
                                        {archivedFiltered.map(renderRow)}
                                    </ul>
                                    {onOpenArchived && (
                                        <button
                                            type="button"
                                            className="chat-inbox-archived-link"
                                            onClick={onOpenArchived}
                                        >
                                            {t('chat:list.openArchived')}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {showPicker && (
                <div className="chat-picker-backdrop" onClick={() => setShowPicker(false)}>
                    <div className="chat-picker" onClick={(e) => e.stopPropagation()}>
                        <h3 className="chat-picker-title">{t('chat:list.selectCompanion')}</h3>
                        {partners.length === 0 ? (
                            <EmptyState
                                size="compact"
                                icon={RobotIcon}
                                title={t('chat:list.noCompanionsTitle')}
                                description={t('chat:list.noCompanions')}
                                actionLabel={t('chat:list.openCharacters')}
                                onAction={() => { setShowPicker(false); onNavigate?.('characters'); }}
                            />
                        ) : (
                            <ul className="chat-picker-list">
                                {partners.map((partner) => {
                                    const name = entityDisplayName(partner);
                                    return (
                                        <li key={partner.id}>
                                            <button
                                                type="button"
                                                className="chat-picker-row"
                                                onClick={() => { setShowPicker(false); startNewChat(partner); }}
                                            >
                                                <span className="chat-list-avatar-ring">
                                                    <CharacterImage
                                                        profileId={partner.character_profile_id}
                                                        alt={name}
                                                        className="chat-list-avatar"
                                                        fallback={<span className="chat-list-avatar-fallback"><RobotIcon className="w-5 h-5" /></span>}
                                                    />
                                                </span>
                                                <span className="chat-picker-name">{name}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatListView;
