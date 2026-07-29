import React from 'react';
import ConfigurableJsonViewer from '../../widgets/ConfigurableJsonViewer';
import { MessageIcon, VolumeIcon, MicIcon, CrosshairIcon, LightbulbIcon, BrainIcon, BookIcon, ClipboardIcon } from '../../../constants/icons.jsx';

function EventHistoryDisplay({ events }) {
    if (!events || events.length === 0) {
        return <p className="text-gray-400">No events recorded yet.</p>;
    }

    const getEventIcon = (eventType) => {
        if (eventType.includes('USER_UTTERANCE')) return <MessageIcon className="w-3 h-3" />;
        if (eventType.includes('TTS')) return <VolumeIcon className="w-3 h-3" />;
        if (eventType.includes('STT')) return <MicIcon className="w-3 h-3" />;
        if (eventType.includes('MOVEMENT')) return <CrosshairIcon className="w-3 h-3" />;
        if (eventType.includes('RAG')) return <LightbulbIcon className="w-3 h-3" />;
        if (eventType.includes('BACKEND')) return <BrainIcon className="w-3 h-3" />;
        if (eventType.includes('CHAT_HISTORY')) return <BookIcon className="w-3 h-3" />;
        return <ClipboardIcon className="w-3 h-3" />;
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
        <div className="space-y-1 max-h-96 overflow-y-auto custom-scrollbar">
            {events.slice().reverse().map((event, index) => (
                <div key={index} className="bg-neutral-800/50 backdrop-blur-sm rounded-lg border border-neutral-700/50 overflow-hidden">
                    {/* Compact Event Header */}
                    <div className="p-2">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={`w-6 h-6 rounded flex items-center justify-center border ${getDirectionColor(event.direction)}`}>
                                    {getEventIcon(event.event.event_type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-medium truncate ${
                                            event.direction === 'incoming' ? 'text-blue-400' : 'text-green-400'
                                        }`}>
                                            {event.direction === 'incoming' ? '→' : '←'} {event.event.event_type}
                                        </span>
                                        <div className={`px-1.5 py-0.5 rounded text-xs font-medium border ${getStatusColor(event.event.status)}`}>
                                            {event.event.status}
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        {new Date(event.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                    event.direction === 'incoming' ? 'bg-blue-400' : 'bg-green-400'
                                }`}></div>
                                <span className="text-xs text-gray-400">{event.direction}</span>
                            </div>
                        </div>

                        {/* Inline Payload */}
                        {event.event.payload && (
                            <div className="mt-1 pt-1">
                                <details className="group">
                                    <summary className="cursor-pointer text-orange-400 text-xs font-medium flex items-center gap-1 hover:text-orange-300">
                                        <svg className="w-3 h-3 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                        Payload
                                    </summary>
                                    <div className="mt-1 bg-neutral-700/30 rounded p-2">
                                        <ConfigurableJsonViewer data={event.event.payload} defaultDepth={2} />
                                    </div>
                                </details>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default EventHistoryDisplay;
