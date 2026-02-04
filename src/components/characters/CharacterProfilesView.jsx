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
    const [cardSize, setCardSize] = useState(() => {
        // Load saved card size from localStorage or default to 'medium'
        return localStorage.getItem('characterProfileCardSize') || 'medium';
    });

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

    const handleCardSizeChange = (size) => {
        setCardSize(size);
        localStorage.setItem('characterProfileCardSize', size);
    };

    // Grid classes based on card size
    const getGridClasses = () => {
        switch (cardSize) {
            case 'small':
                return 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12';
            case 'large':
                return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
            case 'medium':
            default:
                return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';
        }
    };

    return (
        <div className="flex flex-col min-h-full bg-background-base">
            {/* View Header */}
            <div className="bg-background-surface/30 backdrop-blur-sm border-b border-white/5 px-6 py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight">
                            <span className="text-gradient-primary">Character</span> Profiles
                        </h1>
                        <p className="text-xs text-text-muted mt-0.5 font-medium">
                            Manage AI character identities and cards
                        </p>
                    </div>
                    
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowImport(true)}
                            className="btn-secondary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors"
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
                            className="btn-primary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors"
                        >
                            <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Create Profile
                        </button>
                    </div>
                </div>
            </div>

            {/* Search Bar & Card Size Selector */}
            <div className="bg-background-surface/50 border-b border-white/5 px-6 py-4 backdrop-blur-md">
                <div className="flex items-center gap-4 justify-between">
                    <div className="relative flex-1 max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            className="input-field block w-full pl-11 pr-3 py-2 rounded-md leading-5 sm:text-sm transition-colors"
                            placeholder="Search profiles..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Card Size Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted font-medium">Card Size:</span>
                        <div className="flex bg-background-elevated/50 rounded-lg p-1 gap-1">
                            <button
                                onClick={() => handleCardSizeChange('small')}
                                className={`p-2 rounded transition-all ${
                                    cardSize === 'small'
                                        ? 'bg-accent-primary text-white shadow-sm'
                                        : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                                }`}
                                title="Small cards"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                </svg>
                            </button>
                            <button
                                onClick={() => handleCardSizeChange('medium')}
                                className={`p-2 rounded transition-all ${
                                    cardSize === 'medium'
                                        ? 'bg-accent-primary text-white shadow-sm'
                                        : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                                }`}
                                title="Medium cards"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                                </svg>
                            </button>
                            <button
                                onClick={() => handleCardSizeChange('large')}
                                className={`p-2 rounded transition-all ${
                                    cardSize === 'large'
                                        ? 'bg-accent-primary text-white shadow-sm'
                                        : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                                }`}
                                title="Large cards"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h14a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6">
                {isLoading && profiles.length === 0 ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
                    </div>
                ) : filteredProfiles.length > 0 ? (
                    <div className={`grid ${getGridClasses()} gap-6`}>
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
                    <div className="text-center py-20 bg-background-surface/30 rounded-lg border-2 border-dashed border-white/10">
                        <svg className="mx-auto h-12 w-12 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-text-primary">No profiles found</h3>
                        <p className="mt-1 text-sm text-text-muted">
                            {searchQuery ? 'Try adjusting your search query.' : 'Get started by creating a new profile or importing a character card.'}
                        </p>
                        {!searchQuery && (
                            <div className="mt-6 flex justify-center gap-3">
                                <button
                                    onClick={() => setShowImport(true)}
                                    className="btn-secondary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors"
                                >
                                    Import Card
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingProfile(null);
                                        setShowEditor(true);
                                    }}
                                    className="btn-primary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors"
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
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="modal-content w-full max-w-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-border-default flex justify-between items-center">
                            <h2 className="text-xl font-bold text-accent-primary">Import Character Card</h2>
                            <button onClick={() => setShowImport(false)} className="text-text-muted hover:text-text-primary transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6">
                            <CharacterCardImport onSuccess={handleImportSuccess} />
                        </div>
                        <div className="px-6 py-4 border-t border-border-default flex justify-end">
                            <button
                                onClick={() => setShowImport(false)}
                                className="btn-secondary px-4 py-2 rounded-md text-sm font-medium transition-colors"
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
