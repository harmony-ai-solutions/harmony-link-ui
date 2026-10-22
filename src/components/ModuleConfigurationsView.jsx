import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import useModuleConfigStore from '../store/moduleConfigStore.js';
import ModuleCard from './modules/ModuleCard.jsx';
import PageHeader from './ui/PageHeader.jsx';
import { MODULE_TYPE_OPTIONS } from '../constants/moduleConfiguration.js';
import useAllIntegrationInstances from '../hooks/useAllIntegrationInstances.js';
import useDockerStatus from '../hooks/useDockerStatus.js';
import { toast } from '../store/toastStore.js';

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
            toast.success(t('common:toast.configDeleted'));
        } catch (error) {
            alert(t('moduleConfig:deleteFailed', { message: error.message }));
        }
    };

    const handleSaveNew = () => {
        loadAllConfigs();
    };

    return (
        <div className="flex flex-col min-h-full">
            <PageHeader
                title={t('moduleConfig:header.title')}
                subtitle={t('moduleConfig:header.subtitle')}
            />

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
