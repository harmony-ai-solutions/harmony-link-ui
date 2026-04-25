import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for streaming logs via WebSocket.
 *
 * @param {Object} options
 * @param {string} options.wsUrl - WebSocket URL
 * @param {Object} options.filters - Current filter state { component, entityId, minLevel, search }
 * @param {boolean} options.isPaused - Whether streaming is paused
 * @param {number} [options.maxEntries=2000] - Maximum entries to keep in memory
 * @returns {{ entries, isLive, entryCount, clearEntries, reconnect }}
 */
export default function useLogStream({ wsUrl, filters, isPaused, maxEntries = 2000 }) {
    const [entries, setEntries] = useState([]);
    const [isLive, setIsLive] = useState(false);
    const wsRef = useRef(null);
    const bufferRef = useRef([]);
    const reconnectTimerRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const filtersRef = useRef(filters);
    const isPausedRef = useRef(isPaused);

    // Keep refs in sync with props
    useEffect(() => {
        filtersRef.current = filters;
    }, [filters]);

    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    // Batch flush: drain buffer into state periodically
    useEffect(() => {
        const interval = setInterval(() => {
            if (bufferRef.current.length > 0) {
                const batch = bufferRef.current.splice(0);
                setEntries(prev => {
                    const next = [...prev, ...batch];
                    return next.length > maxEntries ? next.slice(-maxEntries) : next;
                });
            }
        }, 200); // 5fps update rate
        return () => clearInterval(interval);
    }, [maxEntries]);

    // WebSocket connection lifecycle
    useEffect(() => {
        let ws;
        let mounted = true;

        const connect = () => {
            if (!mounted) return;

            try {
                ws = new WebSocket(wsUrl);

                ws.onopen = () => {
                    if (!mounted) return;
                    setIsLive(true);
                    reconnectAttemptsRef.current = 0;
                    // Send current filters nested under 'data' key
                    if (filtersRef.current) {
                        ws.send(JSON.stringify({ type: 'filter', data: filtersRef.current }));
                    }
                };

                ws.onmessage = (event) => {
                    if (!mounted) return;
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.type === 'entry') {
                            if (!isPausedRef.current) {
                                bufferRef.current.push(msg.data);
                            }
                        }
                        // Ignore 'ping' messages
                    } catch (e) {
                        console.error('Failed to parse log stream message:', e);
                    }
                };

                ws.onerror = () => {
                    if (!mounted) return;
                    setIsLive(false);
                };

                ws.onclose = () => {
                    if (!mounted) return;
                    setIsLive(false);
                    // Exponential backoff reconnection
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                    reconnectAttemptsRef.current++;
                    reconnectTimerRef.current = setTimeout(connect, delay);
                };

                wsRef.current = ws;
            } catch (e) {
                if (!mounted) return;
                setIsLive(false);
            }
        };

        connect();

        return () => {
            mounted = false;
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            if (ws) {
                ws.onclose = null; // Prevent reconnection on cleanup
                ws.close();
            }
        };
    }, [wsUrl]); // Only reconnect if URL changes

    // Send filter updates to server
    useEffect(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'filter', data: filters }));
        }
    }, [filters]);

    // Send pause/resume to server
    useEffect(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: isPaused ? 'pause' : 'resume' }));
        }
    }, [isPaused]);

    const clearEntries = useCallback(() => {
        setEntries([]);
        bufferRef.current = [];
    }, []);

    const reconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            // The onclose handler will trigger reconnection
        }
    }, []);

    return {
        entries,
        isLive,
        entryCount: entries.length,
        clearEntries,
        reconnect,
    };
}