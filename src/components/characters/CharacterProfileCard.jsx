import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import useCharacterProfileStore from '../../store/characterProfileStore';
import { EditIcon, TrashIcon, RobotIcon, MessageIcon } from '../../constants/icons.jsx';
import Tooltip from '../ui/Tooltip.jsx';

/**
 * Card component for displaying a character profile summary.
 *
 * All per-card actions live behind a single small kebab (vertical three-dot)
 * button at the top-left, hover-revealed: **Edit settings**, **Delete
 * character**, plus the card-conversion actions (**Create AI partner from this
 * card**, **Create persona from this card**) and the **Export** actions.
 *
 * The dropdown is rendered through a React PORTAL into `document.body` and
 * positioned with `position: fixed` from the button's bounding rect. This is
 * deliberate: the card has a hover `transform` and a `backdrop-filter`, both of
 * which create a containing block that breaks any fixed/absolute menu kept
 * inside the card (it would mis-position and blur over the card). Portaling
 * sidesteps that entirely.
 *
 * @param {Object} props
 * @param {import('../../services/management/characterService').CharacterProfile} props.profile - The character profile to display
 * @param {Function} props.onClick - Callback when the card (or "Edit settings") is clicked
 * @param {Function} [props.onDelete] - Callback when "Delete character" is chosen (receives the profile id)
 * @param {Object[]} [props.referencingEntities] - 3-2: entities (AI or persona)
 *   that link this profile live. Drives the "used by" badges.
 * @param {Function} [props.onCreatePersona] - 2-4: "Create persona from this
 *   card" — receives the FULL profile so the app can duplicate it as a rich
 *   full-card copy (all spec + Soulbits fields, images preserved).
 * @param {Function} [props.onCreateEntity] - "Create AI partner from this card"
 *   — receives the FULL profile; the app links it LIVE (no card copy) to a new
 *   AI entity and switches to the Entities tab.
 * @param {Function} [props.onStartChat] - "Start chatting" — receives the FULL
 *   profile; the app resolves (or creates) the AI partner for it and opens a
 *   brand-new chat in the Chat tab.
 */
