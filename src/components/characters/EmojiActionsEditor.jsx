import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listEmojiActions } from '../../services/management/chatReadService.js';
import { createEmojiAction, updateEmojiAction, deleteEmojiAction } from '../../services/management/entityService.js';
import ThemedSelect from '../widgets/ThemedSelect.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import { toast } from '../../store/toastStore.js';
import {
    EKMAN_EMOTIONS,
    additionalEffectsPreview,
    emojiActionContent,
    emptyEmojiAction,
    isEmojiActionSavable,
    normaliseEmojiActionRow,
    planEmojiActionChanges,
    primaryEmotion,
    serialiseEmotionEffect,
} from '../../utils/emojiActionUtils.js';

/**
 * Emoji-actions editor (plan 03-5c).
 *
 * `entity_emoji_actions` is what the chat picker reads: picking an emoji sends
 * its substitution text and shifts the character's mood. Until now it had NO
 * desktop editor, so the only way to change what an emoji does was to reach
 * into the database.
 *
 * ## The Test column
 *
 * The rightmost column renders the `AdditionalEffects` payload that a pick
 * WOULD send, read-only. It is produced by
 * [`buildAdditionalEffects`](../../utils/emojiActionUtils.js) — the same
 * function the preview and the send path share — so the preview cannot claim a
 * payload the socket would not produce. Without it the emotion column is an
 * opaque string in a database.
 *
 * ## Saving
 *
 * One Save button, but the engine's routes are per row (POST/PUT/DELETE), so
 * the save fans out over `planEmojiActionChanges` (creates → updates →
 * deletes). Deletes run LAST: a name clash would otherwise tombstone a row the
 * user still wanted before the replacement is accepted.
 *
 * @param {{ entityId: string, bare?: boolean }} props
 *   `bare` drops the outer card chrome when the host already provides a
 *   section wrapper.
 */
