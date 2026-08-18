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
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Scene Data (JSON):</label>
                <textarea
                    value={sceneData}
                    onChange={(e) => setSceneData(e.target.value)}
                    className="input-field w-full h-24 text-xs font-mono custom-scrollbar"
                />
            </div>
            <button
                type="submit"
                disabled={formState.loading}
                className="module-action-btn w-full justify-center text-accent-primary border-accent-primary/30"
            >
                {formState.loading ? 'Sending...' : 'Send Scene Data'}
            </button>
        </form>
    );
}

export default SceneDataForm;
