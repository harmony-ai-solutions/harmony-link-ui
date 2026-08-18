import React from 'react';
import MovementConfigurationDisplay from '../config/MovementConfigurationDisplay';
import SceneDataForm from '../forms/SceneDataForm';
import RegisterActionsForm from '../forms/RegisterActionsForm';
import FormResponseDisplay from '../shared/FormResponseDisplay';

function MovementTab({ 
    connectionStatus, 
    moduleConfigs, 
    moduleConfigsLoading, 
    moduleConfigErrors, 
    formResponses, 
    onSendEvent, 
    onClearFormResponse 
}) {
    return (
        <div className="p-4 min-h-full">
            <div className="mb-4">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 bg-accent-primary/15 rounded-lg flex items-center justify-center shadow-lg shadow-accent-primary/10">
                        <svg className="w-4 h-4 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-text-primary">Movement Module Simulation</h3>
                        <p className="text-text-muted text-xs">Action Processing • Scene Management • Movement Coordination</p>
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
                                <p className="text-text-muted text-xs">Current movement provider and settings</p>
                            </div>
                        </div>
                        <MovementConfigurationDisplay 
                            config={moduleConfigs.movement}
                            loading={moduleConfigsLoading}
                            error={moduleConfigErrors.movement}
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
                                <p className="text-text-muted text-xs">Test movement functionality with scene data and action registration</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                            {/* Environment Events */}
                            <div className="card-compact">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                        <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h5 className="text-xs font-semibold text-text-primary">Environment Events</h5>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs text-text-muted">Signal that the environment has been loaded</p>
                                    <button
                                        onClick={() => onSendEvent({
                                            event_type: 'ENVIRONMENT_LOADED',
                                            status: 'NEW',
                                            payload: {}
                                        }, 'movement')}
                                        className="module-action-btn w-full justify-center text-accent-primary border-accent-primary/30"
                                        disabled={formResponses.movement.loading}
                                    >
                                        {formResponses.movement.loading ? 'Sending...' : 'Send Environment Loaded'}
                                    </button>
                                </div>
                            </div>

                            {/* Scene Data */}
                            <div className="card-compact">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                        <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                    </div>
                                    <h5 className="text-xs font-semibold text-text-primary">Scene Data</h5>
                                </div>
                                <SceneDataForm 
                                    onSendEvent={(event) => onSendEvent(event, 'movement')} 
                                    formState={formResponses.movement}
                                    onClearResponse={() => onClearFormResponse('movement')}
                                />
                            </div>

                            {/* Register Actions */}
                            <div className="card-compact">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-5 h-5 bg-accent-primary/15 rounded flex items-center justify-center">
                                        <svg className="w-3 h-3 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2m0 0h2a2 2 0 002-2V7a2 2 0 00-2-2H9m0 0V3m0 2v2m0-2h2a2 2 0 012 2v6a2 2 0 01-2 2H9m0 0v2" />
                                        </svg>
                                    </div>
                                    <h5 className="text-xs font-semibold text-text-primary">Register Actions</h5>
                                </div>
                                <RegisterActionsForm 
                                    onSendEvent={(event) => onSendEvent(event, 'movement')} 
                                    formState={formResponses.movement}
                                    onClearResponse={() => onClearFormResponse('movement')}
                                />
                            </div>
                        </div>

                        <div className="mt-3">
                            <FormResponseDisplay 
                                formState={formResponses.movement}
                                onClear={() => onClearFormResponse('movement')}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MovementTab;
