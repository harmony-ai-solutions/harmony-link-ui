import React, { useState } from 'react';

function SceneDataForm({ onSendEvent, formState, onClearResponse }) {
    const [sceneData, setSceneData] = useState(JSON.stringify({
        characters: [
            { name: "TestCharacter", position: [0, 0, 0], orientation: [0, 0, 0] },
            { name: "Player", position: [2, 0, 0], orientation: [0, 180, 0] }
        ],
        objects: [
            { name: "Chair", position: [1, 0, 1], orientation: [0, 0, 0] },
            { name: "Table", position: [0, 0, 2], orientation: [0, 0, 0] }
        ]
    }, null, 2));

    const handleSubmit = (e) => {
        e.preventDefault();
        try {
            const parsedData = JSON.parse(sceneData);
            onSendEvent({
                event_type: 'MOVEMENT_V1_UPDATE_SCENE_DATA',
                status: 'NEW',
                payload: parsedData
            });
        } catch (error) {
            alert('Invalid JSON: ' + error.message);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-2">
            <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Scene Data (JSON):</label>
                <textarea
                    value={sceneData}
                    onChange={(e) => setSceneData(e.target.value)}
                    className="w-full h-24 p-1.5 bg-neutral-600 border border-neutral-500 rounded text-neutral-100 font-mono text-xs custom-scrollbar"
                />
            </div>
            <button
                type="submit"
                disabled={formState.loading}
                className="w-full bg-neutral-700 hover:bg-neutral-500 font-bold py-1.5 px-3 text-orange-400 rounded text-sm disabled:opacity-50"
            >
                {formState.loading ? 'Sending...' : 'Send Scene Data'}
            </button>
        </form>
    );
}

export default SceneDataForm;
