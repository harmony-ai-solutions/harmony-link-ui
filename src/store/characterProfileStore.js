import { create } from 'zustand';
import { produce } from 'immer';
import * as characterService from '../services/management/characterService.js';

/**
 * Zustand store for character profile state management
 */
const useCharacterProfileStore = create((set, get) => ({
    // State
    profiles: [],
    selectedProfileId: null,
    images: {},  // Map of profileId -> image array
    isLoading: false,
    error: null,
    
    // Actions - Character Profiles
    
    /**
     * Load all character profiles from the server
     */
    loadProfiles: async () => {
        set({ isLoading: true, error: null });
        try {
            const profiles = await characterService.listCharacterProfiles();
            set({ profiles, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },
    
    /**
     * Create a new character profile
     * @param {Partial<import('../services/management/characterService').CharacterProfile>} profile 
     * @returns {Promise<import('../services/management/characterService').CharacterProfile>}
     */
    createProfile: async (profile) => {
        set({ isLoading: true, error: null });
        try {
            const newProfile = await characterService.createCharacterProfile(profile);
            set(produce(state => {
                state.profiles.push(newProfile);
                state.isLoading = false;
            }));
            return newProfile;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },
    
    /**
     * Update an existing character profile
     * @param {string} id 
     * @param {Partial<import('../services/management/characterService').CharacterProfile>} updates 
     */
    updateProfile: async (id, updates) => {
        set({ isLoading: true, error: null });
        try {
            const updated = await characterService.updateCharacterProfile(id, updates);
            set(produce(state => {
                const index = state.profiles.findIndex(p => p.id === id);
                if (index !== -1) {
                    state.profiles[index] = updated;
                }
                state.isLoading = false;
            }));
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },
    
    /**
     * Delete a character profile
     * @param {string} id 
     */
    deleteProfile: async (id) => {
        set({ isLoading: true, error: null });
        try {
            await characterService.deleteCharacterProfile(id);
            set(produce(state => {
                state.profiles = state.profiles.filter(p => p.id !== id);
                if (state.selectedProfileId === id) {
                    state.selectedProfileId = null;
                }
                delete state.images[id];
                state.isLoading = false;
            }));
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },
    
    /**
     * Import a character card from a PNG file
     * @param {File} file 
     * @returns {Promise<import('../services/management/characterService').CharacterCardImportResult>}
     */
    importCharacterCard: async (file) => {
        set({ isLoading: true, error: null });
        try {
            const result = await characterService.importCharacterCard(file);
            set(produce(state => {
                state.profiles.push(result.profile);
                state.images[result.profile.id] = [result.image];
                state.isLoading = false;
            }));
            return result;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },
    
    /**
     * Select a profile by ID
     * @param {string} id 
     */
    selectProfile: (id) => {
        set({ selectedProfileId: id });
    },
    
    // Actions - Images
    
    /**
     * Load images for a specific character profile
     * @param {string} profileId 
     */
    loadImages: async (profileId) => {
        try {
            const images = await characterService.listImages(profileId);
            set(produce(state => {
                state.images[profileId] = images;
            }));
        } catch (error) {
            console.error('Failed to load images:', error);
        }
    },
    
    /**
     * Upload a new image for a character profile
     * @param {string} profileId 
     * @param {File} file 
     * @param {string} description 
     * @returns {Promise<import('../services/management/characterService').CharacterImage>}
     */
    uploadImage: async (profileId, file, description) => {
        try {
            const image = await characterService.uploadImage(profileId, file, description);
            set(produce(state => {
                if (!state.images[profileId]) {
                    state.images[profileId] = [];
                }
                state.images[profileId].push(image);
            }));
            return image;
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },
    
    /**
     * Delete a character image
     * @param {string} profileId 
     * @param {number} imageId 
     */
    deleteImage: async (profileId, imageId) => {
        try {
            await characterService.deleteImage(profileId, imageId);
            set(produce(state => {
                if (state.images[profileId]) {
                    state.images[profileId] = state.images[profileId].filter(a => a.id !== imageId);
                }
            }));
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },
    
    /**
     * Set an image as the primary image for a profile
     * @param {string} profileId 
     * @param {number} imageId 
     */
    setPrimaryImage: async (profileId, imageId) => {
        try {
            await characterService.setPrimaryImage(profileId, imageId);
            set(produce(state => {
                if (state.images[profileId]) {
                    state.images[profileId].forEach(image => {
                        image.is_primary = image.id === imageId;
                    });
                }
            }));
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },
    
    // Getters
    
    /**
     * Get a profile by ID from the local state
     * @param {string} id 
     */
    getProfile: (id) => {
        const state = get();
        return state.profiles.find(p => p.id === id);
    },
    
    /**
     * Get the currently selected profile
     */
    getSelectedProfile: () => {
        const state = get();
        return state.profiles.find(p => p.id === state.selectedProfileId);
    },
    
    /**
     * Get images for a profile from the local state
     * @param {string} profileId 
     */
    getImagesForProfile: (profileId) => {
        const state = get();
        return state.images[profileId] || [];
    },
    
    /**
     * Get the primary image for a profile from the local state
     * @param {string} profileId 
     */
    getPrimaryImage: (profileId) => {
        const state = get();
        const images = state.images[profileId] || [];
        return images.find(a => a.is_primary) || images[0];
    },
}));

export default useCharacterProfileStore;
