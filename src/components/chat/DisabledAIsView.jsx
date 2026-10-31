import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RobotIcon } from '../../constants/icons.jsx';
import useChatStore from '../../store/chatStore.js';
import EmptyState from '../ui/EmptyState.jsx';
import Skeleton from '../ui/Skeleton.jsx';
import PageHeader from '../ui/PageHeader.jsx';
import CharacterImage from '../common/CharacterImage.jsx';
import { entityDisplayName } from '../../store/chatStoreUtils.js';
import { disabledEntities } from '../../store/inboxUtils.js';

/**
 * Disabled AI partners screen (Task 02-5).
 *
 * `entities.is_disabled` is an ENTITY flag (not a per-thread one): a disabled
 * partner is off entirely — no chat, no outreach, automations skip — and it
 * keeps its conversations. The inbox shows a 🚫 on every thread it owns; this
 * screen is where those partners are collected so re-enabling one is a single
 * click rather than a hunt through the list.
 *
 * Enabling delegates to `chatStore.setDisabled`, which is the SAME entity
 * `is_disabled` write the inbox menu and the Entities screen use, and it patches
 * both the inbox rows and `chatEntities` optimistically.
 *
 * @param {{ onNavigate?: (tab: string) => void }} props
 */
const DisabledAIsView = ({ onNavigate }) => {
    const { t } = useTranslation();
    const chatEntities = useChatStore((s) => s.chatEntities);
    const loadChatEntities = useChatStore((s) => s.loadChatEntities);
    const setDisabled = useChatStore((s) => s.setDisabled);
    const loadInbox = useChatStore((s) => s.loadInbox);

    const [loaded, setLoaded] = useState(false);
    /** entityId → true while its enable request is in flight. */
    const [busy, setBusy] = useState({});

    useEffect(() => {
        (async () => {
            await loadChatEntities();
            setLoaded(true);
        })();
        // Mount-only: the entity list is the whole data source here.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const disabled = useMemo(() => disabledEntities(chatEntities), [chatEntities]);

    const handleEnable = async (entityId) => {
        setBusy((current) => ({ ...current, [entityId]: true }));
        const ok = await setDisabled(entityId, false);
        setBusy((current) => {
            const next = { ...current };
            delete next[entityId];
            return next;
        });
        // Re-enabling changes the inbox rows' 🚫 flag, which lives in the list
        // payload — the store patched them optimistically, and this refresh
        // makes the server the source of truth again.
        if (ok) loadInbox();
    };

    return (
        <div className="flex flex-col min-h-full">
            <PageHeader
                title={t('chat:disabledAIs.title')}
                subtitle={t('chat:disabledAIs.subtitle')}
            />

            <div className="flex-1 p-6">
                {!loaded ? (
                    <div className="chat-list-rows" aria-busy="true">
                        {Array.from({ length: 3 }).map((_, index) => (
                            <div key={index} className="ui-skeleton-row">
                                <Skeleton className="ui-skeleton-circle" width="46px" height="46px" />
                                <div className="ui-skeleton-row-body">
                                    <Skeleton className="ui-skeleton-line" width="40%" />
                                    <Skeleton className="ui-skeleton-line" width="65%" height="0.6rem" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : disabled.length === 0 ? (
                    <EmptyState
                        icon={RobotIcon}
                        title={t('chat:disabledAIs.empty')}
                        description={t('chat:disabledAIs.emptyHint')}
                        actionLabel={t('chat:disabledAIs.backToInbox')}
                        onAction={() => onNavigate?.('chat')}
                    />
                ) : (
                    <ul className="chat-disabled-list">
                        {disabled.map((entity) => {
                            const name = entityDisplayName(entity) || entity.id;
                            const isBusy = !!busy[entity.id];
                            return (
                                <li key={entity.id} className="chat-disabled-item">
                                    <span className="chat-list-avatar-ring">
                                        <CharacterImage
                                            profileId={entity.character_profile_id}
                                            alt={name}
                                            className="chat-list-avatar"
                                            fallback={<span className="chat-list-avatar-fallback"><RobotIcon className="w-5 h-5" /></span>}
                                        />
                                    </span>
                                    <span className="chat-disabled-item-body">
                                        <span className="chat-list-name">{name}</span>
                                        <span className="chat-disabled-item-hint">
                                            {t('chat:disabledAIs.itemHint')}
                                        </span>
                                    </span>
                                    <button
                                        type="button"
                                        className="btn-primary chat-disabled-item-action"
                                        disabled={isBusy}
                                        onClick={() => handleEnable(entity.id)}
                                    >
                                        {isBusy ? t('chat:disabledAIs.enabling') : t('chat:disabledAIs.enable')}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default DisabledAIsView;
