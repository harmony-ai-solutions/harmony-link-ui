import React, { useState, useEffect } from 'react';
import { getInstanceWebURLs } from '../../services/managementApiService';

const InstanceCard = ({ integrationName, instanceName, instance, onControl, onConfigure, onConfigFiles }) => {
    const [webURLs, setWebURLs] = useState([]);

    useEffect(() => {
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

        fetchWebURLs();
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

    const handleOpenWebInterface = (url) => {
        window.open(url, '_blank'); // Open in new tab
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

            <div className="instance-actions flex flex-wrap gap-2 mb-3">
                <button 
                    onClick={() => onConfigure(integrationName, instanceName)}
                    className="bg-neutral-600 hover:bg-neutral-500 text-white font-bold py-1 px-2 rounded text-xs"
                >
                    Configure
                </button>
                
                {instance.status === 'running' || instance.status === 'partially_running' ? (
                    <button 
                        onClick={() => onControl(integrationName, instanceName, 'stop')}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded text-xs"
                    >
                        Stop
                    </button>
                ) : (
                    <button 
                        onClick={() => onControl(integrationName, instanceName, 'start')}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-2 rounded text-xs"
                    >
                        Start
                    </button>
                )}
                
                <button 
                    onClick={() => onControl(integrationName, instanceName, 'restart')}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-1 px-2 rounded text-xs"
                >
                    Restart
                </button>

                <button 
                    onClick={() => onConfigFiles(integrationName, instanceName)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-xs"
                >
                    Config Files
                </button>

                {instance.status === 'running' && webURLs.length > 0 && (
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
