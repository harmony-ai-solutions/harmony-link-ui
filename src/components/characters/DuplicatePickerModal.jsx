import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { duplicateEntity } from '../../services/management/entityService.js';
import {
    duplicateCandidates,
    duplicatePreview,
    entityDuplicateSourceName,
} from '../../utils/duplicateNamePreview.js';
import CharacterImage from '../common/CharacterImage.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { CheckIcon, RobotIcon, UsersIcon, XIcon } from '../../constants/icons.jsx';
import { toast } from '../../store/toastStore.js';

/**
 * Duplicate-with-preview picker (plan 03-3 — Android's cover-flow flow).
 *
 * Duplicating used to be a blind action: you picked a character and something
 * new appeared, with no way to see what it would be called. This modal makes
 * the copy a *decision*:
 *
 * 1. Pick the base character from a horizontal cover-flow strip.
 * 2. Read the preview — source name, resulting name, how many module mappings
 *    will be copied, and the two things that deliberately are NOT copied.
 * 3. Commit, or cancel and change nothing.
 *
 * ## The name is previewed, never decided, here
 *
 * Plan 03-3 step 3: de-duplication is **server-side and authoritative**. The
 * `"Aria 2"` shown in the preview comes from
 * [`duplicatePreview`](../../utils/duplicateNamePreview.js), a pure mirror of
 * `controllers.ResolveAliasCopy`. It is a *prediction*; after the call the
 * modal renders `created.alias` — whatever the 201 body actually says. The
 * two agree in the normal case and the server wins in every other case, which
 * is the only ordering that keeps the UI honest.
 *
 * ## Empty / degenerate states
 *
 * - **No AI entities at all** → the empty state points at the Characters tab
 *   (you need a character before you can have an AI partner).
 * - **Exactly one AI entity** → cover flow is pointless with one card, so the
 *   strip is replaced by a plain list (step 4).
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose - Cancel/escape/backdrop. Changes nothing.
 * @param {Object[]} [props.entities] - the FULL entity list; personas are
 *   filtered out here. Also used for copy-series slot occupancy, so it must
 *   include AI entities that are not in this picker's own candidate set.
 * @param {Function} [props.onDuplicated] - called with the created entity
 *   after a successful duplicate, so the caller can refresh its stores.
 * @param {Function} [props.onOpenEntity] - Pro: open the new entity in the
 *   Entities screen.
 * @param {Function} [props.onStartChat] - Simple: start a chat with the copy.
 */
