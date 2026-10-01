import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from '../../constants/icons.jsx';
import { describeWireFrame, safeStringify, wireDirectionLabel } from '../../store/devtoolsUtils.js';

/**
 * Chat wire inspector (Phase 3, D7).
 *
 * A Developer-mode-only side panel that shows the raw WebSocket frames of the
 * open conversation — both inbound and outbound, including heartbeat PING/PONG.
 * Frames are captured by chatSocketService.onFrame and stored (capped) in the
 * chat store's `wireFrames`; this component is pure presentation.
 *
 * Collapsed by default; toggled from the chat header.
 */
const ChatWireInspector = ({ frames, onClear, onClose }) => {
    const { t } = useTranslation();
    const [expandedId, setExpandedId] = useState(null);

    // Newest first for the list, so the most recent activity is at the top.
    const ordered = useMemo(() => [...(frames || [])].reverse(), [frames]);

    return (
        <aside className="chat-wire-inspector">
            <div className="chat-wire-inspector-header">
                <span className="text-xs font-bold text-accent-primary">
                    {t('chat:wire.title')}
                </span>
                <span className="text-[10px] text-text-muted ml-2">
                    {t('chat:wire.count', { count: frames?.length || 0 })}
                </span>
                <div className="ml-auto flex items-center gap-1">
                    <button type="button" className="module-action-btn text-[10px]" onClick={onClear}>
                        {t('chat:wire.clear')}
                    </button>
                    <button type="button" className="chat-detail-icon-btn" onClick={onClose} aria-label={t('chat:wire.close')}>
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="chat-wire-inspector-body">
                {ordered.length === 0 && (
                    <p className="text-[10px] text-text-muted p-2">{t('chat:wire.empty')}</p>
                )}
                {ordered.map((entry, i) => {
                    const { eventType, status } = describeWireFrame(entry.frame);
                    const direction = entry.direction || wireDirectionLabel(entry.frame);
                    const isOpen = expandedId === i;
                    return (
                        <div key={i} className="chat-wire-frame">
                            <button
                                type="button"
                                className="chat-wire-frame-row"
                                onClick={() => setExpandedId(isOpen ? null : i)}
                            >
                                <span className={`chat-wire-dir chat-wire-dir-${direction}`}>
                                    {direction === 'out' ? '↑' : '↓'}
                                </span>
                                <span className="text-[10px] font-mono text-text-secondary truncate flex-1">
                                    {eventType}
                                </span>
                                {status && (
                                    <span className="text-[9px] text-text-muted">{status}</span>
                                )}
                                <span className="text-[9px] text-text-muted">
                                    {new Date(entry.at).toLocaleTimeString()}
                                </span>
                            </button>
                            {isOpen && (
                                <pre className="chat-wire-frame-payload">
                                    {safeStringify(entry.frame, 12000).text}
                                </pre>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
};

export default ChatWireInspector;
