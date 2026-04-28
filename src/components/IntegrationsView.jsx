import React, { useState, useEffect, useCallback } from 'react';
import { listIntegrations, getQuickstartRepoPath } from '../services/management/integrationsService.js';
import useDockerStatus from '../hooks/useDockerStatus.js';
import IntegrationCard from './integrations/IntegrationCard';
import QuickstartRepoSettings from './integrations/QuickstartRepoSettings';
import DockerStatusIndicator from './integrations/DockerStatusIndicator';
import YAMLConfigEditor from './integrations/YAMLConfigEditor';
import ConfigFilesModal from './integrations/ConfigFilesModal';
import CreateInstanceModal from './integrations/CreateInstanceModal';

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
              onClick={() => { refreshDockerStatus(); fetchIntegrations(); }}
              disabled={refreshing}
              className="btn-secondary"
            >
              {refreshing ? 'Refreshing...' : 'Refresh All'}
            </button>
          </div>

        </div>
        
        <div className="flex flex-col gap-3">
        {integrations.map((integration) => (
          <IntegrationCard
            key={integration.name}
            integration={integration}
            onConfigure={handleConfigureClick}
            onConfigFiles={handleConfigFilesClick}
            onCreateInstance={handleCreateInstanceClick}
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
    </div>
  );
};

export default IntegrationsView;
