import React, { useState, useEffect, useCallback } from 'react';
import { getIntegrationInstances, controlIntegrationInstance, getDockerStatus, renameIntegrationInstance } from '../../services/management/integrationsService.js';
import InstanceList from './InstanceList';

const IntegrationCard = ({ integration, onConfigure, onConfigFiles, onCreateInstance }) => {
    const [instances, setInstances] = useState({});
    const [loadingInstances, setLoadingInstances] = useState(true);
    const [showInstances, setShowInstances] = useState(false);

    const fetchInstances = useCallback(async () => {
        setLoadingInstances(true);
        try {
            const fetchedInstances = await getIntegrationInstances(integration.name);
            setInstances(fetchedInstances);
        } catch (error) {
            console.error(`Failed to fetch instances for ${integration.name}:`, error);
            setInstances({});
        } finally {
            setLoadingInstances(false);
        }
    }, [integration.name]);

    useEffect(() => {
        fetchInstances();
        const interval = setInterval(fetchInstances, 5000);
        return () => clearInterval(interval);
    }, [fetchInstances]);

    const handleControlClick = async (integrationName, instanceName, action) => {
        try {
            await controlIntegrationInstance(integrationName, instanceName, action);
            fetchInstances();
        } catch (error) {
            console.error(`Failed to perform ${action} on ${integrationName}/${instanceName}:`, error);
            const errorMessage = error.message || error.toString();
            if (isDockerRelatedError(errorMessage)) {
                try { await getDockerStatus(); } catch (dockerError) {
                    console.error('Failed to check Docker status:', dockerError);
                }
            }
            alert(`Error: ${getFriendlyErrorMessage(errorMessage)}`);
            fetchInstances();
        }
    };

    const isDockerRelatedError = (errorMessage) => {
        const dockerKeywords = [
            'docker', 'daemon', 'connection refused',
            'network is unreachable', 'cannot connect to the docker daemon', 'docker endpoint'
        ];
        return dockerKeywords.some(keyword => errorMessage.toLowerCase().includes(keyword));
    };

    const getFriendlyErrorMessage = (errorMessage) => {
        if (isDockerRelatedError(errorMessage)) return 'Docker is not available. Please ensure Docker is running and try again.';
        if (errorMessage.includes('pulling')) return 'Failed to pull Docker images. Please check your internet connection and try again.';
        if (errorMessage.includes('network')) return 'Network error occurred. Please check your connection and try again.';
        return errorMessage;
    };

    const handleRenameInstance = async (integrationName, instanceName, newInstanceName) => {
        try {
            await renameIntegrationInstance(integrationName, instanceName, newInstanceName);
            await fetchInstances();
        } catch (error) {
            console.error(`Failed to rename instance ${integrationName}/${instanceName}:`, error);
            throw error;
        }
    };

    const handleOpenProjectWebsite = (url) => {
        window.open(url, '_blank');
    };

    const instanceCount = Object.keys(instances).length;
    const runningCount = Object.values(instances).filter(instance => instance.status === 'running').length;

    return (
        <div className="integration-row">
            {/* Accent tint overlay — top-left to transparent */}
            <div className="integration-row-tint" />

            {/* Left accent stripe */}
            <div className="integration-row-stripe" />

            {/* ── Main Row ──────────────────────────────────────────────── */}
            <div className="relative flex items-center gap-3 pl-5 pr-4 py-3">

                {/* [1] Chevron toggle */}
                <button
                    onClick={() => setShowInstances(!showInstances)}
                    className="integration-row-chevron flex-shrink-0 w-6 h-6 flex items-center justify-center rounded"
                    title={showInstances ? 'Hide Instances' : 'Show Instances'}
                >
                    <svg
                        className="w-4 h-4"
                        style={{
                            transform: showInstances ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                        }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>

                {/* [2] Integration identity — grows to fill available space, no forced truncation */}
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="integration-row-name text-sm font-bold leading-tight break-words">
                        {integration.displayName}
                    </span>
                    <span className="text-xs leading-tight mt-0.5 break-words" style={{ color: 'var(--color-text-muted)' }}>
                        {integration.description}
                    </span>
                </div>

                {/* [3] Instance count pill — centered in its own fixed-width zone */}
                <div className="flex items-center justify-center flex-shrink-0 w-48">
                    {loadingInstances ? (
                        <span className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
                            Loading…
                        </span>
                    ) : (
                        <span className="integration-count-pill text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                            {instanceCount === 0
                                ? 'No instances'
                                : `${instanceCount} instance${instanceCount !== 1 ? 's' : ''} · ${runningCount} running`}
                        </span>
                    )}
                </div>

                {/* [4] Action buttons — inline, left-anchored in their group */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={() => onCreateInstance(integration.name)}
                        className="btn-primary py-1 px-3 text-xs"
                    >
                        + Add Instance
                    </button>
                    <button
                        onClick={() => handleOpenProjectWebsite(integration.projectWebsite)}
                        className="btn-website-link py-1 px-3 text-xs rounded"
                    >
                        🌐 Website
                    </button>
                </div>

            </div>

            {/* ── Expandable Instance Sub-Rows ─────────────────────────── */}
            {showInstances && (
                <InstanceList
                    integrationName={integration.name}
                    instances={instances}
                    onControl={handleControlClick}
                    onConfigure={onConfigure}
                    onConfigFiles={onConfigFiles}
                    onRename={handleRenameInstance}
                />
            )}
        </div>
    );
};

export default IntegrationCard;
