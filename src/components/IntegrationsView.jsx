import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { listIntegrations, getQuickstartRepoPath, controlIntegrationInstance } from '../services/management/integrationsService.js';
import useDockerStatus from '../hooks/useDockerStatus.js';
import useAllIntegrationInstances from '../hooks/useAllIntegrationInstances';
import IntegrationCard from './integrations/IntegrationCard';
import QuickstartRepoSettings from './integrations/QuickstartRepoSettings';
import DockerStatusIndicator from './integrations/DockerStatusIndicator';
import YAMLConfigEditor from './integrations/YAMLConfigEditor';
import ConfigFilesModal from './integrations/ConfigFilesModal';
import CreateInstanceModal from './integrations/CreateInstanceModal';
import ConfirmDialog from './modals/ConfirmDialog';

const IntegrationsView = () => {
  const { t } = useTranslation();
  const [integrations, setIntegrations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [showConfigFilesModal, setShowConfigFilesModal] = useState(false);
  const [showCreateInstanceModal, setShowCreateInstanceModal] = useState(false);
  const [selectedIntegrationName, setSelectedIntegrationName] = useState(null);
  const [selectedInstanceName, setSelectedInstanceName] = useState(null);
  const [quickstartRepoPath, setQuickstartRepoPath] = useState('');
  const [quickstartPathConfigured, setQuickstartPathConfigured] = useState(false);

  const { dockerStatus, refresh: refreshDockerStatus, prevAvailable } = useDockerStatus(10000);
  const { allInstances, refresh: refreshAllInstances, isLoading: instancesLoading } = useAllIntegrationInstances(10000);

  const instancesByIntegration = React.useMemo(() => {
    const map = {};
    for (const item of allInstances) {
      if (!map[item.integrationName]) map[item.integrationName] = {};
      map[item.integrationName][item.instanceName] = item.instance;
    }
    return map;
  }, [allInstances]);

  const runningInstances = React.useMemo(() => {
    return allInstances.filter(
      ({ instance }) => instance.status === 'running' || instance.status === 'partially_running'
    );
  }, [allInstances]);

  const [showStopAllDialog, setShowStopAllDialog] = useState(false);
  const [stoppingAll, setStoppingAll] = useState(false);

  const handleStopAllClick = () => {
    if (runningInstances.length === 0) return;
    setShowStopAllDialog(true);
  };

  const handleStopAllConfirm = async () => {
    setStoppingAll(true);
    const errors = [];
    for (const { integrationName, instanceName } of runningInstances) {
      try {
        await controlIntegrationInstance(integrationName, instanceName, 'stop');
      } catch (error) {
        console.error(`Failed to stop ${integrationName}/${instanceName}:`, error);
        errors.push({ integrationName, instanceName, error: error.message });
      }
    }
    setShowStopAllDialog(false);
    setStoppingAll(false);
    refreshAllInstances();
    if (errors.length > 0) {
      console.warn('[Stop All] Some instances failed to stop:', errors);
    }
  };

  const handleStopAllCancel = () => {
    setShowStopAllDialog(false);
  };

  const stopAllMessage = React.useMemo(() => {
    if (runningInstances.length === 0) return '';
    const lines = runningInstances.map(({ integrationName, instanceName, instance }) => {
      const deviceLabel = instance.deviceType ? ` (${instance.deviceType.toUpperCase()})` : '';
      return `  \u2022 ${integrationName} / ${instanceName}${deviceLabel}`;
    });
    return t('integrations:stopAll.message', {
      count: runningInstances.length,
      instances: lines.join('\n'),
    });
  }, [runningInstances, t]);

  const fetchIntegrations = useCallback(async () => {
    if (!quickstartPathConfigured) return;
    setRefreshing(true);
    try {
      const integrationsResponse = await listIntegrations();
      setIntegrations(integrationsResponse);
    } catch (error) {
      console.error('Failed to load integrations:', error);
    } finally {
      setRefreshing(false);
    }
  }, [quickstartPathConfigured]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const repoPathResponse = await getQuickstartRepoPath();
        const path = repoPathResponse.path;
        setQuickstartRepoPath(path);
        setQuickstartPathConfigured(!!path);
        if (path) fetchIntegrations();
      } catch (error) {
        console.error('Failed to load initial integration data:', error);
      }
    };
    loadInitialData();
    const integrationsInterval = setInterval(fetchIntegrations, 10000);
    return () => clearInterval(integrationsInterval);
  }, [fetchIntegrations]);

  useEffect(() => {
    if (!prevAvailable && dockerStatus.available && quickstartPathConfigured) {
      console.log('Docker became available, refreshing integrations...');
      fetchIntegrations();
    }
  }, [dockerStatus.available, prevAvailable, quickstartPathConfigured, fetchIntegrations]);

  const handleConfigureClick = (iName, instName) => {
    setSelectedIntegrationName(iName);
    setSelectedInstanceName(instName);
    setShowConfigEditor(true);
  };

  const handleEditorClose = () => {
    setShowConfigEditor(false);
    setSelectedIntegrationName(null);
    setSelectedInstanceName(null);
    fetchIntegrations();
  };

  const handleConfigFilesClick = (iName, instName) => {
    setSelectedIntegrationName(iName);
    setSelectedInstanceName(instName);
    setShowConfigFilesModal(true);
  };

  const handleConfigFilesModalClose = () => {
    setShowConfigFilesModal(false);
    setSelectedIntegrationName(null);
    setSelectedInstanceName(null);
    fetchIntegrations();
  };

  const handleCreateInstanceClick = (iName) => {
    setSelectedIntegrationName(iName);
    setShowCreateInstanceModal(true);
  };

  const handleCreateInstanceModalClose = () => {
    setShowCreateInstanceModal(false);
    setSelectedIntegrationName(null);
    fetchIntegrations();
  };

  const handleQuickstartPathSet = (path) => {
    setQuickstartRepoPath(path);
    setQuickstartPathConfigured(!!path);
    if (path) fetchIntegrations();
    else setIntegrations([]);
  };

  if (!quickstartPathConfigured) {
    return (
      <div className="flex flex-col min-h-full bg-background-base">
        <div className="bg-background-surface/30 backdrop-blur-sm px-6 py-4">
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="text-gradient-primary">{t('integrations:header.title')}</span>
          </h1>
          <p className="text-xs text-text-muted mt-0.5 font-medium">
            {t('integrations:header.subtitle')}
          </p>
        </div>
        <div className="flex-1 p-6">
          <div data-tutorial-id="integration-quickstart">
            <QuickstartRepoSettings onPathSet={handleQuickstartPathSet} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-background-base">
      <div className="bg-background-surface/30 backdrop-blur-sm px-6 py-4">
        <h1 className="text-2xl font-extrabold tracking-tight">
          <span className="text-gradient-primary">{t('integrations:header.title')}</span>
        </h1>
        <p className="text-xs text-text-muted mt-0.5 font-medium">
          {t('integrations:header.subtitle')}
        </p>
      </div>

      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-start gap-3">
          <div data-tutorial-id="integration-quickstart" className="flex-1 min-w-0 max-w-[50%]">
            <QuickstartRepoSettings onPathSet={handleQuickstartPathSet} currentPath={quickstartRepoPath} />
          </div>
          <div className="flex flex-col items-center gap-2 flex-shrink-0 ml-auto">
            <div data-tutorial-id="integration-docker-status">
              <DockerStatusIndicator dockerStatus={dockerStatus} />
            </div>
            <button
              onClick={() => { refreshDockerStatus(); fetchIntegrations(); refreshAllInstances(); }}
              disabled={refreshing} className="btn-secondary py-1.5 px-3 text-xs">
              {refreshing ? t('integrations:buttons.refreshing') : t('integrations:buttons.refreshAll')}
            </button>
            <button
              onClick={handleStopAllClick}
              disabled={runningInstances.length === 0 || stoppingAll}
              className="btn-danger py-1.5 px-3 text-xs">
              {stoppingAll ? t('integrations:buttons.stoppingAll') : t('integrations:buttons.stopAll', { count: runningInstances.length })}
            </button>
          </div>
        </div>

        <div data-tutorial-id="integration-cards" className="flex flex-col gap-3">
          {integrations.map((integration) => (
            <IntegrationCard key={integration.name} integration={integration}
              instances={instancesByIntegration[integration.name] || {}}
              onConfigure={handleConfigureClick} onConfigFiles={handleConfigFilesClick}
              onCreateInstance={handleCreateInstanceClick} onRefreshInstances={refreshAllInstances} />
          ))}
        </div>
      </div>

      {showConfigEditor && selectedIntegrationName && selectedInstanceName && (
        <YAMLConfigEditor integrationName={selectedIntegrationName} instanceName={selectedInstanceName}
          isOpen={showConfigEditor} onClose={handleEditorClose} onSave={handleEditorClose} />
      )}
      {showConfigFilesModal && selectedIntegrationName && selectedInstanceName && (
        <ConfigFilesModal integrationName={selectedIntegrationName} instanceName={selectedInstanceName}
          isOpen={showConfigFilesModal} onClose={handleConfigFilesModalClose} onSave={handleConfigFilesModalClose} />
      )}
      {showCreateInstanceModal && selectedIntegrationName && (
        <CreateInstanceModal integrationName={selectedIntegrationName} isOpen={showCreateInstanceModal}
          onClose={handleCreateInstanceModalClose} onCreate={handleCreateInstanceModalClose} />
      )}

      <ConfirmDialog
        isOpen={showStopAllDialog}
        title={t('integrations:stopAll.title')}
        message={stopAllMessage}
        onConfirm={handleStopAllConfirm}
        onCancel={handleStopAllCancel}
        confirmText={stoppingAll ? t('common:buttons.stoppingAll') : t('common:buttons.stopAll')}
        cancelText={t('common:buttons.cancel')}
      />
    </div>
  );
};

export default IntegrationsView;
