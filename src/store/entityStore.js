import { create } from 'zustand';
import { produce } from 'immer';
import * as entityService from '../services/management/entityService.js';

const useEntityStore = create((set, get) => ({
    // State
    entities: null, // null = not loaded yet, [] = loaded but empty
    selectedEntityId: null,
    isLoading: false,
    error: null,
    
    // Actions
    loadEntities: async () => {
        set({ isLoading: true, error: null });
        try {
            const entities = await entityService.listEntities();
            set({ entities, isLoading: false });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },
    
    createEntity: async (id, characterProfileId) => {
        set({ isLoading: true, error: null });
        try {
            const newEntity = await entityService.createEntity(id, characterProfileId);
            set(produce(state => {
                state.entities.push(newEntity);
                state.selectedEntityId = id;
                state.isLoading = false;
            }));
            return newEntity;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },
    
    updateEntityMappings: async (id, mappings) => {
        set({ isLoading: true, error: null });
        try {
            await entityService.updateEntityMappings(id, mappings);
            // Reload the entity to get updated configuration
            const updated = await entityService.getEntity(id);
            set(produce(state => {
                const index = state.entities.findIndex(e => e.id === id);
                if (index !== -1) {
                    state.entities[index] = updated;
                }
                state.isLoading = false;
            }));
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },
    
    deleteEntity: async (id) => {
        set({ isLoading: true, error: null });
        try {
            await entityService.deleteEntity(id);
            set(produce(state => {
                state.entities = state.entities.filter(e => e.id !== id);
                if (state.selectedEntityId === id) {
                    state.selectedEntityId = null;
                }
                state.isLoading = false;
            }));
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },
    
    selectEntity: (id) => {
        set({ selectedEntityId: id });
    },
    
    // Getters
    getEntity: (id) => {
        const state = get();
        // Add defensive check for undefined/null entities
        if (!state.entities || !Array.isArray(state.entities)) {
            return null;
        }
        if (!id) {
            return null;
        }
        return state.entities.find(e => e.id === id);
    }
}));

export default useEntityStore;
