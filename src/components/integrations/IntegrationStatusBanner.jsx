import React, { useMemo, useCallback } from 'react';
import {
    getConfigUrl,
    findMatchingInstances,
    getInactiveMatches,
    MODULE_SLOT_LABELS
} from '../../utils/integrationMatcher.js';
import { controlIntegrationInstance } from '../../services/management/integrationsService.js';

/**
 * Integration Status Banner
 *
 * Shows a warning banner when entity's module configs point at local integrations
 * that are not running. Provides a "Start All" button to start them.
 *
 * @param {Object} props
 * @param {Object} props.entityMappings - Module slot to config ID mappings
 * @param {Function} props.getConfigById - Function to get config by moduleType and id
 * @param {Array} props.allInstances - All integration instances from hook
 * @param {Function} props.onRefresh - Callback to refresh instances after starting
 */
export default function IntegrationStatusBanner({
    entityMappings,
    getConfigById,
    allInstances,
    onRefresh
}) {
    // Find all inactive local integrations referenced by entity configs
    const inactiveMatches = useMemo(() => {
        if (!entityMappings || !allInstances || allInstances.length === 0) {
            return [];
        }

        const inactive = [];

        for (const [moduleType, configId] of Object.entries(entityMappings)) {
            if (!configId) continue;

            const config = getConfigById(moduleType, parseInt(configId));
            if (!config) continue;

            const configUrl = getConfigUrl(config, moduleType);
            if (!configUrl) continue; // No URL — cloud provider or missing config, skip

            const matches = findMatchingInstances(configUrl, allInstances);
            if (matches.length === 0) continue;

            const inactiveForThisConfig = getInactiveMatches(matches);
            if (inactiveForThisConfig.length > 0) {
                for (const match of inactiveForThisConfig) {
                    inactive.push({
                        moduleType,
                        moduleLabel: MODULE_SLOT_LABELS[moduleType] || moduleType,
                        integrationName: match.integrationName,
                        instanceName: match.instanceName,
                        instance: match.instance
                    });
                }
            }
        }

        return inactive;
    }, [entityMappings, getConfigById, allInstances]);

    // Handle "Start All" button click
    const handleStartAll = useCallback(async () => {
        const uniqueInstances = [];
        const seen = new Set();

        for (const match of inactiveMatches) {
            const key = `${match.integrationName}:${match.instanceName}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueInstances.push(match);
            }
        }

        for (const item of uniqueInstances) {
            try {
                await controlIntegrationInstance(item.integrationName, item.instanceName, 'start');
            } catch (e) {
                console.error(`Failed to start ${item.integrationName}/${item.instanceName}:`, e);
            }
        }

        // Refresh after starting
        if (onRefresh) {
            onRefresh();
        }
    }, [inactiveMatches, onRefresh]);

    // Deduplicate for display: unique instance names with their module labels
    const uniqueInstances = useMemo(() => {
        const seen = new Map(); // key: "integrationName/instanceName" → { ...item, modules: [] }
        for (const item of inactiveMatches) {
            const key = `${item.integrationName}/${item.instanceName}`;
            if (!seen.has(key)) {
                seen.set(key, {
                    integrationName: item.integrationName,
                    instanceName: item.instanceName,
                    instance: item.instance,
                    modules: [item.moduleLabel]
                });
            } else {
                seen.get(key).modules.push(item.moduleLabel);
            }
        }
        return Array.from(seen.values());
    }, [inactiveMatches]);

    // If no inactive matches, don't render anything
    if (inactiveMatches.length === 0) {
        return null;
    }

    return (
        <div
            className="mb-4 p-3 rounded-lg border"
            style={{
                backgroundColor: 'rgba(234, 179, 8, 0.08)',
                borderColor: 'rgba(234, 179, 8, 0.3)'
            }}
        >
            <div className="flex items-start gap-3">
                {/* Warning Icon */}
                <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                    <svg
                        className="w-5 h-5"
                        style={{ color: 'var(--color-warning)' }}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                        />
                    </svg>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold mb-2" style={{ color: 'var(--color-warning)' }}>
                        Local integrations not running
                    </p>
                    <div className="flex flex-col gap-1.5 mb-3">
                        {uniqueInstances.map((item) => (
                            <div
                                key={`${item.integrationName}/${item.instanceName}`}
                                className="flex items-center gap-2 text-xs"
                            >
                                <span
                                    className="inline-flex items-center px-2 py-0.5 rounded font-medium"
                                    style={{
                                        backgroundColor: 'rgba(234, 179, 8, 0.15)',
                                        color: 'var(--color-warning)'
                                    }}
                                >
                                    {item.instanceName}
                                </span>
                                <span style={{ color: 'var(--color-text-muted)' }}>
                                    for {[...new Set(item.modules)].join(', ')}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Start All Button */}
                    <button
                        onClick={handleStartAll}
                        className="btn-accent-gradient text-sm py-1.5 px-4 font-bold"
                    >
                        Start All
                    </button>
                </div>
            </div>
        </div>
    );
}