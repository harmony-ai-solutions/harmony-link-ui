import React, { useState, useEffect, useCallback } from 'react';
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
  const [integrations, setIntegrations] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [showConfigFilesModal, setShowConfigFilesModal] = useState(false);
  const [showCreateInstanceModal, setShowCreateInstanceModal] = useState(false);
  const [selectedIntegrationName, setSelectedIntegrationName] = useState(null);
  const [selectedInstanceName, setSelectedInstanceName] = useState(null);
  const [quickstartRepoPath, setQuickstartRepoPath] = useState('');
  const [quickstartPathConfigured, setQuickstartPathConfigured] = useState(false);

  // Shared Docker status hook — single poller, stable refresh callback
  const { dockerStatus, refresh: refreshDockerStatus, prevAvailable } = useDockerStatus(10000);

  // Shared integration instances from aggregated endpoint (single poll source)
  const { allInstances, refresh: refreshAllInstances, isLoading: instancesLoading } = useAllIntegrationInstances(10000);

  // Group instances by integration name for passing to IntegrationCard
  const instancesByIntegration = React.useMemo(() => {
    const map = {};
    for (const item of allInstances) {
      if (!map[item.integrationName]) {
        map[item.integrationName] = {};
      }
      map[item.integrationName][item.instanceName] = item.instance;
    }
    return map;
  }, [allInstances]);

  // Running instances for Stop All feature
  const runningInstances = React.useMemo(() => {
    return allInstances.filter(
      ({ instance }) => instance.status === 'running' || instance.status === 'partially_running'
    );
  }, [allInstances]);

  // Stop All dialog state and handlers
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

    return `This will stop ${runningInstances.length} running instance${runningInstances.length !== 1 ? 's' : ''}:\n\n` +
      lines.join('\n') +
      '\n\nAre you sure you want to proceed?';
  }, [runningInstances]);

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

  // Initial load + interval for integrations
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const repoPathResponse = await getQuickstartRepoPath();
        const path = repoPathResponse.path;
        setQuickstartRepoPath(path);
        setQuickstartPathConfigured(!!path);

        if (path) {
          fetchIntegrations();
        }
      } catch (error) {
        console.error('Failed to load initial integration data:', error);
      }
    };

    loadInitialData();

    const integrationsInterval = setInterval(fetchIntegrations, 10000);
    return () => clearInterval(integrationsInterval);
  }, [fetchIntegrations]);

  // Detect Docker coming online → refresh integrations (uses ref, not state dependency)
  useEffect(() => {
    if (!prevAvailable && dockerStatus.available && quickstartPathConfigured) {
      console.log('Docker became available, refreshing integrations...');
      fetchIntegrations();
    }
  }, [dockerStatus.available, prevAvailable, quickstartPathConfigured, fetchIntegrations]);

  const handleConfigureClick = (integrationName, instanceName) => {
    setSelectedIntegrationName(integrationName);
    setSelectedInstanceName(instanceName);
    setShowConfigEditor(true);
  };

  const handleEditorClose = () => {
    setShowConfigEditor(false);
    setSelectedIntegrationName(null);
    setSelectedInstanceName(null);
    fetchIntegrations(); // Refresh all integrations after config change
  };

  const handleConfigFilesClick = (integrationName, instanceName) => {
    setSelectedIntegrationName(integrationName);
    setSelectedInstanceName(instanceName);
    setShowConfigFilesModal(true);
  };

  const handleConfigFilesModalClose = () => {
    setShowConfigFilesModal(false);
    setSelectedIntegrationName(null);
    setSelectedInstanceName(null);
    fetchIntegrations(); // Refresh all integrations after config file change
  };

  const handleCreateInstanceClick = (integrationName) => {
    setSelectedIntegrationName(integrationName);
    setShowCreateInstanceModal(true);
  };

  const handleCreateInstanceModalClose = () => {
    setShowCreateInstanceModal(false);
    setSelectedIntegrationName(null);
    fetchIntegrations(); // Refresh all integrations after new instance creation
  };

  const handleQuickstartPathSet = (path) => {
    setQuickstartRepoPath(path);
    setQuickstartPathConfigured(!!path);
    if (path) {
      fetchIntegrations();
    } else {
      setIntegrations([]);
    }
  };

  if (!quickstartPathConfigured) {
    return (
      <div className="flex flex-col min-h-full bg-background-base">
        {/* View Header */}
        <div className="bg-background-surface/30 backdrop-blur-sm border-b border-white/5 px-6 py-4">
          <h1 className="text-2xl font-extrabold tracking-tight">
            <span className="text-gradient-primary">Integrations</span>
          </h1>
          <p className="text-xs text-text-muted mt-0.5 font-medium">
            Manage and deploy containerized AI services
          </p>
        </div>

        <div className="flex-1 p-6">
          <QuickstartRepoSettings onPathSet={handleQuickstartPathSet} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-background-base">
      {/* View Header */}
      <div className="bg-background-surface/30 backdrop-blur-sm border-b border-white/5 px-6 py-4">
        <h1 className="text-2xl font-extrabold tracking-tight">
          <span className="text-gradient-primary">Integrations</span>
        </h1>
        <p className="text-xs text-text-muted mt-0.5 font-medium">
          Manage and deploy containerized AI services
        </p>
      </div>

      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-start gap-3">

          {/* Quickstart repo settings — capped at half the screen width */}
          <div className="flex-1 min-w-0 max-w-[50%]">
            <QuickstartRepoSettings onPathSet={handleQuickstartPathSet} currentPath={quickstartRepoPath} />
          </div>

          {/* Docker status badge + Refresh All — stacked at far right, button centered below badge */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0 ml-auto">
            <DockerStatusIndicator dockerStatus={dockerStatus} />
            <button
              onClick={() => { refreshDockerStatus(); fetchIntegrations(); refreshAllInstances(); }}
              disabled={refreshing}
              className="btn-secondary py-1.5 px-3 text-xs"
            >
              {refreshing ? 'Refreshing...' : 'Refresh All'}
            </button>
            <button
              onClick={handleStopAllClick}
              disabled={runningInstances.length === 0 || stoppingAll}
              className="btn-danger py-1.5 px-3 text-xs"
            >
              {stoppingAll ? 'Stopping All...' : `Stop All (${runningInstances.length})`}
            </button>
          </div>

        </div>
        
        <div className="flex flex-col gap-3">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.name}
            integration={integration}
            instances={instancesByIntegration[integration.name] || {}}
            onConfigure={handleConfigureClick}
            onConfigFiles={handleConfigFilesClick}
            onCreateInstance={handleCreateInstanceClick}
            onRefreshInstances={refreshAllInstances}
          />
        ))}
        </div>
      </div>

      {showConfigEditor && selectedIntegrationName && selectedInstanceName && (
        <YAMLConfigEditor
          integrationName={selectedIntegrationName}
          instanceName={selectedInstanceName}
          isOpen={showConfigEditor}
          onClose={handleEditorClose}
          onSave={handleEditorClose}
        />
      )}

      {showConfigFilesModal && selectedIntegrationName && selectedInstanceName && (
        <ConfigFilesModal
          integrationName={selectedIntegrationName}
          instanceName={selectedInstanceName}
          isOpen={showConfigFilesModal}
          onClose={handleConfigFilesModalClose}
          onSave={handleConfigFilesModalClose}
        />
      )}

      {showCreateInstanceModal && selectedIntegrationName && (
        <CreateInstanceModal
          integrationName={selectedIntegrationName}
          isOpen={showCreateInstanceModal}
          onClose={handleCreateInstanceModalClose}
          onCreate={handleCreateInstanceModalClose}
        />
      )}

      <ConfirmDialog
        isOpen={showStopAllDialog}
        title="Stop All Running Instances"
        message={stopAllMessage}
        onConfirm={handleStopAllConfirm}
        onCancel={handleStopAllCancel}
        confirmText={stoppingAll ? 'Stopping...' : 'Stop All'}
        cancelText="Cancel"
      />
    </div>
  );
};

export default IntegrationsView;
