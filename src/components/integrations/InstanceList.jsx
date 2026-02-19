import React from 'react';
import InstanceCard from './InstanceCard';

const InstanceList = ({ integrationName, instances, onControl, onConfigure, onConfigFiles, onRename }) => {
    const instanceEntries = Object.entries(instances);

    return (
        <div className="instance-rows-container">
            {instanceEntries.length === 0 ? (
                <div className="pl-14 py-2.5 text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
                    No instances configured. Click &quot;+ Add Instance&quot; to get started.
                </div>
            ) : (
                <div className="flex flex-col">
                    {instanceEntries.map(([instanceName, instance]) => {
                        const currentOperation = instance.operation;
                        return (
                            <InstanceCard
                                key={instanceName}
                                integrationName={integrationName}
                                instanceName={instanceName}
                                instance={instance}
                                onControl={onControl}
                                onConfigure={onConfigure}
                                onConfigFiles={onConfigFiles}
                                onRename={onRename}
                                currentOperation={currentOperation}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default InstanceList;
