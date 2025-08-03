import React from 'react';
import BackendConfigurationDisplay from '../config/BackendConfigurationDisplay';
import UserUtteranceForm from '../forms/UserUtteranceForm';
import FormResponseDisplay from '../shared/FormResponseDisplay';

function BackendTab({ 
    connectionStatus, 
    moduleConfigs, 
    moduleConfigsLoading, 
    moduleConfigErrors, 
    formResponses, 
    onSendEvent, 
    onClearFormResponse 
}) {
    return (
        <div className="p-3 bg-gradient-to-br from-neutral-800 to-neutral-900 min-h-full">
            {/* Compact Header */}
            <div className="mb-3">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Backend Module Simulation</h3>
                        <p className="text-gray-400 text-xs">AI Conversation Engine • Chat Processing • Response Generation</p>
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
                    {/* Backend Configuration Section */}
                    <div className="bg-neutral-800/50 backdrop-blur-sm rounded-lg border border-neutral-700/50 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border-b border-purple-500/20 p-2">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-purple-500/20 rounded flex items-center justify-center">
                                    <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-white">Configuration</h4>
                                    <p className="text-purple-300/70 text-xs">Current backend provider and settings</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-3">
                            <BackendConfigurationDisplay 
                                config={moduleConfigs.backend}
                                loading={moduleConfigsLoading}
                                error={moduleConfigErrors.backend}
                            />
                        </div>
                    </div>

                    {/* Event Simulation Section */}
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
                                    <p className="text-green-300/70 text-xs">Test backend functionality with user utterances and chat history</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-3">
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                {/* User Utterance Card */}
                                <div className="bg-neutral-700/30 rounded border border-neutral-600/50 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-4 h-4 bg-blue-500/20 rounded flex items-center justify-center">
                                            <svg className="w-2.5 h-2.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                        </div>
                                        <h5 className="text-xs font-semibold text-white">Send User Utterance</h5>
                                    </div>
                                    <UserUtteranceForm 
                                        onSendEvent={(event) => onSendEvent(event, 'backend')} 
                                        formState={formResponses.backend}
                                        onClearResponse={() => onClearFormResponse('backend')}
                                    />
                                </div>

                                {/* Chat History Card */}
                                <div className="bg-neutral-700/30 rounded border border-neutral-600/50 p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-4 h-4 bg-amber-500/20 rounded flex items-center justify-center">
                                            <svg className="w-2.5 h-2.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <h5 className="text-xs font-semibold text-white">Request Chat History</h5>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xs text-gray-400">Request the conversation history from the backend module</p>
                                        <button
                                            onClick={() => onSendEvent({
                                                event_type: 'CHAT_HISTORY',
                                                status: 'NEW',
                                                payload: {}
                                            }, 'backend')}
                                            className="w-full bg-neutral-700 hover:bg-neutral-500 font-bold py-1.5 px-3 text-orange-400 rounded text-sm disabled:opacity-50"
                                            disabled={formResponses.backend.loading}
                                        >
                                            {formResponses.backend.loading ? 'Requesting...' : 'Request Chat History'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Response Display */}
                            <div className="mt-3">
                                <FormResponseDisplay 
                                    formState={formResponses.backend}
                                    onClear={() => onClearFormResponse('backend')}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default BackendTab;