export default function EmojiActionsEditor({ entityId, bare = false }) {
    const { t } = useTranslation('characters');
    const [rows, setRows] = useState([]);
    const [original, setOriginal] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!entityId) return;
        setLoading(true);
        setError(null);
        try {
            const list = await listEmojiActions(entityId);
            const normalised = (list || []).map(normaliseEmojiActionRow);
            setRows(normalised);
            setOriginal(normalised);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [entityId]);

    useEffect(() => { load(); }, [load]);

    const emotionOptions = useMemo(() => ([
        { value: '', label: t('emoji.none') },
        ...EKMAN_EMOTIONS.map((emotion) => ({ value: emotion, label: t(`emoji.emotions.${emotion}`) })),
    ]), [t]);

    const patchRow = (index, patch) => {
        setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    };

    const handleAdd = () => setRows((prev) => [...prev, emptyEmojiAction()]);

    const handleRemove = (index) => setRows((prev) => prev.filter((_, i) => i !== index));

    /**
     * Emoji is the UNIQUE key with entity_id, so a duplicate emoji cannot be
     * saved. Flagging it here (rather than letting the engine 500 on the
     * constraint) keeps the failure visible next to the row that caused it.
     */
    const duplicateEmojis = useMemo(() => {
        const seen = new Map();
        const dupes = new Set();
        rows.forEach((row) => {
            const key = (row.emoji_native || '').trim();
            if (!key) return;
            if (seen.has(key)) dupes.add(key);
            else seen.set(key, true);
        });
        return dupes;
    }, [rows]);

    const unsavable = rows.filter((row) => !isEmojiActionSavable(row)).length;
    const plan = useMemo(() => planEmojiActionChanges(rows, original), [rows, original]);
    const pendingChanges = plan.creates.length + plan.updates.length + plan.deletes.length;

    const handleSave = async () => {
        if (!entityId || saving) return;
        if (unsavable > 0) {
            setError(t('emoji.incompleteRows', { count: unsavable }));
            return;
        }
        if (duplicateEmojis.size > 0) {
            setError(t('emoji.duplicateEmojis', { emoji: Array.from(duplicateEmojis).join(' ') }));
            return;
        }

        setSaving(true);
        setError(null);
        try {
            // Creates first so a new emoji exists before anything is removed;
            // deletes last so a failed create never loses the old row.
            for (const row of plan.creates) {
                await createEmojiAction(entityId, row);
            }
            for (const row of plan.updates) {
                await updateEmojiAction(entityId, row.id, row);
            }
            for (const id of plan.deletes) {
                await deleteEmojiAction(entityId, id);
            }
            await load();
            toast.success(t('emoji.saved'));
        } catch (e) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const content = (
        <div className="space-y-4">
            {error && (
                <div className="alert-error">
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {loading ? (
                <p className="character-editor-hint">{t('emoji.loading')}</p>
            ) : (
                <>
                    <p className="character-editor-hint">{t('emoji.hint')}</p>

                    {rows.length === 0 ? (
                        <p className="character-editor-hint italic">{t('emoji.empty')}</p>
                    ) : (
                        <div className="char-emoji-table" role="table" aria-label={t('emoji.title')}>
                            <div className="char-emoji-row char-emoji-row-head" role="row">
                                <span role="columnheader">{t('emoji.emojiColumn')}</span>
                                <span role="columnheader">{t('emoji.substitutionColumn')}</span>
                                <span role="columnheader">{t('emoji.emotionColumn')}</span>
                                <span role="columnheader">{t('emoji.testColumn')}</span>
                                <span role="columnheader" aria-label={t('emoji.removeColumn')} />
                            </div>
                            {rows.map((row, index) => {
                                const isDuplicate = duplicateEmojis.has((row.emoji_native || '').trim());
                                const preview = additionalEffectsPreview(row);
                                const emotionValue = primaryEmotion(row.emotion_effect);
                                const unknownEmotion =
                                    !!row.emotion_effect && !emotionValue && String(row.emotion_effect).trim() !== '';
                                return (
                                    <div
                                        key={row.id || `new-${index}`}
                                        className={`char-emoji-row ${isDuplicate ? 'is-invalid' : ''}`}
                                        role="row"
                                    >
                                        <input
                                            type="text"
                                            value={row.emoji_native}
                                            onChange={(e) => patchRow(index, { emoji_native: e.target.value })}
                                            placeholder="😀"
                                            aria-label={t('emoji.emojiColumn')}
                                            className="input-field char-emoji-emoji"
                                            maxLength={16}
                                        />
                                        <input
                                            type="text"
                                            value={row.substitution_text}
                                            onChange={(e) => patchRow(index, { substitution_text: e.target.value })}
                                            placeholder={t('emoji.substitutionPlaceholder')}
                                            aria-label={t('emoji.substitutionColumn')}
                                            className="input-field"
                                        />
                                        <div>
                                            <ThemedSelect
                                                value={emotionValue}
                                                onChange={(value) => patchRow(index, {
                                                    // Clearing the select clears the column —
                                                    // `{"emotion":""}` would log an engine warning
                                                    // on every use.
                                                    emotion_effect: serialiseEmotionEffect(value) ?? null,
                                                })}
                                                options={emotionOptions}
                                            />
                                            {unknownEmotion && (
                                                <p className="char-greeting-warn mt-1">
                                                    {t('emoji.unknownEmotion', { value: row.emotion_effect })}
                                                </p>
                                            )}
                                        </div>
                                        <div className="char-emoji-test" role="cell">
                                            <code>{preview || t('emoji.noEffects')}</code>
                                            <Tooltip content={t('emoji.testHint')}>
                                                <span className="char-emoji-test-body">
                                                    {emojiActionContent(row) || '—'}
                                                </span>
                                            </Tooltip>
                                        </div>
                                        <Tooltip content={t('emoji.remove')}>
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(index)}
                                                className="char-greeting-icon-btn is-danger"
                                                aria-label={t('emoji.remove')}
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </Tooltip>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                        <button type="button" onClick={handleAdd} className="btn-secondary px-4 py-2 text-sm font-semibold">
                            + {t('emoji.addRow')}
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || pendingChanges === 0}
                            className="btn-primary px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? t('emoji.saving') : t('emoji.save')}
                        </button>
                        {pendingChanges > 0 && !saving && (
                            <span className="character-editor-hint">
                                {t('emoji.pending', { count: pendingChanges })}
                            </span>
                        )}
                    </div>
                </>
            )}
        </div>
    );

    if (bare) return content;

    return (
        <div className="character-editor-section">
            <div className="character-editor-section-header">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('emoji.title')}
            </div>
            <div className="p-4">{content}</div>
        </div>
    );
}
