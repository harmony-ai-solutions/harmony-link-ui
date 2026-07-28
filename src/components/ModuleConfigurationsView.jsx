import React, { useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import useModuleConfigStore from '../store/moduleConfigStore.js';
import ModuleCard from './modules/ModuleCard.jsx';
import { MODULE_TYPE_OPTIONS } from '../constants/moduleConfiguration.js';
import useAllIntegrationInstances from '../hooks/useAllIntegrationInstances.js';
import useDockerStatus from '../hooks/useDockerStatus.js';

export default function ModuleConfigurationsView() {
    const { t } = useTranslation();
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
            alert(t('moduleConfig:deleteFailed', { message: error.message }));
        }
    };

    const handleSaveNew = () => {
        loadAllConfigs();
    };

    return (
        <div className="flex flex-col min-h-full bg-background-base">
            <div className="bg-background-surface/30 backdrop-blur-sm px-6 py-4">
                <h1 className="text-2xl font-extrabold tracking-tight">
                    <Trans i18nKey="header.title" ns="moduleConfig" components={{ 0: <span className="text-gradient-primary" /> }} />
                </h1>
                <p className="text-xs text-text-muted mt-0.5 font-medium">
                    {t('moduleConfig:header.subtitle')}
                </p>
            </div>

            <div data-tutorial-id="module-cards-container" className="flex-1 p-6 space-y-3">
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
