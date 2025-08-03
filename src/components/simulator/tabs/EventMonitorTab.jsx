import React from 'react';
import EventHistoryDisplay from '../shared/EventHistoryDisplay';
import GroupedEventHistoryDisplay from '../shared/GroupedEventHistoryDisplay';

function EventMonitorTab({ 
    connectionStatus, 
    eventHistory, 
    groupedEventHistory, 
    useGroupedView, 
    setUseGroupedView, 
    onLoadEventHistory 
}) {
    return (
        <div className="p-3 bg-gradient-to-br from-neutral-800 to-neutral-900 min-h-full">
            {/* Header with Statistics */}
            <div className="mb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Event Monitor</h3>
                            <p className="text-gray-400 text-xs">Real-time Event Tracking • Message History • System Activity</p>
                        </div>
                    </div>
                    {connectionStatus === 'connected' && (
                        <div className="flex items-center gap-2">
                            <div className="bg-neutral-800/50 backdrop-blur-sm rounded border border-neutral-700/50 p-1.5">
                                <div className="grid grid-cols-4 gap-2">
                                    <div className="text-center">
                                        <div className="text-sm font-bold text-blue-400">{eventHistory.length}</div>
                                        <div className="text-xs text-gray-400">Total</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-sm font-bold text-orange-400">{groupedEventHistory.length}</div>
                                        <div className="text-xs text-gray-400">Groups</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-sm font-bold text-green-400">
                                            {eventHistory.filter(e => e.event?.status === 'SUCCESS').length}
                                        </div>
                                        <div className="text-xs text-gray-400">Success</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-sm font-bold text-red-400">
                                            {eventHistory.filter(e => e.event?.status === 'ERROR').length}
                                        </div>
                                        <div className="text-xs text-gray-400">Errors</div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                                <span>Live</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {connectionStatus !== 'connected' ? (
                <div className="flex flex-col items-center justify-center py-8">
                    <div className="w-10 h-10 bg-neutral-700 rounded-full flex items-center justify-center mb-2">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <p className="text-gray-400">Please connect to an entity first</p>
                    <p className="text-gray-500 text-xs mt-1">Use the Connection tab to simulate an entity</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Event History with Controls */}
                    <div className="bg-neutral-800/50 backdrop-blur-sm rounded-lg border border-neutral-700/50 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border-b border-blue-500/20 p-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 bg-blue-500/20 rounded flex items-center justify-center">
                                        <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-white">Event History</h4>
                                        <p className="text-blue-300/70 text-xs">
                                            {useGroupedView ? 'Correlated event groups' : 'Individual event timeline'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                        <label className="text-xs font-medium text-gray-300">View:</label>
                                        <select
                                            value={useGroupedView ? 'grouped' : 'individual'}
                                            onChange={(e) => setUseGroupedView(e.target.value === 'grouped')}
                                            className="p-1 bg-neutral-700 border border-neutral-600 rounded text-neutral-100 text-xs focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
                                        >
                                            <option value="grouped">📊 Grouped</option>
                                            <option value="individual">📋 Individual</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={onLoadEventHistory}
                                        className="bg-blue-800 hover:bg-blue-600 cursor-pointer font-medium py-1 px-2 text-white rounded text-xs transition-colors flex items-center gap-1"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        Refresh
                                    </button>
                                    <div className="flex items-center gap-1">
                                        <div className={`w-1.5 h-1.5 rounded-full ${useGroupedView ? 'bg-orange-400' : 'bg-blue-400'}`}></div>
                                        <span className="text-xs text-gray-400">
                                            {useGroupedView ? groupedEventHistory.length : eventHistory.length}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="p-2">
                            {useGroupedView ? (
                                groupedEventHistory.length === 0 ? (
                                    <div className="text-center py-6">
                                        <div className="w-8 h-8 bg-neutral-700 rounded-full flex items-center justify-center mx-auto mb-2">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                        </div>
                                        <p className="text-gray-400 text-sm">No event groups recorded yet</p>
                                        <p className="text-gray-500 text-xs mt-1">Start interacting with modules</p>
                                    </div>
                                ) : (
                                    <GroupedEventHistoryDisplay groups={groupedEventHistory} />
                                )
                            ) : (
                                eventHistory.length === 0 ? (
                                    <div className="text-center py-6">
                                        <div className="w-8 h-8 bg-neutral-700 rounded-full flex items-center justify-center mx-auto mb-2">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <p className="text-gray-400 text-sm">No events recorded yet</p>
                                        <p className="text-gray-500 text-xs mt-1">Start interacting with modules</p>
                                    </div>
                                ) : (
                                    <EventHistoryDisplay events={eventHistory} />
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default EventMonitorTab;
