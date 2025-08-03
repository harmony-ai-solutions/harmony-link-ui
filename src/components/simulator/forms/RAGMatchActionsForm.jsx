import React, { useState } from 'react';

function RAGMatchActionsForm({ onSendEvent, formState, onClearResponse }) {
    const [utteranceText, setUtteranceText] = useState('');
    const [utteranceType, setUtteranceType] = useState('UTTERANCE_VERBAL');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!utteranceText.trim()) return;

        onSendEvent({
            event_type: 'RAG_MATCH_ACTIONS',
            status: 'NEW',
            payload: {
                type: utteranceType,
                content: utteranceText.trim()
            }
        });
        setUtteranceText('');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Utterance Type:</label>
                <select
                    value={utteranceType}
                    onChange={(e) => setUtteranceType(e.target.value)}
                    className="w-full p-2 bg-neutral-600 border border-neutral-500 rounded text-neutral-100"
                >
                    <option value="UTTERANCE_VERBAL">Verbal</option>
                    <option value="UTTERANCE_NONVERBAL">Non-verbal</option>
                    <option value="UTTERANCE_COMBINED">Combined</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Utterance Text:</label>
                <input
                    type="text"
                    value={utteranceText}
                    onChange={(e) => setUtteranceText(e.target.value)}
                    placeholder="Enter text to match against actions..."
                    className="w-full p-2 bg-neutral-600 border border-neutral-500 rounded text-neutral-100"
                />
            </div>
            <div className="text-xs text-gray-400 mb-2">
                Test action matching by providing an utterance to match against synced actions
            </div>
            <button
                type="submit"
                disabled={!utteranceText.trim() || formState.loading}
                className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
            >
                {formState.loading ? 'Matching...' : 'Match Actions'}
            </button>
        </form>
    );
}

export default RAGMatchActionsForm;
