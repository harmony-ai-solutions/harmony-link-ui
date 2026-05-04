import { useState, useEffect, useRef, useCallback } from 'react';
import useLogStream from '../../hooks/useLogStream.js';
import { fetchLogs, fetchLogComponents, fetchLogEntities, getLogStreamUrl } from '../../services/management/logService.js';
import LogEntry from './LogEntry.jsx';
import FilterToolbar from './FilterToolbar.jsx';
import LogLevelSettings from './LogLevelSettings.jsx';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 1000];

/**
 * Main log viewer component — displays real-time structured log entries
 * with filtering, sorting, pagination, and log level control.
 *
 * Loads historical entries from the REST API on mount, then streams new
 * entries via WebSocket. Duplicates are removed by entry ID.
 */
export default function LogViewer() {
    // ── Filter state ──
    const [filters, setFilters] = useState({
        component: '',
        entityId: '',
        minLevel: 'debug',
        search: '',
    });

    // ── UI state ──
    const [isPaused, setIsPaused] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = newest first
    const [autoScroll, setAutoScroll] = useState(true);
    const [pageSize, setPageSize] = useState(50);
    const [visibleCount, setVisibleCount] = useState(50);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    // ── Data state ──
    const [historyEntries, setHistoryEntries] = useState([]);
    const [components, setComponents] = useState([]);
    const [entities, setEntities] = useState([]);

    // ── WebSocket streaming ──
    const wsUrl = getLogStreamUrl();
    const { entries: liveEntries, isLive, entryCount, clearEntries, reconnect } = useLogStream({
        wsUrl,
        filters,
        isPaused,
        maxEntries: 2000,
    });

    // ── Refs ──
    const scrollContainerRef = useRef(null);
    const seenIdsRef = useRef(new Set());

    // ── Helpers ──
    const extractMeta = useCallback((entries) => {
        const compSet = new Set();
        const entSet = new Set();
        for (const e of entries) {
            if (e.component) compSet.add(e.component);
            if (e.entityId) entSet.add(e.entityId);
        }
        return { components: [...compSet].sort(), entities: [...entSet].sort() };
    }, []);

    // ── Load historical entries on mount ──
    // Fetch the full ring buffer (10K cap) so that after a tab switch remount
    // the user sees exactly what was there before — no entries silently lost.
    useEffect(() => {
        setIsLoadingHistory(true);
        fetchLogs({ limit: 10000 })
            .then(data => {
                const historical = data.entries || [];
                historical.forEach(e => seenIdsRef.current.add(e.id));
                setHistoryEntries(historical);
                const meta = extractMeta(historical);
                if (meta.components.length > 0) setComponents(meta.components);
                if (meta.entities.length > 0) setEntities(meta.entities);
            })
            .catch(err => console.error('Failed to load historical logs:', err))
            .finally(() => setIsLoadingHistory(false));
    }, [extractMeta]);

    // ── Load component/entity lists from REST API ──
    useEffect(() => {
        fetchLogComponents()
            .then(data => {
                const apiComps = data.components || [];
                if (apiComps.length > 0) setComponents(apiComps);
            })
            .catch(err => console.error('Failed to load components:', err));
        fetchLogEntities()
            .then(data => {
                const apiEnts = data.entities || [];
                if (apiEnts.length > 0) setEntities(apiEnts);
            })
            .catch(err => console.error('Failed to load entities:', err));
    }, []);

    // ── Merge history + live entries, dedup by ID ──
    const allEntries = (() => {
        const seen = new Set();
        const merged = [];
        for (const e of historyEntries) {
            if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); }
        }
        for (const e of liveEntries) {
            if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); }
        }
        return merged;
    })();

    // ── Apply filters ──
    const filteredEntries = (() => {
        const levelSeverity = { panic: 0, fatal: 1, error: 2, warn: 3, info: 4, debug: 5, trace: 6 };
        const minSeverity = levelSeverity[filters.minLevel] ?? 5;
        return allEntries.filter(e => {
            if (filters.component && e.component !== filters.component) return false;
            if (filters.entityId && e.entityId !== filters.entityId) return false;
            const entrySeverity = levelSeverity[e.level] ?? 5;
            if (entrySeverity > minSeverity) return false;
            if (filters.search && (!e.message || !e.message.toLowerCase().includes(filters.search.toLowerCase()))) return false;
            return true;
        });
    })();

    // ── Sort (desc = newest first, asc = oldest first) ──
    const sortedEntries = (() => {
        const copy = [...filteredEntries];
        if (sortOrder === 'desc') {
            copy.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } else {
            copy.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        }
        return copy;
    })();

    // ── Paginate: only render visible entries ──
    const totalFiltered = sortedEntries.length;
    const effectiveVisible = Math.min(visibleCount, totalFiltered);
    const displayedEntries = sortedEntries.slice(0, effectiveVisible);
    const hasMore = effectiveVisible < totalFiltered;

    // ── Reset visible count when sort/pageSize changes ──
    useEffect(() => {
        setVisibleCount(pageSize);
    }, [pageSize, sortOrder]);

    // ── Auto-load more when content doesn't fill the container ──
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el || !hasMore) return;
        // If content is shorter than the container, there's no scrollbar so
        // onScroll never fires. Auto-expand until content overflows or we run
        // out of entries.
        if (el.scrollHeight <= el.clientHeight) {
            setVisibleCount(prev => Math.min(prev + pageSize, totalFiltered));
        }
    }, [displayedEntries.length, hasMore, pageSize, totalFiltered]);

    // ── Auto-scroll on new entries ──
    useEffect(() => {
        if (!autoScroll || !scrollContainerRef.current) return;
        requestAnimationFrame(() => {
            const el = scrollContainerRef.current;
            if (!el) return;
            if (sortOrder === 'desc') {
                el.scrollTop = 0; // newest at top
            } else {
                el.scrollTop = el.scrollHeight; // newest at bottom
            }
        });
    }, [entryCount, autoScroll, sortOrder]);

    // ── Scroll handler: detect load-more edge and auto-scroll cancel ──
    const handleScroll = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const { scrollTop, scrollHeight, clientHeight } = el;
        const distFromBottom = scrollHeight - scrollTop - clientHeight;
        const distFromTop = scrollTop;

        // Cancel auto-scroll on manual scroll
        if (sortOrder === 'desc') {
            // Auto-scroll is to top; cancel if user scrolled down >50px
            if (distFromTop > 50) setAutoScroll(false);
        } else {
            // Auto-scroll is to bottom; cancel if user scrolled up >50px
            if (distFromBottom > 50) setAutoScroll(false);
        }

        // Load more when near the "older" end
        if (distFromBottom < 80) {
            setVisibleCount(prev => Math.min(prev + pageSize, totalFiltered));
        }
    }, [sortOrder, pageSize, totalFiltered]);

    // ── Scroll jump button ──
    const handleJumpToEdge = useCallback(() => {
        setAutoScroll(true);
        const el = scrollContainerRef.current;
        if (!el) return;
        if (sortOrder === 'desc') {
            el.scrollTop = 0;
        } else {
            el.scrollTop = el.scrollHeight;
        }
    }, [sortOrder]);

    // ── Refresh ──
    const handleRefresh = useCallback(() => {
        fetchLogComponents()
            .then(data => {
                const apiComps = data.components || [];
                if (apiComps.length > 0) setComponents(apiComps);
                else {
                    const meta = extractMeta(allEntries);
                    if (meta.components.length > 0) setComponents(meta.components);
                }
            })
            .catch(err => console.error('Failed to load components:', err));
        fetchLogEntities()
            .then(data => {
                const apiEnts = data.entities || [];
                if (apiEnts.length > 0) setEntities(apiEnts);
                else {
                    const meta = extractMeta(allEntries);
                    if (meta.entities.length > 0) setEntities(meta.entities);
                }
            })
            .catch(err => console.error('Failed to load entities:', err));
        if (!isLive) reconnect();
    }, [isLive, reconnect, allEntries, extractMeta]);

    // ── Export ──
    const handleExport = useCallback(() => {
        const lines = displayedEntries.map(e => {
            const ts = new Date(e.timestamp).toISOString();
            const level = (e.level || 'debug').toUpperCase().padEnd(5);
            const comp = e.component ? `[${e.component}]` : '';
            const entity = e.entityId ? `[${e.entityId}]` : '';
            const sub = e.subSystem ? `[${e.subSystem}]` : '';
            return `${ts} ${level} ${comp}${entity}${sub} ${e.message}`;
        });
        const text = lines.join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `harmony-link-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    }, [displayedEntries]);

    // ── Clear all ──
    const handleClearAll = useCallback(() => {
        setHistoryEntries([]);
        clearEntries();
        seenIdsRef.current.clear();
        setVisibleCount(pageSize);
    }, [clearEntries, pageSize]);

    // ── Render ──
    return (
        <div className="flex flex-col h-full min-h-0">
            {/* Filter Toolbar */}
            <FilterToolbar
                filters={filters}
                onFilterChange={setFilters}
                components={components}
                entities={entities}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                pageSize={pageSize}
                onPageSizeChange={setPageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onRefresh={handleRefresh}
                onOpenSettings={() => setShowSettings(prev => !prev)}
            />

            {/* Log Level Settings (collapsible) */}
            <LogLevelSettings
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />

            {/* Scrollable Log Container — bounded height via min-h-0 */}
            <div
                ref={scrollContainerRef}
                className="flex-1 min-h-0 overflow-y-auto log-viewer-scroll"
                onScroll={handleScroll}
            >
                {displayedEntries.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-text-muted text-sm">
                        {isLoadingHistory ? 'Loading logs...' : 'No log entries. Waiting for data...'}
                    </div>
                ) : (
                    <>
                        {displayedEntries.map(entry => (
                            <LogEntry key={entry.id} entry={entry} />
                        ))}
                        {hasMore && (
                            <div className="flex items-center justify-center py-2 text-text-muted text-xs">
                                Showing {effectiveVisible} of {totalFiltered} · Scroll to load more
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Control Bar */}
            <div className="log-control-bar">
                <div className="flex items-center gap-3">
                    {/* Live indicator */}
                    <div className={`log-live-dot ${
                        isLive && !isPaused
                            ? 'log-live-dot-active'
                            : isPaused
                                ? 'log-live-dot-paused'
                                : 'log-live-dot-offline'
                    }`} />
                    <span className="text-xs text-text-muted">
                        {isLive ? (isPaused ? 'Paused' : 'Live') : 'Offline'}
                    </span>
                    <span className="text-xs text-text-muted">
                        {effectiveVisible}/{totalFiltered}
                    </span>

                    {/* Jump to edge button (shown when auto-scroll is off) */}
                    {!autoScroll && (
                        <button
                            className="text-xs text-accent-primary hover:underline"
                            onClick={handleJumpToEdge}
                        >
                            {sortOrder === 'desc' ? '↑ Jump to latest' : '↓ Jump to latest'}
                        </button>
                    )}

                    {/* Auto-scroll toggle */}
                    <button
                        className={`module-action-btn text-xs ${autoScroll ? 'text-accent-primary' : ''}`}
                        onClick={() => setAutoScroll(prev => !prev)}
                        title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
                    >
                        {autoScroll ? '⇆ Auto' : '⇳ Manual'}
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="module-action-btn text-xs"
                        onClick={() => setIsPaused(prev => !prev)}
                    >
                        {isPaused ? '▶ Resume' : '⏸ Pause'}
                    </button>
                    <button
                        className="module-action-btn text-xs"
                        onClick={handleClearAll}
                    >
                        Clear
                    </button>
                    <button
                        className="module-action-btn text-xs"
                        onClick={handleExport}
                        disabled={displayedEntries.length === 0}
                    >
                        Export
                    </button>
                    {!isLive && (
                        <button
                            className="module-action-btn text-xs text-accent-primary"
                            onClick={reconnect}
                        >
                            ↻ Reconnect
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
