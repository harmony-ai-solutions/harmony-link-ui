import React, { useState } from 'react';

function STTForm({ onSendEvent, formState, onClearResponse }) {
    const [audioData, setAudioData] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!audioData.trim()) return;

        onSendEvent({
            event_type: 'STT_INPUT_AUDIO',
            status: 'NEW',
            payload: {
                audio_bytes: audioData.trim()
            }
        });
        setAudioData('');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-2">
            <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Audio Data (Base64):</label>
                <textarea
                    value={audioData}
                    onChange={(e) => setAudioData(e.target.value)}
                    placeholder="Enter base64 encoded audio data..."
                    className="w-full h-20 p-1.5 bg-neutral-600 border border-neutral-500 rounded text-neutral-100 font-mono text-xs custom-scrollbar"
                />
            </div>
            <button
                type="submit"
                disabled={!audioData.trim()}
                className="w-full bg-neutral-700 hover:bg-neutral-500 font-bold py-1.5 px-3 text-orange-400 rounded text-sm disabled:opacity-50"
            >
                Send Audio Data
            </button>
        </form>
    );
}

export default STTForm;
