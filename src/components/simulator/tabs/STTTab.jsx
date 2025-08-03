import React from 'react';
import STTConfigurationDisplay from '../config/STTConfigurationDisplay';
import STTForm from '../forms/STTForm';
import FormResponseDisplay from '../shared/FormResponseDisplay';

function STTTab({ connectionStatus, moduleConfigs, moduleConfigsLoading, moduleConfigErrors, formResponses, onSendEvent, onClearFormResponse }) {
    return (
        <div className="p-4 bg-gradient-to-br from-neutral-800 to-neutral-900 min-h-full">
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">STT Module Simulation</h3>
                        <p className="text-gray-400 text-sm">Speech-to-Text • Audio Recognition • Voice Processing</p>
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
                        <div className="bg-gradient-to-r from-indigo-500/10 to-indigo-600/10 border-b border-indigo-500/20 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-indigo-500/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white">Configuration</h4>
                                    <p className="text-indigo-300/70 text-sm">Current STT provider and recognition settings</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4">
                            <STTConfigurationDisplay 
                                config={moduleConfigs.stt}
                                loading={moduleConfigsLoading}
                                error={moduleConfigErrors.stt}
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
                                    <p className="text-green-300/70 text-sm">Test STT functionality with audio input</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="bg-neutral-700/30 rounded-lg border border-neutral-600/50 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-5 h-5 bg-blue-500/20 rounded flex items-center justify-center">
                                        <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                        </svg>
                                    </div>
                                    <h5 className="text-sm font-semibold text-white">Process Audio</h5>
                                </div>
                                <STTForm 
                                    onSendEvent={(event) => onSendEvent(event, 'stt')} 
                                    formState={formResponses.stt}
                                    onClearResponse={() => onClearFormResponse('stt')}
                                />
                            </div>

                            <div className="mt-4">
                                <FormResponseDisplay 
                                    formState={formResponses.stt}
                                    onClear={() => onClearFormResponse('stt')}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default STTTab;
