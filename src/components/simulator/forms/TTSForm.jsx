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
                <label className="block text-sm font-medium text-gray-300 mb-1">Text to Synthesize:</label>
                <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Enter text for TTS..."
                    className="w-full p-2 bg-neutral-600 border border-neutral-500 rounded text-neutral-100"
                />
            </div>
            <button
                type="submit"
                disabled={!text.trim() || formState.loading}
                className="bg-neutral-700 hover:bg-neutral-500 font-bold py-2 px-4 text-orange-400 rounded disabled:opacity-50"
            >
                {formState.loading ? 'Generating...' : 'Generate Speech'}
            </button>
        </form>
    );
}

export default TTSForm;
