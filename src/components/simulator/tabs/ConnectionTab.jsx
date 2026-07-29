import React from 'react';

function ConnectionTab({ 
    entities, 
    selectedEntity, 
    setSelectedEntity, 
    connectionStatus, 
    feedback, 
    isLoading, 
    onConnect, 
    onDisconnect, 
    onLoadEntities,
    onSyncEntityState 
}) {
    return (
        <div className="p-4 min-h-full">
            {/* Compact Header */}
            <div className="mb-4">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 bg-accent-primary/15 rounded-lg flex items-center justify-center shadow-lg shadow-accent-primary/10">
                        <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-text-primary">Connection Management</h3>
                        <p className="text-text-muted text-xs">Entity Selection • Simulation Control • Connection Status</p>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {/* Entity Selection & Simulation Control Row */}
                <div className="flex gap-3 items-stretch">
                    {/* Entity Selection */}
                    <div className="flex-1 card">
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                    <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <span className="text-sm font-semibold text-text-primary">Entity Selection</span>
                            </div>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <select
                                    value={selectedEntity}
                                    onChange={(e) => {
                                        const newEntityId = e.target.value;
                                        setSelectedEntity(newEntityId);
                                        onSyncEntityState(newEntityId);
                                    }}
                                    className="flex-1 input-field text-xs py-1.5"
                                    disabled={isLoading}
                                >
                                    <option value="">Select an entity...</option>
                                    {entities.map(entity => (
                                        <option key={entity.id} value={entity.id}>
                                            {entity.id} {entity.is_simulated ? '(Simulated)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <button 
                                    onClick={onLoadEntities}
                                    className="module-action-btn text-accent-primary border-accent-primary/30"
                                    disabled={isLoading}
                                >
                                    <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    Refresh
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Simulation Control */}
                    <div className="card flex items-center shrink-0 py-1.5">
                        <div className="flex items-center gap-2">
                            <div className="w-3.5 h-3.5 bg-accent-primary/15 rounded flex items-center justify-center flex-shrink-0">
                                <svg className="w-2.5 h-2.5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <span className="text-xs font-semibold text-text-primary">Simulation</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={onConnect}
                                    disabled={isLoading || connectionStatus === 'connected' || !selectedEntity}
                                    className="module-action-btn-save"
                                >
                                    {isLoading && connectionStatus === 'connecting' ? (
                                        <div className="animate-spin rounded-full h-2.5 w-2.5 border-b-2 border-white mr-1"></div>
                                    ) : (
                                        <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                    )}
                                    Start
                                </button>
                                <button
                                    onClick={onDisconnect}
                                    disabled={isLoading || connectionStatus === 'disconnected' || !selectedEntity}
                                    className="module-action-btn-danger"
                                >
                                    {isLoading && connectionStatus === 'disconnecting' ? (
                                        <div className="animate-spin rounded-full h-2.5 w-2.5 border-b-2 border-white mr-1"></div>
                                    ) : (
                                        <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>
                                    )}
                                    Stop
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Entity Modules Section */}
                {selectedEntity && entities.find(e => e.id === selectedEntity) && (
                    <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-text-primary">Modules</h4>
                                <p className="text-text-muted text-xs">Configured modules for the currently selected entity</p>
                            </div>
                        </div>
                        <div>
                            {(() => {
                                const entity = entities.find(e => e.id === selectedEntity);
                                const modules = entity?.modules || {};
                                return (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {Object.entries(modules).map(([module, isActive]) => (
                                            <div key={module} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                                                isActive
                                                    ? 'bg-success/10 text-success border-success/25'
                                                    : 'bg-background-surface/30 text-text-muted border-border-glass'
                                            }`}>
                                                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-success' : 'bg-text-muted'}`}></div>
                                                <span className="font-semibold">{module.toUpperCase()}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                )}

                {/* Feedback Section */}
                {feedback && (
                    <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-text-primary">System Feedback</h4>
                                <p className="text-text-muted text-xs">Connection status and operation results</p>
                            </div>
                        </div>
                        <div className="bg-background-surface/40 rounded-lg p-3 border border-border-glass">
                            <pre className="text-sm font-mono text-text-secondary whitespace-pre-wrap">{feedback}</pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConnectionTab;
