import React from 'react';
import ConfigurableJsonViewer from '../../widgets/ConfigurableJsonViewer';

function EventHistoryDisplay({ events }) {
    if (!events || events.length === 0) {
        return <p className="text-gray-400">No events recorded yet.</p>;
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

    return (
        <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {events.slice().reverse().map((event, index) => (
                <div key={index} className="bg-neutral-800/50 backdrop-blur-sm rounded-xl border border-neutral-700/50 overflow-hidden">
                    {/* Event Header */}
                    <div className="p-4 border-b border-neutral-700/50">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${getDirectionColor(event.direction)}`}>
                                    <span className="text-sm">{getEventIcon(event.event.event_type)}</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className={`font-medium ${
                                            event.direction === 'incoming' ? 'text-blue-400' : 'text-green-400'
                                        }`}>
                                            {event.direction === 'incoming' ? '→' : '←'} {event.event.event_type}
                                        </span>
                                        <div className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(event.event.status)}`}>
                                            {event.event.status}
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-400 mt-1">
                                        {new Date(event.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                    event.direction === 'incoming' ? 'bg-blue-400' : 'bg-green-400'
                                }`}></div>
                                <span className="text-xs text-gray-400 capitalize">{event.direction}</span>
                            </div>
                        </div>
                    </div>

                    {/* Event Payload */}
                    {event.event.payload && (
                        <div className="p-4">
                            <details className="group">
                                <summary className="cursor-pointer text-orange-400 text-sm font-medium flex items-center gap-2 hover:text-orange-300 transition-colors">
                                    <svg className="w-4 h-4 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                    Event Payload
                                </summary>
                                <div className="mt-3 bg-neutral-700/30 rounded-lg p-3">
                                    <ConfigurableJsonViewer data={event.event.payload} defaultDepth={2} />
                                </div>
                            </details>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export default EventHistoryDisplay;
