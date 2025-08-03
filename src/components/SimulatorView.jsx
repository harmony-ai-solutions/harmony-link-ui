import React, { useState, useEffect, useCallback } from 'react';
import { 
    getSimulatorEntities,
    connectSimulator,
    disconnectSimulator,
    sendSimulatorEvent,
    getSimulatorEventHistory,
    getSimulatorGroupedEventHistory,
    getConfig,
    getEntityRAGCollections
} from '../services/managementApiService';

// Import all the new tab components
import ConnectionTab from './simulator/tabs/ConnectionTab';
import EventMonitorTab from './simulator/tabs/EventMonitorTab';
import BackendTab from './simulator/tabs/BackendTab';
import MovementTab from './simulator/tabs/MovementTab';
import TTSTab from './simulator/tabs/TTSTab';
import STTTab from './simulator/tabs/STTTab';
import RAGTab from './simulator/tabs/RAGTab';
import CountenanceTab from './simulator/tabs/CountenanceTab';

function SimulatorView() {
    // Connection state
    const [entities, setEntities] = useState([]);
    const [selectedEntity, setSelectedEntity] = useState('');
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [feedback, setFeedback] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Event history state
    const [eventHistory, setEventHistory] = useState([]);
    const [groupedEventHistory, setGroupedEventHistory] = useState([]);
    const [useGroupedView, setUseGroupedView] = useState(true);

    // Module configurations state
    const [moduleConfigs, setModuleConfigs] = useState({
        backend: null,
        movement: null,
        tts: null,
        stt: null,
        rag: null
    });
    const [moduleConfigsLoading, setModuleConfigsLoading] = useState(false);
    const [moduleConfigErrors, setModuleConfigErrors] = useState({});

    // Form responses state
    const [formResponses, setFormResponses] = useState({
        backend: { loading: false, response: null, error: null },
        movement: { loading: false, response: null, error: null },
        tts: { loading: false, response: null, error: null },
        stt: { loading: false, response: null, error: null },
        rag: { loading: false, response: null, error: null },
        countenance: { loading: false, response: null, error: null }
    });

    // RAG collections state
    const [ragCollections, setRagCollections] = useState([]);
    const [ragCollectionsLoading, setRagCollectionsLoading] = useState(false);

    // Active tab state
    const [activeTab, setActiveTab] = useState('connection');

    // Load entities on component mount
    useEffect(() => {
        loadEntities();
    }, []);

    // Load module configurations when entity is connected and load RAG collections when RAG tab is active
    useEffect(() => {
        if (selectedEntity && connectionStatus === 'connected') {
            console.log("Loading module configurations for entity:", selectedEntity);
            loadModuleConfigurations();

            // Load RAG collections specifically when RAG tab is active
            if (activeTab === 'rag') {
                loadRAGCollections();
            }
        }
    }, [selectedEntity, connectionStatus, activeTab]);

    // Load entities from management API with sophisticated connection state restoration
    const loadEntities = async () => {
        try {
            setIsLoading(true);
            const entityList = await getSimulatorEntities();
            setEntities(entityList.entities || []);
            console.log("Loaded entities for simulator:", entityList);

            // Check if currently selected entity is simulated and restore connection state
            if (selectedEntity) {
                const currentEntity = entityList.entities?.find(entity => entity.id === selectedEntity);
                if (currentEntity?.is_simulated && connectionStatus !== 'connected') {
                    setConnectionStatus('connected');
                    setFeedback(`✅ Restored connection to simulated entity: ${selectedEntity}`);
                    // Load event history for the restored entity
                    try {
                        const [history, groupedHistory] = await Promise.all([
                            getSimulatorEventHistory(selectedEntity, 50),
                            getSimulatorGroupedEventHistory(selectedEntity, 50)
                        ]);
                        setEventHistory(history.events || []);
                        setGroupedEventHistory(groupedHistory.groups || []);
                    } catch (historyError) {
                        console.error("Failed to load event history for restored entity:", historyError);
                    }
                } else if (!currentEntity?.is_simulated && connectionStatus === 'connected') {
                    // Entity is no longer simulated, disconnect
                    setConnectionStatus('disconnected');
                    setEventHistory([]);
                    setGroupedEventHistory([]);
                    setFeedback(`Connection lost for entity: ${selectedEntity}`);
                }
            } else {
                // No entity selected, check if any entity is simulated and auto-select it
                const simulatedEntity = entityList.entities?.find(entity => entity.is_simulated);
                if (simulatedEntity && connectionStatus === 'disconnected') {
                    setSelectedEntity(simulatedEntity.id);
                    setConnectionStatus('connected');
                    setFeedback(`✅ Auto-restored connection to simulated entity: ${simulatedEntity.id}`);
                    // Load event history for the restored entity
                    try {
                        const [history, groupedHistory] = await Promise.all([
                            getSimulatorEventHistory(simulatedEntity.id, 50),
                            getSimulatorGroupedEventHistory(simulatedEntity.id, 50)
                        ]);
                        setEventHistory(history.events || []);
                        setGroupedEventHistory(groupedHistory.groups || []);
                    } catch (historyError) {
                        console.error("Failed to load event history for restored entity:", historyError);
                    }
                }
            }
        } catch (error) {
            console.error("Failed to load entities for simulator:", error);
            setFeedback(`Error loading entities: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Sync entity state when selected entity changes
    const syncEntityState = useCallback(async (entityId) => {
        if (!entityId) {
            setConnectionStatus('disconnected');
            setEventHistory([]);
            setGroupedEventHistory([]);
            setFeedback('');
            clearAllFormResponses();
            setModuleConfigs({
                backend: null,
                movement: null,
                tts: null,
                stt: null,
                rag: null
            });
            setRagCollections([]);
            return;
        }

        const entity = entities.find(e => e.id === entityId);
        if (entity?.is_simulated) {
            setConnectionStatus('connected');
            setFeedback(`✅ Selected already simulated entity: ${entityId}`);
            // Load event history for the selected entity
            try {
                const [history, groupedHistory] = await Promise.all([
                    getSimulatorEventHistory(entityId, 50),
                    getSimulatorGroupedEventHistory(entityId, 50)
                ]);
                setEventHistory(history.events || []);
                setGroupedEventHistory(groupedHistory.groups || []);
            } catch (error) {
                console.error("Failed to load event history:", error);
            }
            // Load module configurations for the selected entity
            await loadModuleConfigurations();
        } else {
            setConnectionStatus('disconnected');
            setEventHistory([]);
            setGroupedEventHistory([]);
            setFeedback(`Selected entity: ${entityId} (not currently simulated)`);
            clearAllFormResponses();
            setModuleConfigs({
                backend: null,
                movement: null,
                tts: null,
                stt: null,
                rag: null
            });
            setRagCollections([]);
        }
    }, [entities]);

    // Connect to entity
    const handleConnect = async () => {
        if (!selectedEntity) {
            setFeedback('Please select an entity to simulate.');
            return;
        }

        // Check if entity is already simulated
        const entity = entities.find(e => e.id === selectedEntity);
        if (entity?.is_simulated) {
            setConnectionStatus('connected');
            setFeedback(`✅ Restored connection to already simulated entity: ${selectedEntity}`);
            await loadEventHistory();
            return;
        }

        try {
            setIsLoading(true);
            setConnectionStatus('connecting');
            setFeedback('Connecting...');

            const response = await connectSimulator(selectedEntity);
            
            setConnectionStatus('connected');
            setFeedback(`✅ Successfully connected to simulated entity: ${selectedEntity}`);
            console.log("Simulator connected:", response);
            await loadModuleConfigurations();
            await loadEventHistory();
            await loadRAGCollections();
            await loadEntities(); // Refresh entities to update simulation status
        } catch (error) {
            setConnectionStatus('disconnected');
            setFeedback(`❌ Connection failed: ${error.message}`);
            console.error("Simulator connection failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Disconnect from entity
    const handleDisconnect = async () => {
        if (!selectedEntity) {
            setFeedback('No entity selected to disconnect.');
            return;
        }

        try {
            setIsLoading(true);
            setConnectionStatus('disconnecting');
            setFeedback('Disconnecting...');

            await disconnectSimulator(selectedEntity);
            
            setConnectionStatus('disconnected');
            setFeedback('✅ Successfully disconnected from simulated entity');
            setEventHistory([]);
            setGroupedEventHistory([]);
            setModuleConfigs({
                backend: null,
                movement: null,
                tts: null,
                stt: null,
                rag: null
            });
            clearAllFormResponses();
            await loadEntities(); // Refresh entities to update simulation status
        } catch (error) {
            setFeedback(`❌ Disconnect failed: ${error.message}`);
            console.error("Simulator disconnection failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // Load module configurations
    const loadModuleConfigurations = async () => {
        if (!selectedEntity) return;
        
        setModuleConfigsLoading(true);
        setModuleConfigErrors({});

        try {
            const config = await getConfig();
            console.log("Full config loaded:", config);
            console.log("Looking for entity:", selectedEntity);
            console.log("Available entities:", Object.keys(config.entities || {}));

            const entityConfig = config.entities?.[selectedEntity];
            console.log("Entity config:", entityConfig);
            
            if (entityConfig) {
                const newModuleConfigs = {
                    backend: entityConfig.backend || null,
                    movement: entityConfig.movement || null,
                    tts: entityConfig.tts || null,
                    stt: entityConfig.stt || null,
                    rag: entityConfig.rag || null
                };
                
                setModuleConfigs(newModuleConfigs);
                console.log("Module configurations loaded:", newModuleConfigs);
                
                // Set individual errors for missing configurations
                const errors = {};
                Object.entries(newModuleConfigs).forEach(([module, config]) => {
                    if (!config) {
                        errors[module] = `No ${module} configuration found for this entity`;
                    }
                });
                setModuleConfigErrors(errors);
            } else {
                console.log("No entity config found for:", selectedEntity);
                setModuleConfigErrors({
                    backend: 'Entity configuration not found',
                    movement: 'Entity configuration not found',
                    tts: 'Entity configuration not found',
                    stt: 'Entity configuration not found',
                    rag: 'Entity configuration not found'
                });
            }
        } catch (error) {
            console.error('Failed to load module configurations:', error);
            const errorMessage = 'Failed to load configuration: ' + error.message;
            setModuleConfigErrors({
                backend: errorMessage,
                movement: errorMessage,
                tts: errorMessage,
                stt: errorMessage,
                rag: errorMessage
            });
        } finally {
            setModuleConfigsLoading(false);
        }
    };

    // Load event history
    const loadEventHistory = async () => {
        if (!selectedEntity || connectionStatus !== 'connected') return;
        try {
            // Load both regular and grouped event history
            const [history, groupedHistory] = await Promise.all([
                getSimulatorEventHistory(selectedEntity, 50),
                getSimulatorGroupedEventHistory(selectedEntity, 50)
            ]);
            setEventHistory(history.events || []);
            setGroupedEventHistory(groupedHistory.groups || []);
        } catch (error) {
            console.error('Failed to load event history:', error);
        }
    };

    // Load RAG collections
    const loadRAGCollections = async () => {
        if (!selectedEntity) return;
        setRagCollectionsLoading(true);
        try {
            const response = await getEntityRAGCollections(selectedEntity);
            setRagCollections(response.collections || []);
        } catch (error) {
            console.error('Failed to load RAG collections:', error);
            // Don't set error for collections as they might not exist yet
        } finally {
            setRagCollectionsLoading(false);
        }
    };

    // Send event to module
    const handleSendEvent = async (event, module) => {
        if (!selectedEntity || connectionStatus !== 'connected') {
            setFormResponses(prev => ({
                ...prev,
                [module]: { loading: false, response: null, error: 'No active simulator connection.' }
            }));
            return;
        }

        setFormResponses(prev => ({
            ...prev,
            [module]: { loading: true, response: null, error: null }
        }));

        try {
            const eventId = event.event_id || `${event.event_type}-${Date.now()}`;
            const eventWithId = { ...event, event_id: eventId };

            await sendSimulatorEvent(selectedEntity, eventWithId);

            // Wait a bit for response, then check event history for result
            setTimeout(async () => {
                try {
                    const history = await getSimulatorEventHistory(selectedEntity, 50);
                    const relatedEvents = history.events?.filter(e =>
                        e.event?.event_id === eventId ||
                        e.event?.event_type === event.event_type
                    ) || [];

                    // Find the most recent response event
                    const responseEvent = relatedEvents
                        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                        .find(e => e.event?.status === 'SUCCESS' || e.event?.status === 'ERROR');

                    setFormResponses(prev => ({
                        ...prev,
                        [module]: {
                            loading: false,
                            response: responseEvent,
                            error: responseEvent?.event?.status === 'ERROR' ? responseEvent.event.payload : null
                        }
                    }));

                    // Refresh event history
                    loadEventHistory();
                } catch (error) {
                    setFormResponses(prev => ({
                        ...prev,
                        [module]: { loading: false, response: null, error: error.message }
                    }));
                }
            }, 1000);

        } catch (error) {
            console.error('Failed to send simulator event:', error);
            setFormResponses(prev => ({
                ...prev,
                [module]: { loading: false, response: null, error: error.message }
            }));
        }
    };

    // Clear form response
    const handleClearFormResponse = (module) => {
        setFormResponses(prev => ({
            ...prev,
            [module]: { loading: false, response: null, error: null }
        }));
    };

    // Clear all form responses
    const clearAllFormResponses = () => {
        setFormResponses({
            backend: { loading: false, response: null, error: null },
            movement: { loading: false, response: null, error: null },
            tts: { loading: false, response: null, error: null },
            stt: { loading: false, response: null, error: null },
            rag: { loading: false, response: null, error: null },
            countenance: { loading: false, response: null, error: null }
        });
    };

    // Open collection manager
    const handleOpenCollectionManager = () => {
        // This would open a modal or navigate to collection manager
        console.log('Opening collection manager...');
    };

    // Tab configuration
    const tabs = [
        { id: 'connection', label: 'Connection', icon: '🔗' },
        { id: 'events', label: 'Event Monitor', icon: '📊' },
        { id: 'backend', label: 'Backend', icon: '🧠' },
        { id: 'movement', label: 'Movement', icon: '🎯' },
        { id: 'tts', label: 'TTS', icon: '🔊' },
        { id: 'stt', label: 'STT', icon: '🎤' },
        { id: 'rag', label: 'RAG', icon: '💡' },
        { id: 'countenance', label: 'Countenance', icon: '😊' }
    ];

    // Render tab content
    const renderTabContent = () => {
        const commonProps = {
            connectionStatus,
            moduleConfigs,
            moduleConfigsLoading,
            moduleConfigErrors,
            formResponses,
            onSendEvent: handleSendEvent,
            onClearFormResponse: handleClearFormResponse
        };

        switch (activeTab) {
            case 'connection':
                return (
                    <ConnectionTab
                        entities={entities}
                        selectedEntity={selectedEntity}
                        setSelectedEntity={setSelectedEntity}
                        connectionStatus={connectionStatus}
                        feedback={feedback}
                        isLoading={isLoading}
                        onConnect={handleConnect}
                        onDisconnect={handleDisconnect}
                        onLoadEntities={loadEntities}
                        onSyncEntityState={syncEntityState}
                    />
                );
            case 'events':
                return (
                    <EventMonitorTab
                        connectionStatus={connectionStatus}
                        eventHistory={eventHistory}
                        groupedEventHistory={groupedEventHistory}
                        useGroupedView={useGroupedView}
                        setUseGroupedView={setUseGroupedView}
                        onLoadEventHistory={loadEventHistory}
                    />
                );
            case 'backend':
                return <BackendTab {...commonProps} />;
            case 'movement':
                return <MovementTab {...commonProps} />;
            case 'tts':
                return <TTSTab {...commonProps} />;
            case 'stt':
                return <STTTab {...commonProps} />;
            case 'rag':
                return (
                    <RAGTab
                        {...commonProps}
                        ragCollections={ragCollections}
                        ragCollectionsLoading={ragCollectionsLoading}
                        onOpenCollectionManager={handleOpenCollectionManager}
                        onRefreshCollections={loadRAGCollections}
                    />
                );
            case 'countenance':
                return (
                    <CountenanceTab
                        connectionStatus={connectionStatus}
                        formResponses={formResponses}
                        onSendEvent={handleSendEvent}
                        onClearFormResponse={handleClearFormResponse}
                    />
                );
            default:
                return <div>Tab not found</div>;
        }
    };

    return (
        <div className="min-h-screen bg-neutral-900 text-neutral-100">
            {/* Header */}
            <div className="bg-neutral-800 border-b border-neutral-700 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-orange-400">Entity Simulator</h1>
                        <p className="text-sm text-gray-400 mt-1">
                            Test and debug AI entity modules in a controlled environment
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                            connectionStatus === 'connected' ? 'bg-green-500/20 text-green-400' :
                            connectionStatus === 'disconnected' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                        }`}>
                            {connectionStatus.toUpperCase()}
                        </div>
                        {selectedEntity && (
                            <div className="text-sm text-gray-300">
                                Entity: <span className="text-orange-400 font-medium">{selectedEntity}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-neutral-800 border-b border-neutral-700">
                <div className="flex overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-orange-400 text-orange-400 bg-neutral-700/50'
                                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-neutral-700/30'
                            }`}
                        >
                            <span className="text-sm">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1">
                {renderTabContent()}
            </div>
        </div>
    );
}

export default SimulatorView;
