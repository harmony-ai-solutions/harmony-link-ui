import React, { useState, useEffect } from 'react';
import { 
    getSimulatorEntities, 
    connectSimulator, 
    disconnectSimulator, 
    sendSimulatorEvent,
    getSimulatorEventHistory,
    getSimulatorStatus 
} from '../services/managementApiService';
import { LogDebug, LogError } from '../../utils/logger';

function SimulatorView() {
    const [activeTab, setActiveTab] = useState('connection');
    const [entities, setEntities] = useState([]);
    const [selectedEntity, setSelectedEntity] = useState('');
    const [connectionStatus, setConnectionStatus] = useState('disconnected'); // disconnected, connecting, connected, error
    const [feedback, setFeedback] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [eventHistory, setEventHistory] = useState([]);
    
    // Enhanced feedback states for each form
    const [formResponses, setFormResponses] = useState({
        backend: { loading: false, response: null, error: null },
        movement: { loading: false, response: null, error: null },
        tts: { loading: false, response: null, error: null },
        stt: { loading: false, response: null, error: null },
        rag: { loading: false, response: null, error: null }
    });

    useEffect(() => {
        loadEntities();
    }, []);

    const loadEntities = async () => {
        try {
            const entityList = await getSimulatorEntities();
            setEntities(entityList.entities || []);
            LogDebug("Loaded entities for simulator:", entityList);
            
            // Check if currently selected entity is simulated and restore connection state
            if (selectedEntity) {
                const currentEntity = entityList.entities?.find(entity => entity.id === selectedEntity);
                if (currentEntity?.is_simulated && connectionStatus !== 'connected') {
                    setConnectionStatus('connected');
                    setFeedback(`✅ Restored connection to simulated entity: ${selectedEntity}`);
                    // Load event history for the restored entity
                    try {
                        const history = await getSimulatorEventHistory(selectedEntity, 50);
                        setEventHistory(history.events || []);
                    } catch (historyError) {
                        LogError("Failed to load event history for restored entity:", historyError);
                    }
                } else if (!currentEntity?.is_simulated && connectionStatus === 'connected') {
                    // Entity is no longer simulated, disconnect
                    setConnectionStatus('disconnected');
                    setEventHistory([]);
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
                        const history = await getSimulatorEventHistory(simulatedEntity.id, 50);
                        setEventHistory(history.events || []);
                    } catch (historyError) {
                        LogError("Failed to load event history for restored entity:", historyError);
                    }
                }
            }
        } catch (error) {
            LogError("Failed to load entities for simulator:", error);
            setFeedback(`Error loading entities: ${error.message}`);
        }
    };

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
            loadEventHistory();
            return;
        }
        
        setIsLoading(true);
        setFeedback('Connecting...');
        setConnectionStatus('connecting');
        try {
            const result = await connectSimulator(selectedEntity);
            setConnectionStatus('connected');
            setFeedback(`✅ Successfully connected to simulated entity: ${selectedEntity}`);
            LogDebug("Simulator connected:", result);
            // Load initial event history
            loadEventHistory();
            // Refresh entities to update the is_simulated flag
            await loadEntities();
        } catch (error) {
            setConnectionStatus('error');
            setFeedback(`❌ Failed to connect: ${error.message}`);
            LogError("Simulator connection failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!selectedEntity) {
            setFeedback('No entity selected to disconnect.');
            return;
        }
        setIsLoading(true);
        setFeedback('Disconnecting...');
        try {
            const result = await disconnectSimulator(selectedEntity);
            setConnectionStatus('disconnected');
            setFeedback(`✅ Successfully disconnected from simulated entity: ${selectedEntity}`);
            setEventHistory([]);
            clearAllFormResponses();
            LogDebug("Simulator disconnected:", result);
            // Refresh entities to update the is_simulated flag
            await loadEntities();
        } catch (error) {
            setFeedback(`❌ Failed to disconnect: ${error.message}`);
            LogError("Simulator disconnection failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadEventHistory = async () => {
        if (!selectedEntity || connectionStatus !== 'connected') return;
        try {
            const history = await getSimulatorEventHistory(selectedEntity, 50);
            setEventHistory(history.events || []);
        } catch (error) {
            LogError("Failed to load event history:", error);
        }
    };

    const sendEvent = async (event, formType = null) => {
        if (!selectedEntity || connectionStatus !== 'connected') {
            setFeedback('No active simulator connection.');
            return;
        }
        
        // Set loading state for specific form
        if (formType) {
            setFormResponses(prev => ({
                ...prev,
                [formType]: { loading: true, response: null, error: null }
            }));
        }
        
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
                    
                    if (formType) {
                        setFormResponses(prev => ({
                            ...prev,
                            [formType]: {
                                loading: false,
                                response: responseEvent,
                                error: responseEvent?.event?.status === 'ERROR' ? responseEvent.event.payload : null
                            }
                        }));
                    }
                    
                    // Refresh event history
                    loadEventHistory();
                } catch (error) {
                    if (formType) {
                        setFormResponses(prev => ({
                            ...prev,
                            [formType]: { loading: false, response: null, error: error.message }
                        }));
                    }
                }
            }, 1000);
            
        } catch (error) {
            LogError("Failed to send simulator event:", error);
            setFeedback(`❌ Failed to send event: ${error.message}`);
            
            if (formType) {
                setFormResponses(prev => ({
                    ...prev,
                    [formType]: { loading: false, response: null, error: error.message }
                }));
            }
        }
    };

    const clearFormResponse = (formType) => {
        setFormResponses(prev => ({
            ...prev,
            [formType]: { loading: false, response: null, error: null }
        }));
    };

    const clearAllFormResponses = () => {
        setFormResponses({
            backend: { loading: false, response: null, error: null },
            movement: { loading: false, response: null, error: null },
            tts: { loading: false, response: null, error: null },
            stt: { loading: false, response: null, error: null },
            rag: { loading: false, response: null, error: null }
        });
    };

    const syncEntityState = async (entityId) => {
        if (!entityId) {
            setConnectionStatus('disconnected');
            setEventHistory([]);
            setFeedback('');
            clearAllFormResponses();
            return;
        }

        const entity = entities.find(e => e.id === entityId);
        if (entity?.is_simulated) {
            setConnectionStatus('connected');
            setFeedback(`✅ Selected already simulated entity: ${entityId}`);
            // Load event history for the selected entity
            try {
                const history = await getSimulatorEventHistory(entityId, 50);
                setEventHistory(history.events || []);
            } catch (error) {
                LogError("Failed to load event history:", error);
            }
        } else {
            setConnectionStatus('disconnected');
            setEventHistory([]);
            setFeedback(`Selected entity: ${entityId} (not currently simulated)`);
            clearAllFormResponses();
        }
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'connection':
                return renderConnectionTab();
            case 'backend':
                return renderBackendTab();
            case 'movement':
                return renderMovementTab();
            case 'tts':
                return renderTTSTab();
            case 'stt':
                return renderSTTTab();
            case 'rag':
                return renderRAGTab();
            case 'countenance':
                return renderCountenanceTab();
            case 'monitor':
                return renderEventMonitorTab();
            default:
                return <div className="p-4">Tab content not implemented yet.</div>;
        }
    };

    const renderConnectionTab = () => (
        <div className="p-4">
            <h3 className="text-xl font-semibold text-orange-400 mb-4">Connection Management</h3>
            
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select Entity from Config:
                </label>
                <select
                    value={selectedEntity}
                    onChange={(e) => {
                        const newEntityId = e.target.value;
                        setSelectedEntity(newEntityId);
                        syncEntityState(newEntityId);
                    }}
                    className="w-full p-2 bg-neutral-700 border border-neutral-600 rounded text-neutral-100"
                    disabled={isLoading}
                >
                    <option value="">Select an entity...</option>
                    {entities.map(entity => (
                        <option key={entity.id} value={entity.id}>
                            {entity.id} {entity.is_simulated ? '(Already Simulated)' : ''}
                        </option>
                    ))}
                </select>
                <button 
                    onClick={loadEntities}
                    className="mt-2 bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 text-orange-400 rounded"
                    disabled={isLoading}
                >
                    Refresh Entities
                </button>
            </div>

            <div className="flex gap-4 mb-4">
                <button
                    onClick={handleConnect}
                    disabled={isLoading || connectionStatus === 'connected' || !selectedEntity}
                    className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
                >
                    {isLoading && connectionStatus === 'connecting' ? 'Connecting...' : 'Simulate Connection'}
                </button>
                <button
                    onClick={handleDisconnect}
                    disabled={isLoading || connectionStatus === 'disconnected' || !selectedEntity}
                    className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
                >
                    {isLoading && connectionStatus === 'disconnecting' ? 'Disconnecting...' : 'Disconnect'}
                </button>
            </div>

            <div className="mb-4">
                <p className="text-sm font-medium text-gray-300">
                    Connection Status: 
                    <span className={`font-bold ml-2 ${
                        connectionStatus === 'connected' ? 'text-green-500' : 
                        connectionStatus === 'disconnected' ? 'text-red-500' : 
                        'text-yellow-500'
                    }`}>
                        {connectionStatus.toUpperCase()}
                    </span>
                </p>
            </div>

            {selectedEntity && entities.find(e => e.id === selectedEntity) && (
                <div className="mb-4 p-3 bg-neutral-700 rounded">
                    <h4 className="text-lg font-medium text-orange-400 mb-2">Entity Configuration</h4>
                    <div className="text-sm text-gray-300">
                        <p><strong>Entity ID:</strong> {selectedEntity}</p>
                        {(() => {
                            const entity = entities.find(e => e.id === selectedEntity);
                            const modules = entity?.modules || {};
                            return (
                                <div className="mt-2">
                                    <strong>Active Modules:</strong>
                                    <div className="grid grid-cols-3 gap-2 mt-1">
                                        {Object.entries(modules).map(([module, isActive]) => (
                                            <span key={module} className={`text-xs px-2 py-1 rounded ${
                                                isActive ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
                                            }`}>
                                                {module.toUpperCase()}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {feedback && (
                <div className="p-3 bg-neutral-700 rounded text-sm font-mono whitespace-pre-wrap">
                    {feedback}
                </div>
            )}
        </div>
    );

    const renderBackendTab = () => (
        <div className="p-4">
            <h3 className="text-xl font-semibold text-orange-400 mb-4">Backend Module Simulation</h3>
            {connectionStatus !== 'connected' ? (
                <p className="text-gray-400">Please connect to an entity first.</p>
            ) : (
                <div className="space-y-6">
                    <div>
                        <h4 className="text-lg font-medium text-gray-300 mb-2">Send User Utterance</h4>
                        <UserUtteranceForm 
                            onSendEvent={(event) => sendEvent(event, 'backend')} 
                            formState={formResponses.backend}
                            onClearResponse={() => clearFormResponse('backend')}
                        />
                    </div>
                    <div>
                        <h4 className="text-lg font-medium text-gray-300 mb-2">Request Chat History</h4>
                        <button
                            onClick={() => sendEvent({
                                event_type: 'CHAT_HISTORY',
                                status: 'NEW',
                                payload: {}
                            }, 'backend')}
                            className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded"
                        >
                            Request Chat History
                        </button>
                    </div>
                    <FormResponseDisplay 
                        formState={formResponses.backend}
                        onClear={() => clearFormResponse('backend')}
                    />
                </div>
            )}
        </div>
    );

    const renderMovementTab = () => (
        <div className="p-4">
            <h3 className="text-xl font-semibold text-orange-400 mb-4">Movement Module Simulation</h3>
            {connectionStatus !== 'connected' ? (
                <p className="text-gray-400">Please connect to an entity first.</p>
            ) : (
                <div className="space-y-6">
                    <div>
                        <h4 className="text-lg font-medium text-gray-300 mb-2">Environment Events</h4>
                        <button
                            onClick={() => sendEvent({
                                event_type: 'ENVIRONMENT_LOADED',
                                status: 'NEW',
                                payload: {}
                            }, 'movement')}
                            className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded mr-2"
                        >
                            Send Environment Loaded
                        </button>
                    </div>
                    <div>
                        <h4 className="text-lg font-medium text-gray-300 mb-2">Scene Data</h4>
                        <SceneDataForm 
                            onSendEvent={(event) => sendEvent(event, 'movement')} 
                            formState={formResponses.movement}
                            onClearResponse={() => clearFormResponse('movement')}
                        />
                    </div>
                    <div>
                        <h4 className="text-lg font-medium text-gray-300 mb-2">Register Actions</h4>
                        <RegisterActionsForm 
                            onSendEvent={(event) => sendEvent(event, 'movement')} 
                            formState={formResponses.movement}
                            onClearResponse={() => clearFormResponse('movement')}
                        />
                    </div>
                    <FormResponseDisplay 
                        formState={formResponses.movement}
                        onClear={() => clearFormResponse('movement')}
                    />
                </div>
            )}
        </div>
    );

    const renderTTSTab = () => (
        <div className="p-4">
            <h3 className="text-xl font-semibold text-orange-400 mb-4">TTS Module Simulation</h3>
            {connectionStatus !== 'connected' ? (
                <p className="text-gray-400">Please connect to an entity first.</p>
            ) : (
                <div className="space-y-6">
                    <TTSForm 
                        onSendEvent={(event) => sendEvent(event, 'tts')} 
                        formState={formResponses.tts}
                        onClearResponse={() => clearFormResponse('tts')}
                    />
                    <FormResponseDisplay 
                        formState={formResponses.tts}
                        onClear={() => clearFormResponse('tts')}
                    />
                </div>
            )}
        </div>
    );

    const renderSTTTab = () => (
        <div className="p-4">
            <h3 className="text-xl font-semibold text-orange-400 mb-4">STT Module Simulation</h3>
            {connectionStatus !== 'connected' ? (
                <p className="text-gray-400">Please connect to an entity first.</p>
            ) : (
                <div className="space-y-6">
                    <STTForm 
                        onSendEvent={(event) => sendEvent(event, 'stt')} 
                        formState={formResponses.stt}
                        onClearResponse={() => clearFormResponse('stt')}
                    />
                    <FormResponseDisplay 
                        formState={formResponses.stt}
                        onClear={() => clearFormResponse('stt')}
                    />
                </div>
            )}
        </div>
    );

    const renderRAGTab = () => (
        <div className="p-4">
            <h3 className="text-xl font-semibold text-orange-400 mb-4">RAG Module Simulation</h3>
            {connectionStatus !== 'connected' ? (
                <p className="text-gray-400">Please connect to an entity first.</p>
            ) : (
                <div className="space-y-6">
                    <div>
                        <h4 className="text-lg font-medium text-gray-300 mb-2">Sync Actions</h4>
                        <RAGSyncActionsForm 
                            onSendEvent={(event) => sendEvent(event, 'rag')} 
                            formState={formResponses.rag}
                            onClearResponse={() => clearFormResponse('rag')}
                        />
                    </div>
                    <div>
                        <h4 className="text-lg font-medium text-gray-300 mb-2">Match Actions</h4>
                        <RAGMatchActionsForm 
                            onSendEvent={(event) => sendEvent(event, 'rag')} 
                            formState={formResponses.rag}
                            onClearResponse={() => clearFormResponse('rag')}
                        />
                    </div>
                    <FormResponseDisplay 
                        formState={formResponses.rag}
                        onClear={() => clearFormResponse('rag')}
                    />
                </div>
            )}
        </div>
    );

    const renderCountenanceTab = () => (
        <div className="p-4">
            <h3 className="text-xl font-semibold text-orange-400 mb-4">Countenance Module Simulation</h3>
            {connectionStatus !== 'connected' ? (
                <p className="text-gray-400">Please connect to an entity first.</p>
            ) : (
                <div>
                    <p className="text-gray-400">Countenance events are automatically generated by other modules.</p>
                    <p className="text-gray-400">Monitor the Event Monitor tab to see countenance updates.</p>
                </div>
            )}
        </div>
    );

    const renderEventMonitorTab = () => (
        <div className="p-4">
            <h3 className="text-xl font-semibold text-orange-400 mb-4">Event Monitor</h3>
            {connectionStatus !== 'connected' ? (
                <p className="text-gray-400">Please connect to an entity first.</p>
            ) : (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-lg font-medium text-gray-300">Event History</h4>
                        <button
                            onClick={loadEventHistory}
                            className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 text-orange-400 rounded"
                        >
                            Refresh
                        </button>
                    </div>
                    <EventHistoryDisplay events={eventHistory} />
                </div>
            )}
        </div>
    );

    return (
        <div className="p-6 bg-neutral-800 text-white">
            <h2 className="text-2xl font-bold text-orange-400 mb-6">Entity Simulator</h2>
            
            {/* Tab Navigation */}
            <div className="flex flex-wrap gap-2 mb-6 border-b border-neutral-600">
                {[
                    { id: 'connection', label: 'Connection' },
                    { id: 'backend', label: 'Backend' },
                    { id: 'movement', label: 'Movement' },
                    { id: 'tts', label: 'TTS' },
                    { id: 'stt', label: 'STT' },
                    { id: 'rag', label: 'RAG' },
                    { id: 'countenance', label: 'Countenance' },
                    { id: 'monitor', label: 'Event Monitor' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 font-medium rounded-t-lg ${
                            activeTab === tab.id
                                ? 'bg-orange-400 text-neutral-900'
                                : 'bg-neutral-700 text-gray-300 hover:bg-neutral-600'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="bg-neutral-700 rounded-lg min-h-96">
                {renderTabContent()}
            </div>
        </div>
    );
}

// Enhanced Form Response Display Component
function FormResponseDisplay({ formState, onClear }) {
    if (!formState.loading && !formState.response && !formState.error) {
        return null;
    }

    // Helper function to safely format payload for display
    const formatPayload = (payload) => {
        if (payload === null || payload === undefined) {
            return 'null';
        }
        
        if (typeof payload === 'string') {
            return payload;
        }
        
        try {
            return JSON.stringify(payload, null, 2);
        } catch (error) {
            return '[Unable to serialize payload]';
        }
    };

    return (
        <div className="mt-4 p-3 bg-neutral-600 rounded">
            <div className="flex justify-between items-center mb-2">
                <h5 className="text-sm font-medium text-orange-400">Response</h5>
                <button
                    onClick={onClear}
                    className="text-xs text-gray-400 hover:text-gray-200"
                >
                    Clear
                </button>
            </div>
            
            {formState.loading && (
                <div className="flex items-center text-yellow-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400 mr-2"></div>
                    Processing...
                </div>
            )}
            
            {formState.error && (
                <div className="text-red-400">
                    <strong>Error:</strong> {typeof formState.error === 'string' ? formState.error : formatPayload(formState.error)}
                </div>
            )}
            
            {formState.response && (
                <div className="space-y-2">
                    <div className="text-sm">
                        <strong>Status:</strong> 
                        <span className={`ml-2 ${
                            formState.response.event?.status === 'SUCCESS' ? 'text-green-400' : 
                            formState.response.event?.status === 'ERROR' ? 'text-red-400' : 
                            'text-yellow-400'
                        }`}>
                            {formState.response.event?.status || 'Unknown'}
                        </span>
                    </div>
                    <div className="text-sm">
                        <strong>Event Type:</strong> {formState.response.event?.event_type}
                    </div>
                    <div className="text-sm">
                        <strong>Timestamp:</strong> {new Date(formState.response.timestamp).toLocaleString()}
                    </div>
                    {formState.response.event?.payload && (
                        <details className="mt-2">
                            <summary className="cursor-pointer text-orange-400 text-sm">Response Data</summary>
                            <pre className="mt-2 text-xs text-gray-300 whitespace-pre-wrap overflow-auto max-h-32 bg-neutral-800 p-2 rounded">
                                {formatPayload(formState.response.event.payload)}
                            </pre>
                        </details>
                    )}
                </div>
            )}
        </div>
    );
}

// Enhanced Helper Components
function UserUtteranceForm({ onSendEvent, formState, onClearResponse }) {
    const [content, setContent] = useState('');
    const [utteranceType, setUtteranceType] = useState('UTTERANCE_VERBAL');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!content.trim()) return;

        onSendEvent({
            event_type: 'USER_UTTERANCE',
            status: 'NEW',
            payload: {
                type: utteranceType,
                content: content.trim()
            }
        });
        setContent('');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Utterance Type:</label>
                <select
                    value={utteranceType}
                    onChange={(e) => setUtteranceType(e.target.value)}
                    className="w-full p-2 bg-neutral-600 border border-neutral-500 rounded text-neutral-100"
                >
                    <option value="UTTERANCE_VERBAL">Verbal</option>
                    <option value="UTTERANCE_NONVERBAL">Non-verbal</option>
                    <option value="UTTERANCE_COMBINED">Combined</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Content:</label>
                <input
                    type="text"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter utterance content..."
                    className="w-full p-2 bg-neutral-600 border border-neutral-500 rounded text-neutral-100"
                />
            </div>
            <button
                type="submit"
                disabled={!content.trim() || formState.loading}
                className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
            >
                {formState.loading ? 'Sending...' : 'Send Utterance'}
            </button>
        </form>
    );
}

function SceneDataForm({ onSendEvent, formState, onClearResponse }) {
    const [sceneData, setSceneData] = useState(JSON.stringify({
        characters: [
            { name: "TestCharacter", position: [0, 0, 0], orientation: [0, 0, 0] },
            { name: "Player", position: [2, 0, 0], orientation: [0, 180, 0] }
        ],
        objects: [
            { name: "Chair", position: [1, 0, 1], orientation: [0, 0, 0] },
            { name: "Table", position: [0, 0, 2], orientation: [0, 0, 0] }
        ]
    }, null, 2));

    const handleSubmit = (e) => {
        e.preventDefault();
        try {
            const parsedData = JSON.parse(sceneData);
            onSendEvent({
                event_type: 'MOVEMENT_V1_UPDATE_SCENE_DATA',
                status: 'NEW',
                payload: parsedData
            });
        } catch (error) {
            alert('Invalid JSON: ' + error.message);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Scene Data (JSON):</label>
                <textarea
                    value={sceneData}
                    onChange={(e) => setSceneData(e.target.value)}
                    className="w-full h-32 p-2 bg-neutral-600 border border-neutral-500 rounded text-neutral-100 font-mono text-sm"
                />
            </div>
            <button
                type="submit"
                disabled={formState.loading}
                className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
            >
                {formState.loading ? 'Sending...' : 'Send Scene Data'}
            </button>
        </form>
    );
}

function RegisterActionsForm({ onSendEvent, formState, onClearResponse }) {
    const [actionsData, setActionsData] = useState(JSON.stringify({
        actions: [
            {
                name: "wave",
                examples: [
                    "wave at {{character}}",
                    "wave hello to {{character}}",
                    "greet {{character}} with a wave"
                ],
                confirmations: [
                    "waving at {{character}}",
                    "greeting {{character}} with a wave"
                ],
                rejections: [
                    "can't wave right now",
                    "unable to wave at {{character}}"
                ]
            },
            {
                name: "sit",
                examples: [
                    "sit down on {{object}}",
                    "take a seat on {{object}}",
                    "sit on the {{object}}"
                ],
                confirmations: [
                    "sitting down on {{object}}",
                    "taking a seat on {{object}}"
                ],
                rejections: [
                    "can't sit on {{object}}",
                    "{{object}} is not suitable for sitting"
                ]
            }
        ]
    }, null, 2));

    const handleSubmit = (e) => {
        e.preventDefault();
        try {
            const parsedData = JSON.parse(actionsData);
            onSendEvent({
                event_type: 'MOVEMENT_V1_REGISTER_ACTIONS',
                status: 'NEW',
                payload: parsedData
            });
        } catch (error) {
            alert('Invalid JSON: ' + error.message);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Actions Data (JSON):</label>
                <textarea
                    value={actionsData}
                    onChange={(e) => setActionsData(e.target.value)}
                    className="w-full h-40 p-2 bg-neutral-600 border border-neutral-500 rounded text-neutral-100 font-mono text-sm"
                />
            </div>
            <button
                type="submit"
                disabled={formState.loading}
                className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
            >
                {formState.loading ? 'Sending...' : 'Register Actions'}
            </button>
        </form>
    );
}

function RAGSyncActionsForm({ onSendEvent, formState, onClearResponse }) {
    const [actionsData, setActionsData] = useState(JSON.stringify({
        actions: [
            {
                name: "wave",
                examples: [
                    "wave at {{character}}",
                    "wave hello to {{character}}",
                    "greet {{character}} with a wave"
                ],
                confirmations: [
                    "waving at {{character}}",
                    "greeting {{character}} with a wave"
                ],
                rejections: [
                    "can't wave right now",
                    "unable to wave at {{character}}"
                ]
            }
        ]
    }, null, 2));

    const handleSubmit = (e) => {
        e.preventDefault();
        try {
            const parsedData = JSON.parse(actionsData);
            onSendEvent({
                event_type: 'RAG_SYNC_ACTIONS',
                status: 'NEW',
                payload: parsedData
            });
        } catch (error) {
            alert('Invalid JSON: ' + error.message);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Actions Data (JSON):</label>
                <textarea
                    value={actionsData}
                    onChange={(e) => setActionsData(e.target.value)}
                    className="w-full h-40 p-2 bg-neutral-600 border border-neutral-500 rounded text-neutral-100 font-mono text-sm"
                />
            </div>
            <div className="text-xs text-gray-400 mb-2">
                Define actions with examples, confirmations, and rejections for RAG matching
            </div>
            <button
                type="submit"
                disabled={formState.loading}
                className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
            >
                {formState.loading ? 'Syncing...' : 'Sync Actions'}
            </button>
        </form>
    );
}

function RAGMatchActionsForm({ onSendEvent, formState, onClearResponse }) {
    const [utteranceText, setUtteranceText] = useState('');
    const [utteranceType, setUtteranceType] = useState('UTTERANCE_VERBAL');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!utteranceText.trim()) return;

        onSendEvent({
            event_type: 'RAG_MATCH_ACTIONS',
            status: 'NEW',
            payload: {
                type: utteranceType,
                content: utteranceText.trim()
            }
        });
        setUtteranceText('');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Utterance Type:</label>
                <select
                    value={utteranceType}
                    onChange={(e) => setUtteranceType(e.target.value)}
                    className="w-full p-2 bg-neutral-600 border border-neutral-500 rounded text-neutral-100"
                >
                    <option value="UTTERANCE_VERBAL">Verbal</option>
                    <option value="UTTERANCE_NONVERBAL">Non-verbal</option>
                    <option value="UTTERANCE_COMBINED">Combined</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Utterance Text:</label>
                <input
                    type="text"
                    value={utteranceText}
                    onChange={(e) => setUtteranceText(e.target.value)}
                    placeholder="Enter text to match against actions..."
                    className="w-full p-2 bg-neutral-600 border border-neutral-500 rounded text-neutral-100"
                />
            </div>
            <div className="text-xs text-gray-400 mb-2">
                Test action matching by providing an utterance to match against synced actions
            </div>
            <button
                type="submit"
                disabled={!utteranceText.trim() || formState.loading}
                className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
            >
                {formState.loading ? 'Matching...' : 'Match Actions'}
            </button>
        </form>
    );
}

function TTSForm({ onSendEvent, formState, onClearResponse }) {
    const [text, setText] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!text.trim()) return;

        onSendEvent({
            event_type: 'TTS_GENERATE_SPEECH',
            status: 'NEW',
            payload: {
                type: 'UTTERANCE_VERBAL',
                content: text.trim()
            }
        });
        setText('');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Text to Synthesize:</label>
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter text for TTS..."
                    className="w-full p-2 bg-neutral-600 border border-neutral-500 rounded text-neutral-100"
                />
            </div>
            <button
                type="submit"
                disabled={!text.trim() || formState.loading}
                className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
            >
                {formState.loading ? 'Generating...' : 'Generate Speech'}
            </button>
        </form>
    );
}

function STTForm({ onSendEvent, formState, onClearResponse }) {
    const [audioData, setAudioData] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!audioData.trim()) return;

        onSendEvent({
            event_type: 'STT_INPUT_AUDIO',
            status: 'NEW',
            payload: {
                audio_bytes: audioData.trim()
            }
        });
        setAudioData('');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Audio Data (Base64):</label>
                <textarea
                    value={audioData}
                    onChange={(e) => setAudioData(e.target.value)}
                    placeholder="Enter base64 encoded audio data..."
                    className="w-full h-24 p-2 bg-neutral-600 border border-neutral-500 rounded text-neutral-100 font-mono text-sm"
                />
            </div>
            <button
                type="submit"
                disabled={!audioData.trim()}
                className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
            >
                Send Audio Data
            </button>
        </form>
    );
}

function EventHistoryDisplay({ events }) {
    if (!events || events.length === 0) {
        return <p className="text-gray-400">No events recorded yet.</p>;
    }

    return (
        <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.slice().reverse().map((event, index) => (
                <div key={index} className="p-3 bg-neutral-600 rounded text-sm">
                    <div className="flex justify-between items-start mb-2">
                        <span className={`font-medium ${
                            event.direction === 'incoming' ? 'text-blue-400' : 'text-green-400'
                        }`}>
                            {event.direction === 'incoming' ? '→' : '←'} {event.event.event_type}
                        </span>
                        <span className="text-gray-400 text-xs">
                            {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                    </div>
                    <div className="text-gray-300">
                        <strong>Status:</strong> {event.event.status}
                    </div>
                    {event.event.payload && (
                        <details className="mt-2">
                            <summary className="cursor-pointer text-orange-400">Payload</summary>
                            <pre className="mt-1 text-xs text-gray-300 whitespace-pre-wrap overflow-auto max-h-32">
                                {JSON.stringify(event.event.payload, null, 2)}
                            </pre>
                        </details>
                    )}
                </div>
            ))}
        </div>
    );
}

export default SimulatorView;
