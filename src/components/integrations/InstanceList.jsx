import React from 'react';
import InstanceCard from './InstanceCard';

const InstanceList = ({ integrationName, instances, onControl, onConfigure, onConfigFiles }) => {
    const instanceEntries = Object.entries(instances);
    
    if (instanceEntries.length === 0) {
        return (
            <div className="no-instances text-neutral-400 text-center py-4">
                <p>No instances configured for this integration.</p>
                <p>Click "Add Instance" to create your first instance.</p>
            </div>
        );
    }
    
    return (
        <div className="instance-list mt-4 border-t border-neutral-700 pt-4">
            <h4 className="text-lg font-semibold text-neutral-300 mb-3">Configured Instances:</h4>
            <div className="grid grid-cols-1 gap-3">
                {instanceEntries.map(([instanceName, instance]) => (
                    <InstanceCard
                        key={instanceName}
                        integrationName={integrationName}
                        instanceName={instanceName}
                        instance={instance}
                        onControl={onControl}
                        onConfigure={onConfigure}
                        onConfigFiles={onConfigFiles}
                    />
                ))}
            </div>
        </div>
    );
};

export default InstanceList;