export default function CharacterProfileCard({ profile, onClick, onDelete, referencingEntities, onCreatePersona, onCreateEntity, onStartChat }) {
    const { t } = useTranslation('characters');
    const primaryImage = useCharacterProfileStore(state => state.getPrimaryImage(profile.id));
    const exportCharacterCard = useCharacterProfileStore(state => state.exportCharacterCard);
    const [busy, setBusy] = useState(null); // null | 'json' | 'png'
    const [menuOpen, setMenuOpen] = useState(false);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
    const btnRef = useRef(null);
    const menuRef = useRef(null);
    const referenced = Array.isArray(referencingEntities) ? referencingEntities : [];

    // Menu width is fixed in CSS (176px) so the panel can be right-aligned to
    // the button without measuring first.
    const MENU_WIDTH = 176;
    const positionMenu = useCallback(() => {
        const btn = btnRef.current;
        if (!btn) return;
        const r = btn.getBoundingClientRect();
        // Right-align: the menu's right edge meets the button's right edge.
        let left = r.right - MENU_WIDTH;
        if (left < 8) left = 8; // keep it on-screen on narrow viewports
        setMenuPos({ top: r.bottom + 6, left });
    }, []);

    // Keep the portal anchored while open; close on outside click / Escape.
    useLayoutEffect(() => {
        if (!menuOpen) return undefined;
        positionMenu();
        const onPointerDown = (e) => {
            if (menuRef.current && menuRef.current.contains(e.target)) return;
            if (btnRef.current && btnRef.current.contains(e.target)) return;
            setMenuOpen(false);
        };
        const onKeyDown = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
        const onReflow = () => setMenuOpen(false);
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', onReflow);
        window.addEventListener('scroll', onReflow, true);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('resize', onReflow);
            window.removeEventListener('scroll', onReflow, true);
        };
    }, [menuOpen, positionMenu]);

    // Close when the card unmounts.
    useEffect(() => () => setMenuOpen(false), []);

    const runAndClose = (fn) => (e) => {
        e.stopPropagation();
        setMenuOpen(false);
        fn?.();
    };

    const handleExport = async (format) => {
        if (!profile?.id || busy) return;
        setBusy(format);
        try {
            await exportCharacterCard(profile.id, format, profile.name);
        } catch (e) {
            // eslint-disable-next-line no-alert
            alert(t('exportFailed', { message: e.message }));
        } finally {
            setBusy(null);
        }
    };

    // Compact rows with a real hover highlight (CSS — Tailwind color utilities
    // are no-ops here); `danger` tone for delete.
    const rowClass = (danger = false) => `character-card-menu-item${danger ? ' character-card-menu-item-danger' : ''}`;
    const iconClass = 'character-card-menu-icon';
    const Separator = () => <div className="character-card-menu-separator" role="separator" />;

    const menu = menuOpen ? createPortal(
        <div
            ref={menuRef}
            className="character-card-menu"
            style={{ top: menuPos.top, left: menuPos.left }}
            onClick={(e) => e.stopPropagation()}
        >
            <button type="button" onClick={runAndClose(() => onClick?.(profile))} className={rowClass()}>
                <EditIcon className={iconClass} />
                {t('menu.editSettings')}
            </button>

            {onStartChat && (
                <button type="button" onClick={runAndClose(() => onStartChat(profile))} className={rowClass()}>
                    <MessageIcon className={iconClass} />
                    {t('menu.startChatting')}
                </button>
            )}

            {onCreateEntity && (
                <>
                    <Separator />
                    <button type="button" onClick={runAndClose(() => onCreateEntity(profile))} className={rowClass()}>
                        <RobotIcon className={iconClass} />
                        {t('buttons.createEntity')}
                    </button>
                </>
            )}

            {onCreatePersona && (
                <button type="button" onClick={runAndClose(() => onCreatePersona(profile))} className={rowClass()}>
                    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    {t('buttons.createPersona')}
                </button>
            )}

            <Separator />

            <button type="button" disabled={busy !== null} onClick={runAndClose(() => handleExport('png'))} className={`${rowClass()} ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <DownloadIcon className={iconClass} />
                {t('buttons.exportAsPng')}
            </button>
            <button type="button" disabled={busy !== null} onClick={runAndClose(() => handleExport('json'))} className={`${rowClass()} ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <DownloadIcon className={iconClass} />
                {t('buttons.exportAsJson')}
            </button>

            {onDelete && (
                <>
                    <Separator />
                    <button type="button" onClick={runAndClose(() => onDelete(profile.id))} className={rowClass(true)}>
                        <TrashIcon className={iconClass} />
                        {t('menu.deleteCharacter')}
                    </button>
                </>
            )}
        </div>,
        document.body
    ) : null;

    return (
        <div
            className="character-profile-card relative group hover:scale-[1.02]"
        >
            {/* Image area keeps its own clipping + rounded top corners so the
                card itself does not clip anything. */}
            <div
                className="aspect-[3/4] relative bg-elevated overflow-hidden"
                style={{ borderTopLeftRadius: 'var(--radius-xl)', borderTopRightRadius: 'var(--radius-xl)' }}
            >
                {primaryImage ? (
                    <img
                        src={primaryImage.data_url}
                        alt={profile.name}
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-disabled">
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                    </div>
                )}

                <div className="absolute inset-0 bg-accent-primary opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none" />

                {/* Small kebab (vertical three-dot) — hover-revealed. The menu
                    itself is portaled to <body> (see `menu` above). */}
                <Tooltip content={t('menu.title')}>
                    <button
                        ref={btnRef}
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                        className="absolute top-2 right-2 z-30 p-1.5 module-action-btn rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:scale-110"
                        aria-label={t('menu.title')}
                        aria-expanded={menuOpen}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                        </svg>
                    </button>
                </Tooltip>
            </div>

            <div className="p-4">
                <h3 className="font-semibold text-accent-primary truncate">{profile.name}</h3>
                <p className="text-sm text-text-muted line-clamp-2 mt-1 min-h-[2.5rem]">
                    {profile.description || t('noDescription')}
                </p>
                {referenced.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {referenced.map(entity => (
                            <span
                                key={entity.id}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    entity.entity_type === 'user'
                                        ? 'bg-accent-primary/15 text-accent-primary'
                                        : 'bg-accent-secondary/15 text-accent-secondary'
                                }`}
                            >
                                {entity.entity_type === 'user'
                                    ? t('usedBy.personaPrefix', { name: entity.alias || entity.id })
                                    : t('usedBy.aiPrefix', { name: entity.alias || entity.id })}
                            </span>
                        ))}
                    </div>
                )}

                {onStartChat && (
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onStartChat(profile); }}
                        className="character-card-chat-btn"
                    >
                        <MessageIcon className="w-4 h-4" />
                        {t('buttons.startChatting')}
                    </button>
                )}
            </div>

            {menu}
        </div>
    );
}

/** Download glyph used by the two Export menu items. */
function DownloadIcon({ className }) {
    return (
        <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
    );
}
