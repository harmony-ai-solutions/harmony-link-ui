import {useEffect, useState} from "react";
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
} from "../../services/managementApiService.js";
import ConfigurableJsonViewer from "../widgets/ConfigurableJsonViewer.jsx";

const RAGCollectionManager = ({ entityId, isOpen, onClose, onError }) => {
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

    // Collections management functions
    const loadCollections = async () => {
        if (!entityId) return;
        setCollectionsLoading(true);
        try {
            const response = await getEntityRAGCollections(entityId);
            setCollections(response.collections || []);
        } catch (error) {
            console.error('Failed to load collections:', error);
            onError('Failed to load collections: ' + error.message);
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
            onError('Failed to load collection details: ' + error.message);
        }
    };

    const loadDocuments = async (collectionName, archetype = '', category = '') => {
        if (!entityId || !collectionName) return;
        try {
            const response = await getEntityRAGCollectionDocuments(entityId, collectionName, archetype, category);
            setDocuments(response.documents || []);
        } catch (error) {
            console.error('Failed to load documents:', error);
            onError('Failed to load documents: ' + error.message);
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
            onError('Failed to load document details: ' + error.message);
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
            onError('Failed to delete document: ' + error.message);
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
            onError('Failed to test query: ' + error.message);
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
            onError('Failed to load grouped view: ' + error.message);
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
            onError('Failed to load group documents: ' + error.message);
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
            onError('Failed to add document: ' + error.message);
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
            onError('Failed to delete group: ' + error.message);
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
            <div className="bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl w-full max-w-7xl h-full max-h-[95vh] flex flex-col">
                {/* Modal Header */}
                <div className="flex justify-between items-center p-6 border-b border-neutral-700 bg-neutral-800 rounded-t-lg">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-white">
                                RAG Collections Management
                            </h3>
                            <p className="text-sm text-gray-400">Entity: {entityId}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-neutral-700 rounded-lg"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-neutral-700 bg-neutral-800">
                    {['overview', 'grouped', 'documents', 'testing'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 font-medium capitalize transition-all duration-200 ${
                                activeTab === tab
                                    ? 'bg-orange-500 text-white border-b-2 border-orange-400'
                                    : 'text-gray-300 hover:text-white hover:bg-neutral-700'
                            }`}
                        >
                            {tab === 'grouped' ? 'Grouped View' : tab}
                        </button>
                    ))}
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-hidden">
                    <div className="h-full overflow-y-auto p-6 custom-scrollbar">
                        {activeTab === 'overview' && (
                            <div>
                                <h4 className="text-lg font-medium text-gray-300 mb-4">Collections Overview</h4>
                                {collectionsLoading ? (
                                    <div className="text-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400 mx-auto"></div>
                                        <p className="text-gray-400 mt-2">Loading collections...</p>
                                    </div>
                                ) : collections.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-gray-400">No collections found for this entity.</p>
                                        <p className="text-gray-500 text-sm mt-2">
                                            Collections are created automatically when actions are synced to the RAG module.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {collections.map(collection => (
                                            <div key={collection.name} className="bg-neutral-700 rounded-lg p-4">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h5 className="font-medium text-orange-400">{collection.name}</h5>
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => {
                                                                loadGroupedView(collection.name);
                                                                setActiveTab('grouped');
                                                            }}
                                                            className="text-xs bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded"
                                                        >
                                                            Groups
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                loadCollectionDetails(collection.name);
                                                                setActiveTab('documents');
                                                            }}
                                                            className="text-xs bg-neutral-600 hover:bg-neutral-500 text-gray-300 px-2 py-1 rounded"
                                                        >
                                                            Browse
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="text-sm text-gray-300 space-y-1">
                                                    <div>Documents: {collection.documentCount}</div>
                                                    <div>Embedding Dim: {collection.embeddingDim}</div>
                                                    <div className="text-xs text-gray-400">
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
                                <h4 className="text-lg font-medium text-gray-300 mb-4">
                                    Grouped View {selectedCollection ? `- ${selectedCollection}` : ''}
                                </h4>
                                {!selectedCollection ? (
                                    <div className="text-center py-8">
                                        <p className="text-gray-400">Select a collection from the Overview tab to view groups.</p>
                                    </div>
                                ) : groupedLoading ? (
                                    <div className="text-center py-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-400 mx-auto"></div>
                                        <p className="text-gray-400 mt-2">Loading groups...</p>
                                    </div>
                                ) : !groupedView || Object.keys(groupedView.groups || {}).length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-gray-400">No groups found in this collection.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {/* Groups Tree */}
                                        <div>
                                            <h5 className="font-medium text-gray-300 mb-2">Groups ({groupedView.totalDocuments} total documents)</h5>
                                            <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                                                {Object.entries(groupedView.groups).map(([archetype, groups]) => (
                                                    <div key={archetype} className="bg-neutral-700 rounded p-3">
                                                        <div className="font-medium text-orange-400 mb-2">📁 {archetype}</div>
                                                        <div className="space-y-1 ml-4">
                                                            {groups.map(group => (
                                                                <div key={group.name} className="bg-neutral-600 rounded p-2">
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="flex-1">
                                                                            <div 
                                                                                className={`font-medium cursor-pointer ${
                                                                                    selectedGroup?.archetype === archetype && selectedGroup?.name === group.name
                                                                                        ? 'text-orange-400'
                                                                                        : 'text-gray-300 hover:text-orange-300'
                                                                                }`}
                                                                                onClick={() => loadGroupDocuments(selectedCollection, archetype, group.name)}
                                                                            >
                                                                                📋 {group.name}
                                                                            </div>
                                                                            <div className="text-xs text-gray-400 mt-1">
                                                                                {group.documentCount} documents
                                                                            </div>
                                                                            <div className="flex gap-2 mt-1">
                                                                                {Object.entries(group.categories).map(([category, count]) => (
                                                                                    <span key={category} className="text-xs bg-neutral-500 text-gray-300 px-1 rounded">
                                                                                        📄 {category} ({count})
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleDeleteGroup(archetype, group.name)}
                                                                            className="text-red-400 hover:text-red-300 ml-2"
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
                                                <h5 className="font-medium text-gray-300">Group Details</h5>
                                                {selectedGroup && (
                                                    <button
                                                        onClick={() => setAddingToGroup(selectedGroup)}
                                                        className="text-xs bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded"
                                                    >
                                                        ➕ Add Document
                                                    </button>
                                                )}
                                            </div>
                                            {!groupDocuments ? (
                                                <div className="bg-neutral-700 rounded p-4 text-center text-gray-400">
                                                    Select a group to view details
                                                </div>
                                            ) : (
                                                <div className="bg-neutral-700 rounded p-4 space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                                                    <div className="text-sm text-gray-300 mb-3">
                                                        <strong>{groupDocuments.archetype}</strong> → <strong>{groupDocuments.name}</strong>
                                                        <span className="text-gray-400"> ({groupDocuments.totalCount} documents)</span>
                                                    </div>
                                                    
                                                    {Object.entries(groupDocuments.categories).map(([category, docs]) => (
                                                        <div key={category} className="border-l-2 border-orange-400 pl-3">
                                                            <div className="font-medium text-orange-400 mb-2">📄 {category} ({docs.length})</div>
                                                            <div className="space-y-2">
                                                                {docs.map(doc => (
                                                                    <div key={doc.id} className="bg-neutral-600 rounded p-2">
                                                                        <div className="flex justify-between items-start">
                                                                            <div className="flex-1">
                                                                                {editingDocument === doc.id ? (
                                                                                    <div className="space-y-2">
                                                                                        <textarea
                                                                                            value={editContent}
                                                                                            onChange={(e) => setEditContent(e.target.value)}
                                                                                            className="w-full bg-neutral-500 text-gray-300 p-2 rounded text-sm"
                                                                                            rows="3"
                                                                                        />
                                                                                        {updateError && (
                                                                                            <div className="text-red-400 text-xs">{updateError}</div>
                                                                                        )}
                                                                                        <div className="flex gap-2">
                                                                                            <button
                                                                                                onClick={() => handleUpdateDocument(doc.id, editContent)}
                                                                                                disabled={updateLoading}
                                                                                                className="text-xs bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white px-2 py-1 rounded"
                                                                                            >
                                                                                                {updateLoading ? 'Saving...' : 'Save'}
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    setEditingDocument(null);
                                                                                                    setEditContent('');
                                                                                                    setUpdateError(null);
                                                                                                }}
                                                                                                className="text-xs bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded"
                                                                                            >
                                                                                                Cancel
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-sm text-gray-300">{doc.content}</div>
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
                                                                                        className="text-blue-400 hover:text-blue-300"
                                                                                        title="Edit document"
                                                                                    >
                                                                                        ✏️
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            if (confirm('Are you sure you want to delete this document?')) {
                                                                                                handleDeleteDocument(selectedCollection, doc.id);
                                                                                                // Refresh group documents after delete
                                                                                                setTimeout(() => {
                                                                                                    if (selectedGroup) {
                                                                                                        loadGroupDocuments(selectedCollection, selectedGroup.archetype, selectedGroup.name);
                                                                                                    }
                                                                                                }, 500);
                                                                                            }
                                                                                        }}
                                                                                        className="text-red-400 hover:text-red-300"
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
                                    <div className="fixed inset-0 bg-gray-600/50 z-50">
                                        <div className="relative top-20 mx-auto p-4 border border-neutral-800 w-96 shadow-lg rounded-md bg-neutral-900">
                                            <h3 className="text-lg font-medium text-orange-400 mb-4">
                                                Add Document to {addingToGroup.archetype} → {addingToGroup.name}
                                            </h3>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm text-gray-300 mb-1">Category:</label>
                                                    <input
                                                        value={addingCategory}
                                                        onChange={(e) => setAddingCategory(e.target.value)}
                                                        className="w-full bg-neutral-600 border border-neutral-500 rounded px-3 py-2 text-gray-300"
                                                        placeholder="example, confirmation, rejection, etc."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm text-gray-300 mb-1">Content:</label>
                                                    <textarea
                                                        value={newDocumentContent}
                                                        onChange={(e) => setNewDocumentContent(e.target.value)}
                                                        placeholder="Enter document content..."
                                                        className="w-full bg-neutral-600 border border-neutral-500 rounded px-3 py-2 text-gray-300"
                                                        rows="4"
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleAddDocumentToGroup}
                                                        disabled={!newDocumentContent.trim() || !addingCategory}
                                                        className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white px-4 py-2 rounded"
                                                    >
                                                        Add Document
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setAddingToGroup(null);
                                                            setNewDocumentContent('');
                                                            setAddingCategory('');
                                                        }}
                                                        className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded"
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
                                    <h4 className="text-lg font-medium text-gray-300">
                                        Documents {selectedCollection ? `- ${selectedCollection}` : ''}
                                    </h4>
                                    <div className="flex gap-2">
                                        <select
                                            value={filterArchetype}
                                            onChange={(e) => setFilterArchetype(e.target.value)}
                                            className="bg-neutral-600 border border-neutral-500 rounded px-2 py-1 text-sm text-gray-300"
                                        >
                                            <option value="">All Archetypes</option>
                                            <option value="movementAction">Movement Action</option>
                                        </select>
                                        <select
                                            value={filterCategory}
                                            onChange={(e) => setFilterCategory(e.target.value)}
                                            className="bg-neutral-600 border border-neutral-500 rounded px-2 py-1 text-sm text-gray-300"
                                        >
                                            <option value="">All Categories</option>
                                            <option value="example">Examples</option>
                                            <option value="confirmation">Confirmations</option>
                                            <option value="rejection">Rejections</option>
                                        </select>
                                    </div>
                                </div>

                                {!selectedCollection ? (
                                    <div className="text-center py-8">
                                        <p className="text-gray-400">Select a collection from the Overview tab to browse documents.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {/* Documents List */}
                                        <div>
                                            <h5 className="font-medium text-gray-300 mb-2">Documents ({documents.length})</h5>
                                            <div className="space-y-2 max-h-96 overflow-y-auto px-1 custom-scrollbar">
                                                {documents.map(doc => (
                                                    <div
                                                        key={doc.id}
                                                        className={`p-3 rounded cursor-pointer ${
                                                            selectedDocument === doc.id
                                                                ? 'bg-orange-600 text-white'
                                                                : 'bg-neutral-700 hover:bg-neutral-600 text-gray-300'
                                                        }`}
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
                                                                className="text-red-400 hover:text-red-300 ml-2"
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
                                            <h5 className="font-medium text-gray-300 mb-2">Document Details</h5>
                                            {!documentDetails ? (
                                                <div className="bg-neutral-700 rounded p-4 text-center text-gray-400">
                                                    Select a document to view details
                                                </div>
                                            ) : (
                                                <div className="bg-neutral-700 rounded p-4 space-y-3">
                                                    <div>
                                                        <label className="text-xs text-gray-400">ID:</label>
                                                        <div className="text-sm text-gray-300 font-mono">{documentDetails.id}</div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-400">Content:</label>
                                                        <div className="text-sm text-gray-300">{documentDetails.content}</div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-400">Metadata:</label>
                                                        <ConfigurableJsonViewer data={documentDetails.metadata} defaultDepth={2} />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-gray-400">Embedding Vector ({documentDetails.embedding?.length} dimensions):</label>
                                                        <div className="text-xs text-gray-500 font-mono max-h-20 overflow-y-auto">
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
                                <h4 className="text-lg font-medium text-gray-300 mb-4">Similarity Testing</h4>
                                {!selectedCollection ? (
                                    <div className="text-center py-8">
                                        <p className="text-gray-400">Select a collection from the Overview tab to test similarity queries.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="bg-neutral-700 rounded p-4">
                                            <h5 className="font-medium text-gray-300 mb-3">Test Query - {selectedCollection}</h5>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm text-gray-300 mb-1">Query Text:</label>
                                                    <input
                                                        type="text"
                                                        value={testQuery}
                                                        onChange={(e) => setTestQuery(e.target.value)}
                                                        placeholder="Enter text to find similar documents..."
                                                        className="w-full bg-neutral-600 border border-neutral-500 rounded px-3 py-2 text-gray-300"
                                                    />
                                                </div>
                                                <div className="flex gap-2">
                                                    <select
                                                        value={filterArchetype}
                                                        onChange={(e) => setFilterArchetype(e.target.value)}
                                                        className="bg-neutral-600 border border-neutral-500 rounded px-2 py-1 text-sm text-gray-300"
                                                    >
                                                        <option value="">All Archetypes</option>
                                                        <option value="movementAction">Movement Action</option>
                                                    </select>
                                                    <select
                                                        value={filterCategory}
                                                        onChange={(e) => setFilterCategory(e.target.value)}
                                                        className="bg-neutral-600 border border-neutral-500 rounded px-2 py-1 text-sm text-gray-300"
                                                    >
                                                        <option value="">All Categories</option>
                                                        <option value="example">Examples</option>
                                                        <option value="confirmation">Confirmations</option>
                                                        <option value="rejection">Rejections</option>
                                                    </select>
                                                    <button
                                                        onClick={handleTestQuery}
                                                        disabled={!testQuery.trim() || testLoading}
                                                        className="bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 text-white px-4 py-1 rounded"
                                                    >
                                                        {testLoading ? 'Testing...' : 'Test Query'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {testResults && (
                                            <div className="bg-neutral-700 rounded p-4">
                                                <h5 className="font-medium text-gray-300 mb-3">
                                                    Results for: "{testResults.query}" ({testResults.results?.length || 0} matches)
                                                </h5>
                                                <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                                                    {testResults.results?.map((result, index) => (
                                                        <div key={index} className="bg-neutral-600 rounded p-3">
                                                            <div className="flex justify-between items-start mb-2">
                                                                <div className="text-sm font-medium text-orange-400">{result.name}</div>
                                                                <div className="text-xs text-gray-400">
                                                                    Similarity: {(result.similarity * 100).toFixed(1)}%
                                                                </div>
                                                            </div>
                                                            <div className="text-sm text-gray-300">{result.content}</div>
                                                            <div className="text-xs text-gray-400 mt-1">
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
