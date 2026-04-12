import {useEffect, useRef, useState} from "react";
import { 
    getEntityRAGCollections, 
    getEntityRAGCollectionDetails,
    getEntityRAGCollectionDocuments,
    getEntityRAGDocumentDetails, 
    deleteEntityRAGDocument, 
    testEntityRAGSimilarityQuery,
    getEntityRAGCollectionGroups,
    getEntityRAGGroupDocuments,
    updateEntityRAGDocument,
    addEntityRAGDocumentToGroup,
    deleteEntityRAGGroup
} from "../../services/management/ragService.js";
import ConfigurableJsonViewer from "../widgets/ConfigurableJsonViewer.jsx";

const RAGCollectionManager = ({ entityId, isOpen, onClose, onError }) => {
    // Track whether the modal is currently open so in-flight requests
    // that complete after close don't surface errors in the parent.
    const isOpenRef = useRef(isOpen);
    useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

    const safeOnError = (msg) => {
        if (isOpenRef.current) onError(msg);
    };

    // Collections management state
    const [collections, setCollections] = useState([]);
    const [collectionsLoading, setCollectionsLoading] = useState(false);
    const [selectedCollection, setSelectedCollection] = useState(null);
    const [collectionDetails, setCollectionDetails] = useState(null);
    const [documents, setDocuments] = useState([]);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [documentDetails, setDocumentDetails] = useState(null);
    const [activeTab, setActiveTab] = useState('overview');
    const [filterArchetype, setFilterArchetype] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [testQuery, setTestQuery] = useState('');
    const [testResults, setTestResults] = useState(null);
    const [testLoading, setTestLoading] = useState(false);

    // Grouped view state
    const [groupedView, setGroupedView] = useState(null);
    const [groupedLoading, setGroupedLoading] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [groupDocuments, setGroupDocuments] = useState(null);
    const [editingDocument, setEditingDocument] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [updateLoading, setUpdateLoading] = useState(false);
    const [updateError, setUpdateError] = useState(null);
    const [addingToGroup, setAddingToGroup] = useState(null);
    const [newDocumentContent, setNewDocumentContent] = useState('');
    const [addingCategory, setAddingCategory] = useState('');

    // Derive available archetypes and categories from the grouped view when loaded.
    // Falls back to empty (only "All" option) if the grouped tab hasn't been visited yet.
    const availableArchetypes = groupedView?.groups
        ? Object.keys(groupedView.groups)
        : [];

    const availableCategories = groupedView?.groups
        ? [...new Set(
            Object.values(groupedView.groups)
                .flat()
                .flatMap(group => Object.keys(group.categories || {}))
          )]
        : [];

    // Collections management functions
    const loadCollections = async () => {
        if (!entityId) return;
        setCollectionsLoading(true);
        try {
            const response = await getEntityRAGCollections(entityId);
            setCollections(response.collections || []);
        } catch (error) {
            console.error('Failed to load collections:', error);
            safeOnError('Failed to load collections: ' + error.message);
        } finally {
            setCollectionsLoading(false);
        }
    };

    const loadCollectionDetails = async (collectionName) => {
        if (!entityId || !collectionName) return;
        try {
            const response = await getEntityRAGCollectionDetails(entityId, collectionName);
            setCollectionDetails(response);
            setSelectedCollection(collectionName);
        } catch (error) {
            console.error('Failed to load collection details:', error);
            safeOnError('Failed to load collection details: ' + error.message);
        }
    };

    const loadDocuments = async (collectionName, archetype = '', category = '') => {
        if (!entityId || !collectionName) return;
        try {
            const response = await getEntityRAGCollectionDocuments(entityId, collectionName, archetype, category);
            setDocuments(response.documents || []);
        } catch (error) {
            console.error('Failed to load documents:', error);
            safeOnError('Failed to load documents: ' + error.message);
        }
    };

    const loadDocumentDetails = async (collectionName, documentId) => {
        if (!entityId || !collectionName || !documentId) return;
        try {
            const response = await getEntityRAGDocumentDetails(entityId, collectionName, documentId);
            setDocumentDetails(response);
            setSelectedDocument(documentId);
        } catch (error) {
            console.error('Failed to load document details:', error);
            safeOnError('Failed to load document details: ' + error.message);
        }
    };

    const handleDeleteDocument = async (collectionName, documentId) => {
        if (!entityId || !collectionName || !documentId) return;
        if (!confirm('Are you sure you want to delete this document?')) return;
        
        try {
            await deleteEntityRAGDocument(entityId, collectionName, documentId);
            // Refresh documents list
            await loadDocuments(collectionName, filterArchetype, filterCategory);
            setSelectedDocument(null);
            setDocumentDetails(null);
        } catch (error) {
            console.error('Failed to delete document:', error);
            safeOnError('Failed to delete document: ' + error.message);
        }
    };

    const handleTestQuery = async () => {
        if (!entityId || !selectedCollection || !testQuery.trim()) return;
        setTestLoading(true);
        try {
            const response = await testEntityRAGSimilarityQuery(
                entityId, 
                selectedCollection, 
                testQuery, 
                10, 
                filterArchetype, 
                filterCategory
            );
            setTestResults(response);
        } catch (error) {
            console.error('Failed to test query:', error);
            safeOnError('Failed to test query: ' + error.message);
        } finally {
            setTestLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedCollection(null);
        setCollectionDetails(null);
        setDocuments([]);
        setSelectedDocument(null);
        setDocumentDetails(null);
        setTestResults(null);
        setTestQuery('');
        setFilterArchetype('');
        setFilterCategory('');
        setGroupedView(null);
        setSelectedGroup(null);
        setGroupDocuments(null);
        setEditingDocument(null);
        setAddingToGroup(null);
        setActiveTab('overview');
        onClose();
    };

    // Grouped view functions
    const loadGroupedView = async (collectionName) => {
        if (!entityId || !collectionName) return;
        setGroupedLoading(true);
        try {
            const response = await getEntityRAGCollectionGroups(entityId, collectionName);
            setGroupedView(response);
            setSelectedCollection(collectionName);
        } catch (error) {
            console.error('Failed to load grouped view:', error);
            safeOnError('Failed to load grouped view: ' + error.message);
        } finally {
            setGroupedLoading(false);
        }
    };

    const loadGroupDocuments = async (collectionName, archetype, groupName) => {
        if (!entityId || !collectionName || !archetype || !groupName) return;
        try {
            const response = await getEntityRAGGroupDocuments(entityId, collectionName, archetype, groupName);
            setGroupDocuments(response);
            setSelectedGroup({ archetype, name: groupName });
        } catch (error) {
            console.error('Failed to load group documents:', error);
            safeOnError('Failed to load group documents: ' + error.message);
        }
    };

    const handleUpdateDocument = async (documentId, newContent) => {
        if (!entityId || !selectedCollection || !documentId || !newContent.trim()) return;
        setUpdateLoading(true);
        setUpdateError(null);
        
        try {
            const result = await updateEntityRAGDocument(entityId, selectedCollection, documentId, newContent);
            if (result.success) {
                // Refresh the group documents
                if (selectedGroup) {
                    await loadGroupDocuments(selectedCollection, selectedGroup.archetype, selectedGroup.name);
                }
                setEditingDocument(null);
                setEditContent('');
            } else {
                setUpdateError(result.error);
            }
        } catch (error) {
            console.error('Failed to update document:', error);
            setUpdateError('Failed to update document: ' + error.message);
        } finally {
            setUpdateLoading(false);
        }
    };

    const handleAddDocumentToGroup = async () => {
        if (!entityId || !selectedCollection || !selectedGroup || !newDocumentContent.trim() || !addingCategory.trim()) return;
        
        try {
            await addEntityRAGDocumentToGroup(
                entityId, 
                selectedCollection, 
                selectedGroup.archetype, 
                selectedGroup.name, 
                addingCategory, 
                newDocumentContent
            );
            // Refresh the group documents
            await loadGroupDocuments(selectedCollection, selectedGroup.archetype, selectedGroup.name);
            setAddingToGroup(null);
            setNewDocumentContent('');
            setAddingCategory('');
        } catch (error) {
            console.error('Failed to add document:', error);
            safeOnError('Failed to add document: ' + error.message);
        }
    };

    const handleDeleteGroup = async (archetype, groupName) => {
        if (!entityId || !selectedCollection || !archetype || !groupName) return;
        if (!confirm(`Are you sure you want to delete the entire "${groupName}" group? This will delete all documents in this group.`)) return;
        
        try {
            await deleteEntityRAGGroup(entityId, selectedCollection, archetype, groupName);
            // Refresh the grouped view
            await loadGroupedView(selectedCollection);
            setSelectedGroup(null);
            setGroupDocuments(null);
        } catch (error) {
            console.error('Failed to delete group:', error);
            safeOnError('Failed to delete group: ' + error.message);
        }
    };

    useEffect(() => {
        if (isOpen && entityId) {
            loadCollections();
        }
    }, [isOpen, entityId]);

    useEffect(() => {
        if (selectedCollection && activeTab === 'documents') {
            loadDocuments(selectedCollection, filterArchetype, filterCategory);
        }
    }, [selectedCollection, activeTab, filterArchetype, filterCategory]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="character-editor-modal rounded-lg shadow-2xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col">
                {/* Modal Header */}
                <div className="character-editor-modal-header rounded-t-lg flex justify-between items-center p-6">
                    <div className="character-editor-modal-tint" />
                    <div className="character-editor-modal-stripe" />
                    <div className="flex items-center gap-3">
                        <div className="character-editor-icon-badge w-8 h-8 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-text-primary">
                                RAG Collections Management
                            </h3>
                            <p className="text-sm text-text-muted">Entity: {entityId}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-text-muted hover:text-text-primary transition-colors p-2 hover:bg-background-elevated rounded-lg"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="character-editor-tab-bar flex">
                    {['overview', 'grouped', 'documents', 'testing'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 font-medium capitalize transition-all duration-200 ${
                                activeTab === tab
                                    ? 'character-editor-tab-active'
                                    : 'character-editor-tab-inactive'
                            }`}
                        >
                            {tab === 'grouped' ? 'Grouped View' : tab}
                        </button>
                    ))}
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-hidden">
                    <div className="h-full overflow-y-auto p-6 custom-scrollbar bg-background-base">
                        {activeTab === 'overview' && (
                            <div>
                                <h4 className="text-lg font-medium text-text-primary mb-4">Collections Overview</h4>
                                {collectionsLoading ? (
                                    <div className="text-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{borderBottomColor: 'var(--color-accent-primary)'}}></div>
                                        <p className="text-text-secondary mt-2">Loading collections...</p>
                                    </div>
                                ) : collections.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-text-secondary">No collections found for this entity.</p>
                                        <p className="text-text-muted text-sm mt-2">
                                            Collections are created automatically when actions are synced to the RAG module.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {collections.map(collection => (
                                            <div key={collection.name} className="card rounded-lg p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h5 className="font-medium text-accent-primary">{collection.name}</h5>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => {
                                                                loadGroupedView(collection.name);
                                                                setActiveTab('grouped');
                                                            }}
                                                            className="text-xs btn-accent-gradient px-2 py-1 rounded"
                                                        >
                                                            Groups
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                loadCollectionDetails(collection.name);
                                                                setActiveTab('documents');
                                                            }}
                                                            className="text-xs btn-secondary px-2 py-1 rounded"
                                                        >
                                                            Browse
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="text-sm text-text-primary space-y-1">
                                                    <div>Documents: {collection.documentCount}</div>
                                                    <div>Embedding Dim: {collection.embeddingDim}</div>
                                                    <div className="text-xs text-text-secondary">
                                                        Last Updated: {new Date(collection.lastUpdated).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'grouped' && (
                            <div>
                                <h4 className="text-lg font-medium text-text-primary mb-4">
                                    Grouped View {selectedCollection ? `- ${selectedCollection}` : ''}
                                </h4>
                                {!selectedCollection ? (
                                    <div className="text-center py-8">
                                        <p className="text-text-secondary">Select a collection from the Overview tab to view groups.</p>
                                    </div>
                                ) : groupedLoading ? (
                                    <div className="text-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{borderBottomColor: 'var(--color-accent-primary)'}}></div>
                                        <p className="text-text-secondary mt-2">Loading groups...</p>
                                    </div>
                                ) : groupedView && !groupedView.supported ? (
                                    <div className="text-center py-8">
                                        <p className="text-text-secondary">
                                            Grouped view is not supported for the {selectedCollection} collection.
                                            This collection uses a different document structure.
                                        </p>
                                    </div>
                                ) : !groupedView || Object.keys(groupedView.groups || {}).length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-text-secondary">No groups found in this collection.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {/* Groups Tree */}
                                        <div>
                                            <h5 className="font-medium text-text-primary mb-2">Groups ({groupedView.totalDocuments} total documents)</h5>
                                            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                                                {Object.entries(groupedView.groups).map(([archetype, groups]) => (
                                                    <div key={archetype} className="card rounded p-3">
                                                        <div className="font-medium text-accent-primary mb-2">📁 {archetype}</div>
                                                        <div className="space-y-1 ml-4">
                                                            {groups.map(group => (
                                                                <div key={group.name} className="card-surface rounded p-2">
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="flex-1">
                                                                            <div 
                                                                                className={`font-medium cursor-pointer ${
                                                                                    selectedGroup?.archetype === archetype && selectedGroup?.name === group.name
                                                                                        ? 'text-accent-primary'
                                                                                        : 'text-text-primary hover:text-accent-primary'
                                                                                }`}
                                                                                onClick={() => loadGroupDocuments(selectedCollection, archetype, group.name)}
                                                                            >
                                                                                📋 {group.name}
                                                                            </div>
                                                                            <div className="text-xs text-text-secondary mt-1">
                                                                                {group.documentCount} documents
                                                                            </div>
                                                                            <div className="flex gap-2 mt-1">
                                                                                {Object.entries(group.categories).map(([category, count]) => (
                                                                                    <span key={category} className="text-xs bg-background-elevated text-text-secondary px-1 rounded">
                                                                                        📄 {category} ({count})
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleDeleteGroup(archetype, group.name)}
                                                                            className="hover:opacity-75 ml-2"
                                                                            style={{color: 'var(--color-error)'}}
                                                                            title="Delete entire group"
                                                                        >
                                                                            🗑️
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Group Details */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <h5 className="font-medium text-text-primary">Group Details</h5>
                                                {selectedGroup && (
                                                    <button
                                                        onClick={() => setAddingToGroup(selectedGroup)}
                                                        className="text-xs instance-action-btn-success px-2 py-1 rounded"
                                                    >
                                                        ➕ Add Document
                                                    </button>
                                                )}
                                            </div>
                                            {!groupDocuments ? (
                                                <div className="card rounded p-4 text-center text-text-secondary">
                                                    Select a group to view details
                                                </div>
                                            ) : (
                                                <div className="card rounded p-4 space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                                                    <div className="text-sm text-text-primary mb-3">
                                                        <strong>{groupDocuments.archetype}</strong> → <strong>{groupDocuments.name}</strong>
                                                        <span className="text-text-secondary"> ({groupDocuments.totalCount} documents)</span>
                                                    </div>
                                                    
                                                    {Object.entries(groupDocuments.categories).map(([category, docs]) => (
                                                        <div key={category} className="border-l-2 pl-3" style={{borderColor: 'var(--color-accent-primary)'}}>
                                                            <div className="font-medium text-accent-primary mb-2">📄 {category} ({docs.length})</div>
                                                            <div className="space-y-2">
                                                                {docs.map(doc => (
                                                                    <div key={doc.id} className="card-surface rounded p-2">
                                                                        <div className="flex justify-between items-start">
                                                                            <div className="flex-1">
                                                                                {editingDocument === doc.id ? (
                                                                                    <div className="space-y-2">
                                                                                        <textarea
                                                                                            value={editContent}
                                                                                            onChange={(e) => setEditContent(e.target.value)}
                                                                                            className="input-field w-full text-sm"
                                                                                            rows="3"
                                                                                        />
                                                                                        {updateError && (
                                                                                            <div className="text-xs" style={{color: 'var(--color-error)'}}>{updateError}</div>
                                                                                        )}
                                                                                        <div className="flex gap-2">
                                                                                            <button
                                                                                                onClick={() => handleUpdateDocument(doc.id, editContent)}
                                                                                                disabled={updateLoading}
                                                                                                className="text-xs instance-action-btn-success disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 rounded"
                                                                                            >
                                                                                                {updateLoading ? 'Saving...' : 'Save'}
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    setEditingDocument(null);
                                                                                                    setEditContent('');
                                                                                                    setUpdateError(null);
                                                                                                }}
                                                                                                className="text-xs btn-secondary px-2 py-1 rounded"
                                                                                            >
                                                                                                Cancel
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-sm text-text-primary">{doc.content}</div>
                                                                                )}
                                                                            </div>
                                                                            {editingDocument !== doc.id && (
                                                                                <div className="flex gap-1 ml-2">
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            setEditingDocument(doc.id);
                                                                                            setEditContent(doc.content);
                                                                                            setUpdateError(null);
                                                                                        }}
                                                                                        className="hover:opacity-75"
                                                                                        style={{color: 'var(--color-info)'}}
                                                                                        title="Edit document"
                                                                                    >
                                                                                        ✏️
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={async () => {
                                                                                            await handleDeleteDocument(selectedCollection, doc.id);
                                                                                            if (selectedGroup) {
                                                                                                await loadGroupDocuments(selectedCollection, selectedGroup.archetype, selectedGroup.name);
                                                                                            }
                                                                                        }}
                                                                                        className="hover:opacity-75"
                                                                                        style={{color: 'var(--color-error)'}}
                                                                                        title="Delete document"
                                                                                    >
                                                                                        🗑️
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Add Document Modal */}
                                {addingToGroup && (
                                    <div className="fixed inset-0 bg-black/60 z-[60]">
                                        <div className="modal-content relative top-20 mx-auto p-4 w-96 shadow-lg rounded-md">
                                            <h3 className="text-lg font-medium text-accent-primary mb-4">
                                                Add Document to {addingToGroup.archetype} → {addingToGroup.name}
                                            </h3>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm text-text-primary mb-1">Category:</label>
                                                    <input
                                                        value={addingCategory}
                                                        onChange={(e) => setAddingCategory(e.target.value)}
                                                        className="input-field w-full"
                                                        placeholder="example, confirmation, rejection, etc."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm text-text-primary mb-1">Content:</label>
                                                    <textarea
                                                        value={newDocumentContent}
                                                        onChange={(e) => setNewDocumentContent(e.target.value)}
                                                        placeholder="Enter document content..."
                                                        className="input-field w-full"
                                                        rows="4"
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleAddDocumentToGroup}
                                                        disabled={!newDocumentContent.trim() || !addingCategory}
                                                        className="instance-action-btn-success disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded"
                                                    >
                                                        Add Document
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setAddingToGroup(null);
                                                            setNewDocumentContent('');
                                                            setAddingCategory('');
                                                        }}
                                                        className="btn-secondary px-4 py-2 rounded"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'documents' && (
                            <div>
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="text-lg font-medium text-text-primary">
                                        Documents {selectedCollection ? `- ${selectedCollection}` : ''}
                                    </h4>
                                    <div className="flex gap-2">
                                        <select
                                            value={filterArchetype}
                                            onChange={(e) => setFilterArchetype(e.target.value)}
                                            className="input-field text-sm py-1"
                                        >
                                            <option value="">All Archetypes</option>
                                            {availableArchetypes.map(a => (
                                                <option key={a} value={a}>{a}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={filterCategory}
                                            onChange={(e) => setFilterCategory(e.target.value)}
                                            className="input-field text-sm py-1"
                                        >
                                            <option value="">All Categories</option>
                                            {availableCategories.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {!selectedCollection ? (
                                    <div className="text-center py-8">
                                        <p className="text-text-secondary">Select a collection from the Overview tab to browse documents.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {/* Documents List */}
                                        <div>
                                            <h5 className="font-medium text-text-primary mb-2">Documents ({documents.length})</h5>
                                            <div className="space-y-2 max-h-96 overflow-y-auto px-1 custom-scrollbar">
                                                {documents.map(doc => (
                                                    <div
                                                        key={doc.id}
                                                        className={`p-3 rounded cursor-pointer ${
                                                            selectedDocument === doc.id
                                                                ? 'text-white'
                                                                : 'card hover:border-border-hover text-text-primary'
                                                        }`}
                                                        style={selectedDocument === doc.id ? {backgroundColor: 'var(--color-accent-primary)'} : {}}
                                                        onClick={() => loadDocumentDetails(selectedCollection, doc.id)}
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex-1">
                                                                <div className="text-sm font-medium">{doc.name}</div>
                                                                <div className="text-xs opacity-75">{doc.category}</div>
                                                                <div className="text-xs mt-1 truncate">{doc.content}</div>
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteDocument(selectedCollection, doc.id);
                                                                }}
                                                                className="hover:opacity-75 ml-2"
                                                                style={{color: 'var(--color-error)'}}
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Document Details */}
                                        <div>
                                            <h5 className="font-medium text-text-primary mb-2">Document Details</h5>
                                            {!documentDetails ? (
                                                <div className="card rounded p-4 text-center text-text-secondary">
                                                    Select a document to view details
                                                </div>
                                            ) : (
                                                <div className="card rounded p-4 space-y-3">
                                                    <div>
                                                        <label className="text-xs text-text-muted">ID:</label>
                                                        <div className="text-sm text-text-primary font-mono">{documentDetails.id}</div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-text-muted">Content:</label>
                                                        <div className="text-sm text-text-primary">{documentDetails.content}</div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-text-muted">Metadata:</label>
                                                        <ConfigurableJsonViewer data={documentDetails.metadata} defaultDepth={2} />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-text-muted">Embedding Vector ({documentDetails.embedding?.length} dimensions):</label>
                                                        <div className="text-xs text-text-muted font-mono max-h-20 overflow-y-auto">
                                                            [{documentDetails.embedding?.slice(0, 10).map(v => v.toFixed(4)).join(', ')}...]
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'testing' && (
                            <div>
                                <h4 className="text-lg font-medium text-text-primary mb-4">Similarity Testing</h4>
                                {!selectedCollection ? (
                                    <div className="text-center py-8">
                                        <p className="text-text-secondary">Select a collection from the Overview tab to test similarity queries.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="card rounded p-4">
                                            <h5 className="font-medium text-text-primary mb-3">Test Query - {selectedCollection}</h5>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm text-text-primary mb-1">Query Text:</label>
                                                    <input
                                                        type="text"
                                                        value={testQuery}
                                                        onChange={(e) => setTestQuery(e.target.value)}
                                                        placeholder="Enter text to find similar documents..."
                                                        className="input-field w-full"
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <select
                                                        value={filterArchetype}
                                                        onChange={(e) => setFilterArchetype(e.target.value)}
                                                        className="input-field text-sm py-1"
                                                    >
                                                        <option value="">All Archetypes</option>
                                                        {availableArchetypes.map(a => (
                                                            <option key={a} value={a}>{a}</option>
                                                        ))}
                                                    </select>
                                                    <select
                                                        value={filterCategory}
                                                        onChange={(e) => setFilterCategory(e.target.value)}
                                                        className="input-field text-sm py-1"
                                                    >
                                                        <option value="">All Categories</option>
                                                        {availableCategories.map(c => (
                                                            <option key={c} value={c}>{c}</option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={handleTestQuery}
                                                        disabled={!testQuery.trim() || testLoading}
                                                        className="btn-accent-gradient disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1 rounded"
                                                    >
                                                        {testLoading ? 'Testing...' : 'Test Query'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {testResults && (
                                            <div className="card rounded p-4">
                                                <h5 className="font-medium text-text-primary mb-3">
                                                    Results for: "{testResults.query}" ({testResults.results?.length || 0} matches)
                                                </h5>
                                                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                                                    {testResults.results?.map((result, index) => (
                                                        <div key={index} className="card-surface rounded p-3">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="text-sm font-medium text-accent-primary">{result.name}</div>
                                                                <div className="text-xs text-text-secondary">
                                                                    Similarity: {(result.similarity * 100).toFixed(1)}%
                                                                </div>
                                                            </div>
                                                            <div className="text-sm text-text-primary">{result.content}</div>
                                                            <div className="text-xs text-text-secondary mt-1">
                                                                {result.archetype} → {result.category}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RAGCollectionManager;
