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
        <div className="p-4 bg-gradient-to-br from-neutral-800 to-neutral-900 min-h-full">
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Movement Module Simulation</h3>
                        <p className="text-gray-400 text-sm">Action Processing • Scene Management • Movement Coordination</p>
                    </div>
                </div>
            </div>

            {connectionStatus !== 'connected' ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-12 h-12 bg-neutral-700 rounded-full flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <p className="text-gray-400 text-lg">Please connect to an entity first</p>
                    <p className="text-gray-500 text-sm mt-1">Use the Connection tab to simulate an entity</p>
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="bg-neutral-800/50 backdrop-blur-sm rounded-xl border border-neutral-700/50 overflow-hidden">
                        <div className="bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 border-b border-cyan-500/20 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white">Configuration</h4>
                                    <p className="text-cyan-300/70 text-sm">Current movement provider and settings</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4">
                            <MovementConfigurationDisplay 
                                config={moduleConfigs.movement}
                                loading={moduleConfigsLoading}
                                error={moduleConfigErrors.movement}
                            />
                        </div>
                    </div>

                    <div className="bg-neutral-800/50 backdrop-blur-sm rounded-xl border border-neutral-700/50 overflow-hidden">
                        <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 border-b border-green-500/20 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-green-500/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white">Event Simulation</h4>
                                    <p className="text-green-300/70 text-sm">Test movement functionality with scene data and action registration</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                                <div className="bg-neutral-700/30 rounded-lg border border-neutral-600/50 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-5 h-5 bg-emerald-500/20 rounded flex items-center justify-center">
                                            <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <h5 className="text-sm font-semibold text-white">Environment Events</h5>
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-xs text-gray-400">Signal that the environment has been loaded</p>
                                        <button
                                            onClick={() => onSendEvent({
                                                event_type: 'ENVIRONMENT_LOADED',
                                                status: 'NEW',
                                                payload: {}
                                            }, 'movement')}
                                            className="w-full bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
                                            disabled={formResponses.movement.loading}
                                        >
                                            {formResponses.movement.loading ? 'Sending...' : 'Send Environment Loaded'}
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-neutral-700/30 rounded-lg border border-neutral-600/50 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-5 h-5 bg-blue-500/20 rounded flex items-center justify-center">
                                            <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                            </svg>
                                        </div>
                                        <h5 className="text-sm font-semibold text-white">Scene Data</h5>
                                    </div>
                                    <SceneDataForm 
                                        onSendEvent={(event) => onSendEvent(event, 'movement')} 
                                        formState={formResponses.movement}
                                        onClearResponse={() => onClearFormResponse('movement')}
                                    />
                                </div>

                                <div className="bg-neutral-700/30 rounded-lg border border-neutral-600/50 p-4">
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-5 h-5 bg-amber-500/20 rounded flex items-center justify-center">
                                            <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v6a2 2 0 002 2h2m0 0h2a2 2 0 002-2V7a2 2 0 00-2-2H9m0 0V3m0 2v2m0-2h2a2 2 0 012 2v6a2 2 0 01-2 2H9m0 0v2" />
                                            </svg>
                                        </div>
                                        <h5 className="text-sm font-semibold text-white">Register Actions</h5>
                                    </div>
                                    <RegisterActionsForm 
                                        onSendEvent={(event) => onSendEvent(event, 'movement')} 
                                        formState={formResponses.movement}
                                        onClearResponse={() => onClearFormResponse('movement')}
                                    />
                                </div>
                            </div>

                            <div className="mt-4">
                                <FormResponseDisplay 
                                    formState={formResponses.movement}
                                    onClear={() => onClearFormResponse('movement')}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default MovementTab;
