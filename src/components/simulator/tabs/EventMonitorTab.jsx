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
        <div className="p-4 min-h-full">
            {/* Header with Statistics */}
            <div className="mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-accent-primary/15 rounded-lg flex items-center justify-center shadow-lg shadow-accent-primary/10">
                            <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-text-primary">Event Monitor</h3>
                            <p className="text-text-muted text-xs">Real-time Event Tracking • Message History • System Activity</p>
                        </div>
                    </div>
                    {connectionStatus === 'connected' && (
                        <div className="flex items-center gap-3">
                            <div className="bg-background-surface/30 backdrop-blur-sm rounded-lg border border-border-glass px-3 py-1.5">
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="text-center">
                                        <div className="text-sm font-bold text-accent-primary">{eventHistory.length}</div>
                                        <div className="text-xs text-text-muted">Total</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-sm font-bold text-accent-secondary">{groupedEventHistory.length}</div>
                                        <div className="text-xs text-text-muted">Groups</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-sm font-bold text-success">
                                            {eventHistory.filter(e => e.event?.status === 'SUCCESS').length}
                                        </div>
                                        <div className="text-xs text-text-muted">Success</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-sm font-bold text-error">
                                            {eventHistory.filter(e => e.event?.status === 'ERROR').length}
                                        </div>
                                        <div className="text-xs text-text-muted">Errors</div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-success">
                                <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></div>
                                <span className="font-medium">Live</span>
                            </div>
                        </div>
                    )}
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
                    <p className="text-text-muted/60 text-xs mt-1">Use the Connection tab to simulate an entity</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* Event History with Controls */}
                    <div className="card">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                    <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-text-primary">Event History</h4>
                                    <p className="text-text-muted text-xs">
                                        {useGroupedView ? 'Correlated event groups' : 'Individual event timeline'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-text-secondary">View:</label>
                                <select
                                    value={useGroupedView ? 'grouped' : 'individual'}
                                    onChange={(e) => setUseGroupedView(e.target.value === 'grouped')}
                                    className="input-field text-xs py-1"
                                >
                                    <option value="grouped">Grouped</option>
                                    <option value="individual">Individual</option>
                                </select>
                                <button
                                    onClick={onLoadEventHistory}
                                    className="module-action-btn text-accent-primary border-accent-primary/30"
                                >
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                    </svg>
                                    Refresh
                                </button>
                                <div className="flex items-center gap-1.5">
                                    <div className={`w-1.5 h-1.5 rounded-full ${useGroupedView ? 'bg-accent-secondary' : 'bg-accent-primary'}`}></div>
                                    <span className="text-xs text-text-muted">
                                        {useGroupedView ? groupedEventHistory.length : eventHistory.length}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div>
                            {useGroupedView ? (
                                groupedEventHistory.length === 0 ? (
                                    <div className="text-center py-10">
                                        <div className="w-10 h-10 bg-background-surface/40 rounded-full flex items-center justify-center mx-auto mb-2 border border-border-glass">
                                            <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                        </div>
                                        <p className="text-text-muted text-sm">No event groups recorded yet</p>
                                        <p className="text-text-muted/60 text-xs mt-1">Start interacting with modules</p>
                                    </div>
                                ) : (
                                    <GroupedEventHistoryDisplay groups={groupedEventHistory} />
                                )
                            ) : (
                                eventHistory.length === 0 ? (
                                    <div className="text-center py-10">
                                        <div className="w-10 h-10 bg-background-surface/40 rounded-full flex items-center justify-center mx-auto mb-2 border border-border-glass">
                                            <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <p className="text-text-muted text-sm">No events recorded yet</p>
                                        <p className="text-text-muted/60 text-xs mt-1">Start interacting with modules</p>
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
