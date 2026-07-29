import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import useCharacterProfileStore from '../../store/characterProfileStore';
import CharacterProfileCard from './CharacterProfileCard';
import CharacterProfileEditor from './CharacterProfileEditor';
import CharacterCardImport from './CharacterCardImport';

/**
 * Main view for managing character profiles
 */
export default function CharacterProfilesView() {
    const { t } = useTranslation();
    const { profiles, isLoading, loadProfiles, loadImages, deleteProfile, getProfile } = useCharacterProfileStore();
    const [showEditor, setShowEditor] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [editingProfile, setEditingProfile] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [cardSize, setCardSize] = useState(() => {
        return localStorage.getItem('characterProfileCardSize') || 'medium';
    });

    /** Filter profiles by search query — matches name and description */
    const filteredProfiles = useMemo(() => {
        if (!searchQuery.trim()) return profiles;
        const query = searchQuery.toLowerCase().trim();
        return profiles.filter(p =>
            p.name?.toLowerCase().includes(query) ||
            p.description?.toLowerCase().includes(query)
        );
    }, [profiles, searchQuery]);

    useEffect(() => {
        loadProfiles();
    }, [loadProfiles]);

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
        if (!confirm(t('characters:deleteConfirm'))) return;
        try {
            await deleteProfile(id);
        } catch (error) {
            alert(t('characters:deleteFailed', { message: error.message }));
        }
    };

    const handleImportSuccess = async (result) => {
        setShowImport(false);
        await loadProfiles();
        if (result && result.id) {
            const profile = getProfile(result.id);
            if (profile) {
                handleEdit(profile);
            }
        }
    };

    const handleCardSizeChange = (size) => {
        setCardSize(size);
        localStorage.setItem('characterProfileCardSize', size);
    };

    const getGridClasses = () => {
        switch (cardSize) {
            case 'small': return 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12';
            case 'large': return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
            case 'medium':
            default: return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6';
        }
    };

    const colorFirstWord = (text) => {
        const spaceIdx = text.indexOf(' ');
        if (spaceIdx === -1) return <span className="text-gradient-primary">{text}</span>;
        return <><span className="text-gradient-primary">{text.slice(0, spaceIdx)}</span>{text.slice(spaceIdx)}</>;
    };

    return (
        <div className="flex flex-col min-h-full bg-background-base">
            <div className="bg-background-surface/30 backdrop-blur-sm px-6 py-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold tracking-tight">
                            {colorFirstWord(t('characters:header.title'))}
                        </h1>
                        <p className="text-xs text-text-muted mt-0.5 font-medium">
                            {t('characters:header.subtitle')}
                        </p>
                    </div>
                    
                    <div className="flex gap-3">
                        <button data-tutorial-id="char-import-btn" onClick={() => setShowImport(true)}
                            className="btn-secondary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors">
                            <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            {t('characters:buttons.importCard')}
                        </button>
                        <button data-tutorial-id="char-create-btn" onClick={() => { setEditingProfile(null); setShowEditor(true); }}
                            className="btn-primary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors">
                            <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            {t('characters:buttons.createProfile')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-background-surface/50 px-6 py-4 backdrop-blur-md">
                <div className="flex items-center justify-between gap-4">
                    {/* Search Bar */}
                    <div data-tutorial-id="char-search" className="search-bar-wrapper">
                        <svg className="search-bar-icon w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            className="search-bar-input"
                            placeholder={t('characters:searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            aria-label={t('characters:searchPlaceholder')}
                        />
                    </div>

                    {/* Card Size Toggle */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-text-muted font-medium">{t('characters:cardSize')}</span>
                        <div className="flex bg-background-elevated/50 rounded-lg p-1 gap-1">
                            {[
                                { size: 'small', title: t('characters:cardSizes.small'), path: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
                                { size: 'medium', title: t('characters:cardSizes.medium'), path: "M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" },
                                { size: 'large', title: t('characters:cardSizes.large'), path: "M4 5a1 1 0 011-1h14a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h14a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4z" },
                            ].map(({ size, title, path }) => (
                                <button key={size} onClick={() => handleCardSizeChange(size)}
                                    className={`p-2 rounded transition-all ${cardSize === size ? 'bg-accent-primary text-white shadow-sm' : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`}
                                    title={title}>
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
                                    </svg>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 p-6">
                {isLoading && profiles.length === 0 ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
                    </div>
                ) : profiles.length > 0 ? (
                    filteredProfiles.length > 0 ? (
                        <div data-tutorial-id="char-profile-grid" className={`grid ${getGridClasses()} gap-6`}>
                            {filteredProfiles.map(profile => (
                                <CharacterProfileCard key={profile.id} profile={profile}
                                    onClick={() => handleEdit(profile)} onDelete={handleDelete} />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-24">
                            <svg className="w-16 h-16 text-text-muted/25 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <p className="text-lg font-semibold text-text-primary mb-1.5">{t('characters:empty.noResults')}</p>
                            <p className="text-sm text-text-muted">{t('characters:empty.tryAdjustingSearch')}</p>
                        </div>
                    )
                ) : (
                    <div className="text-center py-20 bg-background-surface/30 rounded-lg border-2 border-dashed border-white/10">
                        <svg className="mx-auto h-12 w-12 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-text-primary">{t('characters:empty.title')}</h3>
                        <p className="mt-1 text-sm text-text-muted">{t('characters:empty.getStarted')}</p>
                        <div className="mt-6 flex justify-center gap-3">
                            <button onClick={() => setShowImport(true)} className="btn-secondary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors">
                                {t('characters:buttons.importCard')}
                            </button>
                            <button onClick={() => { setEditingProfile(null); setShowEditor(true); }} className="btn-primary inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors">
                                {t('characters:buttons.createProfile')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showEditor && (
                <CharacterProfileEditor profile={editingProfile} onClose={() => { setShowEditor(false); setEditingProfile(null); }} />
            )}

            {showImport && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="modal-content w-full max-w-xl overflow-hidden">
                        <div className="px-6 py-4 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-accent-primary">{t('characters:importTitle')}</h2>
                            <button onClick={() => setShowImport(false)} className="text-text-muted hover:text-text-primary transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6">
                            <CharacterCardImport onSuccess={handleImportSuccess} />
                        </div>
                        <div className="px-6 py-4 flex justify-end">
                            <button onClick={() => setShowImport(false)} className="btn-secondary px-4 py-2 rounded-md text-sm font-medium transition-colors">
                                {t('common:buttons.cancel')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
