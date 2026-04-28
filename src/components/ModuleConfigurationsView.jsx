import React, { useEffect } from 'react';
import useModuleConfigStore from '../store/moduleConfigStore.js';
import ModuleCard from './modules/ModuleCard.jsx';
import { MODULE_TYPE_OPTIONS } from '../constants/moduleConfiguration.js';
import useAllIntegrationInstances from '../hooks/useAllIntegrationInstances.js';
import useDockerStatus from '../hooks/useDockerStatus.js';

export default function ModuleConfigurationsView() {
    const { loadAllConfigs, getConfigs, isLoading } = useModuleConfigStore();
    const { allInstances, refresh: refreshInstances } = useAllIntegrationInstances();
    const { dockerStatus } = useDockerStatus();

    useEffect(() => {
        loadAllConfigs();
    }, []);

    const handleDelete = async (moduleType, id, name) => {
        const { deleteConfig } = useModuleConfigStore.getState();
        try {
            await deleteConfig(moduleType, id);
        } catch (error) {
            alert(`Failed to delete configuration: ${error.message}`);
        }
    };

    const handleSaveNew = () => {
        loadAllConfigs();
    };

    return (
        <div className="flex flex-col min-h-full bg-background-base">
            {/* View Header */}
            <div className="bg-background-surface/30 backdrop-blur-sm border-b border-white/5 px-6 py-4">
                <h1 className="text-2xl font-extrabold tracking-tight">
                    <span className="text-gradient-primary">Module</span> Configurations
                </h1>
                <p className="text-xs text-text-muted mt-0.5 font-medium">
                    Manage AI module configurations and provider settings
                </p>
            </div>

            {/* Module Cards — vertical list */}
            <div className="flex-1 p-6 space-y-3">
                {MODULE_TYPE_OPTIONS.map((moduleInfo) => (
                    <ModuleCard
                        key={moduleInfo.id}
                        moduleType={moduleInfo.id}
                        moduleInfo={moduleInfo}
                        configs={getConfigs(moduleInfo.id)}
                        isLoading={isLoading}
                        onDelete={(id, name) => handleDelete(moduleInfo.id, id, name)}
                        onSaveNew={handleSaveNew}
                        allInstances={allInstances}
                        onInstancesRefresh={refreshInstances}
                        dockerStatus={dockerStatus}
                    />
                ))}
            </div>
        </div>
    );
}
