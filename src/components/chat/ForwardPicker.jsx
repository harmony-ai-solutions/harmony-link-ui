import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import { RobotIcon, SearchIcon } from '../../constants/icons.jsx';
import { entityDisplayName } from '../../store/chatStoreUtils.js';
import CharacterImage from '../common/CharacterImage.jsx';

/**
 * "Forward…" partner picker (Task 02-6 step 4).
 *
 * ── WHAT FORWARD MEANS IN 1.0 ────────────────────────────────────────────
 *
 * The engine has no forward primitive, and adding one would mean a new message
 * type the cognition pipeline does not understand — exactly the kind of engine
 * work this task forbids. So Forward is implemented honestly as **copy the text
 * into another thread**: the chosen partner's conversation is opened and the
 * content is sent there as a normal new message.
 *
 * The consequences are stated in the UI rather than hidden:
 *
 * - only TEXT is forwarded (an image-only message has nothing to copy, and the
 *   bubble's Forward entry is disabled for it);
 * - the copy is a NEW message authored by the user, so the AI sees it as one —
 *   there is no "forwarded from X" attribution, because no field carries one.
 *
 * Portaled to `<body>` and clamped, reusing the chat picker styling, so it is
 * never clipped by the timeline's scroll container.
 *
 * @param {{
 *   isOpen: boolean,
 *   partners: Array<{id: string, character_profile_id?: string, alias?: string}>,
 *   content: string,
 *   fromTitle?: string,
 *   onPick: (partner: object) => void,
 *   onClose: () => void,
 * }} props
 */
const ForwardPicker = ({ isOpen, partners, content, fromTitle, onPick, onClose }) => {
    const { t } = useTranslation();
    const [query, setQuery] = useState('');

    // Reset the filter each time the picker opens, so a previous search does not
    // hide the partner the user is looking for now.
    useEffect(() => {
        if (isOpen) setQuery('');
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return partners || [];
        return (partners || []).filter((partner) => (
            entityDisplayName(partner).toLowerCase().includes(needle)
        ));
    }, [partners, query]);

    if (!isOpen) return null;

    const preview = (content || '').trim();
    const previewText = preview.length > 120 ? `${preview.slice(0, 119)}…` : preview;

    return createPortal(
        <div className="chat-picker-backdrop" onClick={onClose}>
            <div
                className="chat-picker chat-forward-picker"
                role="dialog"
                aria-modal="true"
                aria-label={t('chat:forward.title')}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="chat-picker-head">
                    <h3 className="chat-picker-title">{t('chat:forward.title')}</h3>
                    <button type="button" className="chat-emoji-close" onClick={onClose}
                        aria-label={t('chat:forward.cancel')}>×</button>
                </div>

                <p className="chat-forward-hint">
                    {fromTitle
                        ? t('chat:forward.hintFrom', { name: fromTitle })
                        : t('chat:forward.hint')}
                </p>

                {/* What will actually be sent — text only, and stated as such. */}
                <div className="chat-forward-preview">
                    <span className="chat-forward-preview-label">{t('chat:forward.previewLabel')}</span>
                    <span className="chat-forward-preview-text">{previewText}</span>
                </div>

                <label className="chat-forward-search">
                    <SearchIcon className="w-4 h-4" />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('chat:forward.searchPlaceholder')}
                        autoFocus
                    />
                </label>

                {filtered.length === 0 ? (
                    <p className="chat-emoji-empty">
                        {(partners || []).length === 0
                            ? t('chat:forward.noPartners')
                            : t('chat:forward.noMatches')}
                    </p>
                ) : (
                    <ul className="chat-picker-list chat-forward-list">
                        {filtered.map((partner) => (
                            <li key={partner.id}>
                                <button
                                    type="button"
                                    className="chat-picker-row"
                                    onClick={() => onPick?.(partner)}
                                >
                                    <span className="chat-list-avatar-ring">
                                        <CharacterImage
                                            profileId={partner.character_profile_id}
                                            alt={entityDisplayName(partner)}
                                            className="chat-list-avatar"
                                            fallback={(
                                                <span className="chat-list-avatar-fallback">
                                                    <RobotIcon className="w-5 h-5" />
                                                </span>
                                            )}
                                        />
                                    </span>
                                    <span className="chat-picker-name">
                                        {entityDisplayName(partner)}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="chat-forward-actions">
                    <button type="button" className="btn-secondary" onClick={onClose}>
                        {t('chat:forward.cancel')}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ForwardPicker;
