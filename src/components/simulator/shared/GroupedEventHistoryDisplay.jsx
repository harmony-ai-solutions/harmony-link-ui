import React from 'react';
import ConfigurableJsonViewer from '../../widgets/ConfigurableJsonViewer';

function GroupedEventHistoryDisplay({ groups }) {
    if (!groups || groups.length === 0) {
        return <p className="text-gray-400">No event groups recorded yet.</p>;
    }

    const getEventIcon = (eventType) => {
        if (eventType.includes('USER_UTTERANCE')) return '💬';
        if (eventType.includes('TTS')) return '🔊';
        if (eventType.includes('STT')) return '🎤';
        if (eventType.includes('MOVEMENT')) return '🎯';
        if (eventType.includes('RAG')) return '💡';
        if (eventType.includes('BACKEND')) return '🧠';
        if (eventType.includes('CHAT_HISTORY')) return '📚';
        return '📋';
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'SUCCESS': return 'text-green-400 bg-green-500/20 border-green-500/30';
            case 'ERROR': return 'text-red-400 bg-red-500/20 border-red-500/30';
            case 'NEW': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
            default: return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
        }
    };

    const getDirectionColor = (direction) => {
        return direction === 'incoming' 
            ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' 
            : 'text-green-400 bg-green-500/10 border-green-500/20';
    };

    const getGroupStatusColor = (status) => {
        switch (status) {
            case 'SUCCESS': return 'text-green-400 bg-green-500/10 border-green-500/20';
            case 'ERROR': return 'text-red-400 bg-red-500/10 border-red-500/20';
            default: return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
        }
    };

    return (
        <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
            {groups.slice().reverse().map((group, groupIndex) => (
                <div key={groupIndex} className="bg-neutral-800/50 backdrop-blur-sm rounded-xl border border-neutral-700/50 overflow-hidden">
                    {/* Primary Event Header */}
                    <div className="p-4 border-b border-neutral-700/50">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${getDirectionColor(group.primary_event.direction)}`}>
                                    <span className="text-sm">{getEventIcon(group.primary_event.event.event_type)}</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`font-medium ${
                                            group.primary_event.direction === 'incoming' ? 'text-blue-400' : 'text-green-400'
                                        }`}>
                                            {group.primary_event.direction === 'incoming' ? '→' : '←'} {group.primary_event.event.event_type}
                                        </span>
                                        <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(group.primary_event.event.status)}`}>
                                            {group.primary_event.event.status}
                                        </div>
                                        {group.group_type === 'grouped' && (
                                            <div className="px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                                {group.event_count} events
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {new Date(group.primary_event.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getGroupStatusColor(group.status)}`}>
                                    Group: {group.status}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${
                                        group.primary_event.direction === 'incoming' ? 'bg-blue-400' : 'bg-green-400'
                                    }`}></div>
                                    <span className="text-xs text-gray-400 capitalize">{group.primary_event.direction}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Primary Event Payload */}
                    {group.primary_event.event.payload && (
                        <div className="px-4 py-3 border-b border-neutral-700/50 bg-neutral-700/20">
                            <details className="group">
                                <summary className="cursor-pointer text-orange-400 text-sm font-medium flex items-center gap-2 hover:text-orange-300 transition-colors">
                                    <svg className="w-4 h-4 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                    Primary Event Payload
                                </summary>
                                <div className="mt-3 bg-neutral-700/30 rounded-lg p-3">
                                    <ConfigurableJsonViewer data={group.primary_event.event.payload} defaultDepth={2} />
                                </div>
                            </details>
                        </div>
                    )}

                    {/* Related Events */}
                    {group.related_events && group.related_events.length > 0 && (
                        <div className="p-4">
                            <details className="group">
                                <summary className="cursor-pointer text-cyan-400 text-sm font-medium flex items-center gap-2 hover:text-cyan-300 transition-colors mb-3">
                                    <svg className="w-4 h-4 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                    Related Events ({group.related_events.length})
                                </summary>
                                <div className="space-y-3">
                                    {group.related_events.map((relatedEvent, eventIndex) => (
                                        <div key={eventIndex} className="bg-neutral-700/30 backdrop-blur-sm rounded-lg border border-neutral-600/50 overflow-hidden">
                                            <div className="p-3">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-6 h-6 rounded-md flex items-center justify-center border text-xs ${getDirectionColor(relatedEvent.direction)}`}>
                                                            <span>{getEventIcon(relatedEvent.event.event_type)}</span>
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-sm font-medium ${
                                                                    relatedEvent.direction === 'incoming' ? 'text-blue-400' : 'text-green-400'
                                                                }`}>
                                                                    {relatedEvent.direction === 'incoming' ? '→' : '←'} {relatedEvent.event.event_type}
                                                                </span>
                                                                <div className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(relatedEvent.event.status)}`}>
                                                                    {relatedEvent.event.status}
                                                                </div>
                                                            </div>
                                                            <div className="text-xs text-gray-400 mt-0.5">
                                                                {new Date(relatedEvent.timestamp).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                                            relatedEvent.direction === 'incoming' ? 'bg-blue-400' : 'bg-green-400'
                                                        }`}></div>
                                                        <span className="text-xs text-gray-400 capitalize">{relatedEvent.direction}</span>
                                                    </div>
                                                </div>
                                                {relatedEvent.event.payload && (
                                                    <details className="mt-2">
                                                        <summary className="cursor-pointer text-orange-400 text-xs font-medium flex items-center gap-1 hover:text-orange-300 transition-colors">
                                                            <svg className="w-3 h-3 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                            </svg>
                                                            Payload
                                                        </summary>
                                                        <div className="mt-2 bg-neutral-800/50 rounded-md p-2">
                                                            <ConfigurableJsonViewer data={relatedEvent.event.payload} defaultDepth={1} />
                                                        </div>
                                                    </details>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export default GroupedEventHistoryDisplay;
