import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshIcon, BookIcon } from '../../constants/icons.jsx';
import ThemedSelect from '../widgets/ThemedSelect.jsx';
import ConfigurableJsonViewer from '../widgets/ConfigurableJsonViewer.jsx';
import {
    getEntityRAGCollections,
    getEntityRAGCollectionDocuments,
    getEntityRAGDocumentDetails,
    testEntityRAGSimilarityQuery,
    getEntityRAGCollectionGroups,
} from '../../services/management/ragService.js';
import { listEntities } from '../../services/management/entityService.js';
import { LogError } from '../../utils/logger.js';

/**
 * RAG Debugger (Phase 3, D3).
 *
 * A developer-focused view over an entity's RAG collections:
 *   - Similarity Test: type a query and see which documents the retriever
 *     ranks highest (the existing `test-query` endpoint).
 *   - Document Browser: browse a collection's documents and inspect one
 *     document's content, metadata and embedding.
 *
 * The similarity test endpoint is a query (read-only semantically) — this view
 * performs no destructive operations, so it never bypasses the service layer.
 */
const RAGDebugView = () => {
    const { t } = useTranslation();

    const [entities, setEntities] = useState([]);
    const [selectedEntity, setSelectedEntity] = useState('');

    const [collections, setCollections] = useState([]);
    const [collectionsLoading, setCollectionsLoading] = useState(false);
    const [selectedCollection, setSelectedCollection] = useState('');

    const [subTab, setSubTab] = useState('similarity');

    // Similarity test state
    const [query, setQuery] = useState('');
    const [limit, setLimit] = useState(10);
    const [archetype, setArchetype] = useState('');
    const [category, setCategory] = useState('');
    const [results, setResults] = useState(null);
    const [testing, setTesting] = useState(false);

    // Document browser state
    const [documents, setDocuments] = useState([]);
    const [documentsLoading, setDocumentsLoading] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [documentDetails, setDocumentDetails] = useState(null);

    const [groups, setGroups] = useState(null);

    // ── Entities ──────────────────────────────────────────────────────────
    useEffect(() => {
        listEntities()
            .then((list) => setEntities(Array.isArray(list) ? list : []))
            .catch((error) => LogError('RAG debugger: failed to load entities', error));
    }, []);

    useEffect(() => {
        if (!selectedEntity && entities.length > 0) setSelectedEntity(entities[0].id);
    }, [entities, selectedEntity]);

    // ── Collections ───────────────────────────────────────────────────────
    const loadCollections = useCallback(async (entityId) => {
        if (!entityId) return;
        setCollectionsLoading(true);
        setSelectedCollection('');
        setResults(null);
        setDocuments([]);
        setDocumentDetails(null);
        setGroups(null);
        try {
            const data = await getEntityRAGCollections(entityId);
            setCollections(data?.collections || []);
        } catch (error) {
            LogError('RAG debugger: failed to load collections', error);
            setCollections([]);
        } finally {
            setCollectionsLoading(false);
        }
    }, []);

    useEffect(() => { loadCollections(selectedEntity); }, [selectedEntity, loadCollections]);

    // Archetype/category filter options come from the grouped view (best effort).
    useEffect(() => {
        if (!selectedEntity || !selectedCollection) { setGroups(null); return; }
        getEntityRAGCollectionGroups(selectedEntity, selectedCollection)
            .then((data) => setGroups(data))
            .catch(() => setGroups(null));
    }, [selectedEntity, selectedCollection]);

    const archetypeOptions = useMemo(() => {
        const list = groups?.groups ? Object.keys(groups.groups) : [];
        return [{ value: '', label: t('development:rag.allArchetypes') }, ...list.map((a) => ({ value: a, label: a }))];
    }, [groups, t]);

    const categoryOptions = useMemo(() => {
        const list = groups?.groups
            ? [...new Set(Object.values(groups.groups).flat().flatMap((g) => Object.keys(g.categories || {})))]
            : [];
        return [{ value: '', label: t('development:rag.allCategories') }, ...list.map((c) => ({ value: c, label: c }))];
    }, [groups, t]);

    // ── Similarity test ───────────────────────────────────────────────────
    const runTest = async () => {
        if (!selectedEntity || !selectedCollection || !query.trim()) return;
        setTesting(true);
        try {
            const data = await testEntityRAGSimilarityQuery(
                selectedEntity, selectedCollection, query, limit, archetype, category,
            );
            setResults(data);
        } catch (error) {
            LogError('RAG debugger: similarity test failed', error);
            setResults({ query, results: [], error: error.message });
        } finally {
            setTesting(false);
        }
    };

    // ── Documents ─────────────────────────────────────────────────────────
    const loadDocuments = useCallback(async () => {
        if (!selectedEntity || !selectedCollection) return;
        setDocumentsLoading(true);
        setDocumentDetails(null);
        setSelectedDocument(null);
        try {
            const data = await getEntityRAGCollectionDocuments(selectedEntity, selectedCollection, archetype, category);
            setDocuments(data?.documents || []);
        } catch (error) {
            LogError('RAG debugger: failed to load documents', error);
            setDocuments([]);
        } finally {
            setDocumentsLoading(false);
        }
    }, [selectedEntity, selectedCollection, archetype, category]);

    useEffect(() => {
        if (subTab === 'documents') loadDocuments();
    }, [subTab, loadDocuments]);

    const loadDocumentDetails = async (docId) => {
        try {
            const data = await getEntityRAGDocumentDetails(selectedEntity, selectedCollection, docId);
            setDocumentDetails(data);
            setSelectedDocument(docId);
        } catch (error) {
            LogError('RAG debugger: failed to load document details', error);
        }
    };

    const entityOptions = useMemo(
        () => entities.map((e) => ({ value: e.id, label: e.alias || e.id })),
        [entities],
    );

    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Selector bar */}
            <div className="flex flex-wrap items-center gap-3 px-6 py-3 border-b border-border-glass bg-background-surface/20">
                <label className="text-xs font-medium text-text-secondary">{t('development:rag.entity')}</label>
                <div className="w-56">
                    <ThemedSelect
                        value={selectedEntity}
                        onChange={setSelectedEntity}
                        options={entityOptions.length ? entityOptions : [{ value: '', label: t('development:inspector.noEntities') }]}
                        placeholder={t('development:inspector.selectEntity')}
                    />
                </div>

                <label className="text-xs font-medium text-text-secondary ml-2">{t('development:rag.collection')}</label>
                <div className="w-56">
                    <ThemedSelect
                        value={selectedCollection}
                        onChange={setSelectedCollection}
                        options={[
                            { value: '', label: collectionsLoading ? t('development:inspector.loading') : t('development:rag.selectCollection') },
                            ...collections.map((c) => ({ value: c.name || c, label: c.name || c })),
                        ]}
                    />
                </div>

                <button type="button" className="module-action-btn text-xs" onClick={() => loadCollections(selectedEntity)}>
                    <RefreshIcon className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Sub-tab bar */}
            <div className="character-editor-tab-bar">
                <button
                    className={`character-editor-tab ${subTab === 'similarity' ? 'character-editor-tab-active' : 'character-editor-tab-inactive'}`}
                    onClick={() => setSubTab('similarity')}
                >
                    {t('development:rag.tabs.similarity')}
                </button>
                <button
                    className={`character-editor-tab ${subTab === 'documents' ? 'character-editor-tab-active' : 'character-editor-tab-inactive'}`}
                    onClick={() => setSubTab('documents')}
                >
                    {t('development:rag.tabs.documents')}
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6 space-y-4">
                {!selectedCollection && (
                    <p className="text-sm text-text-muted">{t('development:rag.selectCollectionHint')}</p>
                )}

                {/* ── Similarity test ── */}
                {subTab === 'similarity' && selectedCollection && (
                    <>
                        <section className="character-editor-section">
                            <div className="character-editor-section-header">{t('development:rag.similarity.title')}</div>
                            <div className="p-4 space-y-3">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') runTest(); }}
                                    placeholder={t('development:rag.similarity.placeholder')}
                                    className="input-field w-full"
                                />
                                <div className="flex flex-wrap items-center gap-2">
                                    <ThemedSelect value={archetype} onChange={setArchetype} options={archetypeOptions} />
                                    <ThemedSelect value={category} onChange={setCategory} options={categoryOptions} />
                                    <div className="w-28">
                                        <ThemedSelect
                                            value={limit}
                                            onChange={(v) => setLimit(parseInt(v, 10) || 10)}
                                            options={[5, 10, 20, 50].map((n) => ({ value: n, label: `Top ${n}` }))}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-primary disabled:opacity-50"
                                        disabled={!query.trim() || testing}
                                        onClick={runTest}
                                    >
                                        {testing ? t('development:rag.similarity.testing') : t('development:rag.similarity.run')}
                                    </button>
                                </div>
                            </div>
                        </section>

                        {results && (
                            <section className="character-editor-section">
                                <div className="character-editor-section-header">
                                    {t('development:rag.similarity.results', { count: results.results?.length || 0 })}
                                </div>
                                <div className="p-4 space-y-2">
                                    {(results.results || []).length === 0 ? (
                                        <p className="text-xs text-text-muted">{t('development:rag.similarity.noResults')}</p>
                                    ) : results.results.map((r, i) => (
                                        <div key={i} className="card-surface rounded p-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-medium text-accent-primary">{r.name}</span>
                                                <span className="text-xs text-text-secondary">
                                                    {(Number(r.similarity) * 100).toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="text-xs text-text-primary">{r.content}</div>
                                            <div className="text-[10px] text-text-muted mt-1">
                                                {r.archetype} → {r.category}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}

                {/* ── Document browser ── */}
                {subTab === 'documents' && selectedCollection && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <section className="character-editor-section">
                            <div className="character-editor-section-header flex items-center gap-2">
                                <BookIcon className="w-4 h-4" />
                                {t('development:rag.documents.title', { count: documents.length })}
                            </div>
                            <div className="p-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                {documentsLoading && <p className="text-xs text-text-muted p-2">{t('development:inspector.loading')}</p>}
                                {!documentsLoading && documents.length === 0 && (
                                    <p className="text-xs text-text-muted p-2">{t('development:rag.documents.empty')}</p>
                                )}
                                {documents.map((doc) => (
                                    <button
                                        key={doc.id}
                                        type="button"
                                        onClick={() => loadDocumentDetails(doc.id)}
                                        className={`w-full text-left p-2 rounded mb-1 transition-colors ${
                                            selectedDocument === doc.id ? 'bg-accent-primary/20' : 'hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="text-sm text-text-primary">{doc.name}</div>
                                        <div className="text-[10px] text-text-muted">{doc.category}</div>
                                        <div className="text-xs text-text-secondary truncate mt-0.5">{doc.content}</div>
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section className="character-editor-section">
                            <div className="character-editor-section-header">{t('development:rag.documents.details')}</div>
                            <div className="p-4 space-y-3">
                                {!documentDetails ? (
                                    <p className="text-xs text-text-muted">{t('development:rag.documents.selectHint')}</p>
                                ) : (
                                    <>
                                        <div>
                                            <label className="text-[10px] text-text-muted">ID</label>
                                            <div className="text-xs font-mono text-text-primary break-all">{documentDetails.id}</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-text-muted">{t('development:rag.documents.content')}</label>
                                            <div className="text-xs text-text-primary whitespace-pre-wrap">{documentDetails.content}</div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-text-muted">{t('development:rag.documents.metadata')}</label>
                                            <ConfigurableJsonViewer data={documentDetails.metadata} defaultDepth={2} />
                                        </div>
                                        {documentDetails.embedding && (
                                            <div>
                                                <label className="text-[10px] text-text-muted">
                                                    {t('development:rag.documents.embedding', { count: documentDetails.embedding.length })}
                                                </label>
                                                <div className="text-[10px] text-text-muted font-mono max-h-20 overflow-y-auto">
                                                    [{documentDetails.embedding.slice(0, 10).map((v) => Number(v).toFixed(4)).join(', ')}…]
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RAGDebugView;
