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
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Type:</label>
                <select
                    value={utteranceType}
                    onChange={(e) => setUtteranceType(e.target.value)}
                    className="input-field w-full text-xs py-1.5"
                >
                    <option value="UTTERANCE_VERBAL">Verbal</option>
                    <option value="UTTERANCE_NONVERBAL">Non-verbal</option>
                    <option value="UTTERANCE_COMBINED">Combined</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Content:</label>
                <input
                    type="text"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Enter utterance content..."
                    className="input-field w-full text-xs py-1.5"
                />
            </div>
            <button
                type="submit"
                disabled={!content.trim() || formState.loading}
                className="module-action-btn w-full justify-center text-accent-primary border-accent-primary/30"
            >
                {formState.loading ? 'Sending...' : 'Send Utterance'}
            </button>
        </form>
    );
}

export default UserUtteranceForm;
