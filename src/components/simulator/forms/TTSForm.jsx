import React, { useState } from 'react';

function TTSForm({ onSendEvent, formState, onClearResponse }) {
    const [text, setText] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!text.trim()) return;

        onSendEvent({
            event_type: 'TTS_GENERATE_SPEECH',
            status: 'NEW',
            payload: {
                type: 'UTTERANCE_VERBAL',
                content: text.trim()
            }
        });
        setText('');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Text to Synthesize:</label>
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter text for TTS..."
                    className="input-field w-full text-xs py-1.5"
                />
            </div>
            <button
                type="submit"
                disabled={!text.trim() || formState.loading}
                className="module-action-btn w-full justify-center text-accent-primary border-accent-primary/30"
            >
                {formState.loading ? 'Generating...' : 'Generate Speech'}
            </button>
        </form>
    );
}

export default TTSForm;
