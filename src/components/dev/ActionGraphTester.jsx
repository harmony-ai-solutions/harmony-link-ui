import { useState, useEffect } from 'react';
import {
    getConnectedEntities,
    getEntityDetails,
    sendTestActionGraph
} from '../../services/management/developmentService.js';
import { LogDebug, LogError } from '../../utils/logger.js';

/**
 * ActionGraph Tester — allows testing ActionGraph commands against connected entities.
 * Extracted from DevelopmentView and modernized with design system.
 */
export default function ActionGraphTester() {
    const [entities, setEntities] = useState(null);
    const [selectedEntity, setSelectedEntity] = useState('');
    const [entityDetails, setEntityDetails] = useState(null);
    const [selectedAction, setSelectedAction] = useState('');
    const [targetName, setTargetName] = useState('');
    const [lookAtTarget, setLookAtTarget] = useState(false);
    const [requiresConsent, setRequiresConsent] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [manualMode, setManualMode] = useState(false);
    const [manualJson, setManualJson] = useState('');

    useEffect(() => {
        loadEntities();
    }, []);

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
            setSelectedAction('');
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
                try {
                    actionGraph = JSON.parse(manualJson);
                } catch (parseError) {
                    setFeedback(`❌ Invalid JSON: ${parseError.message}`);
                    return;
                }
            } else {
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
        <div className="p-6 space-y-6">
            {/* Entity Selection Section */}
            <section className="character-editor-section">
                <div className="character-editor-section-header">
                    Entity Selection
                </div>
                <div className="p-4 space-y-4">
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-medium text-text-secondary w-28">
                            Connected Entity
                        </label>
                        <select
                            value={selectedEntity}
                            onChange={(e) => setSelectedEntity(e.target.value)}
                            className="input-field flex-1"
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
                        <button onClick={loadEntities} className="module-action-btn" disabled={isLoading}>
                            Refresh
                        </button>
                    </div>
                </div>
            </section>

            {/* Input Mode & Action Configuration */}
            <section className="character-editor-section">
                <div className="character-editor-section-header">
                    Action Configuration
                </div>
                <div className="p-4 space-y-4">
                    {/* Mode Toggle */}
                    <div className="flex items-center gap-4">
                        <label className="text-sm font-medium text-text-secondary w-28">
                            Input Mode
                        </label>
                        <div className="flex gap-2">
                            <button
                                className={`text-xs px-3 py-1.5 rounded border transition-all ${
                                    !manualMode
                                        ? 'bg-accent-primary/20 text-accent-primary border-accent-primary/30 font-bold'
                                        : 'bg-background-surface text-text-muted border-white/10'
                                }`}
                                onClick={() => setManualMode(false)}
                            >
                                Form Mode
                            </button>
                            <button
                                className={`text-xs px-3 py-1.5 rounded border transition-all ${
                                    manualMode
                                        ? 'bg-accent-primary/20 text-accent-primary border-accent-primary/30 font-bold'
                                        : 'bg-background-surface text-text-muted border-white/10'
                                }`}
                                onClick={() => setManualMode(true)}
                            >
                                Manual JSON
                            </button>
                        </div>
                    </div>

                    {/* Form Mode content */}
                    {!manualMode && (
                        <>
                            {entityDetails && (
                                <div className="flex items-center gap-4">
                                    <label className="text-sm font-medium text-text-secondary w-28">
                                        Action
                                    </label>
                                    <select
                                        value={selectedAction}
                                        onChange={(e) => setSelectedAction(e.target.value)}
                                        className="input-field flex-1"
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

                            {selectedAction && (
                                <div className="p-3 bg-background-surface/50 rounded-lg border border-white/5 space-y-3">
                                    <h4 className="text-sm font-bold text-accent-primary">Target Configuration</h4>
                                    <div className="flex items-center gap-4">
                                        <label className="text-sm text-text-secondary w-28">Target Name</label>
                                        <input
                                            type="text"
                                            value={targetName}
                                            onChange={(e) => setTargetName(e.target.value)}
                                            placeholder="e.g., character name or object"
                                            className="input-field flex-1"
                                            disabled={isLoading}
                                        />
                                    </div>
                                    <div className="flex items-center gap-6 pl-28">
                                        <label className="flex items-center gap-2 text-sm text-text-secondary">
                                            <input
                                                type="checkbox"
                                                checked={lookAtTarget}
                                                onChange={(e) => setLookAtTarget(e.target.checked)}
                                                className="accent-accent-primary"
                                                disabled={isLoading}
                                            />
                                            Look at target
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-text-secondary">
                                            <input
                                                type="checkbox"
                                                checked={requiresConsent}
                                                onChange={(e) => setRequiresConsent(e.target.checked)}
                                                className="accent-accent-primary"
                                                disabled={isLoading}
                                            />
                                            Requires consent
                                        </label>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* Manual JSON Mode */}
                    {manualMode && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-text-secondary">
                                    ActionGraph JSON
                                </label>
                                <button className="module-action-btn text-xs" onClick={generateSampleJson}>
                                    Generate Sample
                                </button>
                            </div>
                            <textarea
                                value={manualJson}
                                onChange={(e) => setManualJson(e.target.value)}
                                placeholder="Enter ActionGraph JSON here..."
                                className="input-field w-full h-40 font-mono text-sm resize-y"
                                disabled={isLoading}
                            />
                        </div>
                    )}
                </div>
            </section>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
                <button
                    onClick={handleSendActionGraph}
                    disabled={!selectedEntity || isLoading || (!manualMode && !selectedAction) || (manualMode && !manualJson.trim())}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? 'Sending...' : 'Send ActionGraph'}
                </button>
                <button onClick={resetForm} className="btn-secondary" disabled={isLoading}>
                    Reset
                </button>
            </div>

            {/* Feedback */}
            {feedback && (
                <div className={`p-3 rounded-lg border ${
                    feedback.startsWith('✅')
                        ? 'bg-green-500/5 border-green-500/20 text-green-400'
                        : feedback.startsWith('❌')
                            ? 'bg-red-500/5 border-red-500/20 text-red-400'
                            : 'bg-background-surface border-white/5 text-text-secondary'
                }`}>
                    <p className="text-sm font-mono whitespace-pre-wrap">{feedback}</p>
                </div>
            )}

            {/* Entity Details Debug Info */}
            {entityDetails && (
                <section className="character-editor-section">
                    <div className="character-editor-section-header">
                        Entity Details
                    </div>
                    <div className="p-4">
                        <pre className="text-xs text-text-secondary whitespace-pre-wrap overflow-auto max-h-40 font-mono">
                            {JSON.stringify(entityDetails, null, 2)}
                        </pre>
                    </div>
                </section>
            )}
        </div>
    );
}