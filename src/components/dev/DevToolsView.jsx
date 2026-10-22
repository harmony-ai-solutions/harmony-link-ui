import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshIcon, CheckIcon, WarningIcon } from '../../constants/icons.jsx';
import Toggle from '../ui/Toggle.jsx';
import JsonViewer from '../widgets/JsonViewer.jsx';
import useDevToolsStore from '../../store/devtoolsStore.js';
import { getDevSchema, getDevMigrations } from '../../services/management/devtoolsService.js';
import { summarizeMigrations } from '../../store/devtoolsUtils.js';
import { LogError } from '../../utils/logger.js';

/**
 * Developer Tools (Phase 3, D4 / D6).
 *
 *   - Raw JSON toggle (D4): when on, every JSON viewer in the app shows full
 *     depth. The preference is persisted per install.
 *   - Schema / parity (D6): the applied database schema (tables, indexes,
 *     triggers, views) and the migration status — both READ-ONLY. Migrations
 *     are never applied from the UI.
 */
const DevToolsView = () => {
    const { t } = useTranslation();
    const rawJson = useDevToolsStore((s) => s.rawJson);
    const toggleRawJson = useDevToolsStore((s) => s.toggleRawJson);

    const [schema, setSchema] = useState([]);
    const [schemaLoading, setSchemaLoading] = useState(false);
    const [schemaError, setSchemaError] = useState(null);
    const [schemaFilter, setSchemaFilter] = useState('');

    const [migrations, setMigrations] = useState([]);
    const [migrationsLoading, setMigrationsLoading] = useState(false);

    const [subTab, setSubTab] = useState('schema');

    const loadSchema = useCallback(async () => {
        setSchemaLoading(true);
        setSchemaError(null);
        try {
            const rows = await getDevSchema();
            setSchema(rows);
        } catch (error) {
            LogError('Dev tools: failed to load schema', error);
            setSchemaError(error.message || 'Failed to load schema');
            setSchema([]);
        } finally {
            setSchemaLoading(false);
        }
    }, []);

    const loadMigrations = useCallback(async () => {
        setMigrationsLoading(true);
        try {
            const data = await getDevMigrations();
            setMigrations(data.migrations || []);
        } catch (error) {
            LogError('Dev tools: failed to load migrations', error);
            setMigrations([]);
        } finally {
            setMigrationsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSchema();
        loadMigrations();
    }, [loadSchema, loadMigrations]);

    const summary = useMemo(() => summarizeMigrations(migrations), [migrations]);

    const filteredSchema = useMemo(() => {
        if (!schemaFilter.trim()) return schema;
        const needle = schemaFilter.toLowerCase();
        return schema.filter(
            (row) => row.name?.toLowerCase().includes(needle) || row.type?.toLowerCase().includes(needle),
        );
    }, [schema, schemaFilter]);

    const groupedSchema = useMemo(() => {
        const groups = {};
        for (const row of filteredSchema) {
            (groups[row.type] = groups[row.type] || []).push(row);
        }
        return groups;
    }, [filteredSchema]);

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Raw JSON toggle */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-border-glass bg-background-surface/20">
                <Toggle checked={rawJson} onChange={toggleRawJson} />
                <div>
                    <div className="text-sm font-medium text-text-primary">{t('development:tools.rawJson.title')}</div>
                    <div className="text-xs text-text-muted">{t('development:tools.rawJson.description')}</div>
                </div>
            </div>

            {/* Sub-tab bar */}
            <div className="character-editor-tab-bar">
                <button
                    className={`character-editor-tab ${subTab === 'schema' ? 'character-editor-tab-active' : 'character-editor-tab-inactive'}`}
                    onClick={() => setSubTab('schema')}
                >
                    {t('development:tools.tabs.schema')}
                </button>
                <button
                    className={`character-editor-tab ${subTab === 'migrations' ? 'character-editor-tab-active' : 'character-editor-tab-inactive'}`}
                    onClick={() => setSubTab('migrations')}
                >
                    {t('development:tools.tabs.migrations')}
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-4">
                {/* ── Schema ── */}
                {subTab === 'schema' && (
                    <>
                        <div className="flex items-center gap-3">
                            <input
                                type="text"
                                value={schemaFilter}
                                onChange={(e) => setSchemaFilter(e.target.value)}
                                placeholder={t('development:tools.schema.filter')}
                                className="input-field w-64"
                            />
                            <span className="text-xs text-text-muted">
                                {t('development:tools.schema.count', { count: filteredSchema.length })}
                            </span>
                            <button type="button" className="module-action-btn text-xs" onClick={loadSchema}>
                                <RefreshIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {schemaLoading && <p className="text-sm text-text-muted">{t('development:inspector.loading')}</p>}
                        {schemaError && (
                            <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
                                {schemaError}
                            </div>
                        )}

                        {Object.entries(groupedSchema).map(([type, rows]) => (
                            <section key={type} className="character-editor-section">
                                <div className="character-editor-section-header">
                                    {type} ({rows.length})
                                </div>
                                <div className="p-3 space-y-1">
                                    {rows.map((row) => (
                                        <details key={`${row.type}-${row.name}`} className="rounded border border-border-glass/50">
                                            <summary className="px-2 py-1 text-xs font-mono text-text-secondary cursor-pointer">
                                                {row.name}
                                            </summary>
                                            <div className="p-2 bg-background-surface/40">
                                                <pre className="text-[10px] font-mono text-text-muted whitespace-pre-wrap">
                                                    {row.sql}
                                                </pre>
                                            </div>
                                        </details>
                                    ))}
                                </div>
                            </section>
                        ))}

                        {/* Raw schema payload (respects the D4 toggle). */}
                        {schema.length > 0 && (
                            <section className="character-editor-section">
                                <div className="character-editor-section-header">{t('development:tools.schema.raw')}</div>
                                <div className="p-3">
                                    <JsonViewer data={schema} maxDepth={rawJson ? 999 : 2} />
                                </div>
                            </section>
                        )}
                    </>
                )}

                {/* ── Migrations ── */}
                {subTab === 'migrations' && (
                    <>
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-text-muted">
                                {t('development:tools.migrations.applied', { applied: summary.applied, total: summary.total })}
                            </span>
                            {summary.pending > 0 && (
                                <span className="text-xs text-yellow-400">
                                    {t('development:tools.migrations.pending', { count: summary.pending })}
                                </span>
                            )}
                            <button type="button" className="module-action-btn text-xs ml-auto" onClick={loadMigrations}>
                                <RefreshIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {migrationsLoading && <p className="text-sm text-text-muted">{t('development:inspector.loading')}</p>}

                        <section className="character-editor-section">
                            <div className="p-2">
                                {migrations.map((m) => (
                                    <div key={m.version} className="flex items-center gap-3 px-2 py-1.5 border-b border-border-glass/40 last:border-0">
                                        {m.applied ? (
                                            <CheckIcon className="w-4 h-4 text-green-400" />
                                        ) : (
                                            <WarningIcon className="w-4 h-4 text-yellow-400" />
                                        )}
                                        <span className="text-xs font-mono text-text-muted w-10">{m.version}</span>
                                        <span className="text-xs text-text-secondary flex-1 truncate">{m.description}</span>
                                        <span className={`log-tag ${m.applied ? 'log-tag-component' : 'opacity-60'}`}>
                                            {m.applied ? t('development:tools.migrations.stateApplied') : t('development:tools.migrations.statePending')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
};

export default DevToolsView;
