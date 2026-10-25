import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import useCharacterProfileStore from '../../store/characterProfileStore';
import {
    detectCardSpec,
    createdFieldKeys,
    overwrittenFieldKeys,
    nextCopyName,
} from '../../utils/importReviewUtils.js';

/** Files bigger than this are rejected client-side (the engine caps at 10 MB too). */
const MAX_CARD_BYTES = 10 * 1024 * 1024;

/**
 * Character-card import with a REVIEW step (plan 03-5d).
 *
 * ## The three states
 *
 *   `idle`    — the dropzone.
 *   `review`  — the card has been parsed (server-side, `?dry_run=1`) and
 *               nothing has been written. The user sees what was detected and
 *               chooses Import or Cancel. **This is the state the task exists
 *               for**: an import must never be silent.
 *   `blocked` — the card's name is already taken. Import is DISABLED (not
 *               silently redirected); the only way forward is "Import as copy",
 *               which asks the engine to import under the next copy name.
 *
 * ## Why the preview comes from the server
 *
 * The review panel could count greetings and parse the lorebook locally, but
 * the spec, the drops and the name-collision state all live in the engine.
 * `previewCharacterCardImport` asks the engine for the summary it will actually
 * act on, so the panel cannot promise something the import will not do.
 *
 * @param {Object} props
 * @param {Function} [props.onSuccess] - Callback when import is successful
 */
