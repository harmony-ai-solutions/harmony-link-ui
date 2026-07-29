import React, { useState } from 'react';
import ThemedSelect from '../../widgets/ThemedSelect';

function RAGMatchActionsForm({ onSendEvent, formState, onClearResponse }) {
    const [utteranceText, setUtteranceText] = useState('');
    const [utteranceType, setUtteranceType] = useState('UTTERANCE_VERBAL');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!utteranceText.trim()) return;

        onSendEvent({
            event_type: 'RAG_MATCH_ACTIONS',
            status: 'NEW',
            payload: {
                type: utteranceType,
                content: utteranceText.trim()
            }
        });
        setUtteranceText('');
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div>
                <label className="block text-sm font-semibold text-text-secondary mb-1.5">Utterance Type:</label>
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
                <label className="block text-sm font-semibold text-text-secondary mb-1.5">Utterance Text:</label>
                <input
                    type="text"
                    value={utteranceText}
                    onChange={(e) => setUtteranceText(e.target.value)}
                    placeholder="Enter text to match against actions..."
                    className="input-field w-full"
                />
            </div>
            <div className="text-xs text-text-muted">
                Test action matching by providing an utterance to match against synced actions
            </div>
            <button
                type="submit"
                disabled={!utteranceText.trim() || formState.loading}
                className="module-action-btn w-full justify-center text-accent-primary border-accent-primary/30"
            >
                {formState.loading ? 'Matching...' : 'Match Actions'}
            </button>
        </form>
    );
}

export default RAGMatchActionsForm;
