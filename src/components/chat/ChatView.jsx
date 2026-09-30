import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageIcon, RobotIcon, PlusIcon } from '../../constants/icons.jsx';
import ChatListView from './ChatListView.jsx';
import ChatDetailView from './ChatDetailView.jsx';
import useChatStore from '../../store/chatStore.js';
import useCharacterProfileStore from '../../store/characterProfileStore.js';
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
    const [showPicker, setShowPicker] = useState(false);

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

    /**
     * Jump to the Characters tab and open the create-profile editor straight
     * away. The intent is stashed in characterProfileStore because switching
     * tabs unmounts this view and remounts CharacterProfilesView (same
     * cross-view handoff pattern as personaStore.requestEditPersonaId).
     */
    const handleCreateCharacter = () => {
        setShowPicker(false);
        useCharacterProfileStore.getState().requestCreateProfile();
        onNavigate('characters');
    };

    /**
     * Begin a brand-new conversation with the chosen AI partner. Mirrors
     * ChatListView.startNewChat: the engine resolves the interaction id on
     * INIT_ENTITY, and ChatView.handleOpenConversation adds the persona.
     */
    const startNewChat = (partner) => {
        setShowPicker(false);
        handleOpenConversation({
            interactionId: null,
            entityId: partner.id,
            participantIds: [partner.id],
            partnerEntityId: partner.id,
            isNew: true,
        });
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
            <div className="bg-background-surface px-6 py-4">
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
                            <h2 className="text-xl font-bold text-text-primary mb-8">
                                {t('chat:placeholder.title')}
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShowPicker(true)}
                                className="btn-primary inline-flex items-center gap-2"
                            >
                                <PlusIcon className="w-4 h-4" />
                                {t('chat:placeholder.startChatting')}
                            </button>
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

            {/* New-chat companion picker (opened by the welcome "+ Start
                Chatting" button). Shares the ChatListView picker styling; its
                empty state offers the create-character flow so the simple
                "start chatting" path is never a dead end. */}
            {showPicker && (
                <div className="chat-picker-backdrop" onClick={() => setShowPicker(false)}>
                    <div className="chat-picker" onClick={(e) => e.stopPropagation()}>
                        <h3 className="chat-picker-title">{t('chat:list.selectCompanion')}</h3>
                        {partners.length === 0 ? (
                            <>
                                <p className="chat-picker-empty">{t('chat:list.noCompanions')}</p>
                                <button
                                    type="button"
                                    onClick={handleCreateCharacter}
                                    className="btn-primary inline-flex items-center gap-2"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    {t('chat:placeholder.createCharacter')}
                                </button>
                            </>
                        ) : (
                            <ul className="chat-picker-list">
                                {partners.map((partner) => (
                                    <li key={partner.id}>
                                        <button
                                            type="button"
                                            className="chat-picker-row"
                                            onClick={() => startNewChat(partner)}
                                        >
                                            <span className="chat-list-avatar-ring">
                                                <span className="chat-list-avatar-fallback"><RobotIcon className="w-5 h-5" /></span>
                                            </span>
                                            <span className="chat-picker-name">{entityDisplayName(partner)}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChatView;
