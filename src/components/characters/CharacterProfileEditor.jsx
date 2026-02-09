import React, { useState, useEffect } from 'react';
import useCharacterProfileStore from '../../store/characterProfileStore';
import ImageGallery from './ImageGallery';

/**
 * Modal editor for character profiles
 * @param {Object} props
 * @param {import('../../services/management/characterService').CharacterProfile} [props.profile] - Existing profile to edit
 * @param {Function} props.onClose - Callback to close the editor
 */
export default function CharacterProfileEditor({ profile, onClose }) {
    const [activeTab, setActiveTab] = useState('basic');
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        personality: '',
        appearance: '',
        backstory: '',
        voice_characteristics: '',
        base_prompt: '',
        scenario: '',
        example_dialogues: '',
        typing_speed_wpm: 60,
        audio_response_chance_percent: 50
    });
    
    const createProfile = useCharacterProfileStore(state => state.createProfile);
    const updateProfile = useCharacterProfileStore(state => state.updateProfile);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (profile) {
            setFormData({
                name: profile.name || '',
                description: profile.description || '',
                personality: profile.personality || '',
                appearance: profile.appearance || '',
                backstory: profile.backstory || '',
                voice_characteristics: profile.voice_characteristics || '',
                base_prompt: profile.base_prompt || '',
                scenario: profile.scenario || '',
                example_dialogues: profile.example_dialogues || '',
                typing_speed_wpm: profile.typing_speed_wpm ?? 60,
                audio_response_chance_percent: profile.audio_response_chance_percent ?? 50
            });
        }
    }, [profile]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        
        try {
            if (profile) {
                await updateProfile(profile.id, formData);
            } else {
                await createProfile(formData);
            }
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const tabs = [
        { id: 'basic', label: 'Basic Info' },
        { id: 'extended', label: 'Extended Info' },
        { id: 'advanced', label: 'Advanced' },
        { id: 'images', label: 'Images', hidden: !profile }
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'basic':
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="input-field w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={3}
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Personality</label>
                            <textarea
                                name="personality"
                                value={formData.personality}
                                onChange={handleChange}
                                rows={3}
                                className="input-field w-full resize-none"
                            />
                        </div>
                    </div>
                );
            case 'extended':
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Appearance</label>
                            <textarea
                                name="appearance"
                                value={formData.appearance}
                                onChange={handleChange}
                                rows={3}
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Backstory</label>
                            <textarea
                                name="backstory"
                                value={formData.backstory}
                                onChange={handleChange}
                                rows={4}
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Voice Characteristics</label>
                            <textarea
                                name="voice_characteristics"
                                value={formData.voice_characteristics}
                                onChange={handleChange}
                                rows={2}
                                className="input-field w-full resize-none"
                            />
                        </div>
                    </div>
                );
            case 'advanced':
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Base System Prompt</label>
                            <textarea
                                name="base_prompt"
                                value={formData.base_prompt}
                                onChange={handleChange}
                                rows={4}
                                placeholder="The primary instructions for the AI..."
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Scenario</label>
                            <textarea
                                name="scenario"
                                value={formData.scenario}
                                onChange={handleChange}
                                rows={2}
                                placeholder="The current setting or context..."
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Example Dialogues</label>
                            <textarea
                                name="example_dialogues"
                                value={formData.example_dialogues}
                                onChange={handleChange}
                                rows={4}
                                placeholder="User: Hello!&#10;Char: Greetings, traveller!..."
                                className="input-field w-full resize-none font-mono text-sm"
                            />
                        </div>
                        
                        {/* Behavior Settings Section */}
                        <div className="pt-4 border-t border-border-default">
                            <h3 className="text-sm font-semibold text-text-primary mb-4">Chat Behavior Settings</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Typing Speed (WPM)
                                        <span className="text-xs text-text-muted ml-2">Words per minute</span>
                                    </label>
                                    <input
                                        type="number"
                                        name="typing_speed_wpm"
                                        value={formData.typing_speed_wpm}
                                        onChange={handleChange}
                                        min="1"
                                        max="200"
                                        className="input-field w-full"
                                    />
                                    <p className="text-xs text-text-muted mt-1">
                                        Average: 40-60 WPM. Affects typing indicator duration in chats.
                                    </p>
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">
                                        Audio Response Chance (%)
                                        <span className="text-xs text-text-muted ml-2">0-100%</span>
                                    </label>
                                    <input
                                        type="number"
                                        name="audio_response_chance_percent"
                                        value={formData.audio_response_chance_percent}
                                        onChange={handleChange}
                                        min="0"
                                        max="100"
                                        className="input-field w-full"
                                    />
                                    <p className="text-xs text-text-muted mt-1">
                                        Percentage chance character responds with audio message.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'images':
                return profile ? <ImageGallery profileId={profile.id} /> : null;
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="modal-content w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-border-default flex justify-between items-center">
                    <h2 className="text-xl font-bold text-accent-primary">
                        {profile ? `Edit Profile: ${profile.name}` : 'Create Character Profile'}
                    </h2>
                    <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex border-b border-border-default bg-background-surface">
                    {tabs.map(tab => !tab.hidden && (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-3 text-sm font-medium transition-colors ${
                                activeTab === tab.id 
                                    ? 'border-b-2 border-accent-primary text-accent-primary bg-background-elevated' 
                                    : 'text-text-muted hover:text-text-primary hover:bg-background-elevated/50'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-background-surface">
                    {activeTab !== 'images' ? (
                        <form id="character-profile-form" onSubmit={handleSubmit}>
                            {renderTabContent()}
                        </form>
                    ) : (
                        renderTabContent()
                    )}
                </div>

                <div className="px-6 py-4 border-t border-border-default flex justify-between items-center">
                    <div>
                        {error && <span className="text-sm text-status-error font-medium">{error}</span>}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary px-4 py-2 rounded-md text-sm font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        {activeTab !== 'images' && (
                            <button
                                type="submit"
                                form="character-profile-form"
                                disabled={saving}
                                className="btn-primary px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Saving...' : 'Save Profile'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
