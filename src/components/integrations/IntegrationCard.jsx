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
            setInstances({}); // Clear instances on error
        } finally {
            setLoadingInstances(false);
        }
    }, [integration.name]);

    useEffect(() => {
        fetchInstances();
        const interval = setInterval(fetchInstances, 5000); // Refresh instances every 5 seconds
        return () => clearInterval(interval);
    }, [fetchInstances]);

    const handleControlClick = async (integrationName, instanceName, action) => {
        try {
            await controlIntegrationInstance(integrationName, instanceName, action);
            // Immediately refresh instances to get updated operation status from backend
            fetchInstances();
        } catch (error) {
            console.error(`Failed to perform ${action} on ${integrationName}/${instanceName}:`, error);
            
            // Check if this is a Docker-related error and trigger Docker status check
            const errorMessage = error.message || error.toString();
            if (isDockerRelatedError(errorMessage)) {
                console.log('Docker-related error detected, checking Docker status...');
                try {
                    await getDockerStatus(); // This will trigger a Docker status update
                } catch (dockerError) {
                    console.error('Failed to check Docker status:', dockerError);
                }
            }
            
            // Show user-friendly error message
            const friendlyMessage = getFriendlyErrorMessage(errorMessage);
            alert(`Error: ${friendlyMessage}`);
            
            // Refresh instances even on error to clear any stale operation state
            fetchInstances();
        }
    };

    // Helper function to detect Docker-related errors
    const isDockerRelatedError = (errorMessage) => {
        const dockerKeywords = [
            'docker',
            'daemon',
            'connection refused',
            'network is unreachable',
            'cannot connect to the docker daemon',
            'docker endpoint'
        ];
        
        const lowerError = errorMessage.toLowerCase();
        return dockerKeywords.some(keyword => lowerError.includes(keyword));
    };

    // Helper function to provide user-friendly error messages
    const getFriendlyErrorMessage = (errorMessage) => {
        if (isDockerRelatedError(errorMessage)) {
            return 'Docker is not available. Please ensure Docker is running and try again.';
        }
        
        if (errorMessage.includes('pulling')) {
            return 'Failed to pull Docker images. Please check your internet connection and try again.';
        }
        
        if (errorMessage.includes('network')) {
            return 'Network error occurred. Please check your connection and try again.';
        }
        
        return errorMessage; // Return original message if no specific handling
    };

    const handleRenameInstance = async (integrationName, instanceName, newInstanceName) => {
        try {
            await renameIntegrationInstance(integrationName, instanceName, newInstanceName);
            // Immediately refresh instances to show the renamed instance
            await fetchInstances();
        } catch (error) {
            console.error(`Failed to rename instance ${integrationName}/${instanceName}:`, error);
            throw error; // Re-throw to let the modal handle the error display
        }
    };

    const handleOpenProjectWebsite = (url) => {
        window.open(url, '_blank'); // Open in new tab
    };

    const instanceCount = Object.keys(instances).length;
    // Fixed: Use capital S for Status to match backend structure
    const runningCount = Object.values(instances).filter(instance => instance.status === 'running').length;

    return (
        <div className="integration-card">
            <div className="integration-header flex justify-between items-start mb-2">
                <h3 className="text-xl font-semibold text-accent-primary">{integration.displayName}</h3>
                <button
                    onClick={() => handleOpenProjectWebsite(integration.projectWebsite)}
                    className="btn-website-link text-xs py-1 px-2 rounded font-semibold flex-shrink-0"
                >
                    🌐 Website
                </button>
            </div>
            
            <p className="text-text-secondary text-sm mb-2">{integration.description}</p>

            <div className="instance-summary text-sm text-text-muted mb-4">
                {loadingInstances ? (
                    <span>Loading instances...</span>
                ) : (
                    instanceCount > 0 ? (
                        <span>
                            {instanceCount} instance{instanceCount !== 1 ? 's ' : ' '}
                            ({runningCount} running)
                        </span>
                    ) : (
                        <span>No instances configured</span>
                    )
                )}
            </div>

            <div className="integration-actions flex flex-wrap gap-2 mb-4">
                <button 
                    onClick={() => setShowInstances(!showInstances)}
                    className="btn-secondary py-1 px-3 rounded text-sm"
                >
                    {showInstances ? 'Hide Instances' : 'Show Instances'}
                </button>
                <button 
                    onClick={() => onCreateInstance(integration.name)}
                    className="btn-primary py-1 px-3 rounded text-sm"
                >
                    Add Instance
                </button>
            </div>
            
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
