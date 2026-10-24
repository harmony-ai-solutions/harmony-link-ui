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
    // Cross-view request: set by the Chat welcome screen's "Create AI
    // Character" button, consumed once by CharacterProfilesView to open the
    // create editor for a brand-new profile. Mirrors personaStore's
    // requestEditPersonaId handoff pattern.
    createProfileRequested: false,

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
     * Toggle a profile's favourite bit (plan 03-1).
     *
     * OPTIMISTIC, then reconciled: the heart must feel instant, so the local row
     * is patched before the request goes out, and a failure restores the EXACT
     * previous value (not a blanket `false`) — the user may have been
     * un-favouriting. The error is re-thrown so the card can toast it.
     *
     * Two details that matter:
     *  - `is_favorite` is patched as a NUMBER (1/0). The engine stores it as a
     *    SQLite 0/1 INTEGER and the list route marshals `int64`, so writing
     *    `true` here would make the optimistic row disagree with the next
     *    refetch and with `isFavorite()`'s wire-value handling.
     *  - `isLoading` is deliberately NOT touched. It is the grid's skeleton flag;
     *    flipping it on every heart click would flash the whole character grid.
     *
     * @param {string} id
     * @param {boolean} [nextFavorite] - explicit target; defaults to the inverse
     * @returns {Promise<{id: string, is_favorite: boolean}>}
     */
    toggleFavorite: async (id, nextFavorite) => {
        const current = get().profiles.find(p => p.id === id);
        if (!current) return null;

        const previous = current.is_favorite;
        // Accept both the numeric wire value and a boolean from a caller.
        const target = typeof nextFavorite === 'boolean'
            ? nextFavorite
            : !(previous === true || previous === 1 || previous === '1');

        set(produce(state => {
            const index = state.profiles.findIndex(p => p.id === id);
            if (index !== -1) {
                state.profiles[index].is_favorite = target ? 1 : 0;
            }
        }));

        try {
            const result = await characterService.setCharacterProfileFavorite(id, target);
            // Reconcile against the engine's answer (authoritative), keeping the
            // numeric shape.
            const confirmed = !!result?.is_favorite;
            set(produce(state => {
                const index = state.profiles.findIndex(p => p.id === id);
                if (index !== -1) {
                    state.profiles[index].is_favorite = confirmed ? 1 : 0;
                }
            }));
            return result;
        } catch (error) {
            // Restore the snapshot — a failed toggle must never leave the heart
            // lying about what the database holds.
            set(produce(state => {
                const index = state.profiles.findIndex(p => p.id === id);
                if (index !== -1) {
                    state.profiles[index].is_favorite = previous;
                }
            }));
            set({ error: error.message });
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
                if (result && result.profile) {
                    state.profiles.push(result.profile);
                    if (result.profile.id && result.image) {
                        state.images[result.profile.id] = [result.image];
                    }
                }
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

    /**
     * Export a character profile as a Character Card V3 (JSON or PNG `ccv3`).
     * Triggers a browser download of the exported card.
     * @param {string} profileId
     * @param {'json'|'png'} [format='png']
     * @param {string} [filenameBase]
     */
    exportCharacterCard: async (profileId, format = 'png', filenameBase) => {
        set({ isLoading: true, error: null });
        try {
            await characterService.exportCharacterCard(profileId, format, filenameBase);
            set({ isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
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
     * Update image metadata (e.g., description)
     * @param {string} profileId 
     * @param {string} imageId 
     * @param {Object} updates - Metadata updates (e.g., {description: "..."})
     */
    updateImageMetadata: async (profileId, imageId, updates) => {
        try {
            const updated = await characterService.updateImageMetadata(profileId, imageId, updates);
            set(produce(state => {
                if (state.images[profileId]) {
                    const index = state.images[profileId].findIndex(img => img.id === imageId);
                    if (index !== -1) {
                        state.images[profileId][index] = { ...state.images[profileId][index], ...updated };
                    }
                }
            }));
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },
    
    /**
     * Delete a character image
     * @param {string} profileId 
     * @param {string} imageId 
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
     * @param {string} imageId 
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
    
    /**
     * Trigger VL analysis for a character image and update local state.
     * @param {string} profileId
     * @param {string} imageId
     * @param {string} visionConfigId
     */
    analyzeImage: async (profileId, imageId, visionConfigId) => {
        try {
            const result = await characterService.analyzeImage(profileId, imageId, visionConfigId);
            // Update local image state with the returned VL data
            set(produce(state => {
                if (state.images[profileId]) {
                    const index = state.images[profileId].findIndex(img => img.id === imageId);
                    if (index !== -1) {
                        state.images[profileId][index] = {
                            ...state.images[profileId][index],
                            vl_model: result.vl_model,
                            vl_model_interpretation: result.vl_model_interpretation,
                            description: result.description,
                        };
                    }
                }
            }));
            return result;
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

    /**
     * Cross-view handoff: ask the Characters tab to open the create-profile
     * editor as soon as it renders. Used by the Chat welcome screen's
     * "Create AI Character" button.
     */
    requestCreateProfile: () => set({ createProfileRequested: true }),

    /** Consume the pending create request (idempotent). */
    clearRequestCreateProfile: () => set({ createProfileRequested: false }),
}));

export default useCharacterProfileStore;