export default function DuplicatePickerModal({
    isOpen,
    onClose,
    entities,
    onDuplicated,
    onOpenEntity,
    onStartChat,
}) {
    const { t } = useTranslation('characters');

    const candidates = useMemo(() => duplicateCandidates(entities), [entities]);
    const showCarousel = candidates.length > 1;

    const [focusIndex, setFocusIndex] = useState(0);
    const [busy, setBusy] = useState(false);
    const [created, setCreated] = useState(null);
    const [error, setError] = useState(null);

    /**
     * Reset every transient bit of state on close so a cancelled duplicate
     * leaves nothing behind — including a stale `created` result, which would
     * otherwise show up on the NEXT open as if it had just happened.
     */
    useEffect(() => {
        if (isOpen) return;
        setFocusIndex(0);
        setBusy(false);
        setCreated(null);
        setError(null);
    }, [isOpen]);

    /**
     * The list can shrink under us (a duplicate from another window, or the
     * caller's refresh). Clamp rather than render `candidates[undefined]`.
     */
    useEffect(() => {
        if (candidates.length === 0) {
            if (focusIndex !== 0) setFocusIndex(0);
            return;
        }
        if (focusIndex > candidates.length - 1) {
            setFocusIndex(candidates.length - 1);
        }
    }, [candidates.length, focusIndex]);

    const focused = candidates[focusIndex] || null;

    /** The preview for the focused card. Never used as the source of truth. */
    const preview = useMemo(
        () => duplicatePreview(focused, entities),
        [focused, entities]
    );

    const moveFocus = useCallback((delta) => {
        setFocusIndex((current) => {
            if (candidates.length === 0) return 0;
            const next = current + delta;
            if (next < 0 || next > candidates.length - 1) return current;
            return next;
        });
    }, [candidates.length]);

    const handleKeyDown = (event) => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            moveFocus(-1);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            moveFocus(1);
        } else if (event.key === 'Home') {
            event.preventDefault();
            setFocusIndex(0);
        } else if (event.key === 'End') {
            event.preventDefault();
            setFocusIndex(Math.max(0, candidates.length - 1));
        }
    };

    const handleDuplicate = async () => {
        if (!focused || busy) return;
        setBusy(true);
        setError(null);
        try {
            const result = await duplicateEntity(focused.id);
            // Render the SERVER's name — `preview.nextName` was only a guess.
            setCreated(result || {});
            // Let the caller refresh stores now rather than on close, so a
            // follow-up "Open in Entities" / "Start chatting" lands on a list
            // that already contains the copy.
            onDuplicated?.(result);
            toast.success(
                t('duplicate.toast.created', {
                    name: result?.alias || preview.nextName || preview.sourceName,
                })
            );
        } catch (err) {
            // 400 "persona entities cannot be duplicated" / 404 "entity not
            // found" arrive with clean bodies and are worth showing verbatim.
            setError(err?.message || t('duplicate.error.generic'));
        } finally {
            setBusy(false);
        }
    };

    if (!isOpen) return null;

    const handleBackdropDown = (event) => {
        if (event.target === event.currentTarget && !busy) onClose();
    };

    const createdName = created?.alias || preview.nextName || preview.sourceName;

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onMouseDown={handleBackdropDown}
        >
            <div
                className="modal-content w-full max-w-2xl overflow-hidden"
                role="dialog"
                aria-modal="true"
                aria-label={t('duplicate.title')}
                data-tutorial-id="char-duplicate-modal"
            >
                {/* ── Header ─────────────────────────────────────────── */}
                <div className="px-6 py-4 flex justify-between items-start gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-accent-primary">{t('duplicate.title')}</h2>
                        <p className="text-xs text-text-muted mt-1">{t('duplicate.subtitle')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
                        aria-label={t('buttons.close')}
                        disabled={busy}
                    >
                        <XIcon className="w-6 h-6" />
                    </button>
                </div>

                {created ? (
                    /* ── Result ────────────────────────────────────────
                       The copy EXISTS now. Offer the next step instead of
                       leaving the user on a picker that no longer applies. */
                    <div className="px-6 pb-6">
                        <div className="char-duplicate-result">
                            <span className="char-duplicate-result-icon" aria-hidden="true">
                                <CheckIcon className="w-5 h-5" />
                            </span>
                            <div className="min-w-0">
                                <p className="char-duplicate-result-title">
                                    {t('duplicate.result.title', { name: createdName })}
                                </p>
                                <p className="char-duplicate-result-hint">
                                    {t('duplicate.result.hint')}
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="btn-secondary px-4 py-2 rounded-md text-sm font-medium"
                            >
                                {t('buttons.close')}
                            </button>
                            {onStartChat && (
                                <button
                                    type="button"
                                    onClick={() => onStartChat(created)}
                                    className="btn-secondary px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2"
                                >
                                    <RobotIcon className="w-4 h-4" />
                                    {t('duplicate.result.startChat')}
                                </button>
                            )}
                            {onOpenEntity && (
                                <button
                                    type="button"
                                    onClick={() => onOpenEntity(created)}
                                    className="btn-primary px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2"
                                >
                                    {t('duplicate.result.openEntity')}
                                </button>
                            )}
                        </div>
                    </div>
                ) : candidates.length === 0 ? (
                    /* ── Nothing to duplicate ──────────────────────────── */
                    <div className="px-6 pb-6">
                        <EmptyState
                            icon={UsersIcon}
                            size="compact"
                            title={t('duplicate.empty.title')}
                            description={t('duplicate.empty.description')}
                            actionLabel={t('buttons.close')}
                            onAction={onClose}
                        />
                    </div>
                ) : (
                    <>
                        {/* ── Picker ────────────────────────────────────── */}
                        {showCarousel ? (
                            <div
                                className="char-coverflow"
                                tabIndex={0}
                                onKeyDown={handleKeyDown}
                                role="listbox"
                                aria-label={t('duplicate.pickerLabel')}
                                aria-activedescendant={focused ? `dup-card-${focused.id}` : undefined}
                                data-tutorial-id="char-coverflow"
                            >
                                <div className="char-coverflow-stage">
                                    {candidates.map((entity, index) => {
                                        const offset = index - focusIndex;
                                        const distance = Math.abs(offset);
                                        // Two cards either side read as a strip;
                                        // anything further is hidden rather than
                                        // squeezed into a smear.
                                        const hidden = distance > 2;
                                        const profileId =
                                            entity.character_profile?.id || entity.character_profile_id || null;
                                        const name = entityDuplicateSourceName(entity) || entity.id;
                                        return (
                                            <button
                                                key={entity.id}
                                                id={`dup-card-${entity.id}`}
                                                type="button"
                                                role="option"
                                                aria-selected={offset === 0}
                                                aria-label={name}
                                                tabIndex={-1}
                                                onClick={() => setFocusIndex(index)}
                                                className={`char-coverflow-card${offset === 0 ? ' char-coverflow-card-focused' : ''}`}
                                                style={{
                                                    transform: `translateX(${offset * 6.75}rem) scale(${offset === 0 ? 1 : 0.8}) rotateY(${offset * -26}deg)`,
                                                    zIndex: 20 - distance,
                                                    opacity: hidden ? 0 : (offset === 0 ? 1 : 0.75),
                                                    pointerEvents: hidden ? 'none' : 'auto',
                                                }}
                                            >
                                                <div className="char-coverflow-art">
                                                    <CharacterImage
                                                        profileId={profileId}
                                                        alt={name}
                                                        className="w-full h-full object-cover"
                                                        fallback={(
                                                            <div className="w-full h-full flex items-center justify-center text-text-disabled">
                                                                <RobotIcon className="w-9 h-9" />
                                                            </div>
                                                        )}
                                                    />
                                                </div>
                                                <span className="char-coverflow-name">{name}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="char-coverflow-controls">
                                    <button
                                        type="button"
                                        onClick={() => moveFocus(-1)}
                                        disabled={focusIndex === 0}
                                        className="char-coverflow-arrow"
                                        aria-label={t('duplicate.previous')}
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                    <span className="char-coverflow-position">
                                        {t('duplicate.position', {
                                            current: focusIndex + 1,
                                            total: candidates.length,
                                        })}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => moveFocus(1)}
                                        disabled={focusIndex >= candidates.length - 1}
                                        className="char-coverflow-arrow"
                                        aria-label={t('duplicate.next')}
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* One candidate: a carousel of one is just noise. */
                            <div className="px-6 pb-2" data-tutorial-id="char-duplicate-plain">
                                <p className="char-duplicate-plain-label">{t('duplicate.plainLabel')}</p>
                                <ul className="char-duplicate-plain-list">
                                    {candidates.map((entity) => (
                                        <li key={entity.id} className="char-duplicate-plain-item">
                                            <RobotIcon className="w-4 h-4" />
                                            <span>{entityDuplicateSourceName(entity) || entity.id}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* ── Preview ──────────────────────────────────── */}
                        <div className="px-6 pt-4">
                            <div className="char-duplicate-preview" aria-live="polite">
                                <div className="char-duplicate-names">
                                    <span className="char-duplicate-name char-duplicate-name-source" title={preview.sourceName}>
                                        {preview.sourceName || t('duplicate.unnamed')}
                                    </span>
                                    <svg className="char-duplicate-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6l6 6-6 6" />
                                    </svg>
                                    <span className="char-duplicate-name char-duplicate-name-result" title={preview.nextName}>
                                        {preview.nextName || t('duplicate.unnamed')}
                                    </span>
                                </div>

                                <ul className="char-duplicate-facts">
                                    <li>
                                        {preview.mappingCount > 0
                                            ? t('duplicate.facts.mappings', { count: preview.mappingCount })
                                            : t('duplicate.facts.mappingsNone')}
                                    </li>
                                    <li>{t('duplicate.facts.profileLinked')}</li>
                                </ul>

                                <p className="char-duplicate-warning">
                                    {t('duplicate.warning.notCopied')}
                                </p>
                                {preview.hasAlias && (
                                    <p className="char-duplicate-note">
                                        {t('duplicate.note.serverDecides')}
                                    </p>
                                )}
                                {!preview.hasAlias && (
                                    <p className="char-duplicate-note">
                                        {t('duplicate.note.noAlias')}
                                    </p>
                                )}
                            </div>

                            {error && (
                                <p className="char-duplicate-error" role="alert">{error}</p>
                            )}
                        </div>

                        <div className="px-6 py-4 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={busy}
                                className="btn-secondary px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                            >
                                {t('buttons.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleDuplicate}
                                disabled={busy || !focused}
                                className="btn-primary px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                data-tutorial-id="char-duplicate-confirm"
                            >
                                {busy ? t('duplicate.duplicating') : t('duplicate.confirm')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
