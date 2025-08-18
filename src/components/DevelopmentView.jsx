import {useState, useEffect} from 'react';
import {getConnectedEntities, getEntityDetails, sendTestActionGraph} from "../services/management/developmentService.js";
import {LogDebug, LogError} from "../utils/logger.js";

function DevelopmentView() {
    const [entities, setEntities] = useState(null);
    const [selectedEntity, setSelectedEntity] = useState('');
    const [entityDetails, setEntityDetails] = useState(null);
    const [selectedAction, setSelectedAction] = useState('');
    const [targetName, setTargetName] = useState('');
    const [lookAtTarget, setLookAtTarget] = useState(false);
    const [requiresConsent, setRequiresConsent] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState('');
    
    // Manual JSON mode
    const [manualMode, setManualMode] = useState(false);
    const [manualJson, setManualJson] = useState('');

    // Load entities on component mount
    useEffect(() => {
        loadEntities();
    }, []);

    // Load entity details when selection changes
    useEffect(() => {
        if (selectedEntity) {
            loadEntityDetails(selectedEntity);
        } else {
            setEntityDetails(null);
            setSelectedAction('');
        }
    }, [selectedEntity]);

    const loadEntities = async () => {
        try {
            const entityList = await getConnectedEntities();
            setEntities(entityList);
            LogDebug("Loaded entities:", entityList);
        } catch (error) {
            LogError("Failed to load entities:", error);
            setFeedback(`Error loading entities: ${error.message}`);
        }
    };

    const loadEntityDetails = async (entityId) => {
        try {
            setIsLoading(true);
            const details = await getEntityDetails(entityId);
            setEntityDetails(details);
            setSelectedAction(''); // Reset action selection
            LogDebug("Loaded entity details:", details);
        } catch (error) {
            LogError("Failed to load entity details:", error);
            setFeedback(`Error loading entity details: ${error.message}`);
            setEntityDetails(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendActionGraph = async () => {
        if (!selectedEntity) {
            setFeedback('Please select an entity');
            return;
        }

        if (!manualMode && !selectedAction) {
            setFeedback('Please select an action or switch to manual mode');
            return;
        }

        if (manualMode && !manualJson.trim()) {
            setFeedback('Please enter a JSON ActionGraph');
            return;
        }

        try {
            setIsLoading(true);
            setFeedback('Sending ActionGraph...');

            let actionGraph;

            if (manualMode) {
                // Parse manual JSON
                try {
                    actionGraph = JSON.parse(manualJson);
                } catch (parseError) {
                    setFeedback(`❌ Invalid JSON: ${parseError.message}`);
                    return;
                }
            } else {
                // Build ActionGraph structure from form
                actionGraph = {
                    graph_id: `dev-test-${Date.now()}`,
                    graph_actor: selectedEntity,
                    graph_vector: [{
                        action: selectedAction,
                        targets: targetName ? [{
                            name: targetName,
                            look_at_target: lookAtTarget,
                            requires_consent: requiresConsent
                        }] : [],
                        transition_mode: "linear"
                    }]
                };
            }

            LogDebug("Sending ActionGraph:", actionGraph);
            const result = await sendTestActionGraph(selectedEntity, actionGraph);
            setFeedback(`✅ ActionGraph sent successfully! Response: ${JSON.stringify(result)}`);
        } catch (error) {
            LogError("Failed to send ActionGraph:", error);
            setFeedback(`❌ Error sending ActionGraph: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setSelectedAction('');
        setTargetName('');
        setLookAtTarget(false);
        setRequiresConsent(false);
        setManualJson('');
        setFeedback('');
    };

    const generateSampleJson = () => {
        const sampleActionGraph = {
            graph_id: `dev-test-${Date.now()}`,
            graph_actor: selectedEntity || "entity_id",
            graph_vector: [{
                action: "walk",
                targets: [{
                    name: "target_name",
                    look_at_target: true,
                    requires_consent: false
                }],
                transition_mode: "linear"
            }]
        };
        setManualJson(JSON.stringify(sampleActionGraph, null, 2));
    };

    return (
        <div className="p-6 bg-neutral-800 text-white">
            <h2 className="text-2xl font-bold text-orange-400 mb-6">Development Tools</h2>
            
            {/* Entity Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Connected Entity:
                </label>
                <select 
                    value={selectedEntity} 
                    onChange={(e) => setSelectedEntity(e.target.value)}
                    className="w-full p-2 bg-neutral-700 border border-neutral-600 rounded text-neutral-100"
                    disabled={isLoading}
                >
                    <option value="">Select an entity...</option>
                    {entities && entities.length > 0 &&
                        entities.map(entity => (
                            <option key={entity.id} value={entity.id}>
                                {entity.id} ({entity.status})
                            </option>
                        ))
                    }
                </select>
                <button 
                    onClick={loadEntities}
                    className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400"
                    disabled={isLoading}
                >
                    Refresh Entities
                </button>
            </div>

            {/* Mode Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Input Mode:
                </label>
                <div className="flex gap-4">
                    <label className="flex items-center">
                        <input 
                            type="radio"
                            checked={!manualMode}
                            onChange={() => setManualMode(false)}
                            className="mr-2 text-indigo-600"
                            disabled={isLoading}
                        />
                        <span className="text-sm">Form Mode (Guided)</span>
                    </label>
                    
                    <label className="flex items-center">
                        <input 
                            type="radio"
                            checked={manualMode}
                            onChange={() => setManualMode(true)}
                            className="mr-2 text-indigo-600"
                            disabled={isLoading}
                        />
                        <span className="text-sm">Manual JSON Mode</span>
                    </label>
                </div>
            </div>

            {/* Form Mode */}
            {!manualMode && (
                <>
                    {/* Action Selection */}
                    {entityDetails && (
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Available Actions:
                            </label>
                            <select
                                value={selectedAction}
                                onChange={(e) => setSelectedAction(e.target.value)}
                                className="w-full p-2 bg-neutral-700 border border-neutral-600 rounded text-neutral-100"
                                disabled={isLoading}
                            >
                                <option value="">Select an action...</option>
                                {entityDetails.actions && entityDetails.actions.map(action => (
                                    <option key={action.name} value={action.name}>
                                        {action.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Target Configuration */}
                    {selectedAction && (
                        <div className="mb-6 p-4 bg-neutral-700 rounded">
                            <h3 className="text-lg font-medium text-orange-400 mb-3">Target Configuration</h3>
                            
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Target Name (optional):
                                </label>
                                <input 
                                    type="text"
                                    value={targetName}
                                    onChange={(e) => setTargetName(e.target.value)}
                                    placeholder="e.g., character name or object"
                                    className="w-full p-2 bg-neutral-600 border border-neutral-500 rounded text-neutral-100"
                                    disabled={isLoading}
                                />
                            </div>

                            <div className="flex gap-4">
                                <label className="flex items-center">
                                    <input 
                                        type="checkbox"
                                        checked={lookAtTarget}
                                        onChange={(e) => setLookAtTarget(e.target.checked)}
                                        className="mr-2 text-indigo-600"
                                        disabled={isLoading}
                                    />
                                    <span className="text-sm">Look at target</span>
                                </label>
                                
                                <label className="flex items-center">
                                    <input 
                                        type="checkbox"
                                        checked={requiresConsent}
                                        onChange={(e) => setRequiresConsent(e.target.checked)}
                                        className="mr-2 text-indigo-600"
                                        disabled={isLoading}
                                    />
                                    <span className="text-sm">Requires consent</span>
                                </label>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Manual JSON Mode */}
            {manualMode && (
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-300">
                            ActionGraph JSON:
                        </label>
                        <button 
                            onClick={generateSampleJson}
                            className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400"
                            disabled={isLoading}
                        >
                            Generate Sample
                        </button>
                    </div>
                    <textarea
                        value={manualJson}
                        onChange={(e) => setManualJson(e.target.value)}
                        placeholder="Enter ActionGraph JSON here..."
                        className="w-full h-40 p-3 bg-neutral-700 border border-neutral-600 rounded text-neutral-100 font-mono text-sm"
                        disabled={isLoading}
                    />
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 mb-6">
                <button 
                    onClick={handleSendActionGraph}
                    disabled={!selectedEntity || isLoading || (!manualMode && !selectedAction) || (manualMode && !manualJson.trim())}
                    className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400"
                >
                    {isLoading ? 'Sending...' : 'Send ActionGraph'}
                </button>
                
                <button 
                    onClick={resetForm}
                    disabled={isLoading}
                    className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400"
                >
                    Reset Form
                </button>
            </div>

            {/* Feedback Area */}
            {feedback && (
                <div className="p-4 bg-neutral-700 rounded">
                    <h3 className="text-lg font-medium text-orange-400 mb-2">Status</h3>
                    <div className="text-sm font-mono whitespace-pre-wrap">
                        {feedback}
                    </div>
                </div>
            )}

            {/* Entity Details Debug Info */}
            {entityDetails && (
                <div className="mt-6 p-4 bg-neutral-700 rounded">
                    <h3 className="text-lg font-medium text-orange-400 mb-2">Entity Details (Debug)</h3>
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-auto max-h-40">
                        {JSON.stringify(entityDetails, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}

export default DevelopmentView;
