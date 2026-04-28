import { useState, useEffect, useCallback } from 'react';
import { getAllIntegrationStatuses, listIntegrations } from '../services/management/integrationsService.js';

/**
 * Hook to fetch all integration instances from all integrations.
 * Uses the aggregated status endpoint for efficiency (single HTTP request).
 * Polls periodically to keep status up to date.
 *
 * @param {number} pollIntervalMs - Polling interval in milliseconds (default: 10000)
 * @returns {Object} - { allInstances: Array, refresh: Function, isLoading: boolean }
 */
export default function useAllIntegrationInstances(pollIntervalMs = 10000) {
    const [allInstances, setAllInstances] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        try {
            // Single aggregated call for all instance statuses
            const statuses = await getAllIntegrationStatuses();

            // Get integration definitions for display metadata
            const integrationDefs = await listIntegrations();

            // Build a lookup map for integration definitions by name
            const integrationMap = {};
            for (const def of integrationDefs) {
                integrationMap[def.name] = def;
            }

            // Flatten statuses into the same allInstances format
            const results = [];
            for (const [integrationName, status] of Object.entries(statuses)) {
                const integration = integrationMap[integrationName] || { name: integrationName };
                for (const [instanceName, instance] of Object.entries(status.instances || {})) {
                    results.push({
                        integrationName,
                        instanceName,
                        instance,
                        integration
                    });
                }
            }

            setAllInstances(results);
        } catch (e) {
            console.error('[useAllIntegrationInstances] Failed to fetch integration instances:', e);
            // If requests fail (no quickstart repo), just set empty
            setAllInstances([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
        const interval = setInterval(fetchAll, pollIntervalMs);
        return () => clearInterval(interval);
    }, [fetchAll, pollIntervalMs]);

    return { allInstances, refresh: fetchAll, isLoading };
}