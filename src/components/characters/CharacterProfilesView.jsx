import React, { useState, useEffect } from 'react';
import useCharacterProfileStore from '../../store/characterProfileStore';
import CharacterProfileCard from './CharacterProfileCard';
import CharacterProfileEditor from './CharacterProfileEditor';
import CharacterCardImport from './CharacterCardImport';

/**
 * Main view for managing character profiles
 */
export default function CharacterProfilesView() {
    const { profiles, isLoading, loadProfiles, loadImages, deleteProfile, getProfile } = useCharacterProfileStore();
    const [showEditor, setShowEditor] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [editingProfile, setEditingProfile] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        loadProfiles();
    }, [loadProfiles]);

    // Load images for all profiles when profiles are loaded
    useEffect(() => {
        if (profiles && profiles.length > 0) {
            profiles.forEach(profile => {
                if (profile && profile.id) {
                    loadImages(profile.id);
                }
            });
        }
    }, [profiles, loadImages]);

    const handleEdit = (profile) => {
        setEditingProfile(profile);
        setShowEditor(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this character profile? This action cannot be undone.')) return;
        try {
            await deleteProfile(id);
        } catch (error) {
            alert('Failed to delete profile: ' + error.message);
        }
    };

    const handleImportSuccess = async (result) => {
        // Close the import modal first
        setShowImport(false);
        
        // Reload profiles to get the complete data from server
        await loadProfiles();
        
        // Now open editor with the freshly loaded profile
        if (result && result.id) {
            const profile = getProfile(result.id);
            if (profile) {
                handleEdit(profile);
            }
        }
    };

    const filteredProfiles = profiles.filter(p => 
        p && p.id && p.name && (
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
        )
    );

    return (
        <div className="bg-neutral-900 text-neutral-100 min-h-screen p-6">
            {/* Header */}
            <div className="bg-neutral-800 border-b border-neutral-700 px-6 py-4 rounded-t-lg">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-orange-400">Character Profiles</h1>
                        <p className="text-sm text-gray-400 mt-1">Manage AI character identities and cards</p>
                    </div>
                    
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowImport(true)}
                            className="inline-flex items-center px-4 py-2 border border-neutral-600 shadow-sm text-sm font-medium rounded-md text-neutral-300 bg-neutral-700 hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                        >
                            <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Import Card
                        </button>
                        <button
                            onClick={() => {
                                setEditingProfile(null);
                                setShowEditor(true);
                            }}
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                        >
                            <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create Profile
                        </button>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="bg-neutral-800 border-x border-neutral-700 px-6 py-4">
                <div className="relative max-w-md">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2 border border-neutral-600 rounded-md leading-5 bg-neutral-700 text-neutral-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
                        placeholder="Search profiles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="bg-neutral-800 border border-neutral-700 rounded-b-lg p-6">
                {isLoading && profiles.length === 0 ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
                    </div>
                ) : filteredProfiles.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredProfiles.map(profile => (
                            <CharacterProfileCard
                                key={profile.id}
                                profile={profile}
                                onClick={() => handleEdit(profile)}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-neutral-900 rounded-lg border-2 border-dashed border-neutral-700">
                        <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-neutral-100">No profiles found</h3>
                        <p className="mt-1 text-sm text-gray-400">
                            {searchQuery ? 'Try adjusting your search query.' : 'Get started by creating a new profile or importing a character card.'}
                        </p>
                        {!searchQuery && (
                            <div className="mt-6 flex justify-center gap-3">
                                <button
                                    onClick={() => setShowImport(true)}
                                    className="inline-flex items-center px-4 py-2 border border-neutral-600 shadow-sm text-sm font-medium rounded-md text-neutral-300 bg-neutral-700 hover:bg-neutral-600"
                                >
                                    Import Card
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingProfile(null);
                                        setShowEditor(true);
                                    }}
                                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-orange-500 hover:bg-orange-600"
                                >
                                    Create Profile
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            {showEditor && (
                <CharacterProfileEditor
                    profile={editingProfile}
                    onClose={() => {
                        setShowEditor(false);
                        setEditingProfile(null);
                    }}
                />
            )}

            {showImport && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                    <div className="bg-neutral-800 rounded-lg shadow-xl w-full max-w-xl overflow-hidden border border-neutral-700">
                        <div className="px-6 py-4 border-b border-neutral-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-orange-400">Import Character Card</h2>
                            <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-300">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6">
                            <CharacterCardImport onSuccess={handleImportSuccess} />
                        </div>
                        <div className="px-6 py-4 border-t border-neutral-700 flex justify-end">
                            <button
                                onClick={() => setShowImport(false)}
                                className="px-4 py-2 border border-neutral-600 rounded-md text-sm font-medium text-neutral-300 bg-neutral-700 hover:bg-neutral-600"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
