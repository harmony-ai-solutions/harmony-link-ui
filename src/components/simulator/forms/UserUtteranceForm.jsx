import React, { useState } from 'react';

function UserUtteranceForm({ onSendEvent, formState, onClearResponse }) {
    const [content, setContent] = useState('');
    const [utteranceType, setUtteranceType] = useState('UTTERANCE_VERBAL');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!content.trim()) return;

        onSendEvent({
            event_type: 'USER_UTTERANCE',
            status: 'NEW',
            payload: {
                type: utteranceType,
                content: content.trim()
            }
        });
        setContent('');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-2">
            <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Type:</label>
                <select
                    value={utteranceType}
                    onChange={(e) => setUtteranceType(e.target.value)}
                    className="w-full p-1.5 bg-neutral-600 border border-neutral-500 rounded text-neutral-100 text-sm"
                >
                    <option value="UTTERANCE_VERBAL">Verbal</option>
                    <option value="UTTERANCE_NONVERBAL">Non-verbal</option>
                    <option value="UTTERANCE_COMBINED">Combined</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">Content:</label>
                <input
                    type="text"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter utterance content..."
                    className="w-full p-1.5 bg-neutral-600 border border-neutral-500 rounded text-neutral-100 text-sm"
                />
            </div>
            <button
                type="submit"
                disabled={!content.trim() || formState.loading}
                className="w-full bg-neutral-700 hover:bg-neutral-500 font-bold py-1.5 px-3 text-orange-400 rounded text-sm disabled:opacity-50"
            >
                {formState.loading ? 'Sending...' : 'Send Utterance'}
            </button>
        </form>
    );
}

export default UserUtteranceForm;
