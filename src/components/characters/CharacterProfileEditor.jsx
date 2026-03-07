import React, { useState, useEffect } from 'react';
import useCharacterProfileStore from '../../store/characterProfileStore';
import { listModuleConfigs } from '../../services/management/moduleService.js';
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
    const [visionConfigs, setVisionConfigs] = useState([]);
    const [selectedVisionConfigId, setSelectedVisionConfigId] = useState(null);

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
            setSelectedVisionConfigId(profile.vision_config_id || null);
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
            setSelectedVisionConfigId(null);
        }
    };

    useEffect(() => {
        setInitialValues();
    }, [profile]);

    useEffect(() => {
        if (activeTab === 'images') {
            listModuleConfigs('vision').then(setVisionConfigs).catch(console.error);
        }
    }, [activeTab]);

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
            vision_config_id: selectedVisionConfigId || null,
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
        {
            id: 'basic', label: 'Basic Info',
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        },
        {
            id: 'extended', label: 'Extended Info',
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z" /></svg>
        },
        {
            id: 'advanced', label: 'Advanced',
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
        },
        {
            id: 'images', label: 'Images', hidden: !profile,
            icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'basic':
                return (
                    <div className="space-y-5">
                        <div className="character-editor-field-group">
                            <label className="character-editor-label">
                                Name
                                <span className="character-editor-label-required">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onBlur={(e) => validateNameAndUpdate(e.target.value)}
                                required
                                placeholder="Character name..."
                                className="input-field w-full"
                            />
                        </div>
                        <div className="character-editor-field-group">
                            <label className="character-editor-label">Description</label>
                            <p className="character-editor-hint">A brief summary of who this character is.</p>
                            <textarea
                                name="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                placeholder="A brief overview of this character..."
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div className="character-editor-field-group">
                            <label className="character-editor-label">Personality</label>
                            <p className="character-editor-hint">How the character thinks, behaves, and interacts.</p>
                            <textarea
                                name="personality"
                                value={personality}
                                onChange={(e) => setPersonality(e.target.value)}
                                rows={4}
                                placeholder="Friendly, curious, witty, empathetic..."
                                className="input-field w-full resize-none"
                            />
                        </div>
                    </div>
                );
            case 'extended':
                return (
                    <div className="space-y-5">
                        <div className="character-editor-field-group">
                            <label className="character-editor-label">Appearance</label>
                            <p className="character-editor-hint">Physical description — used for image generation and visual context.</p>
                            <textarea
                                name="appearance"
                                value={appearance}
                                onChange={(e) => setAppearance(e.target.value)}
                                rows={3}
                                placeholder="Tall, dark hair, piercing blue eyes..."
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div className="character-editor-field-group">
                            <label className="character-editor-label">Backstory</label>
                            <p className="character-editor-hint">History and background that shapes this character's worldview.</p>
                            <textarea
                                name="backstory"
                                value={backstory}
                                onChange={(e) => setBackstory(e.target.value)}
                                rows={4}
                                placeholder="Born in a small village, raised by..."
                                className="input-field w-full resize-none"
                            />
                        </div>
                        <div className="character-editor-field-group">
                            <label className="character-editor-label">Voice Characteristics</label>
                            <p className="character-editor-hint">Speaking style, tone, and distinctive phrases.</p>
                            <textarea
                                name="voice_characteristics"
                                value={voiceCharacteristics}
                                onChange={(e) => setVoiceCharacteristics(e.target.value)}
                                rows={2}
                                placeholder="Speaks softly, uses archaic phrases, laughs often..."
                                className="input-field w-full resize-none"
                            />
                        </div>
                    </div>
                );
            case 'advanced':
                return (
                    <div className="space-y-4">
                        {/* AI Prompt section */}
                        <div className="character-editor-section">
                            <div className="character-editor-section-header">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                AI Prompt Settings
                            </div>
                            <div className="space-y-4 p-4">
                                <div className="character-editor-field-group">
                                    <label className="character-editor-label">Base System Prompt</label>
                                    <p className="character-editor-hint">Primary instructions passed to the AI model.</p>
                                    <textarea
                                        name="base_prompt"
                                        value={basePrompt}
                                        onChange={(e) => setBasePrompt(e.target.value)}
                                        rows={4}
                                        placeholder="You are {{char}}, a helpful and friendly assistant..."
                                        className="input-field w-full resize-none"
                                    />
                                </div>
                                <div className="character-editor-field-group">
                                    <label className="character-editor-label">Scenario</label>
                                    <p className="character-editor-hint">The current setting or context for the conversation.</p>
                                    <textarea
                                        name="scenario"
                                        value={scenario}
                                        onChange={(e) => setScenario(e.target.value)}
                                        rows={2}
                                        placeholder="A cozy cafe in a fantasy city, late afternoon..."
                                        className="input-field w-full resize-none"
                                    />
                                </div>
                                <div className="character-editor-field-group">
                                    <label className="character-editor-label">Example Dialogues</label>
                                    <p className="character-editor-hint">Sample exchanges that guide the AI's response style.</p>
                                    <textarea
                                        name="example_dialogues"
                                        value={exampleDialogues}
                                        onChange={(e) => setExampleDialogues(e.target.value)}
                                        rows={4}
                                        placeholder={"User: Hello!\nChar: Greetings, traveller!..."}
                                        className="input-field w-full resize-none font-mono text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Chat Behavior section */}
                        <div className="character-editor-section">
                            <div className="character-editor-section-header">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                                Chat Behavior
                            </div>
                            <div className="grid grid-cols-2 gap-4 p-4">
                                <div className="character-editor-field-group">
                                    <label className="character-editor-label">
                                        Typing Speed
                                        <span className="character-editor-label-unit">Words per Minute</span>
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
                                    <p className="character-editor-hint">Average: 40–60 WPM. Affects typing indicator duration.</p>
                                </div>
                                <div className="character-editor-field-group">
                                    <label className="character-editor-label">
                                        Audio Response Chance
                                        <span className="character-editor-label-unit">0–100%</span>
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
                                    <p className="character-editor-hint">Probability of responding with an audio message.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 'images':
                return profile ? (
                    <div className="space-y-4">
                        {/* Vision Config selector */}
                        <div className="character-editor-section">
                            <div className="character-editor-section-header">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Vision Integration
                            </div>
                            <div className="flex items-center gap-4 p-4">
                                <select
                                    value={selectedVisionConfigId ?? ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSelectedVisionConfigId(val ? Number(val) : null);
                                    }}
                                    className="input-field flex-1 max-w-xs"
                                >
                                    <option value="">— None —</option>
                                    {visionConfigs.map(cfg => (
                                        <option key={cfg.id} value={cfg.id}>{cfg.name}</option>
                                    ))}
                                </select>
                                <p className="character-editor-hint flex-1 italic">
                                    Select a Vision module config to enable automated image analysis and labeling.
                                </p>
                            </div>
                        </div>

                        <ImageGallery
                            profileId={profile.id}
                            visionConfigId={selectedVisionConfigId}
                        />
                    </div>
                ) : null;
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="character-editor-modal w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">

                {/* ── Modal Header ───────────────────────────────────────────── */}
                <div className="character-editor-modal-header">
                    <div className="character-editor-modal-tint" />
                    <div className="character-editor-modal-stripe" />
                    <div className="relative flex justify-between items-center px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="character-editor-icon-badge">
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gradient-primary leading-tight">
                                    {profile ? 'Edit Profile' : 'Create Character Profile'}
                                </h2>
                                {profile && (
                                    <p className="text-xs text-text-muted mt-0.5">{profile.name}</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="relative text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-white/5"
                            title="Close"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* ── Tab Bar ────────────────────────────────────────────────── */}
                <div className="character-editor-tab-bar">
                    {tabs.map(tab => !tab.hidden && (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`character-editor-tab ${activeTab === tab.id ? 'character-editor-tab-active' : 'character-editor-tab-inactive'}`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* ── Tab Content ────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-6 bg-background-base">
                    {activeTab !== 'images' ? (
                        <form id="character-profile-form" onSubmit={handleSubmit}>
                            {renderTabContent()}
                        </form>
                    ) : (
                        renderTabContent()
                    )}
                </div>

                {/* ── Footer ─────────────────────────────────────────────────── */}
                <div className="character-editor-footer">
                    <div className="flex-1">
                        {error && (
                            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-error)' }}>
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 flex-shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary px-5 py-2 text-sm font-semibold"
                        >
                            Cancel
                        </button>
                        {activeTab !== 'images' ? (
                            <button
                                type="submit"
                                form="character-profile-form"
                                disabled={saving}
                                className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Saving…' : 'Save Profile'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={(e) => handleSubmit(e)}
                                disabled={saving}
                                className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Saving…' : 'Save Profile'}
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
