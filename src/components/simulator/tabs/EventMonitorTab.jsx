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
        <div className="p-4 bg-gradient-to-br from-neutral-800 to-neutral-900 min-h-full">
            {/* Header Section */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Event Monitor</h3>
                        <p className="text-gray-400 text-sm">Real-time Event Tracking • Message History • System Activity</p>
                    </div>
                </div>
            </div>

            {connectionStatus !== 'connected' ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <p className="text-gray-400 text-lg">Please connect to an entity first</p>
                    <p className="text-gray-500 text-sm mt-1">Use the Connection tab to simulate an entity</p>
                </div>
            ) : (
                <div className="space-y-5">
                    {/* Event Monitor Controls */}
                    <div className="bg-neutral-800/50 backdrop-blur-sm rounded-xl border border-neutral-700/50 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 border-b border-cyan-500/20 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white">Monitor Controls</h4>
                                    <p className="text-cyan-300/70 text-sm">Configure event display and refresh data</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium text-gray-300">View Mode:</label>
                                        <select
                                            value={useGroupedView ? 'grouped' : 'individual'}
                                            onChange={(e) => setUseGroupedView(e.target.value === 'grouped')}
                                            className="p-2 bg-neutral-700 border border-neutral-600 rounded-lg text-neutral-100 text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-colors"
                                        >
                                            <option value="grouped">📊 Grouped Events</option>
                                            <option value="individual">📋 Individual Events</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                        <span>Live Monitoring</span>
                                    </div>
                                </div>
                                <button
                                    onClick={onLoadEventHistory}
                                    className="bg-cyan-600 hover:bg-cyan-500 font-medium py-2 px-4 text-white rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Refresh Events
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Event History Display */}
                    <div className="bg-neutral-800/50 backdrop-blur-sm rounded-xl border border-neutral-700/50 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500/10 to-blue-600/10 border-b border-blue-500/20 p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className="text-lg font-semibold text-white">Event History</h4>
                                        <p className="text-blue-300/70 text-sm">
                                            {useGroupedView ? 'Correlated event groups with related activities' : 'Individual event timeline with full details'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {useGroupedView ? (
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                                            <span>{groupedEventHistory.length} groups</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                            <span>{eventHistory.length} events</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-4">
                            {useGroupedView ? (
                                <div className="space-y-4">
                                    {groupedEventHistory.length === 0 ? (
                                        <div className="text-center py-8">
                                            <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                </svg>
                                            </div>
                                            <p className="text-gray-400 text-lg">No event groups recorded yet</p>
                                            <p className="text-gray-500 text-sm mt-1">Start interacting with modules to see grouped events</p>
                                        </div>
                                    ) : (
                                        <GroupedEventHistoryDisplay groups={groupedEventHistory} />
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {eventHistory.length === 0 ? (
                                        <div className="text-center py-8">
                                            <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center mx-auto mb-3">
                                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <p className="text-gray-400 text-lg">No events recorded yet</p>
                                            <p className="text-gray-500 text-sm mt-1">Start interacting with modules to see event history</p>
                                        </div>
                                    ) : (
                                        <EventHistoryDisplay events={eventHistory} />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Event Statistics */}
                    <div className="bg-neutral-800/50 backdrop-blur-sm rounded-xl border border-neutral-700/50 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border-b border-purple-500/20 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-purple-500/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white">Session Statistics</h4>
                                    <p className="text-purple-300/70 text-sm">Event activity summary and performance metrics</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-neutral-700/30 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-blue-400">{eventHistory.length}</div>
                                    <div className="text-xs text-gray-400 mt-1">Total Events</div>
                                </div>
                                <div className="bg-neutral-700/30 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-orange-400">{groupedEventHistory.length}</div>
                                    <div className="text-xs text-gray-400 mt-1">Event Groups</div>
                                </div>
                                <div className="bg-neutral-700/30 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-green-400">
                                        {eventHistory.filter(e => e.event?.status === 'SUCCESS').length}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">Successful</div>
                                </div>
                                <div className="bg-neutral-700/30 rounded-lg p-4 text-center">
                                    <div className="text-2xl font-bold text-red-400">
                                        {eventHistory.filter(e => e.event?.status === 'ERROR').length}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">Errors</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default EventMonitorTab;
