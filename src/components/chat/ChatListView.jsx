import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageIcon, RobotIcon, PlusIcon, SearchIcon } from '../../constants/icons.jsx';
import useChatStore from '../../store/chatStore.js';
import { partitionChatEntities, entityDisplayName, conversationPreview, truncatePreview } from '../../store/chatStoreUtils.js';
import useEntityStore from '../../store/entityStore.js';
import * as characterService from '../../services/management/characterService.js';

/**
 * Chat list (F1): every conversation for the selected AI companion, with the
 * last message, an unread badge and a "New Chat" picker.
 *
 * @param {{ onOpenConversation: (conversation: object) => void,
 *   onNavigate: (tab: string) => void }} props
 */
const ChatListView = ({ onOpenConversation, onNavigate }) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [avatarByProfile, setAvatarByProfile] = useState({});

    const conversations = useChatStore((s) => s.conversations);
    const chatEntities = useChatStore((s) => s.chatEntities);
    const listEntityId = useChatStore((s) => s.listEntityId);
    const loadChatEntities = useChatStore((s) => s.loadChatEntities);
    const loadConversations = useChatStore((s) => s.loadConversations);
    const entities = useEntityStore((s) => s.entities);
    const loadEntities = useEntityStore((s) => s.loadEntities);

    const { partners } = useMemo(() => partitionChatEntities(chatEntities), [chatEntities]);

    // Load chat entities + entity list once.
    useEffect(() => {
        loadChatEntities();
        if (entities === null) loadEntities();
    }, []);

    // Default the list to the first available AI companion.
    useEffect(() => {
        if (!listEntityId && partners.length > 0) {
            loadConversations(partners[0].id);
        }
    }, [partners, listEntityId]);

    // Load primary avatars for the partners' character profiles.
    useEffect(() => {
        let active = true;
        (async () => {
            const map = {};
            for (const partner of partners) {
                if (!partner.character_profile_id) continue;
                try {
                    const images = await characterService.listImages(partner.character_profile_id);
                    const primary = images?.find((i) => i.is_primary) || images?.[0];
                    if (primary?.data_url) map[partner.character_profile_id] = primary.data_url;
                } catch {
                    /* avatar is cosmetic — ignore failures */
                }
            }
            if (active) setAvatarByProfile(map);
        })();
        return () => { active = false; };
    }, [partners]);

    const entityById = useMemo(() => {
        const map = {};
        for (const entity of chatEntities) map[entity.id] = entity;
        return map;
    }, [chatEntities]);

    const avatarForEntity = (entityId) => {
        const option = entityById[entityId];
        const profileId = option?.character_profile_id;
        return profileId ? avatarByProfile[profileId] : null;
    };

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase();
        return conversations.filter((c) => {
            if (unreadOnly && !c.unread_count) return false;
            if (!term) return true;
            const partner = entityById[c.partner_entity_id];
            const name = entityDisplayName(partner).toLowerCase();
            const preview = conversationPreview(c.last_message).toLowerCase();
            return name.includes(term) || preview.includes(term);
        });
    }, [conversations, search, unreadOnly, entityById]);

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

            {filtered.length === 0 ? (
                <div className="chat-list-empty">
                    <MessageIcon className="w-8 h-8 text-accent-primary" />
                    <p className="chat-list-empty-title">{t('chat:list.empty')}</p>
                    <p className="chat-list-empty-hint">{t('chat:list.emptyHint')}</p>
                    <button type="button" className="btn-secondary" onClick={() => onNavigate?.('characters')}>
                        <RobotIcon className="w-4 h-4" />
                        {t('chat:list.openCharacters')}
                    </button>
                </div>
            ) : (
                <ul className="chat-list-rows">
                    {filtered.map((conversation) => {
                        const partner = entityById[conversation.partner_entity_id];
                        const avatar = avatarForEntity(conversation.partner_entity_id);
                        const name = entityDisplayName(partner) || conversation.partner_entity_id;
                        const preview = conversationPreview(conversation.last_message);
                        const isOutgoing = conversation.last_message?.sender_entity_id === conversation.entity_id;
                        const previewPrefix = isOutgoing ? `${t('chat:list.you')}: ` : '';
                        const time = conversation.last_message?.created_at;
                        const timeLabel = time ? new Date(time).toLocaleDateString() : '';

                        return (
                            <li key={conversation.interaction_id}>
                                <button
                                    type="button"
                                    className="chat-list-row"
                                    onClick={() => onOpenConversation?.({
                                        interactionId: conversation.interaction_id,
                                        entityId: conversation.entity_id,
                                        participantIds: conversation.participant_ids,
                                        partnerEntityId: conversation.partner_entity_id,
                                        participantKey: conversation.participant_key,
                                    })}
                                >
                                    <span className="chat-list-avatar-ring">
                                        {avatar
                                            ? <img src={avatar} alt={name} className="chat-list-avatar" />
                                            : <span className="chat-list-avatar-fallback"><RobotIcon className="w-5 h-5" /></span>}
                                    </span>
                                    <span className="chat-list-body">
                                        <span className="chat-list-row-top">
                                            <span className="chat-list-name">{name}</span>
                                            {timeLabel && <span className="chat-list-time">{timeLabel}</span>}
                                        </span>
                                        <span className="chat-list-preview">
                                            {preview
                                                ? `${previewPrefix}${truncatePreview(preview)}`
                                                : t('chat:list.noMessages')}
                                        </span>
                                    </span>
                                    {conversation.unread_count > 0 && (
                                        <span className="chat-list-badge">{conversation.unread_count}</span>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            )}

            {showPicker && (
                <div className="chat-picker-backdrop" onClick={() => setShowPicker(false)}>
                    <div className="chat-picker" onClick={(e) => e.stopPropagation()}>
                        <h3 className="chat-picker-title">{t('chat:list.selectCompanion')}</h3>
                        {partners.length === 0 ? (
                            <p className="chat-picker-empty">{t('chat:list.noCompanions')}</p>
                        ) : (
                            <ul className="chat-picker-list">
                                {partners.map((partner) => {
                                    const avatar = avatarForEntity(partner.id);
                                    return (
                                        <li key={partner.id}>
                                            <button
                                                type="button"
                                                className="chat-picker-row"
                                                onClick={() => { setShowPicker(false); startNewChat(partner); }}
                                            >
                                                <span className="chat-list-avatar-ring">
                                                    {avatar
                                                        ? <img src={avatar} alt={entityDisplayName(partner)} className="chat-list-avatar" />
                                                        : <span className="chat-list-avatar-fallback"><RobotIcon className="w-5 h-5" /></span>}
                                                </span>
                                                <span className="chat-picker-name">{entityDisplayName(partner)}</span>
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
