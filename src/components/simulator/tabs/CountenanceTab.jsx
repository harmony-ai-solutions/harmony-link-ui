import React from 'react';
import CountenanceConfigurationDisplay from '../config/CountenanceConfigurationDisplay';
import FormResponseDisplay from '../shared/FormResponseDisplay';

function CountenanceTab({ connectionStatus, moduleConfigs, moduleConfigsLoading, moduleConfigErrors, formResponses, onSendEvent, onClearFormResponse }) {
    return (
        <div className="p-3 bg-gradient-to-br from-neutral-800 to-neutral-900 min-h-full">
            <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-gradient-to-br from-pink-500 to-pink-600 rounded flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Countenance Module Simulation</h3>
                        <p className="text-gray-400 text-xs">Facial Expression • Emotion Processing • Visual Communication</p>
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
                <div className="space-y-2">
                    <div className="bg-neutral-800/50 backdrop-blur-sm rounded-lg border border-neutral-700/50 overflow-hidden">
                        <div className="bg-gradient-to-r from-pink-500/10 to-pink-600/10 border-b border-pink-500/20 p-2">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-pink-500/20 rounded flex items-center justify-center">
                                    <svg className="w-3 h-3 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-white">Configuration</h4>
                                    <p className="text-pink-300/70 text-xs">Current countenance provider and expression settings</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-3">
                            <CountenanceConfigurationDisplay 
                                config={moduleConfigs.countenance}
                                loading={moduleConfigsLoading}
                                error={moduleConfigErrors.countenance}
                            />
                        </div>
                    </div>

                    <div className="bg-neutral-800/50 backdrop-blur-sm rounded-lg border border-neutral-700/50 overflow-hidden">
                        <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 border-b border-green-500/20 p-2">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-green-500/20 rounded flex items-center justify-center">
                                    <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-white">Event Simulation</h4>
                                    <p className="text-green-300/70 text-xs">Test countenance functionality with expression generation</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-3">
                            <div className="bg-neutral-700/30 rounded border border-neutral-600/50 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-4 h-4 bg-pink-500/20 rounded flex items-center justify-center">
                                        <svg className="w-2.5 h-2.5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h5 className="text-xs font-semibold text-white">Generate Expression</h5>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs text-gray-400">Generate facial expressions based on utterances</p>
                                    <button
                                        onClick={() => onSendEvent({
                                            event_type: 'COUNTENANCE_GENERATE_EXPRESSION',
                                            status: 'NEW',
                                            payload: {
                                                type: 'UTTERANCE_VERBAL',
                                                content: 'Hello there! How are you doing today?'
                                            }
                                        }, 'countenance')}
                                        className="w-full bg-neutral-700 hover:bg-neutral-500 font-bold py-1.5 px-3 text-orange-400 rounded text-sm disabled:opacity-50"
                                        disabled={formResponses.countenance.loading}
                                    >
                                        {formResponses.countenance.loading ? 'Generating...' : 'Generate Expression'}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-3">
                                <FormResponseDisplay 
                                    formState={formResponses.countenance}
                                    onClear={() => onClearFormResponse('countenance')}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CountenanceTab;
