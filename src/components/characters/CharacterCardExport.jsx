import React, { useState } from 'react';
import { Menu, MenuButton, MenuItems, MenuItem } from '@headlessui/react';
import { useTranslation } from 'react-i18next';
import useCharacterProfileStore from '../../store/characterProfileStore';

/**
 * Export a character profile as a Character Card V3 (JSON or PNG `ccv3`).
 *
 * Calls the backend `GET /character-profiles/:id/export?format=` route (via the
 * profile store) and triggers a browser download. Mirrors `CharacterCardImport`
 * for import/export symmetry in the management UI.
 *
 * @param {Object} props
 * @param {import('../../services/management/characterService').CharacterProfile} props.profile
 *        Profile to export (must have `id` and `name`).
 * @param {'card'|'editor'} [props.variant='card'] - 'card' = compact icon button
 *        (hover-revealed, like the delete button); 'editor' = labeled button for
 *        the editor modal header.
 */
export default function CharacterCardExport({ profile, variant = 'card' }) {
    const { t } = useTranslation();
    const exportCharacterCard = useCharacterProfileStore(state => state.exportCharacterCard);
    const [busy, setBusy] = useState(null); // null | 'json' | 'png'

    const handle = async (format) => {
        if (!profile?.id || busy) return;
        setBusy(format);
        try {
            await exportCharacterCard(profile.id, format, profile.name);
        } catch (e) {
            // eslint-disable-next-line no-alert
            alert(t('characters:exportFailed', { message: e.message }));
        } finally {
            setBusy(null);
        }
    };

    const DownloadIcon = (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
    );

    const items = (anchorClass) => (
        <MenuItems className={`absolute ${anchorClass} mt-2 w-48 origin-top-right rounded-md bg-background-elevated shadow-lg ring-1 ring-black/10 focus:outline-none z-50`}>
            <MenuItem>
                {({ focus }) => (
                    <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => handle('png')}
                        className={`flex items-center w-full px-3 py-2 text-sm text-left transition-colors ${focus ? 'bg-accent-primary/15 text-accent-primary' : 'text-text-primary'} ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {busy === 'png' ? <Spinner /> : <span className="w-4 h-4 mr-2 inline-flex">{DownloadIcon}</span>}
                        {t('characters:buttons.exportAsPng')}
                    </button>
                )}
            </MenuItem>
            <MenuItem>
                {({ focus }) => (
                    <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => handle('json')}
                        className={`flex items-center w-full px-3 py-2 text-sm text-left transition-colors ${focus ? 'bg-accent-primary/15 text-accent-primary' : 'text-text-primary'} ${busy ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {busy === 'json' ? <Spinner /> : <span className="w-4 h-4 mr-2 inline-flex">{DownloadIcon}</span>}
                        {t('characters:buttons.exportAsJson')}
                    </button>
                )}
            </MenuItem>
        </MenuItems>
    );

    if (variant === 'editor') {
        return (
            <Menu as="div" className="relative inline-block text-left">
                <MenuButton
                    disabled={!profile?.id || busy !== null}
                    className="btn-secondary inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title={t('characters:buttons.exportCard')}
                >
                    {busy ? <Spinner /> : <span className="mr-1.5 inline-flex">{DownloadIcon}</span>}
                    <span className="hidden sm:inline">{t('characters:buttons.exportCard')}</span>
                    <svg className="ml-1 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </MenuButton>
                {items('right-0')}
            </Menu>
        );
    }

    // 'card' variant: compact icon, hover-revealed (alongside the delete button).
    // Anchored top-left; the menu opens rightward/downward so it stays on-card.
    return (
        <Menu as="div" className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <MenuButton
                onClick={(e) => e.stopPropagation()}
                disabled={!profile?.id || busy !== null}
                className="p-1.5 module-action-btn rounded-full hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                title={t('characters:buttons.exportCard')}
            >
                {busy ? <span className="block w-4 h-4">{/* compact spinner */}<span className="block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /></span> : DownloadIcon}
            </MenuButton>
            <div onClick={(e) => e.stopPropagation()}>{items('left-0')}</div>
        </Menu>
    );
}

function Spinner() {
    return <span className="w-4 h-4 mr-2 inline-flex"><span className="block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /></span>;
}