export default function CharacterCardImport({ onSuccess }) {
    const { t } = useTranslation('characters');
    const [phase, setPhase] = useState('idle'); // idle | review | blocked
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [droppedFields, setDroppedFields] = useState(null);
    const [preview, setPreview] = useState(null);
    const [file, setFile] = useState(null);

    const previewImport = useCharacterProfileStore(state => state.previewImport);
    const importCharacterCard = useCharacterProfileStore(state => state.importCharacterCard);
    const profiles = useCharacterProfileStore(state => state.profiles);

    /**
     * Parse the card and open the review panel. NOTHING is persisted here —
     * the request carries `dry_run=1`.
     */
    const onDrop = useCallback(async (acceptedFiles) => {
        if (acceptedFiles.length === 0) return;
        const chosen = acceptedFiles[0];

        setError(null);
        setDroppedFields(null);

        if (chosen.size > MAX_CARD_BYTES) {
            setError(t('import.imageTooLarge'));
            return;
        }

        setBusy(true);
        try {
            const detected = await previewImport(chosen);
            setFile(chosen);
            setPreview(detected);

            // Three outcomes, deliberately distinguished:
            //   false     → free, import normally.
            //   true      → taken, block and offer "Import as copy".
            //   null      → the engine could NOT check (DB unreachable).
            //
            // Unknown gets its own phase rather than being folded into
            // `blocked`: offering to import under a PREDICTED copy name when
            // nobody actually verified the original exists is not a copy, it is
            // a guess that could itself duplicate. `unknown` therefore offers
            // only Cancel.
            const taken = detected?.name_taken;
            if (taken === false) setPhase('review');
            else if (taken === true) setPhase('blocked');
            else setPhase('unknown');

            if (detected?.dropped_fields?.length > 0) {
                setDroppedFields(detected.dropped_fields);
            }
        } catch (err) {
            setError(err.message);
            setPhase('idle');
        } finally {
            setBusy(false);
        }
    }, [previewImport, t]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/png': ['.png'] },
        maxFiles: 1,
        disabled: busy || phase !== 'idle',
    });

    /**
     * Commit the import.
     *
     * - `create`  → a plain POST with no name override. If the name was taken
     *               between the preview and this click, the engine answers 409
     *               and we flip to `blocked` instead of writing.
     * - `blocked` → POST with the review panel's predicted copy name. The
     *               engine still owns the final name; the panel re-renders from
     *               the result.
     */
    const handleImport = async () => {
        if (!file || busy) return;
        setBusy(true);
        setError(null);
        try {
            const options = phase === 'blocked' ? { name: copyName } : {};
            const result = await importCharacterCard(file, options);
            onSuccess?.(result);
        } catch (err) {
            if (err.status === 409 || err.nameTaken) {
                // The name was claimed between preview and commit. Re-open the
                // review in its blocked state with the engine's fresh preview.
                if (err.preview) setPreview(err.preview);
                setPhase('blocked');
                setError(null);
            } else {
                setError(err.message);
            }
        } finally {
            setBusy(false);
        }
    };

    const handleCancel = () => {
        setPhase('idle');
        setPreview(null);
        setFile(null);
        setDroppedFields(null);
        setError(null);
    };

    // ── Review model ────────────────────────────────────────────────────
    // The engine's numbers are authoritative; the local helpers only normalise
    // the spec label and predict the copy name. `nextCopyName` mirrors
    // `charactercard.NextProfileCopyName`, and the engine's `suggested_name`
    // wins whenever it sent one.
    const specLabel = preview ? detectCardSpec({ spec: preview.spec, spec_version: preview.spec_version }) : null;
    const copyName = preview
        ? (preview.suggested_name || nextCopyName(preview.name, profiles))
        : '';
    // The engine sends the attributed field lists (it maps the card to know
    // them); the local helpers only fill in when the payload predates them.
    const createdFields = Array.isArray(preview?.created_fields)
        ? preview.created_fields
        : (preview ? createdFieldKeys(preview) : []);
    const overwritten = Array.isArray(preview?.overwritten_fields)
        ? preview.overwritten_fields
        : overwrittenFieldKeys();

    const renderReviewBody = () => (
        <div className="space-y-4">
            <div className="rounded-lg border border-border-default bg-background-elevated/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-wide text-text-muted">
                        {t('importReview.title')}
                    </span>
                    <span className="char-import-spec-badge">
                        {t(`importReview.spec.${specLabel}`, { defaultValue: specLabel })}
                    </span>
                </div>

                <div className="space-y-1">
                    <p className="text-lg font-bold text-text-primary break-words">
                        {preview?.name || t('importReview.untitled')}
                    </p>
                </div>

                <dl className="char-import-facts">
                    <div>
                        <dt>{t('importReview.descriptionLength')}</dt>
                        <dd>{preview?.description_length ?? 0}</dd>
                    </div>
                    <div>
                        <dt>{t('importReview.alternateGreetings')}</dt>
                        <dd>{preview?.alternate_greeting_count ?? 0}</dd>
                    </div>
                    <div>
                        <dt>{t('importReview.lorebookEntries')}</dt>
                        <dd>{preview?.lorebook_entry_count ?? 0}</dd>
                    </div>
                    <div>
                        <dt>{t('importReview.embeddedImages')}</dt>
                        <dd>{preview?.image_count ?? 1}</dd>
                    </div>
                </dl>

                {preview?.first_mes && (
                    <div>
                        <p className="text-xs uppercase tracking-wide text-text-muted mb-1">
                            {t('importReview.greetingPreview')}
                        </p>
                        <blockquote className="char-import-greeting">
                            {preview.first_mes}
                        </blockquote>
                    </div>
                )}

                <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-text-muted">
                        {t('importReview.createdFields')}
                    </p>
                    <p className="text-sm text-text-secondary">
                        {createdFields.length > 0
                            ? createdFields.map((key) => t(`importReview.fields.${key}`, { defaultValue: key })).join(' · ')
                            : t('importReview.noFields')}
                    </p>
                </div>

                <div className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-text-muted">
                        {t('importReview.overwrittenFields')}
                    </p>
                    <p className="text-sm text-text-secondary">
                        {overwritten.length === 0
                            ? t('importReview.nothingOverwritten')
                            : overwritten.join(' · ')}
                    </p>
                </div>
            </div>

            {phase === 'blocked' && (
                <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-2">
                    <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                        </svg>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-yellow-500">
                                {t('importReview.nameTakenTitle', { name: preview?.name || '' })}
                            </p>
                            <p className="text-xs text-text-muted">
                                {copyName
                                    ? t('importReview.nameTakenHint', { copy: copyName })
                                    : t('importReview.nameTakenHintNoCopy')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {phase === 'unknown' && (
                <div className="alert-error" role="alert">
                    <p className="text-sm font-medium">{t('importReview.collisionUnknownTitle')}</p>
                    <p className="text-xs mt-1">{t('importReview.collisionUnknownHint')}</p>
                </div>
            )}

            {droppedFields && droppedFields.length > 0 && (
                <div className="rounded-lg border border-border-default p-3 space-y-1">
                    <p className="text-xs font-medium text-text-secondary">
                        {t('import.droppedFieldsTitle', { count: droppedFields.length })}
                    </p>
                    <ul className="text-xs text-text-muted max-h-24 overflow-y-auto space-y-0.5">
                        {droppedFields.map((field) => (
                            <li key={field} className="font-mono">{field}</li>
                        ))}
                    </ul>
                </div>
            )}

            {error && (
                <div className="alert-error">
                    <p className="text-sm">{error}</p>
                </div>
            )}

            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={handleCancel}
                    disabled={busy}
                    className="btn-secondary flex-1 py-2 text-sm font-semibold disabled:opacity-50"
                >
                    {t('buttons.cancel')}
                </button>
                <button
                    type="button"
                    onClick={handleImport}
                    // `unknown` disables Import outright: the panel cannot vouch
                    // for a name nobody checked, so the only honest action is
                    // Cancel and retry — offering a PREDICTED copy name here
                    // would itself risk a duplicate.
                    disabled={busy || phase === 'unknown' || (phase === 'blocked' && !copyName)}
                    data-tutorial-id="char-import-confirm"
                    className="btn-primary flex-1 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {busy
                        ? t('import.uploading')
                        : phase === 'blocked'
                            ? t('importReview.importAsCopy', { copy: copyName })
                            : t('importReview.import')}
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {phase === 'idle' && (
                <div
                    data-tutorial-id="char-import-dropzone"
                    {...getRootProps()}
                    className={`
                        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                        transition-colors duration-200
                        ${isDragActive ? 'border-accent-primary bg-accent-primary/10' : 'border-border-default hover:border-border-hover'}
                        ${busy ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                >
                    <input {...getInputProps()} />
                    {busy ? (
                        <div className="space-y-2">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto"></div>
                            <p className="text-text-muted">{t('import.reading')}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <svg className="mx-auto h-12 w-12 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="text-lg font-medium text-text-primary">
                                {isDragActive ? t('import.dropActive') : t('import.dropIdle')}
                            </p>
                            <p className="text-sm text-text-muted">{t('import.orClick')}</p>
                            <p className="text-xs text-text-disabled mt-2">{t('import.formats')}</p>
                        </div>
                    )}
                </div>
            )}

            {phase === 'idle' && error && (
                <div className="alert-error">
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {(phase === 'review' || phase === 'blocked' || phase === 'unknown') && renderReviewBody()}
        </div>
    );
}
