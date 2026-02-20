import React, { useState, useEffect } from 'react';
import useCharacterProfileStore from '../../store/characterProfileStore';
import ImageGallery from './ImageGallery';
import ErrorDialog from '../modals/ErrorDialog.jsx';

/**
 * Modal editor for character profiles
 * @param {Object} props
 * @param {import('../../services/management/characterService').CharacterProfile} [props.profile] - Existing profile to edit
 * @param {Function} props.onClose - Callback to close the editor
 */
export default function CharacterProfileEditor({ profile, onClose }) {
    const [activeTab, setActiveTab] = useState('basic');

    const createProfile = useCharacterProfileStore(state => state.createProfile);
    const updateProfile = useCharacterProfileStore(state => state.updateProfile);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);

    // Modal dialog for field validation errors (consistent with module settings pattern)
    const [modalMessage, setModalMessage] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const showModal = (message) => {
        setModalMessage(message);
        setIsModalVisible(true);
    };

    // Individual field states (per-field pattern, consistent with module settings views)
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [personality, setPersonality] = useState('');
    const [appearance, setAppearance] = useState('');
    const [backstory, setBackstory] = useState('');
    const [voiceCharacteristics, setVoiceCharacteristics] = useState('');
    const [basePrompt, setBasePrompt] = useState('');
    const [scenario, setScenario] = useState('');
    const [exampleDialogues, setExampleDialogues] = useState('');
    const [typingSpeedWPM, setTypingSpeedWPM] = useState('60');
    const [audioResponseChance, setAudioResponseChance] = useState('50');

    const setInitialValues = () => {
        if (profile) {
            setName(profile.name || '');
            setDescription(profile.description || '');
            setPersonality(profile.personality || '');
            setAppearance(profile.appearance || '');
            setBackstory(profile.backstory || '');
            setVoiceCharacteristics(profile.voice_characteristics || '');
            setBasePrompt(profile.base_prompt || '');
            setScenario(profile.scenario || '');
            setExampleDialogues(profile.example_dialogues || '');
            setTypingSpeedWPM(String(profile.typing_speed_wpm ?? 60));
            setAudioResponseChance(String(profile.audio_response_chance_percent ?? 50));
        } else {
            setName('');
            setDescription('');
            setPersonality('');
            setAppearance('');
            setBackstory('');
            setVoiceCharacteristics('');
            setBasePrompt('');
            setScenario('');
            setExampleDialogues('');
            setTypingSpeedWPM('60');
            setAudioResponseChance('50');
        }
    };

    useEffect(() => {
        setInitialValues();
    }, [profile]);

    // onBlur validation functions (consistent with module settings pattern)
    const validateNameAndUpdate = (value) => {
        if (value.trim() === '' && name.length > 0) {
            showModal('Name cannot be empty.');
            setName(profile?.name || ''); // reset to original profile name
            return;
        }
        setName(value);
    };

    const validateTypingSpeedAndUpdate = (value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue < 1 || numValue > 200) {
            showModal('Typing speed must be a whole number between 1 and 200.');
            setTypingSpeedWPM(String(profile?.typing_speed_wpm ?? 60)); // reset to original/default
            return;
        }
        setTypingSpeedWPM(String(numValue));
    };

    const validateAudioChanceAndUpdate = (value) => {
        const numValue = parseInt(value, 10);
        if (isNaN(numValue) || numValue < 0 || numValue > 100) {
            showModal('Audio response chance must be a whole number between 0 and 100.');
            setAudioResponseChance(String(profile?.audio_response_chance_percent ?? 50)); // reset to original/default
            return;
        }
        setAudioResponseChance(String(numValue));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('Name is required.');
            return;
        }

        const typingSpeedNum = parseInt(typingSpeedWPM, 10);
        const audioChanceNum = parseInt(audioResponseChance, 10);

        if (isNaN(typingSpeedNum) || typingSpeedNum < 1 || typingSpeedNum > 200) {
            setError('Please fix validation errors: typing speed must be a number between 1 and 200.');
            return;
        }
        if (isNaN(audioChanceNum) || audioChanceNum < 0 || audioChanceNum > 100) {
            setError('Please fix validation errors: audio response chance must be a number between 0 and 100.');
            return;
        }

        setSaving(true);
        setError(null);

        const payload = {
            name: name.trim(),
            description,
            personality,
            appearance,
            backstory,
            voice_characteristics: voiceCharacteristics,
            base_prompt: basePrompt,
            scenario,
            example_dialogues: exampleDialogues,
            typing_speed_wpm: typingSpeedNum,
            audio_response_chance_percent: audioChanceNum,
        };

        try {
            if (profile) {
                await updateProfile(profile.id, payload);
            } else {
                await createProfile(payload);
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
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onBlur={(e) => validateNameAndUpdate(e.target.value)}
                                required
                                className="input-field w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Description</label>
                            <textarea
                                name="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Personality</label>
                            <textarea
                                name="personality"
                                value={personality}
                                onChange={(e) => setPersonality(e.target.value)}
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
                                value={appearance}
                                onChange={(e) => setAppearance(e.target.value)}
                                rows={3}
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Backstory</label>
                            <textarea
                                name="backstory"
                                value={backstory}
                                onChange={(e) => setBackstory(e.target.value)}
                                rows={4}
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Voice Characteristics</label>
                            <textarea
                                name="voice_characteristics"
                                value={voiceCharacteristics}
                                onChange={(e) => setVoiceCharacteristics(e.target.value)}
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
                                value={basePrompt}
                                onChange={(e) => setBasePrompt(e.target.value)}
                                rows={4}
                                placeholder="The primary instructions for the AI..."
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Scenario</label>
                            <textarea
                                name="scenario"
                                value={scenario}
                                onChange={(e) => setScenario(e.target.value)}
                                rows={2}
                                placeholder="The current setting or context..."
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Example Dialogues</label>
                            <textarea
                                name="example_dialogues"
                                value={exampleDialogues}
                                onChange={(e) => setExampleDialogues(e.target.value)}
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
                                        value={typingSpeedWPM}
                                        onChange={(e) => setTypingSpeedWPM(e.target.value)}
                                        onBlur={(e) => validateTypingSpeedAndUpdate(e.target.value)}
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
                                        value={audioResponseChance}
                                        onChange={(e) => setAudioResponseChance(e.target.value)}
                                        onBlur={(e) => validateAudioChanceAndUpdate(e.target.value)}
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
            <ErrorDialog
                isOpen={isModalVisible}
                title="Invalid Input"
                message={modalMessage}
                onClose={() => setIsModalVisible(false)}
                type="error"
            />
        </div>
    );
}
