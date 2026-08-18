import React from 'react';
import ConfigurableJsonViewer from '../../widgets/ConfigurableJsonViewer';
import { MessageIcon, VolumeIcon, MicIcon, CrosshairIcon, LightbulbIcon, BrainIcon, BookIcon, ClipboardIcon } from '../../../constants/icons.jsx';

function EventHistoryDisplay({ events }) {
    if (!events || events.length === 0) {
        return <p className="text-text-muted text-sm py-4 text-center">No events recorded yet.</p>;
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
            case 'SUCCESS': return 'text-success bg-success/10 border-success/20';
            case 'ERROR': return 'text-error bg-error/10 border-error/20';
            case 'NEW': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
            default: return 'text-warning bg-warning/10 border-warning/20';
        }
    };

    const getDirectionColor = (direction) => {
        return direction === 'incoming' 
            ? 'text-blue-400 bg-blue-500/10 border-blue-500/20' 
            : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    };

    return (
        <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scrollbar">
            {events.slice().reverse().map((event, index) => (
                <div key={index} className="bg-background-surface/30 backdrop-blur-sm rounded-lg border border-border-glass overflow-hidden">
                    {/* Compact Event Header */}
                    <div className="p-2.5">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${getDirectionColor(event.direction)}`}>
                                    {getEventIcon(event.event.event_type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-semibold truncate ${
                                            event.direction === 'incoming' ? 'text-blue-400' : 'text-emerald-400'
                                        }`}>
                                            {event.direction === 'incoming' ? '→' : '←'} {event.event.event_type}
                                        </span>
                                        <div className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${getStatusColor(event.event.status)}`}>
                                            {event.event.status}
                                        </div>
                                    </div>
                                    <div className="text-xs text-text-muted mt-0.5">
                                        {new Date(event.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 ml-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                    event.direction === 'incoming' ? 'bg-blue-400' : 'bg-emerald-400'
                                }`}></div>
                                <span className="text-xs text-text-muted">{event.direction}</span>
                            </div>
                        </div>

                        {/* Inline Payload */}
                        {event.event.payload && (
                            <div className="mt-2 pt-2 border-t border-border-glass">
                                <details className="group">
                                    <summary className="cursor-pointer text-accent-primary text-xs font-semibold flex items-center gap-1 hover:text-accent-secondary transition-colors">
                                        <svg className="w-3 h-3 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                        Payload
                                    </summary>
                                    <div className="mt-1.5 bg-background-surface/50 rounded-lg p-2 border border-border-glass">
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
