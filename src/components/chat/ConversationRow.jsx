import { useTranslation } from 'react-i18next';
import { RobotIcon } from '../../constants/icons.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import CharacterImage from '../common/CharacterImage.jsx';
import {
    conversationPreview,
    conversationDisplayName,
    conversationAvatarProfileId,
    isConversationLastMessageOutgoing,
    truncatePreview,
} from '../../store/chatStoreUtils.js';
import { rowUnreadBadge } from '../../store/inboxUtils.js';

/** Short time-of-day label for a row (`14:05`), or the date when older. */
export function formatRowTime(value, now = new Date()) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const sameDay = date.toDateString() === now.toDateString();
    return sameDay
        ? date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
}

/**
 * ONE inbox row — avatar · name · status · time · preview · unread badge · `⋯`.
 *
 * Extracted from `ChatListView` (Task 02-5) so the Archived screen renders the
 * *same* row rather than a near-copy that drifts: the row is where every action
 * is anchored, and two implementations would mean two behaviours.
 *
 * Behaviour:
 * - Click anywhere on the row body opens the thread.
 * - Right-click, or the `⋯` button, opens {@link ConversationMenu}. The `⋯`
 *   button is a sibling of the row button (never a nested `<button>`, which is
 *   invalid HTML and swallows the click in some browsers).
 * - The unread badge is suppressed for muted threads (the Android rule); the
 *   row still shows its preview and keeps its position.
 *
 * @param {{
 *   conversation: object,
 *   entityById?: Record<string, object>,
 *   onOpen?: (conversation: object) => void,
 *   onMenu?: (conversation: object, position: {x: number, y: number}) => void,
 *   menuOpen?: boolean,
 * }} props
 */
const ConversationRow = ({ conversation, entityById, onOpen, onMenu, menuOpen = false }) => {
    const { t } = useTranslation();

    // Name/avatar by the AI companion that OWNS the row, not by
    // partner_entity_id (the persona "user").
    const name = conversationDisplayName(conversation, entityById);
    const avatarProfileId = conversationAvatarProfileId(conversation, entityById);
    const preview = conversationPreview(conversation.last_message);
    const isOutgoing = isConversationLastMessageOutgoing(conversation, entityById);
    const previewPrefix = isOutgoing ? `${t('chat:list.you')}: ` : '';
    const badge = rowUnreadBadge(conversation);

    const openMenuAt = (x, y) => onMenu?.(conversation, { x, y });

    /**
     * Status column: 📌 pinned · 🔇 muted · 🚫 disabled.
     *
     * Glyphs (matching the Android inbox) rather than new SVG icons, each with a
     * translated accessible label + tooltip so the meaning is not guesswork.
     * Rendered only when at least one flag is set — a quiet row stays quiet.
     */
    const renderStatus = () => {
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

    return (
        <li className="chat-list-item">
            <button
                type="button"
                className={`chat-list-row ${badge > 0 ? 'chat-list-row-unread' : ''}`}
                onClick={() => onOpen?.(conversation)}
                onContextMenu={(event) => {
                    event.preventDefault();
                    openMenuAt(event.clientX, event.clientY);
                }}
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
                        {renderStatus()}
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
            {onMenu && (
                <Tooltip content={t('chat:menu.open')}>
                    <button
                        type="button"
                        className={`chat-list-menu-btn ${menuOpen ? 'chat-list-menu-btn-active' : ''}`}
                        aria-label={t('chat:menu.open')}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        onClick={(event) => {
                            // Anchor the menu to the button, not the cursor.
                            const rect = event.currentTarget.getBoundingClientRect();
                            openMenuAt(rect.right - 4, rect.bottom + 4);
                        }}
                    >
                        ⋯
                    </button>
                </Tooltip>
            )}
        </li>
    );
};

export default ConversationRow;
