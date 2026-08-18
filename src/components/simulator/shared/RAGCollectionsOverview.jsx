import React from 'react';

// RAG Collections Overview Component
function RAGCollectionsOverview({ collections, loading, onOpenManager, onRefresh }) {
    if (loading) {
        return (
            <div className="bg-background-surface/40 rounded-lg p-4 border border-border-glass">
                <div className="flex items-center gap-2 text-text-muted text-sm">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-primary"></div>
                    Loading collections...
                </div>
            </div>
        );
    }

    const totalDocuments = collections.reduce((sum, collection) => sum + collection.documentCount, 0);

    return (
        <div className="bg-background-surface-translucent backdrop-blur-sm rounded-lg p-4 border border-border-glass">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h5 className="font-semibold text-accent-primary">Collections Summary</h5>
                    <p className="text-sm text-text-muted">
                        {collections.length} collection{collections.length !== 1 ? 's' : ''}, {totalDocuments} total documents
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={onRefresh}
                        className="module-action-btn text-accent-primary border-accent-primary/30"
                    >
                        <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        Refresh
                    </button>
                    <button
                        onClick={onOpenManager}
                        className="btn-primary text-sm py-1.5 px-4"
                    >
                        Manage Collections
                    </button>
                </div>
            </div>

            {collections.length === 0 ? (
                <div className="text-center py-8">
                    <div className="text-text-muted mb-2">No collections found</div>
                    <div className="text-xs text-text-muted/60">
                        Collections are created automatically when you sync actions to the RAG module
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {collections.map(collection => (
                        <div key={collection.name} className="card-surface p-3">
                            <div className="flex justify-between items-start mb-2">
                                <h6 className="font-semibold text-text-primary text-sm">{collection.name}</h6>
                                <span className="text-xs bg-accent-primary/15 text-accent-primary px-2 py-1 rounded-lg font-semibold">
                                    {collection.documentCount}
                                </span>
                            </div>
                            <div className="text-xs text-text-muted space-y-1">
                                <div>Embedding Dim: {collection.embeddingDim}</div>
                                <div>Updated: {new Date(collection.lastUpdated).toLocaleDateString()}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {collections.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border-glass">
                    <div className="text-xs text-text-muted">
                        Use the Collection Manager to view, edit, and organize your vector embeddings
                    </div>
                </div>
            )}
        </div>
    );
}

export default RAGCollectionsOverview;
