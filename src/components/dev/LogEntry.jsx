import { useState, useCallback } from 'react';

/**
 * Level color configuration using theme-aware colors.
 */
const levelConfig = {
    debug:    { className: 'log-level-badge log-level-debug', icon: '🔍' },
    info:     { className: 'log-level-badge log-level-info', icon: 'ℹ️' },
    warn:     { className: 'log-level-badge log-level-warn', icon: '⚠️' },
    error:    { className: 'log-level-badge log-level-error', icon: '❌' },
    fatal:    { className: 'log-level-badge log-level-fatal', icon: '💀' },
    panic:    { className: 'log-level-badge log-level-fatal', icon: '💥' },
};

/**
 * Format timestamp to HH:MM:SS.mmm format.
 */
function formatTimestamp(ts) {
    const date = new Date(ts);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Apply simple syntax highlighting to prompt content.
 */
function highlightPromptContent(content) {
    return content.split('\n').map((line, i) => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('## ')) {
            return <div key={i} className="log-prompt-subheading">{line}</div>;
        }
        if (trimmed.startsWith('# ')) {
            return <div key={i} className="log-prompt-heading">{line}</div>;
        }
        if (trimmed.startsWith('IMPORTANT') || trimmed.startsWith('WARNING')) {
            return <div key={i} className="log-prompt-warning">{line}</div>;
        }
        return <div key={i}>{line}</div>;
    });
}

/**
 * Get message preview for collapsed state.
 */
function getMessagePreview(entry) {
    if (entry.isPrompt) {
        const type = entry.promptType || 'unknown';
        if (entry.promptSummary) {
            return `${type} prompt: ${entry.promptSummary}`;
        }
        return `${type} prompt: ${entry.message.substring(0, 80)}${entry.message.length > 80 ? '…' : ''}`;
    }
    // Truncate long messages
    if (entry.message.length > 120) {
        return entry.message.substring(0, 120) + '…';
    }
    return entry.message;
}

/**
 * Individual log entry component with collapsible content.
 */
export default function LogEntry({ entry }) {
    const [isExpanded, setIsExpanded] = useState(
        entry.level === 'error' || entry.level === 'fatal'
    );

    const toggleExpand = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    const handleCopy = useCallback(() => {
        const text = entry.isPrompt && entry.promptSummary
            ? entry.promptSummary
            : entry.message;
        navigator.clipboard.writeText(text).catch(() => {});
    }, [entry]);

    const level = levelConfig[entry.level] || levelConfig.debug;

    // Build entry class names
    const entryClasses = ['log-entry'];
    if (isExpanded) entryClasses.push('log-entry-expanded');
    if (entry.level === 'error' || entry.level === 'fatal') entryClasses.push('log-entry-error');
    else if (entry.level === 'warn') entryClasses.push('log-entry-warn');
    if (entry.isPrompt) entryClasses.push('log-entry-prompt');

    return (
        <div className={entryClasses.join(' ')}>
            {/* Header row — always visible */}
            <div className="flex items-center gap-2 cursor-pointer" onClick={toggleExpand}>
                {/* Timestamp */}
                <span className="text-xs text-text-muted font-mono w-20 flex-shrink-0">
                    {formatTimestamp(entry.timestamp)}
                </span>

                {/* Level badge */}
                {entry.isPrompt ? (
                    <span className="log-level-badge log-level-prompt">
                        PROMPT·{entry.promptType || '?'}
                    </span>
                ) : (
                    <span className={level.className}>
                        {entry.level.toUpperCase()}
                    </span>
                )}

                {/* Component tag */}
                {entry.component && (
                    <span className="log-tag log-tag-component">
                        {entry.component}
                    </span>
                )}

                {/* Entity tag */}
                {entry.entityId && (
                    <span className="log-tag log-tag-entity">
                        {entry.entityId}
                    </span>
                )}

                {/* SubSystem tag */}
                {entry.subSystem && (
                    <span className="log-tag log-tag-subsystem">
                        {entry.subSystem}
                    </span>
                )}

                {/* Message preview */}
                <span className="text-xs text-text-secondary truncate flex-1 font-mono">
                    {getMessagePreview(entry)}
                </span>

                {/* Expand/collapse indicator */}
                <span className="text-text-muted text-xs flex-shrink-0">
                    {isExpanded ? '▼' : '▶'}
                </span>
            </div>

            {/* Expanded content */}
            {isExpanded && (
                <div className="mt-2 ml-2 pl-3 border-l-2 border-accent-primary/20">
                    {entry.isPrompt ? (
                        <div className="log-prompt-content">
                            {highlightPromptContent(entry.message)}
                        </div>
                    ) : (
                        <div className="font-mono text-xs text-text-secondary whitespace-pre-wrap">
                            {entry.message}
                        </div>
                    )}

                    {/* Data fields if present */}
                    {entry.data && Object.keys(entry.data).length > 0 && (
                        <div className="mt-2 text-xs text-text-muted font-mono">
                            {Object.entries(entry.data)
                                .filter(([key]) => !['component', 'entityId', 'subSystem', 'isPrompt', 'promptType', 'promptSummary'].includes(key))
                                .map(([key, value]) => (
                                    <div key={key}>
                                        <span className="text-accent-primary">{key}</span>: {JSON.stringify(value)}
                                    </div>
                                ))}
                        </div>
                    )}

                    <div className="flex justify-end mt-2">
                        <button
                            className="module-action-btn text-[10px]"
                            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                        >
                            📋 Copy
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}