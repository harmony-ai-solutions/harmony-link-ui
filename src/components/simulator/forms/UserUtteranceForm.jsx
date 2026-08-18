import React, { useState } from 'react';
import ThemedSelect from '../../widgets/ThemedSelect';

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
                <ThemedSelect
                    value={utteranceType}
                    onChange={setUtteranceType}
                    options={[
                        { value: 'UTTERANCE_VERBAL', label: 'Verbal' },
                        { value: 'UTTERANCE_NONVERBAL', label: 'Non-verbal' },
                        { value: 'UTTERANCE_COMBINED', label: 'Combined' },
                    ]}
                />
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
