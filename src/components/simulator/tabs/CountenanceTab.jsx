import React from 'react';
import FormResponseDisplay from '../shared/FormResponseDisplay';

function CountenanceTab({ connectionStatus, formResponses, onSendEvent, onClearFormResponse }) {
    return (
        <div className="p-4 bg-gradient-to-br from-neutral-800 to-neutral-900 min-h-full">
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">Countenance Module Simulation</h3>
                        <p className="text-gray-400 text-sm">Facial Expression • Emotion Processing • Visual Communication</p>
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
                        <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 border-b border-green-500/20 p-4">
                            <div className="flex items-center gap-3">
                                <div className="w-7 h-7 bg-green-500/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-lg font-semibold text-white">Event Simulation</h4>
                                    <p className="text-green-300/70 text-sm">Test countenance functionality with expression generation</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-4">
                            <div className="bg-neutral-700/30 rounded-lg border border-neutral-600/50 p-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-5 h-5 bg-pink-500/20 rounded flex items-center justify-center">
                                        <svg className="w-3 h-3 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h5 className="text-sm font-semibold text-white">Generate Expression</h5>
                                </div>
                                <div className="space-y-3">
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
                                        className="w-full bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
                                        disabled={formResponses.countenance.loading}
                                    >
                                        {formResponses.countenance.loading ? 'Generating...' : 'Generate Expression'}
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4">
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
