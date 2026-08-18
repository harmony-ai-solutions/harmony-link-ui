import React from 'react';
import CognitionConfigurationDisplay from '../config/CognitionConfigurationDisplay.jsx';
import FormResponseDisplay from '../shared/FormResponseDisplay';

function CognitionTab({ connectionStatus, moduleConfigs, moduleConfigsLoading, moduleConfigErrors, formResponses, onSendEvent, onClearFormResponse }) {
    return (
        <div className="p-4 min-h-full">
            <div className="mb-4">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 bg-accent-primary/15 rounded-lg flex items-center justify-center shadow-lg shadow-accent-primary/10">
                        <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-text-primary">Cognition Module Simulation</h3>
                        <p className="text-text-muted text-xs">Facial Expression • Emotion Processing • Visual Communication</p>
                    </div>
                </div>
            </div>

            {connectionStatus !== 'connected' ? (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-14 h-14 bg-background-surface/40 rounded-2xl flex items-center justify-center mb-3 border border-border-glass">
                        <svg className="w-7 h-7 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <p className="text-text-muted">Please connect to an entity first</p>
                    <p className="text-text-muted/60 text-sm mt-1">Use the Connection tab to simulate an entity</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-text-primary">Configuration</h4>
                                <p className="text-text-muted text-xs">Current cognition provider and expression settings</p>
                            </div>
                        </div>
                        <CognitionConfigurationDisplay 
                            config={moduleConfigs.cognition}
                            loading={moduleConfigsLoading}
                            error={moduleConfigErrors.cognition}
                        />
                    </div>

                    <div className="card">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-text-primary">Event Simulation</h4>
                                <p className="text-text-muted text-xs">Test cognition functionality with expression generation</p>
                            </div>
                        </div>
                        <div className="card-compact">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                    <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <h5 className="text-xs font-semibold text-text-primary">Generate Expression</h5>
                            </div>
                            <div className="space-y-2">
                                <p className="text-xs text-text-muted">Generate facial expressions based on utterances</p>
                                <button
                                    onClick={() => onSendEvent({
                                        event_type: 'COGNITION_GENERATE_EXPRESSION',
                                        status: 'NEW',
                                        payload: {
                                            type: 'UTTERANCE_VERBAL',
                                            content: 'Hello there! How are you doing today?'
                                        }
                                    }, 'cognition')}
                                    className="module-action-btn w-full justify-center text-accent-primary border-accent-primary/30"
                                    disabled={formResponses.cognition.loading}
                                >
                                    {formResponses.cognition.loading ? 'Generating...' : 'Generate Expression'}
                                </button>
                            </div>
                        </div>

                        <div className="mt-3">
                            <FormResponseDisplay 
                                formState={formResponses.cognition}
                                onClear={() => onClearFormResponse('cognition')}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CognitionTab;
