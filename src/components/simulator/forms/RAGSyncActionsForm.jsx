import React, { useState } from 'react';

function RAGSyncActionsForm({ onSendEvent, formState, onClearResponse }) {
    const [actionsData, setActionsData] = useState(JSON.stringify({
        actions: [
            {
                name: "wave",
                examples: [
                    "wave at {{character}}",
                    "wave hello to {{character}}",
                    "greet {{character}} with a wave"
                ],
                confirmations: [
                    "waving at {{character}}",
                    "greeting {{character}} with a wave"
                ],
                rejections: [
                    "can't wave right now",
                    "unable to wave at {{character}}"
                ]
            }
        ]
    }, null, 2));

    const handleSubmit = (e) => {
        e.preventDefault();
        try {
            const parsedData = JSON.parse(actionsData);
            onSendEvent({
                event_type: 'RAG_SYNC_ACTIONS',
                status: 'NEW',
                payload: parsedData
            });
        } catch (error) {
            alert('Invalid JSON: ' + error.message);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Actions Data (JSON):</label>
                <textarea
                    value={actionsData}
                    onChange={(e) => setActionsData(e.target.value)}
                    className="w-full h-40 p-2 bg-neutral-600 border border-neutral-500 rounded text-neutral-100 font-mono text-sm custom-scrollbar"
                />
            </div>
            <div className="text-xs text-gray-400 mb-2">
                Define actions with examples, confirmations, and rejections for RAG matching
            </div>
            <button
                type="submit"
                disabled={formState.loading}
                className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
            >
                {formState.loading ? 'Syncing...' : 'Sync Actions'}
            </button>
        </form>
    );
}

export default RAGSyncActionsForm;
