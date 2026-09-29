import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageIcon, RobotIcon, SettingsGearIcon } from '../../constants/icons.jsx';
import LocalAISetupCard from './LocalAISetupCard.jsx';
import ChatListView from './ChatListView.jsx';
import ChatDetailView from './ChatDetailView.jsx';
import useChatStore from '../../store/chatStore.js';
import { partitionChatEntities, entityDisplayName } from '../../store/chatStoreUtils.js';

/**
 * Chat tab container (Phase 2).
 *
 * Simple-mode landing screen that either shows the chat list (F1) or the open
 * conversation (F2–F16). All chat data lives in chatStore; this view only wires
 * the store to the list/detail components and picks the "chat as" persona.
 *
 * @param {Function} onNavigate - switches the active settings tab by id.
 */
const ChatView = ({ onNavigate }) => {
    const { t } = useTranslation();
    const [openConversation, setOpenConversation] = useState(null);
    const [ownEntityId, setOwnEntityId] = useState(null);

    const chatEntities = useChatStore((s) => s.chatEntities);
    const loadChatEntities = useChatStore((s) => s.loadChatEntities);
    const loadConversations = useChatStore((s) => s.loadConversations);
    const openChat = useChatStore((s) => s.openConversation);
    const closeSocket = useChatStore((s) => s.closeSocket);

    const { partners, personas } = useMemo(() => partitionChatEntities(chatEntities), [chatEntities]);

    useEffect(() => {
        loadChatEntities();
    }, []);

    // Default the persona to the first available user entity.
    useEffect(() => {
        if (!ownEntityId && personas.length > 0) {
            setOwnEntityId(personas[0].id);
        }
    }, [personas, ownEntityId]);

    const handleOpenConversation = async (conversation) => {
        const partner = chatEntities.find((e) => e.id === conversation.entityId);
        // D-21: the participant set must include the persona we chat as so the
        // engine resolves a private interaction and the persona identity applies.
        // A brand-new chat (from the picker) arrives with only the partner id.
        const persona = ownEntityId || personas[0]?.id;
        const participantIds = Array.from(new Set([
            conversation.entityId,
            ...(conversation.participantIds || []),
            ...(persona ? [persona] : []),
        ])).filter(Boolean);
        const enriched = {
            ...conversation,
            participantIds,
            title: entityDisplayName(partner) || conversation.entityId,
        };
        setOpenConversation(enriched);
        await openChat(enriched);
    };

    const handleBack = () => {
        closeSocket();
        setOpenConversation(null);
        // Refresh the list so the newest message shows.
        const listEntityId = useChatStore.getState().listEntityId;
        if (listEntityId) loadConversations(listEntityId);
    };

    const hasCompanions = partners.length > 0;

    return (
        <div className="flex flex-col min-h-full">
            {/* View Header */}
            <div className="bg-background-surface/30 backdrop-blur-sm px-6 py-4">
                <h1 className="text-2xl font-extrabold tracking-tight">
                    <span className="text-gradient-primary">{t('chat:header.title')}</span>
                </h1>
                <p className="text-xs text-text-muted mt-0.5 font-medium">
                    {t('chat:header.subtitle')}
                </p>
            </div>

            <div className="flex-1 p-6">
                {!hasCompanions ? (
                    <div className="max-w-2xl mx-auto">
                        <div className="text-center py-16">
                            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-2xl bg-accent-primary/10 mb-6">
                                <MessageIcon className="w-9 h-9 text-accent-primary" />
                            </div>
                            <h2 className="text-xl font-bold text-text-primary mb-3">
                                {t('chat:placeholder.title')}
                            </h2>
                            <p className="text-sm leading-relaxed text-text-secondary max-w-lg mx-auto mb-8">
                                {t('chat:placeholder.description')}
                            </p>
                            <div className="flex flex-wrap items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => onNavigate('characters')}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <RobotIcon className="w-4 h-4" />
                                    {t('chat:placeholder.addCharacter')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onNavigate('general')}
                                    className="btn-secondary flex items-center gap-2"
                                >
                                    <SettingsGearIcon className="w-4 h-4" />
                                    {t('chat:placeholder.openSettings')}
                                </button>
                            </div>
                        </div>

                        {/* One-click local-AI setup + preset bundles (Simple mode helpers). */}
                        <div className="mt-4">
                            <LocalAISetupCard />
                        </div>
                    </div>
                ) : openConversation ? (
                    <ChatDetailView
                        conversation={openConversation}
                        ownEntityId={ownEntityId || openConversation.entityId}
                        personas={personas}
                        onOwnEntityChange={setOwnEntityId}
                        onBack={handleBack}
                    />
                ) : (
                    <ChatListView
                        onOpenConversation={handleOpenConversation}
                        onNavigate={onNavigate}
                    />
                )}
            </div>
        </div>
    );
};

export default ChatView;
