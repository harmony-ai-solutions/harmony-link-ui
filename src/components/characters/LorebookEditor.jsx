import React, { useMemo, useState } from 'react';
import { Editor } from '@monaco-editor/react';
import { Trans, useTranslation } from 'react-i18next';
import Toggle from '../ui/Toggle.jsx';

// ═══════════════════════════════════════════════════════════════════════════
// LorebookEditor — structured editor for the `character_book` JSON column.
//
// Web counterpart of the RN App's LorebookViewerSheet + LorebookEntryEditor.
// Reads/writes the raw JSON string owned by CharacterProfileEditor (controlled
// `value` / `onChange` API), so it drops in where the raw Monaco editor used to
// live. Matching is semantic engine-side, so `content` is the primary field
// and `enabled` / `constant` are the only other matching-drivers; everything
// else (keys, position, flags, …) is preserved verbatim for card export.
//
// A collapsible "Edit raw JSON" escape hatch keeps the power-user path (paste a
// full book JSON, fix import artifacts) available alongside the structured UI.
// Unknown top-level / entry keys are round-tripped untouched (spread on every
// mutation) — consistent with the engine's no-unknown-fields handling.
// ═══════════════════════════════════════════════════════════════════════════

/** Parse a character_book JSON string into a book object, or null when empty/invalid. */
function tryParseBook(raw) {
    if (!raw || raw === 'null' || (typeof raw === 'string' && raw.trim() === '')) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

/** Guarantee a usable shape (entries[] + extensions object) while preserving unknown keys. */
function normalizeBook(parsed) {
    if (!parsed) return { extensions: {}, entries: [] };
    return {
        ...parsed,
        extensions:
            parsed.extensions && typeof parsed.extensions === 'object' && !Array.isArray(parsed.extensions)
                ? parsed.extensions
                : {},
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    };
}

/** Sensible defaults for a freshly added entry (matches engine/RN defaults). */
function createDefaultEntry() {
    return {
        keys: [],
        content: '',
        extensions: {},
        enabled: true,
        insertion_order: 10,
        position: 'before_char',
        case_sensitive: false,
        use_regex: false,
        constant: false,
        selective: false,
        secondary_keys: [],
    };
}

/** Comma-separated text ⇄ string[] bridge (parity with the RN entry editor). */
function csvToKeys(text) {
    return text
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
}

// ─── Small presentational helpers ───────────────────────────────────────────

function KeyChips({ keys }) {
    if (!keys || keys.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-1 mt-1.5">
            {keys.map((k, i) => (
                <span
                    key={`${i}-${k}`}
                    className="px-2 py-0.5 text-xs rounded bg-background-hover text-text-secondary border border-border-default"
                >
                    {k}
                </span>
            ))}
        </div>
    );
}

function FieldLabel({ children, hint }) {
    return (
        <div className="mb-1.5">
            <label className="character-editor-label block">{children}</label>
            {hint && <p className="character-editor-hint mt-0.5">{hint}</p>}
        </div>
    );
}

function SwitchRow({ label, hint, checked, onChange }) {
    return (
        <div className="flex items-start gap-3 py-1.5">
            <Toggle checked={checked} onChange={(e) => onChange(e.target.checked)} />
            <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary">{label}</div>
                {hint && <div className="text-xs text-text-muted mt-0.5">{hint}</div>}
            </div>
        </div>
    );
}

// ─── Per-entry inline form ──────────────────────────────────────────────────
//
// Owns a local draft (seeded once on mount via a lazy initializer; the parent
// remounts it with a `key` whenever the targeted entry changes). Internal edits
// update local state and bubble the reconstructed entry up through `onChange`.
// Because the form never re-seeds from props after mount, the caret never jumps.

function EntryForm({ entry, onChange, onDelete }) {
    const { t } = useTranslation('characters');
    const [draft, setDraft] = useState(() => ({ ...createDefaultEntry(), ...entry }));
    const [keysText, setKeysText] = useState(() => (entry.keys ?? []).join(', '));

    const patch = (partial) => setDraft((prev) => ({ ...prev, ...partial }));

    // Bubble the canonical entry up to the parent on every edit. The advanced
    // options (incl. secondary_keys) have no editor, so they are carried
    // verbatim from the seeded draft to preserve imported data on round-trip.
    const emit = (nextDraft, nextKeysText) => {
        onChange({
            ...nextDraft,
            keys: csvToKeys(nextKeysText),
        });
    };

    const updateField = (key, value) => {
        const next = { ...draft, [key]: value };
        setDraft(next);
        emit(next, keysText);
    };

    const handleKeysChange = (text) => {
        setKeysText(text);
        emit(draft, text);
    };

    return (
        <div className="mt-3 pt-3 border-t border-border-default space-y-4">
            {/* ── Name / Comment (display only) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="character-editor-field-group">
                    <FieldLabel hint={t('lorebook.nameHint')}>{t('lorebook.name')}</FieldLabel>
                    <input
                        type="text"
                        value={draft.name ?? ''}
                        onChange={(e) => updateField('name', e.target.value)}
                        placeholder={t('lorebook.namePlaceholder')}
                        className="input-field w-full"
                    />
                </div>
                <div className="character-editor-field-group">
                    <FieldLabel hint={t('lorebook.commentHint')}>{t('lorebook.comment')}</FieldLabel>
                    <input
                        type="text"
                        value={draft.comment ?? ''}
                        onChange={(e) => updateField('comment', e.target.value)}
                        placeholder={t('lorebook.commentPlaceholder')}
                        className="input-field w-full"
                    />
                </div>
            </div>

            {/* ── Primary field: content (embedded + matched semantically) ── */}
            <div className="character-editor-field-group">
                <FieldLabel hint={t('lorebook.contentHint')}>
                    {t('lorebook.content')}
                </FieldLabel>
                <textarea
                    value={draft.content ?? ''}
                    onChange={(e) => updateField('content', e.target.value)}
                    rows={5}
                    placeholder={t('lorebook.contentPlaceholder')}
                    className="input-field w-full resize-none font-mono text-sm"
                />
            </div>

            {/* ── Keys (export-only, semantic matching ignores them) ── */}
            <div className="character-editor-field-group">
                <FieldLabel hint={t('lorebook.keysHint')}>
                    {t('lorebook.keys')}
                </FieldLabel>
                <input
                    type="text"
                    value={keysText}
                    onChange={(e) => handleKeysChange(e.target.value)}
                    placeholder={t('lorebook.keysPlaceholder')}
                    className="input-field w-full"
                />
                <KeyChips keys={csvToKeys(keysText)} />
            </div>

            {/* ── Matching drivers ── */}
            <div className="rounded-lg border border-border-default bg-background-hover/40 p-3">
                <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">
                    {t('lorebook.matchingGroup')}
                </div>
                <SwitchRow
                    label={t('lorebook.enabled')}
                    hint={t('lorebook.enabledHint')}
                    checked={draft.enabled ?? true}
                    onChange={(v) => updateField('enabled', v)}
                />
                <SwitchRow
                    label={t('lorebook.constantLabel')}
                    hint={t('lorebook.constantHint')}
                    checked={draft.constant ?? false}
                    onChange={(v) => updateField('constant', v)}
                />
            </div>

            {/* ── Delete ── */}
            <div className="flex justify-end pt-1">
                <button
                    type="button"
                    onClick={onDelete}
                    className="text-sm text-text-muted hover:text-error transition-colors"
                >
                    {t('lorebook.deleteEntry')}
                </button>
            </div>
        </div>
    );
}

// ─── Main component ─────────────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {string} props.value - Raw `character_book` JSON string from the profile.
 * @param {(nextJson: string) => void} props.onChange - Called with the updated JSON string on every edit.
 */
export default function LorebookEditor({ value, onChange }) {
    const { t } = useTranslation('characters');
    const [expandedIndex, setExpandedIndex] = useState(null);
    const [rawMode, setRawMode] = useState(false);
    const [bookSettingsOpen, setBookSettingsOpen] = useState(false);
    const [rawError, setRawError] = useState(null);

    const parsed = useMemo(() => tryParseBook(value), [value]);
    const book = useMemo(() => normalizeBook(parsed), [parsed]);
    const entries = book.entries;
    const constantCount = entries.filter((e) => e.constant).length;
    const parseFailed = parsed === null && !!value && value !== 'null' && value.trim() !== '';

    /** Re-serialize the whole book and emit. */
    const commit = (nextBook) => {
        onChange(JSON.stringify(nextBook));
    };

    const updateEntry = (index, updated) => {
        const nextEntries = entries.map((e, i) => (i === index ? updated : e));
        commit({ ...book, entries: nextEntries });
    };

    const deleteEntry = (index) => {
        commit({ ...book, entries: entries.filter((_, i) => i !== index) });
        // Keep the expanded row valid after the index shift.
        setExpandedIndex((cur) => {
            if (cur === null) return null;
            if (cur === index) return null;
            return cur > index ? cur - 1 : cur;
        });
    };

    const toggleEnabled = (index) => {
        updateEntry(index, { ...entries[index], enabled: !entries[index].enabled });
    };

    const addEntry = () => {
        const created = createDefaultEntry();
        commit({ ...book, entries: [...entries, created] });
        // Expand the newly appended entry.
        setExpandedIndex(entries.length);
    };

    const patchBookMeta = (key, val) => {
        const next = { ...book };
        if (val === '' || val === undefined) {
            delete next[key];
        } else {
            next[key] = val;
        }
        commit(next);
    };

    const handleRawChange = (text) => {
        if (text && text.trim()) {
            try {
                JSON.parse(text);
                setRawError(null);
            } catch {
                setRawError(t('lorebook.invalidJson'));
            }
        } else {
            setRawError(null);
        }
        onChange(text);
    };

    // ── Raw JSON mode ──
    if (rawMode) {
        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className="character-editor-hint">
                        {t('lorebook.rawJsonHint')}
                    </p>
                    <button
                        type="button"
                        onClick={() => setRawMode(false)}
                        className="btn-secondary px-3 py-1.5 text-xs font-semibold"
                    >
                        {t('lorebook.structuredView')}
                    </button>
                </div>
                <div className="rounded-lg border border-white/10 overflow-hidden">
                    <Editor
                        height={420}
                        theme="vs-dark"
                        defaultLanguage="json"
                        value={value}
                        onChange={handleRawChange}
                        options={{
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            fontSize: 13,
                            tabSize: 2,
                            automaticLayout: true,
                        }}
                    />
                </div>
                {rawError && (
                    <p className="text-xs font-medium" style={{ color: 'var(--color-error)' }}>
                        {rawError}
                    </p>
                )}
            </div>
        );
    }

    // ── Structured mode ──
    return (
        <div className="space-y-4">
            {/* Header: summary + raw toggle */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-text-secondary">
                    <span className="font-semibold text-text-primary">{entries.length}</span>{' '}
                    {entries.length === 1 ? t('lorebook.entry') : t('lorebook.entries')}
                    {constantCount > 0 && (
                        <>
                            {' · '}
                            <span className="font-semibold text-text-primary">{constantCount}</span> {t('lorebook.constant')}
                        </>
                    )}
                    {book.scan_depth != null && (
                        <>
                            {' · '}{t('lorebook.scanDepth')}{' '}
                            <span className="font-semibold text-text-primary">{book.scan_depth}</span>
                        </>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => setRawMode(true)}
                    className="btn-secondary px-3 py-1.5 text-xs font-semibold"
                >
                    {t('lorebook.editRawJson')}
                </button>
            </div>

            {parseFailed && (
                <div className="rounded-lg border border-warning/40 bg-warning-bg/30 px-3 py-2 text-xs text-warning">
                    {t('lorebook.parseFailedHint')}
                </div>
            )}

            {/* Book settings (name / description / scan_depth / token_budget / recursive_scanning) */}
            <div className="rounded-lg border border-border-default">
                <button
                    type="button"
                    onClick={() => setBookSettingsOpen((v) => !v)}
                    className="flex items-center justify-between w-full px-3 py-2 text-left"
                >
                    <span className="text-sm font-semibold text-text-secondary">{t('lorebook.bookSettings')}</span>
                    <span className="text-text-muted text-xs">{bookSettingsOpen ? '▴' : '▾'}</span>
                </button>
                {bookSettingsOpen && (
                    <div className="px-3 pb-3 pt-1 space-y-4 border-t border-border-default">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="character-editor-field-group">
                                <FieldLabel>{t('lorebook.bookName')}</FieldLabel>
                                <input
                                    type="text"
                                    value={book.name ?? ''}
                                    onChange={(e) => patchBookMeta('name', e.target.value)}
                                    placeholder="—"
                                    className="input-field w-full"
                                />
                            </div>
                            <div className="character-editor-field-group">
                                <FieldLabel>{t('lorebook.bookDescription')}</FieldLabel>
                                <input
                                    type="text"
                                    value={book.description ?? ''}
                                    onChange={(e) => patchBookMeta('description', e.target.value)}
                                    placeholder="—"
                                    className="input-field w-full"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="character-editor-field-group">
                                <FieldLabel hint={t('lorebook.scanDepthHint')}>{t('lorebook.scanDepthField')}</FieldLabel>
                                <input
                                    type="number"
                                    value={book.scan_depth ?? ''}
                                    onChange={(e) =>
                                        patchBookMeta(
                                            'scan_depth',
                                            e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                                        )
                                    }
                                    placeholder="—"
                                    className="input-field w-full"
                                />
                            </div>
                            <div className="character-editor-field-group">
                                <FieldLabel hint={t('lorebook.tokenBudgetHint')}>{t('lorebook.tokenBudget')}</FieldLabel>
                                <input
                                    type="number"
                                    value={book.token_budget ?? ''}
                                    onChange={(e) =>
                                        patchBookMeta(
                                            'token_budget',
                                            e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                                        )
                                    }
                                    placeholder="—"
                                    className="input-field w-full"
                                />
                            </div>
                        </div>
                        <SwitchRow
                            label={t('lorebook.recursiveScanning')}
                            hint={t('lorebook.recursiveScanningHint')}
                            checked={book.recursive_scanning ?? false}
                            onChange={(v) => patchBookMeta('recursive_scanning', v)}
                        />
                    </div>
                )}
            </div>

            {/* Entry list */}
            {entries.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border-default px-4 py-8 text-center">
                    <p className="text-sm text-text-muted">
                        {t('lorebook.empty')}
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {entries.map((entry, index) => {
                        const expanded = expandedIndex === index;
                        const title = entry.name || entry.comment || t('lorebook.untitledEntry');
                        const keyPreview = (entry.keys ?? []).join(', ') || t('lorebook.noKeys');
                        return (
                            <div
                                key={index}
                                className={`rounded-lg border bg-background-surface/40 ${
                                    expanded ? 'border-accent-primary' : 'border-border-default'
                                }`}
                            >
                                {/* Collapsed row */}
                                <div className="flex items-start gap-3 p-3">
                                    <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                                        <Toggle
                                            checked={entry.enabled ?? true}
                                            onChange={() => toggleEnabled(index)}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedIndex(expanded ? null : index)}
                                        className="flex-1 min-w-0 text-left"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-text-primary truncate">
                                                {title}
                                            </span>
                                            {entry.constant && (
                                                <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold uppercase rounded bg-warning-bg text-warning border border-warning/30">
                                                    {t('lorebook.constantLabel')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-text-muted truncate">{keyPreview}</div>
                                        {entry.content && (
                                            <div className="text-xs text-text-secondary mt-1 line-clamp-2 whitespace-pre-wrap">
                                                {entry.content}
                                            </div>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedIndex(expanded ? null : index)}
                                        className="shrink-0 text-text-muted hover:text-text-primary transition-colors p-1"
                                        title={expanded ? t('lorebook.collapse') : t('lorebook.expand')}
                                    >
                                        <svg
                                            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 9l-7 7-7-7"
                                            />
                                        </svg>
                                    </button>
                                </div>

                                {/* Expanded inline form (remounts per entry via key) */}
                                {expanded && (
                                    <div className="px-3 pb-3">
                                        <EntryForm
                                            key={`entry-${index}`}
                                            entry={entry}
                                            onChange={(updated) => updateEntry(index, updated)}
                                            onDelete={() => deleteEntry(index)}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <button type="button" onClick={addEntry} className="btn-secondary w-full py-2.5 text-sm font-semibold">
                {t('lorebook.addEntry')}
            </button>

            <p className="character-editor-hint">
                <Trans
                    t={t}
                    i18nKey="lorebook.footerHint"
                    components={[
                        <strong key="e" />,
                        <strong key="c" />,
                        <strong key="k" />,
                    ]}
                >
                    Only <strong>enabled</strong>, <strong>content</strong> and <strong>constant</strong> drive
                    engine retrieval; all other fields are preserved verbatim for Character Card export.
                </Trans>
            </p>
        </div>
    );
}
