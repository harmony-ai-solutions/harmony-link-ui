import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import useChatStore from '../../store/chatStore.js';
import { toast } from '../../store/toastStore.js';
import ConfirmDialog from '../modals/ConfirmDialog.jsx';

/**
 * Per-conversation action menu (Task 02-5).
 *
 * Opened from a row's `⋯` button, from a right-click on the row, and from the
 * detail view's header — the SAME component and the SAME actions in all three
 * places, because the acceptance criterion is that every action works "from the
 * list and from inside a thread". A second, header-only implementation would
 * drift.
 *
 * Actions: **Pin/Unpin, Archive/Unarchive, Mute/Unmute, Mark read/unread,
 * Disable AI, Delete**. Every label is derived from the row's CURRENT state, so
 * a menu never offers "Pin" on an already-pinned thread.
 *
 * Presentation notes:
 * - Rendered in a portal at `position: fixed` coordinates, so it is never
 *   clipped by the inbox scroll container (the same reason the toast stack and
 *   the tooltips portal to `<body>`).
 * - The point is CLAMPED to the viewport, so a right-click near the bottom-right
 *   corner opens upwards/leftwards instead of off-screen.
 * - Closes on outside click, Escape, and after every action.
 *
 * The store actions are optimistic (local patch → request → rollback + toast),
 * so this component never waits for the network before closing.
 */

/** Every action the menu can offer, in presentation order. */
export const CONVERSATION_MENU_ACTIONS = ['pin', 'archive', 'mute', 'read', 'disable', 'delete'];

/** Actions permanently destructive enough to warrant a confirmation. */
const DESTRUCTIVE_ACTIONS = ['delete'];

/**
 * @param {{
 *   conversation: object,
 *   position: {x: number, y: number}|null,
 *   onClose: () => void,
 *   actions?: string[],
 *   onDeleted?: (conversation: object) => void,
 *   name?: string,
 * }} props
 *   `actions` narrows the menu (the Archived screen passes `['unarchive']`).
 *   `onDeleted` lets the caller drop any local state bound to the thread.
 */
const ConversationMenu = ({
    conversation,
    position,
    onClose,
    actions = CONVERSATION_MENU_ACTIONS,
    onDeleted,
    name,
}) => {
    const { t } = useTranslation();
    const menuRef = useRef(null);
    const [offset, setOffset] = useState({ left: 0, top: 0 });
    const [confirmDelete, setConfirmDelete] = useState(false);

    const setPinned = useChatStore((s) => s.setPinned);
    const setArchived = useChatStore((s) => s.setArchived);
    const setMuted = useChatStore((s) => s.setMuted);
    const markRead = useChatStore((s) => s.markRead);
    const setDisabled = useChatStore((s) => s.setDisabled);
    const deleteConversation = useChatStore((s) => s.deleteConversation);

    const close = useCallback(() => {
        setConfirmDelete(false);
        onClose?.();
    }, [onClose]);

    // Clamp the menu inside the viewport. Runs before paint so the menu never
    // flashes at the raw click point.
    useLayoutEffect(() => {
        const el = menuRef.current;
        if (!el || !position) return;
        const rect = el.getBoundingClientRect();
        const pad = 8;
        const maxLeft = window.innerWidth - rect.width - pad;
        const maxTop = window.innerHeight - rect.height - pad;
        setOffset({
            left: Math.max(pad, Math.min(position.x, maxLeft)),
            top: Math.max(pad, Math.min(position.y, maxTop)),
        });
    }, [position]);

    // Dismissal: outside click + Escape.
    useEffect(() => {
        const onPointerDown = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) close();
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape') close();
        };
        document.addEventListener('mousedown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown, true);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [close]);

    if (!position || !conversation) return null;

    const pinned = !!conversation.pinned;
    const archived = !!conversation.archived;
    const muted = !!conversation.muted;
    const disabledAI = !!conversation.entity_disabled;
    const hasUnread = (Number(conversation.unread_count) || 0) > 0;
    const threadName = name || conversation.companion_display_name || conversation.entity_id || '';

    const handle = (id) => {
        if (DESTRUCTIVE_ACTIONS.includes(id)) {
            setConfirmDelete(true);
            return;
        }
        close();
        switch (id) {
            case 'pin':
                setPinned(conversation, !pinned);
                break;
            case 'archive':
                setArchived(conversation, !archived);
                break;
            case 'mute':
                setMuted(conversation, !muted);
                break;
            case 'read':
                // The store stays silent for read state (it also fires on open
                // and on window focus, where a toast would be noise), so the
                // confirmation lives here, at the explicit user action.
                markRead(conversation, { read: !hasUnread }).then((ok) => {
                    if (!ok) return;
                    toast.success(t(hasUnread
                        ? 'chat:toast.markedRead'
                        : 'chat:toast.markedUnread'));
                });
                break;
            case 'disable':
                setDisabled(conversation.entity_id, !disabledAI);
                break;
            default:
                break;
        }
    };

    const confirmDeleteYes = async () => {
        setConfirmDelete(false);
        const ok = await deleteConversation(conversation);
        if (ok) {
            onDeleted?.(conversation);
            onClose?.();
        }
        // On failure the store rolled the row back and toasts the engine's
        // reason (a 409 says "Close the conversation before deleting it."),
        // so the menu stays closed either way — nothing was decided here.
        else {
            onClose?.();
        }
    };

    const items = [];
    if (actions.includes('pin')) {
        items.push({ id: 'pin', label: t(pinned ? 'chat:menu.unpin' : 'chat:menu.pin') });
    }
    if (actions.includes('archive')) {
        items.push({ id: 'archive', label: t(archived ? 'chat:menu.unarchive' : 'chat:menu.archive') });
    }
    if (actions.includes('unarchive')) {
        items.push({ id: 'archive', label: t('chat:menu.unarchive') });
    }
    if (actions.includes('mute')) {
        items.push({ id: 'mute', label: t(muted ? 'chat:menu.unmute' : 'chat:menu.mute') });
    }
    if (actions.includes('read')) {
        items.push({ id: 'read', label: t(hasUnread ? 'chat:menu.markRead' : 'chat:menu.markUnread') });
    }
    if (actions.includes('disable')) {
        items.push({ id: 'disable', label: t(disabledAI ? 'chat:menu.enableAI' : 'chat:menu.disableAI') });
    }
    if (actions.includes('delete')) {
        items.push({ id: 'delete', label: t('chat:menu.delete'), danger: true });
    }

    return createPortal(
        <>
            <div
                ref={menuRef}
                className="chat-conv-menu"
                role="menu"
                style={{ left: `${offset.left}px`, top: `${offset.top}px` }}
            >
                {items.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        className={`chat-conv-menu-item ${item.danger ? 'chat-conv-menu-item-danger' : ''}`}
                        onClick={() => handle(item.id)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            <ConfirmDialog
                isOpen={confirmDelete}
                title={t('chat:menu.deleteTitle')}
                message={t('chat:menu.deleteMessage', { name: threadName })}
                confirmText={t('chat:menu.delete')}
                cancelText={t('common:buttons.cancel')}
                onConfirm={confirmDeleteYes}
                onCancel={() => setConfirmDelete(false)}
            />
        </>,
        document.body
    );
};

export default ConversationMenu;
