import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageIcon } from '../../constants/icons.jsx';
import useChatStore from '../../store/chatStore.js';
import EmptyState from '../ui/EmptyState.jsx';
import Skeleton from '../ui/Skeleton.jsx';
import PageHeader from '../ui/PageHeader.jsx';
import ConversationRow from './ConversationRow.jsx';
import ConversationMenu from './ConversationMenu.jsx';
import { filterByPartner, groupByDay, partnerChips } from '../../store/inboxUtils.js';

/**
 * Archived conversations screen (Task 02-5).
 *
 * The full, paged home for the inbox's collapsed "Archived (N)" section. It
 * renders the SAME {@link ConversationRow} as the inbox — deliberately not a
 * near-copy — so a row behaves identically wherever it appears.
 *
 * The menu is narrowed to **unarchive only**: pinning a thread you have filed
 * away, or deleting it from the archive screen, are actions for the inbox. This
 * keeps the screen's one job obvious ("get it back"), which is what the plan
 * asked for.
 *
 * The rows themselves come from the store's `archivedConversations`, which
 * `loadInbox({ includeArchived: true })` already fetched — so this screen costs
 * no request of its own unless the archive was never loaded.
 *
 * @param {{ onOpenConversation: (conversation: object) => void,
 *   onNavigate?: (tab: string) => void }} props
 */
const ArchivedChatsView = ({ onOpenConversation, onNavigate }) => {
    const { t } = useTranslation();
    const [menu, setMenu] = useState(null);
    const [search, setSearch] = useState('');

    const archivedConversations = useChatStore((s) => s.archivedConversations);
    const archivedLoaded = useChatStore((s) => s.archivedLoaded);
    const chatEntities = useChatStore((s) => s.chatEntities);
    const listEntityId = useChatStore((s) => s.listEntityId);
    const loadChatEntities = useChatStore((s) => s.loadChatEntities);
    const loadInbox = useChatStore((s) => s.loadInbox);

    useEffect(() => {
        (async () => {
            if (chatEntities.length === 0) await loadChatEntities();
            // The archive array arrives with the inbox load; only pay for a
            // request when this screen is the first thing the user opened.
            if (!useChatStore.getState().archivedLoaded) {
                await loadInbox({ includeArchived: true });
            }
        })();
        // Intentionally mount-only: `loadInbox` identities are stable in the
        // store and re-running on every row change would refetch mid-action.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const entityById = useMemo(() => {
        const map = {};
        for (const entity of chatEntities) map[entity.id] = entity;
        return map;
    }, [chatEntities]);

    // A partner chip must never lead to an empty screen, so chips come from the
    // archived rows, not from the entity list.
    const chips = useMemo(
        () => partnerChips(archivedConversations, entityById),
        [archivedConversations, entityById]
    );
    const showChips = chips.length >= 2;
    const activeFilter = showChips && chips.some((chip) => chip.id === listEntityId)
        ? listEntityId
        : null;

    const rows = useMemo(() => {
        const term = search.trim().toLowerCase();
        return filterByPartner(archivedConversations, activeFilter).filter((row) => {
            if (!term) return true;
            const name = (row.companion_display_name || row.entity_id || '').toLowerCase();
            const preview = String(row.last_message?.content || '').toLowerCase();
            return name.includes(term) || preview.includes(term);
        });
    }, [archivedConversations, activeFilter, search]);

    // Day buckets over the server order — grouping is a view, never a re-sort.
    const dayGroups = useMemo(() => groupByDay(rows), [rows]);

    // Unarchive only: this screen's one job is to put a thread back.
    const menuActions = useMemo(() => ['unarchive'], []);

    const openConversation = (conversation) => onOpenConversation?.({
        interactionId: conversation.interaction_id,
        entityId: conversation.entity_id,
        participantIds: conversation.participant_ids,
        partnerEntityId: conversation.partner_entity_id,
        participantKey: conversation.participant_key,
    });

    const loading = !archivedLoaded && archivedConversations.length === 0;

    return (
        <div className="flex flex-col min-h-full">
            <PageHeader
                title={t('chat:archived.title')}
                subtitle={t('chat:archived.subtitle')}
            />

            <div className="flex-1 p-6">
                <div className="chat-list">
                    <div className="chat-list-toolbar">
                        <div className="chat-list-search">
                            <input
                                type="text"
                                value={search}
                                placeholder={t('chat:archived.searchPlaceholder')}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="chat-list-rows" aria-busy="true">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div key={index} className="ui-skeleton-row">
                                    <Skeleton className="ui-skeleton-circle" width="46px" height="46px" />
                                    <div className="ui-skeleton-row-body">
                                        <Skeleton className="ui-skeleton-line" width="45%" />
                                        <Skeleton className="ui-skeleton-line" width="75%" height="0.6rem" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : rows.length === 0 ? (
                        <EmptyState
                            icon={MessageIcon}
                            title={archivedConversations.length > 0
                                ? t('chat:archived.noMatches')
                                : t('chat:archived.empty')}
                            description={archivedConversations.length > 0
                                ? t('chat:archived.noMatchesHint')
                                : t('chat:archived.emptyHint')}
                            actionLabel={t('chat:archived.backToInbox')}
                            onAction={() => {
                                if (archivedConversations.length > 0) {
                                    setSearch('');
                                    onNavigate?.('chat');
                                } else {
                                    onNavigate?.('chat');
                                }
                            }}
                        />
                    ) : (
                        <div className="chat-list-scroll">
                            {dayGroups.map((group) => (
                                <div key={group.key} className="chat-inbox-daygroup">
                                    <h3 className="chat-inbox-dayhead">{t(`chat:list.day.${group.key}`)}</h3>
                                    <ul className="chat-list-rows">
                                        {group.rows.map((conversation) => (
                                            <ConversationRow
                                                key={conversation.participant_key}
                                                conversation={conversation}
                                                entityById={entityById}
                                                onOpen={openConversation}
                                                onMenu={(row, position) => setMenu({ conversation: row, position })}
                                                menuOpen={menu?.conversation?.participant_key === conversation.participant_key}
                                            />
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {menu && (
                <ConversationMenu
                    conversation={menu.conversation}
                    position={menu.position}
                    actions={menuActions}
                    onClose={() => setMenu(null)}
                    // Unarchiving moves the row out of this list; the store has
                    // already done that, so closing the menu is all that remains.
                    onDeleted={() => setMenu(null)}
                />
            )}
        </div>
    );
};

export default ArchivedChatsView;
