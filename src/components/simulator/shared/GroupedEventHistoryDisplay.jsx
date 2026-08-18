import React from 'react';
import ConfigurableJsonViewer from '../../widgets/ConfigurableJsonViewer';
import { MessageIcon, VolumeIcon, MicIcon, CrosshairIcon, LightbulbIcon, BrainIcon, BookIcon, ClipboardIcon } from '../../../constants/icons.jsx';

function GroupedEventHistoryDisplay({ groups }) {
    if (!groups || groups.length === 0) {
        return <p className="text-text-muted text-sm py-4 text-center">No event groups recorded yet.</p>;
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

    const getGroupStatusColor = (status) => {
        switch (status) {
            case 'SUCCESS': return 'text-success bg-success/10 border-success/20';
            case 'ERROR': return 'text-error bg-error/10 border-error/20';
            default: return 'text-warning bg-warning/10 border-warning/20';
        }
    };

    return (
        <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scrollbar">
            {groups.slice().reverse().map((group, groupIndex) => (
                <div key={groupIndex} className="bg-background-surface/30 backdrop-blur-sm rounded-lg border border-border-glass overflow-hidden">
                    {/* Compact Primary Event Header */}
                    <div className="p-2.5">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${getDirectionColor(group.primary_event.direction)}`}>
                                    {getEventIcon(group.primary_event.event.event_type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={`text-sm font-semibold truncate ${
                                            group.primary_event.direction === 'incoming' ? 'text-blue-400' : 'text-emerald-400'
                                        }`}>
                                            {group.primary_event.direction === 'incoming' ? '→' : '←'} {group.primary_event.event.event_type}
                                        </span>
                                        <div className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${getStatusColor(group.primary_event.event.status)}`}>
                                            {group.primary_event.event.status}
                                        </div>
                                        {group.group_type === 'grouped' && (
                                            <div className="px-1.5 py-0.5 rounded text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/25">
                                                {group.event_count}
                                            </div>
                                        )}
                                        <div className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${getGroupStatusColor(group.status)}`}>
                                            {group.status}
                                        </div>
                                    </div>
                                    <div className="text-xs text-text-muted mt-0.5">
                                        {new Date(group.primary_event.timestamp).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 ml-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                    group.primary_event.direction === 'incoming' ? 'bg-blue-400' : 'bg-emerald-400'
                                }`}></div>
                                <span className="text-xs text-text-muted">{group.primary_event.direction}</span>
                            </div>
                        </div>

                        {/* Primary Event Payload */}
                        {group.primary_event.event.payload && (
                            <div className="mt-2 pt-2 border-t border-border-glass">
                                <details className="group">
                                    <summary className="cursor-pointer text-accent-primary text-xs font-semibold flex items-center gap-1 hover:text-accent-secondary transition-colors">
                                        <svg className="w-3 h-3 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                        Primary Payload
                                    </summary>
                                    <div className="mt-1.5 bg-background-surface/50 rounded-lg p-2 border border-border-glass">
                                        <ConfigurableJsonViewer data={group.primary_event.event.payload} defaultDepth={2} />
                                    </div>
                                </details>
                            </div>
                        )}

                        {/* Related Events */}
                        {group.related_events && group.related_events.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border-glass">
                                <details className="group">
                                    <summary className="cursor-pointer text-cyan-400 text-xs font-semibold flex items-center gap-1 hover:text-cyan-300 transition-colors">
                                        <svg className="w-3 h-3 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                        Related ({group.related_events.length})
                                    </summary>
                                    <div className="mt-1.5 space-y-1.5">
                                        {group.related_events.map((relatedEvent, eventIndex) => (
                                            <div key={eventIndex} className="bg-background-surface/50 rounded-lg border border-border-glass p-2">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                        <div className={`w-5 h-5 rounded flex items-center justify-center border text-xs ${getDirectionColor(relatedEvent.direction)}`}>
                                                            {getEventIcon(relatedEvent.event.event_type)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1">
                                                                <span className={`text-xs font-semibold truncate ${
                                                                    relatedEvent.direction === 'incoming' ? 'text-blue-400' : 'text-emerald-400'
                                                                }`}>
                                                                    {relatedEvent.direction === 'incoming' ? '→' : '←'} {relatedEvent.event.event_type}
                                                                </span>
                                                                <div className={`px-1 py-0.5 rounded text-xs font-semibold border ${getStatusColor(relatedEvent.event.status)}`}>
                                                                    {relatedEvent.event.status}
                                                                </div>
                                                            </div>
                                                            <div className="text-xs text-text-muted">
                                                                {new Date(relatedEvent.timestamp).toLocaleString()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 ml-1">
                                                        <div className={`w-1 h-1 rounded-full ${
                                                            relatedEvent.direction === 'incoming' ? 'bg-blue-400' : 'bg-emerald-400'
                                                        }`}></div>
                                                    </div>
                                                </div>
                                                {relatedEvent.event.payload && (
                                                    <div className="mt-1.5 pt-1.5 border-t border-border-glass">
                                                        <details>
                                                            <summary className="cursor-pointer text-accent-primary text-xs font-semibold flex items-center gap-1 hover:text-accent-secondary transition-colors">
                                                                <svg className="w-2.5 h-2.5 transform group-open:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                                                </svg>
                                                                Payload
                                                            </summary>
                                                            <div className="mt-1 bg-background-surface/50 rounded-lg p-1.5 border border-border-glass">
                                                                <ConfigurableJsonViewer data={relatedEvent.event.payload} defaultDepth={1} />
                                                            </div>
                                                        </details>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
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

export default GroupedEventHistoryDisplay;
