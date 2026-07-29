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
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Audio Data (Base64):</label>
                <textarea
                    value={audioData}
                    onChange={(e) => setAudioData(e.target.value)}
                    placeholder="Enter base64 encoded audio data..."
                    className="input-field w-full h-20 text-xs font-mono custom-scrollbar"
                />
            </div>
            <button
                type="submit"
                disabled={!audioData.trim()}
                className="module-action-btn w-full justify-center text-accent-primary border-accent-primary/30"
            >
                Send Audio Data
            </button>
        </form>
    );
}

export default STTForm;
