import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    RefreshIcon, MessageIcon, BookIcon, BrainIcon, ActivityIcon, TerminalIcon,
} from '../../constants/icons.jsx';
import ThemedSelect from '../widgets/ThemedSelect.jsx';
import ConfigurableJsonViewer from '../widgets/ConfigurableJsonViewer.jsx';
import { getDevInspector, listDevPrompts } from '../../services/management/devtoolsService.js';
import { getConnectedEntities } from '../../services/management/developmentService.js';
import { listEntities } from '../../services/management/entityService.js';
import { getSimulatorEventHistory } from '../../services/management/simulatorService.js';
import {
    normalizeEmotion, normalizeModules, normalizeMemoryLevels, formatPercent,
} from '../../store/devtoolsUtils.js';
import { LogError } from '../../utils/logger.js';

/**
 * Developer Inspector (Phase 3, D1 / D2 / D5).
 *
 * Three task-grouped panels for one entity:
 *   - Overview (D1): modules & capabilities, active sessions, emotion state,
 *     memory counts and recent conversations.
 *   - Prompts  (D2): the raw prompts the engine logged, with section
 *     highlighting so you can see exactly what the AI received.
 *   - Events   (D5): a timeline of the session's events, payload-expandable.
 *
 * Every panel is READ-ONLY — no dev action here bypasses the service layer.
 */
