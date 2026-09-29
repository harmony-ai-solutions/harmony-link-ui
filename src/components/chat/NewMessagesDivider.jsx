import { useTranslation } from 'react-i18next';

/**
 * "New messages" divider (F6). Placed above the first unread inbound message so
 * the user can see where they left off.
 */
const NewMessagesDivider = () => {
    const { t } = useTranslation();
    return (
        <div className="chat-new-divider" role="separator">
            <span className="chat-new-divider-line" />
            <span className="chat-new-divider-label">{t('chat:conversation.newMessages')}</span>
            <span className="chat-new-divider-line" />
        </div>
    );
};

export default NewMessagesDivider;
