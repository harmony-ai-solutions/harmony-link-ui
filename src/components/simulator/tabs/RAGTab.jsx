import React from 'react';
import RAGConfigurationDisplay from '../config/RAGConfigurationDisplay';
import RAGSyncActionsForm from '../forms/RAGSyncActionsForm';
import RAGMatchActionsForm from '../forms/RAGMatchActionsForm';
import RAGCollectionsOverview from '../shared/RAGCollectionsOverview';
import FormResponseDisplay from '../shared/FormResponseDisplay';

function RAGTab({ 
    connectionStatus, 
    moduleConfigs, 
    moduleConfigsLoading, 
    moduleConfigErrors, 
    formResponses, 
    onSendEvent, 
    onClearFormResponse,
    ragCollections,
    ragCollectionsLoading,
    onOpenCollectionManager,
    onRefreshCollections
}) {
    return (
        <div className="p-4 min-h-full">
            <div className="mb-4">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 bg-accent-primary/15 rounded-lg flex items-center justify-center shadow-lg shadow-accent-primary/10">
                        <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-text-primary">RAG Module Simulation</h3>
                        <p className="text-text-muted text-xs">Retrieval-Augmented Generation • Vector Embeddings • Action Matching</p>
                    </div>
                </div>
            </div>

            {connectionStatus !== 'connected' ? (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-14 h-14 bg-background-surface/40 rounded-2xl flex items-center justify-center mb-3 border border-border-glass">
                        <svg className="w-7 h-7 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <p className="text-text-muted">Please connect to an entity first</p>
                    <p className="text-text-muted/60 text-sm mt-1">Use the Connection tab to simulate an entity</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-text-primary">Configuration</h4>
                                <p className="text-text-muted text-xs">Current RAG provider and settings</p>
                            </div>
                        </div>
                        <RAGConfigurationDisplay 
                            config={moduleConfigs.rag}
                            loading={moduleConfigsLoading}
                            error={moduleConfigErrors.rag}
                        />
                    </div>

                    <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-text-primary">Vector Collections</h4>
                                <p className="text-text-muted text-xs">Manage your vector embeddings and documents</p>
                            </div>
                        </div>
                        <RAGCollectionsOverview 
                            collections={ragCollections}
                            loading={ragCollectionsLoading}
                            onOpenManager={onOpenCollectionManager}
                            onRefresh={onRefreshCollections}
                        />
                    </div>

                    <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-text-primary">Event Simulation</h4>
                                <p className="text-text-muted text-xs">Test RAG functionality with sync and match operations</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                            <div className="card-compact">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                        <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </div>
                                    <h5 className="text-xs font-semibold text-text-primary">Sync Actions</h5>
                                </div>
                                <RAGSyncActionsForm 
                                    onSendEvent={(event) => onSendEvent(event, 'rag')} 
                                    formState={formResponses.rag}
                                    onClearResponse={() => onClearFormResponse('rag')}
                                />
                            </div>

                            <div className="card-compact">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                        <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </div>
                                    <h5 className="text-xs font-semibold text-text-primary">Match Actions</h5>
                                </div>
                                <RAGMatchActionsForm 
                                    onSendEvent={(event) => onSendEvent(event, 'rag')} 
                                    formState={formResponses.rag}
                                    onClearResponse={() => onClearFormResponse('rag')}
                                />
                            </div>
                        </div>

                        <div className="mt-3">
                            <FormResponseDisplay 
                                formState={formResponses.rag}
                                onClear={() => onClearFormResponse('rag')}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default RAGTab;
