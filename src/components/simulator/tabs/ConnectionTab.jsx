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
        <div className="p-4 bg-gradient-to-br from-neutral-800 to-neutral-900 min-h-full">
            {/* Header Section */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Connection Management</h3>
                        <p className="text-gray-400 text-sm">Entity Selection • Simulation Control • Connection Status</p>
                    </div>
                </div>
            </div>

            <div className="space-y-5">
                {/* Entity Selection Section */}
                <div className="bg-neutral-800/50 backdrop-blur-sm rounded-xl border border-neutral-700/50 overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border-b border-blue-500/20 p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-white">Entity Selection</h4>
                                <p className="text-blue-300/70 text-sm">Choose an entity from your configuration</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-4">
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Available Entities:
                                </label>
                                <select
                                    value={selectedEntity}
                                    onChange={(e) => {
                                        const newEntityId = e.target.value;
                                        setSelectedEntity(newEntityId);
                                        onSyncEntityState(newEntityId);
                                    }}
                                    className="w-full p-3 bg-neutral-700 border border-neutral-600 rounded-lg text-neutral-100 focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
                                    disabled={isLoading}
                                >
                                    <option value="">Select an entity...</option>
                                    {entities.map(entity => (
                                        <option key={entity.id} value={entity.id}>
                                            {entity.id} {entity.is_simulated ? '(Already Simulated)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button 
                                onClick={onLoadEntities}
                                className="bg-neutral-700 hover:bg-neutral-600 font-medium py-2 px-4 text-blue-400 rounded-lg transition-colors border border-neutral-600 hover:border-blue-400/50"
                                disabled={isLoading}
                            >
                                🔄 Refresh Entities
                            </button>
                        </div>
                    </div>
                </div>

                {/* Connection Control Section */}
                <div className="bg-neutral-800/50 backdrop-blur-sm rounded-xl border border-neutral-700/50 overflow-hidden">
                    <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 border-b border-green-500/20 p-4">
                        <div className="flex items-center gap-3">
                            <div className="w-7 h-7 bg-green-500/20 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-lg font-semibold text-white">Simulation Control</h4>
                                <p className="text-green-300/70 text-sm">Start and stop entity simulation</p>
                            </div>
                        </div>
                    </div>
                    <div className="p-4">
                        <div className="flex gap-4 mb-4">
                            <button
                                onClick={onConnect}
                                disabled={isLoading || connectionStatus === 'connected' || !selectedEntity}
                                className="flex-1 bg-green-600 hover:bg-green-500 disabled:bg-neutral-600 disabled:text-neutral-400 font-bold py-3 px-6 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isLoading && connectionStatus === 'connecting' ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Connecting...
                                    </span>
                                ) : (
                                    '▶️ Start Simulation'
                                )}
                            </button>
                            <button
                                onClick={onDisconnect}
                                disabled={isLoading || connectionStatus === 'disconnected' || !selectedEntity}
                                className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-neutral-600 disabled:text-neutral-400 font-bold py-3 px-6 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isLoading && connectionStatus === 'disconnecting' ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        Disconnecting...
                                    </span>
                                ) : (
                                    '⏹️ Stop Simulation'
                                )}
                            </button>
                        </div>

                        {/* Connection Status */}
                        <div className="bg-neutral-700/30 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-300">Connection Status:</span>
                                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                                    connectionStatus === 'connected' ? 'bg-green-500/20 text-green-400' : 
                                    connectionStatus === 'disconnected' ? 'bg-red-500/20 text-red-400' : 
                                    'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                    <div className={`w-2 h-2 rounded-full ${
                                        connectionStatus === 'connected' ? 'bg-green-400' : 
                                        connectionStatus === 'disconnected' ? 'bg-red-400' : 
                                        'bg-yellow-400'
                                    }`}></div>
                                    {connectionStatus.toUpperCase()}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Entity Information Section */}
                {selectedEntity && entities.find(e => e.id === selectedEntity) && (
                    <div className="bg-neutral-800/50 backdrop-blur-sm rounded-xl border border-neutral-700/50 overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-500/10 to-orange-600/10 border-b border-orange-500/20 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-orange-500/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white">Entity Information</h4>
                                    <p className="text-orange-300/70 text-sm">Configuration details and active modules</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="space-y-4">
                                <div className="bg-neutral-700/30 rounded-lg p-4">
                                    <div className="text-sm text-gray-300">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="font-semibold text-orange-400">Entity ID:</span>
                                            <span className="font-mono bg-neutral-600 px-2 py-1 rounded text-xs">{selectedEntity}</span>
                                        </div>
                                        {(() => {
                                            const entity = entities.find(e => e.id === selectedEntity);
                                            const modules = entity?.modules || {};
                                            return (
                                                <div>
                                                    <span className="font-semibold text-orange-400 block mb-2">Active Modules:</span>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                                        {Object.entries(modules).map(([module, isActive]) => (
                                                            <div key={module} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
                                                                isActive ? 'bg-green-600/20 text-green-400 border border-green-500/30' : 'bg-gray-600/20 text-gray-400 border border-gray-500/30'
                                                            }`}>
                                                                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                                                                <span className="font-medium">{module.toUpperCase()}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Feedback Section */}
                {feedback && (
                    <div className="bg-neutral-800/50 backdrop-blur-sm rounded-xl border border-neutral-700/50 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border-b border-purple-500/20 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white">System Feedback</h4>
                                    <p className="text-purple-300/70 text-sm">Connection status and operation results</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="bg-neutral-700/30 rounded-lg p-4">
                                <pre className="text-sm font-mono text-gray-300 whitespace-pre-wrap">{feedback}</pre>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ConnectionTab;
