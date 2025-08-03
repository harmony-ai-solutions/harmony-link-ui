import React from 'react';

// RAG Collections Overview Component
function RAGCollectionsOverview({ collections, loading, onOpenManager, onRefresh }) {
    if (loading) {
        return (
            <div className="bg-neutral-700 rounded p-4">
                <div className="flex items-center text-yellow-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400 mr-2"></div>
                    Loading collections...
                </div>
            </div>
        );
    }

    const totalDocuments = collections.reduce((sum, collection) => sum + collection.documentCount, 0);

    return (
        <div className="bg-neutral-700 rounded p-4">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h5 className="font-medium text-orange-400">Collections Summary</h5>
                    <p className="text-sm text-gray-400">
                        {collections.length} collection{collections.length !== 1 ? 's' : ''}, {totalDocuments} total documents
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onRefresh}
                        className="text-xs bg-neutral-600 hover:bg-neutral-500 text-gray-300 px-3 py-1 rounded"
                    >
                        🔄 Refresh
                    </button>
                    <button
                        onClick={onOpenManager}
                        className="text-sm bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded font-medium"
                    >
                        📊 Manage Collections
                    </button>
                </div>
            </div>

            {collections.length === 0 ? (
                <div className="text-center py-6">
                    <div className="text-gray-400 mb-2">No collections found</div>
                    <div className="text-xs text-gray-500">
                        Collections are created automatically when you sync actions to the RAG module
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {collections.map(collection => (
                        <div key={collection.name} className="bg-neutral-600 rounded p-3">
                            <div className="flex justify-between items-start mb-2">
                                <h6 className="font-medium text-gray-300">{collection.name}</h6>
                                <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded">
                                    {collection.documentCount}
                                </span>
                            </div>
                            <div className="text-xs text-gray-400 space-y-1">
                                <div>Embedding Dim: {collection.embeddingDim}</div>
                                <div>Updated: {new Date(collection.lastUpdated).toLocaleDateString()}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {collections.length > 0 && (
                <div className="mt-4 pt-3 border-t border-neutral-600">
                    <div className="text-xs text-gray-400">
                        💡 Use the Collection Manager to view, edit, and organize your vector embeddings
                    </div>
                </div>
            )}
        </div>
    );
}

export default RAGCollectionsOverview;
