import React, { useState, useEffect } from 'react';
import { getInstanceWebURLs, cancelIntegrationInstanceOperation, openSystemUrl } from '../../services/managementApiService';

const InstanceCard = ({ integrationName, instanceName, instance, onControl, onConfigure, onConfigFiles, currentOperation }) => {
    const [webURLs, setWebURLs] = useState([]);

    useEffect(() => {
        let interval;
        
        const fetchWebURLs = async () => {
            if (instance.status === 'running') {
                try {
                    const data = await getInstanceWebURLs(integrationName, instanceName);
                    setWebURLs(data.webURLs);
                } catch (error) {
                    console.error(`Failed to fetch web URLs for ${integrationName}/${instanceName}:`, error);
                    setWebURLs([]);
                }
            } else {
                setWebURLs([]);
            }
        };

        fetchWebURLs(); // Initial fetch
        
        // Set up continuous polling when instance is running
        if (instance.status === 'running') {
            interval = setInterval(fetchWebURLs, 5000); // Poll every 5 seconds
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [integrationName, instanceName, instance.status]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'running': return 'bg-green-500';
            case 'stopped': return 'bg-red-500';
            case 'configured': return 'bg-blue-500';
            case 'not_found': return 'bg-gray-500';
            case 'docker_unavailable': return 'bg-yellow-500';
            case 'partially_running': return 'bg-orange-500';
            case 'error': return 'bg-purple-500';
            default: return 'bg-gray-500';
        }
    };
    
    const getDeviceIcon = (deviceType) => {
        switch (deviceType) {
            case 'nvidia': return '🟢'; // Green circle for NVIDIA
            case 'amd': return '🔴'; // Red circle for AMD
            case 'intel': return '🔵'; // Blue circle for Intel
            case 'cpu': return '💻'; // Laptop for CPU
            default: return '⚙️'; // Gear for unknown
        }
    };

    const handleOpenWebInterface = async (url) => {
        try {
            // Try to open in system browser first (works in standalone mode)
            await openSystemUrl(url);
        } catch (error) {
            // Fallback to opening in new tab (container mode or error)
            console.log('System browser opening failed, falling back to window.open:', error.message);
            window.open(url, '_blank');
        }
    };

    const formatProgressLine = (line) => {
        // Check if this is a Docker progress line with progress bar
        const progressMatch = line.match(/^(.+?)\s+(\[=*>?\s*\])\s+(.+)$/);
        if (!progressMatch) {
            return line; // Return original line if no progress bar found
        }

        const [, prefix, progressBar, suffix] = progressMatch;
        
        // Calculate available space (rough estimate based on container width)
        const containerWidth = 300; // Approximate width in pixels
        const charWidth = 7; // Approximate character width
        const availableChars = Math.floor(containerWidth / charWidth);
        
        // Reserve space for prefix and suffix
        const prefixLength = prefix.length;
        const suffixLength = suffix.length;
        const reservedSpace = prefixLength + suffixLength + 4; // +4 for spacing
        
        // Calculate max progress bar width
        const maxProgressWidth = Math.max(10, availableChars - reservedSpace);
        
        // Extract progress percentage if available
        let progressPercent = 0;
        const percentMatch = suffix.match(/(\d+(?:\.\d+)?)%/);
        if (percentMatch) {
            progressPercent = parseFloat(percentMatch[1]);
        } else {
            // Try to extract from size info like "45.2MB/89.3MB"
            const sizeMatch = suffix.match(/(\d+(?:\.\d+)?[KMGT]?B)\/(\d+(?:\.\d+)?[KMGT]?B)/);
            if (sizeMatch) {
                const current = parseFloat(sizeMatch[1]);
                const total = parseFloat(sizeMatch[2]);
                if (total > 0) {
                    progressPercent = (current / total) * 100;
                }
            }
        }
        
        // Create responsive progress bar
        const filledWidth = Math.floor((progressPercent / 100) * maxProgressWidth);
        const emptyWidth = maxProgressWidth - filledWidth - 1; // -1 for the arrow
        
        const responsiveProgressBar = '[' + 
            '='.repeat(Math.max(0, filledWidth)) + 
            (filledWidth > 0 ? '>' : '') + 
            ' '.repeat(Math.max(0, emptyWidth)) + 
            ']';
        
        return `${prefix} ${responsiveProgressBar} ${suffix}`;
    };

    return (
        <div className="instance-card bg-neutral-700 p-3 rounded-md shadow-sm border border-neutral-600">
            <div className="instance-header flex justify-between items-center mb-2">
                <h4 className="text-md font-semibold text-orange-300">{instance.displayName || instance.name}</h4>
                <div className="instance-badges flex gap-1">
                    {instance.deviceType && (
                        <span className={`device-badge text-xs px-2 py-0.5 rounded-full bg-neutral-600 text-neutral-200`}>
                            {getDeviceIcon(instance.deviceType)} {instance.deviceType.toUpperCase()}
                        </span>
                    )}
                    <span className={`status-badge text-xs px-2 py-0.5 rounded-full text-white ${getStatusColor(instance.status)}`}>
                        {instance.status ? instance.status.replace(/_/g, ' ') : 'N/A'}
                    </span>
                </div>
            </div>
            
            {instance.description && <p className="text-neutral-300 text-sm mb-3">{instance.description}</p>}
            {instance.error && <p className="text-red-400 text-xs mb-3">Error: {instance.error}</p>}
            
            {/* Show operation status if there's an active operation */}
            {currentOperation && currentOperation.inProgress && (
                <div className="operation-status bg-blue-900 border border-blue-600 rounded p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-400"></div>
                            <span className="text-blue-300 text-sm font-medium">
                                {currentOperation.message || `${currentOperation.type}...`}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-blue-400 text-xs">
                                {Math.floor((Date.now() - new Date(currentOperation.startTime).getTime()) / 1000)}s
                            </span>
                            <button
                                onClick={async () => {
                                    try {
                                        await cancelIntegrationInstanceOperation(integrationName, instanceName);
                                        // The operation status will be updated through the normal polling mechanism
                                    } catch (error) {
                                        console.error('Failed to cancel operation:', error);
                                    }
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded"
                                title="Cancel Operation"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                    
                    {/* Progress bar */}
                    {currentOperation.progress && (
                        <div className="mb-2">
                            <div className="flex justify-between text-xs text-blue-300 mb-1">
                                <span>Step {currentOperation.progress.currentStep} of {currentOperation.progress.totalSteps}</span>
                                <span>{currentOperation.progress.overallPercent}%</span>
                            </div>
                            <div className="w-full bg-blue-800 rounded-full h-2">
                                <div 
                                    className="bg-blue-400 h-2 rounded-full transition-all duration-300" 
                                    style={{ width: `${currentOperation.progress.overallPercent}%` }}
                                ></div>
                            </div>
                        </div>
                    )}
                    
                    {/* Phase information */}
                    {currentOperation.phase && (
                        <div className="text-xs text-blue-200 mb-2">
                            <span className="font-medium">Phase:</span> {currentOperation.phase.replace(/_/g, ' ')}
                        </div>
                    )}
                    
                    {/* Image pull progress */}
                    {currentOperation.progress && currentOperation.progress.imagePulls && Object.keys(currentOperation.progress.imagePulls).length > 0 && (
                        <div className="text-xs text-blue-200 mb-2">
                            <div className="font-medium mb-1">Image Progress:</div>
                            {Object.entries(currentOperation.progress.imagePulls).map(([imageName, pull]) => (
                                <div key={imageName} className="flex justify-between items-center mb-1">
                                    <span className="truncate max-w-32" title={imageName}>
                                        {imageName.split(':')[0]}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-1 py-0.5 rounded text-xs ${
                                            pull.status === 'complete' ? 'bg-green-600' :
                                            pull.status === 'extracting' ? 'bg-yellow-600' :
                                            'bg-blue-600'
                                        }`}>
                                            {pull.status}
                                        </span>
                                        {pull.percent > 0 && <span>{pull.percent}%</span>}
                                        {pull.size && <span className="text-xs opacity-75">{pull.size}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Recent output */}
                    {currentOperation.output && currentOperation.output.length > 0 && (
                        <div className="text-xs text-blue-200">
                            <div className="font-medium mb-1">Recent Output:</div>
                            <div className="bg-blue-950 rounded p-2 max-h-20 overflow-y-auto">
                                {currentOperation.output.slice(-3).map((line, index) => (
                                    <div key={index} className="font-mono text-xs opacity-75 truncate" title={line}>
                                        {formatProgressLine(line)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="instance-actions flex flex-wrap gap-2 mb-3">
                <button 
                    onClick={() => onConfigure(integrationName, instanceName)}
                    disabled={!!currentOperation}
                    className={`font-bold py-1 px-2 rounded text-xs ${
                        currentOperation 
                            ? 'bg-neutral-500 text-neutral-400 cursor-not-allowed' 
                            : 'bg-neutral-600 hover:bg-neutral-500 text-white'
                    }`}
                >
                    Configure
                </button>
                
                {instance.status === 'running' || instance.status === 'partially_running' ? (
                    <button 
                        onClick={() => onControl(integrationName, instanceName, 'stop')}
                        disabled={!!currentOperation}
                        className={`font-bold py-1 px-2 rounded text-xs ${
                            currentOperation 
                                ? 'bg-red-400 text-red-200 cursor-not-allowed' 
                                : 'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                    >
                        {currentOperation?.type === 'stop' ? 'Stopping...' : 'Stop'}
                    </button>
                ) : (
                    <button 
                        onClick={() => onControl(integrationName, instanceName, 'start')}
                        disabled={!!currentOperation}
                        className={`font-bold py-1 px-2 rounded text-xs ${
                            currentOperation 
                                ? 'bg-green-400 text-green-200 cursor-not-allowed' 
                                : 'bg-green-600 hover:bg-green-700 text-white'
                        }`}
                    >
                        {currentOperation?.type === 'start' ? 'Starting...' : 'Start'}
                    </button>
                )}
                
                <button 
                    onClick={() => onControl(integrationName, instanceName, 'restart')}
                    disabled={!!currentOperation}
                    className={`font-bold py-1 px-2 rounded text-xs ${
                        currentOperation 
                            ? 'bg-yellow-400 text-yellow-200 cursor-not-allowed' 
                            : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    }`}
                >
                    {currentOperation?.type === 'restart' ? 'Restarting...' : 'Restart'}
                </button>

                <button 
                    onClick={() => onConfigFiles(integrationName, instanceName)}
                    disabled={!!currentOperation}
                    className={`font-bold py-1 px-2 rounded text-xs ${
                        currentOperation 
                            ? 'bg-blue-400 text-blue-200 cursor-not-allowed' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                >
                    Config Files
                </button>

                {instance.status === 'running' && webURLs && webURLs.length > 0 && !currentOperation && (
                    webURLs.map((url, index) => (
                        <button
                            key={`web-ui-${index}`}
                            onClick={() => handleOpenWebInterface(url)}
                            className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-1 px-2 rounded text-xs"
                        >
                            Open Web UI
                        </button>
                    ))
                )}
            </div>
            
            {instance.containers && instance.containers.length > 0 && (
                <div className="container-info text-neutral-400 text-xs">
                    <h5 className="font-semibold mb-1">Containers:</h5>
                    <ul className="list-disc list-inside">
                        {instance.containers.map(container => (
                            <li key={container.id} className="mb-0.5">
                                <span className="font-medium text-neutral-200">{container.name}</span>: {container.state} 
                                {container.health && ` (${container.health})`}
                                {container.ports && container.ports.length > 0 && (
                                    <span className="ml-2">
                                        Ports: {container.ports.map(p => `${p.publicPort || p.privatePort}/${p.type}`).join(', ')}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default InstanceCard;
