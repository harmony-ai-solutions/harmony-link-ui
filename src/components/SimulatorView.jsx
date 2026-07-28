import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
    getSimulatorEntities,
    connectSimulator,
    disconnectSimulator,
    sendSimulatorEvent,
    getSimulatorEventHistory,
    getSimulatorGroupedEventHistory
} from '../services/management/simulatorService.js';
import {getConfig} from '../services/management/configService.js';
import {getEntityRAGCollections} from '../services/management/ragService.js';

import ConnectionTab from './simulator/tabs/ConnectionTab';
import EventMonitorTab from './simulator/tabs/EventMonitorTab';
import BackendTab from './simulator/tabs/BackendTab';
import MovementTab from './simulator/tabs/MovementTab';
import TTSTab from './simulator/tabs/TTSTab';
import STTTab from './simulator/tabs/STTTab';
import RAGTab from './simulator/tabs/RAGTab';
import CognitionTab from './simulator/tabs/CognitionTab';

function SimulatorView() {
    const { t } = useTranslation();
    const ts = (key, opts) => t(`simulator:${key}`, opts);

    const [entities, setEntities] = useState([]);
    const [selectedEntity, setSelectedEntity] = useState('');
    const [connectionStatus, setConnectionStatus] = useState('disconnected');
    const [feedback, setFeedback] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [eventHistory, setEventHistory] = useState([]);
    const [groupedEventHistory, setGroupedEventHistory] = useState([]);
    const [useGroupedView, setUseGroupedView] = useState(true);

    const [moduleConfigs, setModuleConfigs] = useState({
        backend: null, movement: null, tts: null, stt: null, rag: null, cognition: null
    });
    const [moduleConfigsLoading, setModuleConfigsLoading] = useState(false);
    const [moduleConfigErrors, setModuleConfigErrors] = useState({});

    const [formResponses, setFormResponses] = useState({
        backend: { loading: false, response: null, error: null },
        movement: { loading: false, response: null, error: null },
        tts: { loading: false, response: null, error: null },
        stt: { loading: false, response: null, error: null },
        rag: { loading: false, response: null, error: null },
        cognition: { loading: false, response: null, error: null }
    });

    const [ragCollections, setRagCollections] = useState([]);
    const [ragCollectionsLoading, setRagCollectionsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('connection');

    useEffect(() => { loadEntities(); }, []);

    useEffect(() => {
        if (selectedEntity && connectionStatus === 'connected') {
            console.log("Loading module configurations for entity:", selectedEntity);
            loadModuleConfigurations();
            if (activeTab === 'rag') loadRAGCollections();
        }
    }, [selectedEntity, connectionStatus, activeTab]);

    const loadEntities = async () => {
        try {
            setIsLoading(true);
            const entityList = await getSimulatorEntities();
            setEntities(entityList.entities || []);
            console.log("Loaded entities for simulator:", entityList);

            if (selectedEntity) {
                const currentEntity = entityList.entities?.find(entity => entity.id === selectedEntity);
                if (currentEntity?.is_simulated && connectionStatus !== 'connected') {
                    setConnectionStatus('connected');
                    setFeedback(ts('messages.connectionRestored', { entity: selectedEntity }));
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
                    setConnectionStatus('disconnected');
                    setEventHistory([]);
                    setGroupedEventHistory([]);
                    setFeedback(ts('messages.connectionLost', { entity: selectedEntity }));
                }
            } else {
                const simulatedEntity = entityList.entities?.find(entity => entity.is_simulated);
                if (simulatedEntity && connectionStatus === 'disconnected') {
                    setSelectedEntity(simulatedEntity.id);
                    setConnectionStatus('connected');
                    setFeedback(ts('messages.autoRestored', { entity: simulatedEntity.id }));
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
            setFeedback(ts('messages.errorLoadingEntities', { message: error.message }));
        } finally {
            setIsLoading(false);
        }
    };

    const syncEntityState = useCallback(async (entityId) => {
        if (!entityId) {
            setConnectionStatus('disconnected');
            setEventHistory([]);
            setGroupedEventHistory([]);
            setFeedback('');
            clearAllFormResponses();
            setModuleConfigs({ backend: null, movement: null, tts: null, stt: null, rag: null, cognition: null });
            setRagCollections([]);
            return;
        }
        const entity = entities.find(e => e.id === entityId);
        if (entity?.is_simulated) {
            setConnectionStatus('connected');
            setFeedback(ts('messages.alreadySimulated', { entity: entityId }));
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
            await loadModuleConfigurations();
        } else {
            setConnectionStatus('disconnected');
            setEventHistory([]);
            setGroupedEventHistory([]);
            setFeedback(ts('messages.selectedEntity', { entity: entityId }) + ' ' + ts('messages.notCurrentlySimulated'));
            clearAllFormResponses();
            setModuleConfigs({ backend: null, movement: null, tts: null, stt: null, rag: null, cognition: null });
            setRagCollections([]);
        }
    }, [entities, ts]);

    const handleConnect = async () => {
        if (!selectedEntity) {
            setFeedback(ts('messages.selectEntity'));
            return;
        }
        const entity = entities.find(e => e.id === selectedEntity);
        if (entity?.is_simulated) {
            setConnectionStatus('connected');
            setFeedback(ts('messages.connectionRestored', { entity: selectedEntity }));
            await loadEventHistory();
            return;
        }
        try {
            setIsLoading(true);
            setConnectionStatus('connecting');
            setFeedback(t('common:status.connecting'));
            const response = await connectSimulator(selectedEntity);
            setConnectionStatus('connected');
            setFeedback(ts('messages.connectedSuccessfully', { entity: selectedEntity }));
            console.log("Simulator connected:", response);
            await loadModuleConfigurations();
            await loadEventHistory();
            await loadRAGCollections();
            await loadEntities();
        } catch (error) {
            setConnectionStatus('disconnected');
            setFeedback(ts('messages.connectionFailed', { message: error.message }));
            console.error("Simulator connection failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDisconnect = async () => {
        if (!selectedEntity) {
            setFeedback(ts('messages.noEntityDisconnect'));
            return;
        }
        try {
            setIsLoading(true);
            setConnectionStatus('disconnecting');
            setFeedback(t('common:status.disconnecting'));
            await disconnectSimulator(selectedEntity);
            setConnectionStatus('disconnected');
            setFeedback(ts('messages.disconnectedSuccessfully'));
            setEventHistory([]);
            setGroupedEventHistory([]);
            setModuleConfigs({ backend: null, movement: null, tts: null, stt: null, rag: null, cognition: null });
            clearAllFormResponses();
            await loadEntities();
        } catch (error) {
            setFeedback(ts('messages.disconnectFailed', { message: error.message }));
            console.error("Simulator disconnection failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadModuleConfigurations = async () => {
        if (!selectedEntity) return;
        setModuleConfigsLoading(true);
        setModuleConfigErrors({});
        try {
            const config = await getConfig();
            const entityConfig = config.entities?.[selectedEntity];
            if (entityConfig) {
                const newModuleConfigs = {
                    backend: entityConfig.backend || null,
                    movement: entityConfig.movement || null,
                    tts: entityConfig.tts || null,
                    stt: entityConfig.stt || null,
                    rag: entityConfig.rag || null,
                    cognition: entityConfig.cognition || null
                };
                setModuleConfigs(newModuleConfigs);
                const errors = {};
                Object.entries(newModuleConfigs).forEach(([module, cfg]) => {
                    if (!cfg) errors[module] = ts('messages.noConfigFound', { module });
                });
                setModuleConfigErrors(errors);
            } else {
                setModuleConfigErrors({
                    backend: ts('messages.entityConfigNotFound'),
                    movement: ts('messages.entityConfigNotFound'),
                    tts: ts('messages.entityConfigNotFound'),
                    stt: ts('messages.entityConfigNotFound'),
                    rag: ts('messages.entityConfigNotFound'),
                    cognition: ts('messages.entityConfigNotFound')
                });
            }
        } catch (error) {
            console.error('Failed to load module configurations:', error);
            const errMsg = ts('messages.failedToLoadConfig', { message: error.message });
            setModuleConfigErrors({ backend: errMsg, movement: errMsg, tts: errMsg, stt: errMsg, rag: errMsg, cognition: errMsg });
        } finally {
            setModuleConfigsLoading(false);
        }
    };

    const loadEventHistory = async () => {
        if (!selectedEntity || connectionStatus !== 'connected') return;
        try {
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

    const loadRAGCollections = async () => {
        if (!selectedEntity) return;
        setRagCollectionsLoading(true);
        try {
            const response = await getEntityRAGCollections(selectedEntity);
            setRagCollections(response.collections || []);
        } catch (error) {
            console.error('Failed to load RAG collections:', error);
        } finally {
            setRagCollectionsLoading(false);
        }
    };

    const handleSendEvent = async (event, module) => {
        if (!selectedEntity || connectionStatus !== 'connected') {
            setFormResponses(prev => ({
                ...prev,
                [module]: { loading: false, response: null, error: ts('messages.noConnection') }
            }));
            return;
        }
        setFormResponses(prev => ({ ...prev, [module]: { loading: true, response: null, error: null } }));
        try {
            const eventId = event.event_id || `${event.event_type}-${Date.now()}`;
            const eventWithId = { ...event, event_id: eventId };
            await sendSimulatorEvent(selectedEntity, eventWithId);
            setTimeout(async () => {
                try {
                    const history = await getSimulatorEventHistory(selectedEntity, 50);
                    const relatedEvents = history.events?.filter(e =>
                        e.event?.event_id === eventId || e.event?.event_type === event.event_type) || [];
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

    const handleClearFormResponse = (module) => {
        setFormResponses(prev => ({ ...prev, [module]: { loading: false, response: null, error: null } }));
    };

    const clearAllFormResponses = () => {
        setFormResponses({
            backend: { loading: false, response: null, error: null },
            movement: { loading: false, response: null, error: null },
            tts: { loading: false, response: null, error: null },
            stt: { loading: false, response: null, error: null },
            rag: { loading: false, response: null, error: null },
            cognition: { loading: false, response: null, error: null }
        });
    };

    const handleOpenCollectionManager = () => {
        console.log('Opening collection manager...');
    };

    const tabs = [
        { id: 'connection', label: ts('tabs.connection'), icon: '🔗' },
        { id: 'events', label: ts('tabs.eventMonitor'), icon: '📊' },
        { id: 'backend', label: ts('tabs.backend'), icon: '🧠' },
        { id: 'movement', label: ts('tabs.movement'), icon: '🎯' },
        { id: 'tts', label: ts('tabs.tts'), icon: '🔊' },
        { id: 'stt', label: ts('tabs.stt'), icon: '🎤' },
        { id: 'rag', label: ts('tabs.rag'), icon: '💡' },
        { id: 'cognition', label: ts('tabs.cognition'), icon: '😊' }
    ];

    const renderTabContent = () => {
        const commonProps = {
            connectionStatus, moduleConfigs, moduleConfigsLoading, moduleConfigErrors,
            formResponses, onSendEvent: handleSendEvent, onClearFormResponse: handleClearFormResponse
        };
        switch (activeTab) {
            case 'connection':
                return <ConnectionTab entities={entities} selectedEntity={selectedEntity}
                    setSelectedEntity={setSelectedEntity} connectionStatus={connectionStatus}
                    feedback={feedback} isLoading={isLoading}
                    onConnect={handleConnect} onDisconnect={handleDisconnect}
                    onLoadEntities={loadEntities} onSyncEntityState={syncEntityState} />;
            case 'events':
                return <EventMonitorTab connectionStatus={connectionStatus} eventHistory={eventHistory}
                    groupedEventHistory={groupedEventHistory} useGroupedView={useGroupedView}
                    setUseGroupedView={setUseGroupedView} onLoadEventHistory={loadEventHistory} />;
            case 'backend': return <BackendTab {...commonProps} />;
            case 'movement': return <MovementTab {...commonProps} />;
            case 'tts': return <TTSTab {...commonProps} />;
            case 'stt': return <STTTab {...commonProps} />;
            case 'rag':
                return <RAGTab {...commonProps} ragCollections={ragCollections}
                    ragCollectionsLoading={ragCollectionsLoading}
                    onOpenCollectionManager={handleOpenCollectionManager}
                    onRefreshCollections={loadRAGCollections} />;
            case 'cognition': return <CognitionTab {...commonProps} />;
            default: return <div>{ts('messages.tabNotFound')}</div>;
        }
    };

    const statusLabels = {
        connected: t('common:status.connected'),
        disconnected: t('common:status.disconnected'),
        connecting: t('common:status.connecting'),
        disconnecting: t('common:status.disconnecting'),
    };

    return (
        <div className="bg-neutral-900 text-neutral-100">
            <div className="bg-neutral-800 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-orange-400">{ts('header.title')}</h1>
                        <p className="text-sm text-gray-400 mt-1">{ts('header.subtitle')}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                            connectionStatus === 'connected' ? 'bg-green-500/20 text-green-400' :
                            connectionStatus === 'disconnected' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                        }`}>
                            {(statusLabels[connectionStatus] || connectionStatus).toUpperCase()}
                        </div>
                        {selectedEntity && (
                            <div className="text-sm text-gray-300">
                                {ts('entityLabel')}: <span className="text-orange-400 font-medium">{selectedEntity}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-neutral-800">
                <div className="flex overflow-x-auto">
                    {tabs.map((tab) => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                                activeTab === tab.id
                                    ? 'border-orange-400 text-orange-400 bg-neutral-700/50'
                                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-neutral-700/30'
                            }`}>
                            <span className="text-sm">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1">
                {renderTabContent()}
            </div>
        </div>
    );
}

export default SimulatorView;
