import React, { useState, useEffect, useCallback } from 'react';
import { listIntegrations, getQuickstartRepoPath } from '../services/managementApiService'; // Removed refreshIntegrationStatuses
import IntegrationCard from './integrations/IntegrationCard';
import QuickstartRepoSettings from './integrations/QuickstartRepoSettings';
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

  const fetchIntegrationsAndStatuses = useCallback(async () => {
    if (!quickstartPathConfigured) return;
    setRefreshing(true);
    try {
      const integrationsResponse = await listIntegrations();
      setIntegrations(integrationsResponse);
      // The IntegrationCard will now fetch its own instance statuses
    } catch (error) {
      console.error('Failed to load integrations or refresh statuses:', error);
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
        if (path) {
          fetchIntegrationsAndStatuses();
        }
      } catch (error) {
        console.error('Failed to load initial integration data:', error);
      }
    };

    loadInitialData();
    const interval = setInterval(fetchIntegrationsAndStatuses, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [fetchIntegrationsAndStatuses]);

  const handleConfigureClick = (integrationName, instanceName) => {
    setSelectedIntegrationName(integrationName);
    setSelectedInstanceName(instanceName);
    setShowConfigEditor(true);
  };

  const handleEditorClose = () => {
    setShowConfigEditor(false);
    setSelectedIntegrationName(null);
    setSelectedInstanceName(null);
    fetchIntegrationsAndStatuses(); // Refresh all integrations after config change
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
    fetchIntegrationsAndStatuses(); // Refresh all integrations after config file change
  };

  const handleCreateInstanceClick = (integrationName) => {
    setSelectedIntegrationName(integrationName);
    setShowCreateInstanceModal(true);
  };

  const handleCreateInstanceModalClose = () => {
    setShowCreateInstanceModal(false);
    setSelectedIntegrationName(null);
    fetchIntegrationsAndStatuses(); // Refresh all integrations after new instance creation
  };

  const handleQuickstartPathSet = (path) => {
    setQuickstartRepoPath(path);
    setQuickstartPathConfigured(!!path);
    if (path) {
      fetchIntegrationsAndStatuses();
    } else {
      setIntegrations([]);
    }
  };

  if (!quickstartPathConfigured) {
    return (
      <div className="p-4">
        <h2 className="text-2xl font-bold mb-4 text-orange-400">Integrations</h2>
        <QuickstartRepoSettings onPathSet={handleQuickstartPathSet} />
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4 text-orange-400">Integrations</h2>
      <div className="flex justify-between items-center mb-4">
        <QuickstartRepoSettings onPathSet={handleQuickstartPathSet} currentPath={quickstartRepoPath} />
        {/* DeviceTypeSelector is now handled per instance in CreateInstanceModal */}
        <button 
          onClick={fetchIntegrationsAndStatuses}
          disabled={refreshing}
          className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400"
        >
          {refreshing ? 'Refreshing...' : 'Refresh All'}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
