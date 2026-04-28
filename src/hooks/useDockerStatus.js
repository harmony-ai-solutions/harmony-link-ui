import { useState, useEffect, useCallback, useRef } from 'react';
import { getDockerStatus } from '../services/management/integrationsService.js';

/**
 * Hook to poll Docker status at a regular interval.
 * Uses a ref to track the previous available state so callers can
 * detect when Docker comes online without re-triggering the effect.
 *
 * @param {number} pollIntervalMs - Polling interval in milliseconds (default: 10000)
 * @returns {{ dockerStatus: Object, refresh: Function, prevAvailable: boolean }}
 */
export default function useDockerStatus(pollIntervalMs = 10000) {
    const [dockerStatus, setDockerStatus] = useState({ available: false, lastCheck: null, hasClient: false });
    const prevAvailableRef = useRef(false);

    const refresh = useCallback(async () => {
        try {
            const status = await getDockerStatus();
            // Use functional setState to read previous state without closure capture
            setDockerStatus(prev => {
                prevAvailableRef.current = prev.available;
                return status;
            });
            return status;
        } catch (e) {
            console.debug('[useDockerStatus] Failed to fetch Docker status:', e.message);
            setDockerStatus(prev => {
                prevAvailableRef.current = prev.available;
                return { ...prev, available: false };
            });
            return { available: false, lastCheck: null, hasClient: false };
        }
    }, []); // stable — no dependencies

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, pollIntervalMs);
        return () => clearInterval(interval);
    }, [refresh, pollIntervalMs]);

    return {
        dockerStatus,
        refresh,
        /** True if Docker was available on the *previous* poll — useful for "just came online" detection */
        get prevAvailable() { return prevAvailableRef.current; }
    };
}