const InspectorView = () => {
    const { t } = useTranslation();

    const [entities, setEntities] = useState([]);
    const [connectedIds, setConnectedIds] = useState(new Set());
    const [selectedEntity, setSelectedEntity] = useState('');

    const [subTab, setSubTab] = useState('overview');

    const [overview, setOverview] = useState(null);
    const [overviewLoading, setOverviewLoading] = useState(false);
    const [overviewError, setOverviewError] = useState(null);

    const [prompts, setPrompts] = useState([]);
    const [promptsLoading, setPromptsLoading] = useState(false);
    const [promptTypeFilter, setPromptTypeFilter] = useState('');

    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(false);

    // ── Load entity options (all entities + which are connected) ──────────
    const loadEntities = useCallback(async () => {
        try {
            const list = await listEntities();
            setEntities(Array.isArray(list) ? list : []);
        } catch (error) {
            LogError('Inspector: failed to load entities', error);
        }
        try {
            const connected = await getConnectedEntities();
            setConnectedIds(new Set((connected || []).map((e) => e.id)));
        } catch (error) {
            LogError('Inspector: failed to load connected entities', error);
        }
    }, []);

    useEffect(() => { loadEntities(); }, [loadEntities]);

    // Default the selection to the first entity once loaded.
    useEffect(() => {
        if (!selectedEntity && entities.length > 0) {
            setSelectedEntity(entities[0].id);
        }
    }, [entities, selectedEntity]);

    // ── Overview ──────────────────────────────────────────────────────────
    const loadOverview = useCallback(async (entityId) => {
        if (!entityId) return;
        setOverviewLoading(true);
        setOverviewError(null);
        try {
            const data = await getDevInspector(entityId);
            setOverview(data);
        } catch (error) {
            LogError('Inspector: failed to load overview', error);
            setOverviewError(error.message || 'Failed to load inspector data');
            setOverview(null);
        } finally {
            setOverviewLoading(false);
        }
    }, []);

    const loadPrompts = useCallback(async (entityId, promptType) => {
        setPromptsLoading(true);
        try {
            const data = await listDevPrompts({ entityId: entityId || undefined, promptType: promptType || undefined, limit: 50 });
            setPrompts(data);
        } catch (error) {
            LogError('Inspector: failed to load prompts', error);
            setPrompts([]);
        } finally {
            setPromptsLoading(false);
        }
    }, []);

    const loadEvents = useCallback(async (entityId) => {
        if (!entityId) return;
        setEventsLoading(true);
        try {
            const data = await getSimulatorEventHistory(entityId, 50);
            setEvents(data?.events || []);
        } catch (error) {
            LogError('Inspector: failed to load event trace', error);
            setEvents([]);
        } finally {
            setEventsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!selectedEntity) return;
        loadOverview(selectedEntity);
        loadPrompts(selectedEntity, promptTypeFilter);
        loadEvents(selectedEntity);
    }, [selectedEntity, promptTypeFilter, loadOverview, loadPrompts, loadEvents]);

    // ── Derived overview rows ─────────────────────────────────────────────
    const emotionRows = useMemo(() => normalizeEmotion(overview?.emotion), [overview]);
    const moduleRows = useMemo(() => normalizeModules(overview?.modules), [overview]);
    const memoryRows = useMemo(() => normalizeMemoryLevels(overview?.memory_by_level), [overview]);
    const conversations = overview?.conversations || [];
    const sessions = overview?.sessions || [];

    const promptTypeOptions = useMemo(() => {
        const types = new Set(prompts.map((p) => p.promptType).filter(Boolean));
        return [
            { value: '', label: t('development:inspector.prompts.allTypes') },
            ...[...types].sort().map((type) => ({ value: type, label: type })),
        ];
    }, [prompts, t]);

    const entityOptions = useMemo(
        () => entities.map((e) => ({
            value: e.id,
            label: `${e.alias || e.id}${connectedIds.has(e.id) ? ` • ${t('development:inspector.connected')}` : ''}`,
        })),
        [entities, connectedIds, t],
    );

    const colorFirstWord = (text) => {
        const spaceIdx = text.indexOf(' ');
        if (spaceIdx === -1) return <span className="text-gradient-primary">{text}</span>;
        return <><span className="text-gradient-primary">{text.slice(0, spaceIdx)}</span>{text.slice(spaceIdx)}</>;
    };

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Entity selector bar */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-border-glass bg-background-surface/20">
                <label className="text-xs font-medium text-text-secondary">
                    {t('development:inspector.entity')}
                </label>
                <div className="w-72">
                    <ThemedSelect
                        value={selectedEntity}
                        onChange={setSelectedEntity}
                        options={entityOptions.length ? entityOptions : [{ value: '', label: t('development:inspector.noEntities') }]}
                        placeholder={t('development:inspector.selectEntity')}
                    />
                </div>
                <button
                    type="button"
                    className="module-action-btn text-xs"
                    onClick={() => {
                        loadEntities();
                        if (selectedEntity) {
                            loadOverview(selectedEntity);
                            loadPrompts(selectedEntity, promptTypeFilter);
                            loadEvents(selectedEntity);
                        }
                    }}
                >
                    <RefreshIcon className="w-3.5 h-3.5" />
                </button>
                {selectedEntity && connectedIds.has(selectedEntity) && (
                    <span className="status-badge status-success">{t('development:inspector.connected')}</span>
                )}
            </div>

            {/* Sub-tab bar */}
            <div className="character-editor-tab-bar">
                <button
                    className={`character-editor-tab ${subTab === 'overview' ? 'character-editor-tab-active' : 'character-editor-tab-inactive'}`}
                    onClick={() => setSubTab('overview')}
                >
                    {t('development:inspector.tabs.overview')}
                </button>
                <button
                    className={`character-editor-tab ${subTab === 'prompts' ? 'character-editor-tab-active' : 'character-editor-tab-inactive'}`}
                    onClick={() => setSubTab('prompts')}
                >
                    {t('development:inspector.tabs.prompts')}
                </button>
                <button
                    className={`character-editor-tab ${subTab === 'events' ? 'character-editor-tab-active' : 'character-editor-tab-inactive'}`}
                    onClick={() => setSubTab('events')}
                >
                    {t('development:inspector.tabs.events')}
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-6">
                {/* ── D1: Overview ── */}
                {subTab === 'overview' && (
                    <>
                        {overviewLoading && (
                            <p className="text-sm text-text-muted">{t('development:inspector.loading')}</p>
                        )}
                        {overviewError && !overviewLoading && (
                            <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-sm">
                                {overviewError}
                            </div>
                        )}
                        {!selectedEntity && !overviewLoading && (
                            <p className="text-sm text-text-muted">{t('development:inspector.selectEntity')}</p>
                        )}

                        {overview && (
                            <>
                                <section className="character-editor-section">
                                    <div className="character-editor-section-header">
                                        {t('development:inspector.modules.title')}
                                    </div>
                                    <div className="p-4">
                                        {moduleRows.length === 0 ? (
                                            <p className="text-xs text-text-muted">{t('development:inspector.modules.empty')}</p>
                                        ) : (
                                            <div className="flex flex-wrap gap-2">
                                                {moduleRows.map((m) => (
                                                    <span
                                                        key={m.name}
                                                        className={`log-tag ${m.enabled ? 'log-tag-component' : 'opacity-40'}`}
                                                        title={m.configId || t('development:inspector.modules.disabled')}
                                                    >
                                                        {m.name}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <section className="character-editor-section">
                                        <div className="character-editor-section-header flex items-center gap-2">
                                            <ActivityIcon className="w-4 h-4" />
                                            {t('development:inspector.sessions.title')}
                                        </div>
                                        <div className="p-4 space-y-2">
                                            {sessions.length === 0 ? (
                                                <p className="text-xs text-text-muted">{t('development:inspector.sessions.empty')}</p>
                                            ) : sessions.map((s, i) => (
                                                <div key={i} className="flex items-center justify-between text-xs">
                                                    <span className="text-text-secondary">{s.device_type}</span>
                                                    <span className="font-mono text-text-muted">{s.handler_id}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    <section className="character-editor-section">
                                        <div className="character-editor-section-header flex items-center gap-2">
                                            <BrainIcon className="w-4 h-4" />
                                            {t('development:inspector.emotion.title')}
                                        </div>
                                        <div className="p-4 space-y-2">
                                            {emotionRows.length === 0 ? (
                                                <p className="text-xs text-text-muted">{t('development:inspector.emotion.empty')}</p>
                                            ) : emotionRows.map((row) => (
                                                <div key={row.key} className="flex items-center gap-3">
                                                    <span className="text-xs text-text-secondary w-24">{row.label}</span>
                                                    <div className="flex-1 h-1.5 rounded-full bg-background-surface overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-accent-primary"
                                                            style={{ width: formatPercent(row.value) }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-text-muted w-10 text-right">{formatPercent(row.value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                </div>

                                <section className="character-editor-section">
                                    <div className="character-editor-section-header flex items-center gap-2">
                                        <BookIcon className="w-4 h-4" />
                                        {t('development:inspector.memory.title')}
                                    </div>
                                    <div className="p-4 flex flex-wrap items-center gap-4 text-xs">
                                        <span className="text-text-secondary">
                                            {t('development:inspector.memory.total')}: <span className="text-accent-primary font-bold">{overview.memory_total ?? 0}</span>
                                        </span>
                                        {memoryRows.map((row) => (
                                            <span key={row.level} className="text-text-muted">
                                                L{row.level}: <span className="text-text-secondary">{row.count}</span>
                                            </span>
                                        ))}
                                    </div>
                                </section>

                                <section className="character-editor-section">
                                    <div className="character-editor-section-header flex items-center gap-2">
                                        <MessageIcon className="w-4 h-4" />
                                        {t('development:inspector.conversations.title')}
                                    </div>
                                    <div className="p-4 space-y-2">
                                        {conversations.length === 0 ? (
                                            <p className="text-xs text-text-muted">{t('development:inspector.conversations.empty')}</p>
                                        ) : conversations.map((c) => (
                                            <div key={c.interaction_id} className="flex items-start justify-between gap-3 text-xs border-b border-border-glass/50 pb-2 last:border-0">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="log-tag log-tag-entity">{c.scope}</span>
                                                        <span className="text-text-muted font-mono truncate">{c.interaction_id}</span>
                                                    </div>
                                                    {c.last_message && (
                                                        <div className="text-text-secondary mt-1 truncate">
                                                            {c.last_message.content}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-text-muted whitespace-nowrap">{c.status}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </>
                        )}
                    </>
                )}

                {/* ── D2: Prompt Inspector ── */}
                {subTab === 'prompts' && (
                    <>
                        <div className="flex items-center gap-3">
                            <label className="text-xs text-text-secondary">{t('development:inspector.prompts.filterType')}</label>
                            <div className="w-56">
                                <ThemedSelect
                                    value={promptTypeFilter}
                                    onChange={setPromptTypeFilter}
                                    options={promptTypeOptions}
                                    placeholder={t('development:inspector.prompts.allTypes')}
                                />
                            </div>
                            <button
                                type="button"
                                className="module-action-btn text-xs"
                                onClick={() => loadPrompts(selectedEntity, promptTypeFilter)}
                            >
                                <RefreshIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {promptsLoading && <p className="text-sm text-text-muted">{t('development:inspector.loading')}</p>}
                        {!promptsLoading && prompts.length === 0 && (
                            <p className="text-sm text-text-muted">{t('development:inspector.prompts.empty')}</p>
                        )}

                        {prompts.map((p) => (
                            <section key={p.id} className="character-editor-section">
                                <div className="character-editor-section-header flex items-center gap-2">
                                    <TerminalIcon className="w-4 h-4" />
                                    <span className="log-level-badge log-level-prompt">
                                        {p.promptType || 'prompt'}
                                    </span>
                                    {p.entityId && <span className="log-tag log-tag-entity">{p.entityId}</span>}
                                    <span className="ml-auto text-[10px] text-text-muted font-mono">
                                        {new Date(p.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <div className="p-4">
                                    <pre className="log-prompt-content text-xs font-mono whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar">
                                        {highlightPrompt(p.message)}
                                    </pre>
                                </div>
                            </section>
                        ))}
                    </>
                )}

                {/* ── D5: Event Trace ── */}
                {subTab === 'events' && (
                    <>
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-text-muted">
                                {t('development:inspector.events.hint')}
                            </p>
                            <button
                                type="button"
                                className="module-action-btn text-xs"
                                onClick={() => loadEvents(selectedEntity)}
                            >
                                <RefreshIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {eventsLoading && <p className="text-sm text-text-muted">{t('development:inspector.loading')}</p>}
                        {!eventsLoading && events.length === 0 && (
                            <p className="text-sm text-text-muted">{t('development:inspector.events.empty')}</p>
                        )}

                        <div className="space-y-2">
                            {events.map((ev, i) => (
                                <details key={ev.id || i} className="character-editor-section">
                                    <summary className="character-editor-section-header cursor-pointer flex items-center gap-2">
                                        <span className="text-[10px] text-text-muted font-mono">
                                            {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : ''}
                                        </span>
                                        <span className="log-tag log-tag-component">
                                            {ev.event_type || ev.event?.event_type || 'event'}
                                        </span>
                                        <span className="text-[10px] text-text-muted">
                                            {ev.direction || ev.event?.status || ''}
                                        </span>
                                    </summary>
                                    <div className="p-3">
                                        <ConfigurableJsonViewer data={ev.event?.payload ?? ev.payload ?? ev} defaultDepth={2} />
                                    </div>
                                </details>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

/** Highlight markdown-ish prompt headings/warnings, mirroring the LogViewer. */
function highlightPrompt(content) {
    if (!content) return '';
    return content.split('\n').map((line, i) => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('## ') || trimmed.startsWith('# ')
            || trimmed.startsWith('IMPORTANT') || trimmed.startsWith('WARNING')) {
            return (
                <div key={i} className="log-prompt-heading">{line}</div>
            );
        }
        return <div key={i}>{line}</div>;
    });
}

export default InspectorView;
