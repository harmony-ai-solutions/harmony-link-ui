import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageIcon, RobotIcon } from '../../constants/icons.jsx';
import ChatListView from './ChatListView.jsx';
import ChatDetailView from './ChatDetailView.jsx';
import PageHeader from '../ui/PageHeader.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import useChatStore from '../../store/chatStore.js';
import useCharacterProfileStore from '../../store/characterProfileStore.js';
import { partitionChatEntities, entityDisplayName } from '../../store/chatStoreUtils.js';
import CharacterImage from '../common/CharacterImage.jsx';

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
        // "Start chatting" on a character card stashes the partner id in
        // chatStore; load the chat entities first (so the conversation can
        // resolve a display name and the persona participant), then open it.
        // The entities are read from the store AFTER loading (not from this
        // render's closure, which is still empty on a fresh mount).
        const request = useChatStore.getState().startChatRequest;
        if (request?.entityId) {
            useChatStore.getState().clearRequestStartChat();
            loadChatEntities().then(() => {
                const entities = useChatStore.getState().chatEntities || [];
                const partner = entities.find((e) => e.id === request.entityId);
                // D-21: include the persona we chat as so the engine resolves a
                // private interaction and the persona identity applies.
                const persona = entities.find((e) => e.entity_type === 'user');
                const participantIds = Array.from(new Set([
                    request.entityId,
                    ...(persona ? [persona.id] : []),
                ]));
                const enriched = {
                    interactionId: null,
                    entityId: request.entityId,
                    participantIds,
                    partnerEntityId: request.entityId,
                    isNew: true,
                    title: entityDisplayName(partner) || request.entityId,
                };
                setOpenConversation(enriched);
                openChat(enriched);
            });
        } else {
            loadChatEntities();
        }
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
        //
        // The merged inbox spans several personas, so when the row already names
        // a persona participant, chat AS that persona (and speak as them) —
        // never add a second persona to an existing private pair, which would
        // mint a new group interaction.
        const rowPersona = (conversation.participantIds || [])
            .find((id) => personas.some((p) => p.id === id));
        const persona = rowPersona || ownEntityId || personas[0]?.id;
        const participantIds = Array.from(new Set([
            conversation.entityId,
            ...(conversation.participantIds || []),
            ...(persona ? [persona] : []),
        ])).filter(Boolean);
        if (rowPersona && rowPersona !== ownEntityId) setOwnEntityId(rowPersona);
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
        // Refresh the inbox so the newest message shows (all companions —
        // `loadConversations()` defaults to the merged app-style list).
        loadConversations();
    };

    const hasCompanions = partners.length > 0;

    return (
        <div className="flex flex-col min-h-full">
            {/* Chat used to be the odd one out: its header sat above a scroll
                container of its own instead of scrolling with the content like
                every other view now does. It shares the same non-sticky header
                as the other eight, so all nine behave identically.
                `PageHeader` also accepts `sticky` if a view ever needs it —
                `.ui-page-header-sticky` is position: sticky only, which leaves
                the fixed chat lightbox and pickers this view renders inside the
                scroll column anchored to the viewport. */}
            <PageHeader
                title={t('chat:header.title')}
                subtitle={t('chat:header.subtitle')}
            />

            <div className="flex-1 p-6">
                {!hasCompanions ? (
                    /* Chat landing: there are literally no AI partners yet, so
                       both next steps are real — create one, or talk to an
                       existing character card. Same shape as every other
                       empty view (EmptyState), which is what Phase 01 task 3
                       asked this screen to keep. */
                    <EmptyState
                        className="mx-auto max-w-2xl"
                        icon={MessageIcon}
                        title={t('chat:placeholder.title')}
                        description={t('chat:placeholder.description')}
                        actionLabel={t('chat:placeholder.startChatting')}
                        onAction={() => setShowPicker(true)}
                        secondaryLabel={t('chat:placeholder.createCharacter')}
                        onSecondary={handleCreateCharacter}
                    />
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
                            <EmptyState
                                size="compact"
                                icon={RobotIcon}
                                title={t('chat:list.noCompanionsTitle')}
                                description={t('chat:list.noCompanions')}
                                actionLabel={t('chat:placeholder.createCharacter')}
                                onAction={handleCreateCharacter}
                            />
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
                                                <CharacterImage
                                                    profileId={partner.character_profile_id}
                                                    alt={entityDisplayName(partner)}
                                                    className="chat-list-avatar"
                                                    fallback={<span className="chat-list-avatar-fallback"><RobotIcon className="w-5 h-5" /></span>}
                                                />
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
