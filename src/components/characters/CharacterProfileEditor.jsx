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
        example_dialogues: ''
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
                example_dialogues: profile.example_dialogues || ''
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
                            <label className="block text-sm font-medium text-gray-700">Name</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={3}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Personality</label>
                            <textarea
                                name="personality"
                                value={formData.personality}
                                onChange={handleChange}
                                rows={3}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            />
                        </div>
                    </div>
                );
            case 'extended':
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Appearance</label>
                            <textarea
                                name="appearance"
                                value={formData.appearance}
                                onChange={handleChange}
                                rows={3}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Backstory</label>
                            <textarea
                                name="backstory"
                                value={formData.backstory}
                                onChange={handleChange}
                                rows={4}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Voice Characteristics</label>
                            <textarea
                                name="voice_characteristics"
                                value={formData.voice_characteristics}
                                onChange={handleChange}
                                rows={2}
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            />
                        </div>
                    </div>
                );
            case 'advanced':
                return (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Base System Prompt</label>
                            <textarea
                                name="base_prompt"
                                value={formData.base_prompt}
                                onChange={handleChange}
                                rows={4}
                                placeholder="The primary instructions for the AI..."
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Scenario</label>
                            <textarea
                                name="scenario"
                                value={formData.scenario}
                                onChange={handleChange}
                                rows={2}
                                placeholder="The current setting or context..."
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Example Dialogues</label>
                            <textarea
                                name="example_dialogues"
                                value={formData.example_dialogues}
                                onChange={handleChange}
                                rows={4}
                                placeholder="User: Hello!&#10;Char: Greetings, traveller!..."
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-900 font-mono text-sm"
                            />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-height-[90vh] flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <h2 className="text-xl font-bold text-gray-900">
                        {profile ? `Edit Profile: ${profile.name}` : 'Create Character Profile'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex border-b border-gray-200 bg-white">
                    {tabs.map(tab => !tab.hidden && (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-3 text-sm font-medium transition-colors ${
                                activeTab === tab.id 
                                    ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50' 
                                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-white">
                    {activeTab !== 'images' ? (
                        <form id="character-profile-form" onSubmit={handleSubmit}>
                            {renderTabContent()}
                        </form>
                    ) : (
                        renderTabContent()
                    )}
                </div>

                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                    <div>
                        {error && <span className="text-sm text-red-600 font-medium">{error}</span>}
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Cancel
                        </button>
                        {activeTab !== 'images' && (
                            <button
                                type="submit"
                                form="character-profile-form"
                                disabled={saving}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
