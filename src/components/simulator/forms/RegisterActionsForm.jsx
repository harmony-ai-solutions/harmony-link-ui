import React, { useState } from 'react';

function RegisterActionsForm({ onSendEvent, formState, onClearResponse }) {
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
            },
            {
                name: "sit",
                examples: [
                    "sit down on {{object}}",
                    "take a seat on {{object}}",
                    "sit on the {{object}}"
                ],
                confirmations: [
                    "sitting down on {{object}}",
                    "taking a seat on {{object}}"
                ],
                rejections: [
                    "can't sit on {{object}}",
                    "{{object}} is not suitable for sitting"
                ]
            }
        ]
    }, null, 2));

    const handleSubmit = (e) => {
        e.preventDefault();
        try {
            const parsedData = JSON.parse(actionsData);
            onSendEvent({
                event_type: 'MOVEMENT_V1_REGISTER_ACTIONS',
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
            <button
                type="submit"
                disabled={formState.loading}
                className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
            >
                {formState.loading ? 'Sending...' : 'Register Actions'}
            </button>
        </form>
    );
}

export default RegisterActionsForm;
