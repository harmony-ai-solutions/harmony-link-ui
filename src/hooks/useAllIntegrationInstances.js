import { useState, useEffect, useCallback } from 'react';
import { listIntegrations, getIntegrationInstances } from '../services/management/integrationsService.js';

/**
 * Hook to fetch all integration instances from all integrations.
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
            const integrations = await listIntegrations();
            const results = [];

            for (const integration of integrations) {
                try {
                    const instancesMap = await getIntegrationInstances(integration.name);
                    for (const [instanceName, instance] of Object.entries(instancesMap)) {
                        results.push({
                            integrationName: integration.name,
                            instanceName,
                            instance,
                            integration
                        });
                    }
                } catch (e) {
                    // Skip integrations that fail to load (e.g., quickstart repo not configured)
                    console.debug(`Failed to load instances for ${integration.name}:`, e.message);
                }
            }

            setAllInstances(results);
        } catch (e) {
            console.error('[useAllIntegrationInstances] Failed to fetch integration instances:', e);
            // If listIntegrations fails (no quickstart repo), just set empty
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
