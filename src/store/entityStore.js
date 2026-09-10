import { create } from 'zustand';
import { produce } from 'immer';
import * as entityService from '../services/management/entityService.js';

const useEntityStore = create((set, get) => ({
    // State
    entities: null, // null = not loaded yet, [] = loaded but empty
    selectedEntityId: null,
    isLoading: false,
    error: null,
    // Active sessions per entity id (GET /entities/sessions wire shape:
    // { [entityId]: [{device_type, handler_id}] }). Entities without active
    // sessions are absent; {} = loaded but none active, null = not loaded.
    sessionsByEntity: null,

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

    // Refresh the active-session map (presence badge + Active filter). Best
    // effort: a failed poll keeps the previous map — the badge is cosmetic
    // and the next poll tick re-fetches.
    loadSessions: async () => {
        try {
            const sessionsByEntity = await entityService.getEntitySessions();
            set({ sessionsByEntity: sessionsByEntity || {} });
        } catch (error) {
            if (get().sessionsByEntity === null) {
                set({ sessionsByEntity: {} });
            }
        }
    },

    // Force-disconnect every session of the entity, then refresh the map.
    // @returns {{stopped: number}} the engine response
    stopSessions: async (id) => {
        const result = await entityService.stopEntitySessions(id);
        await get().loadSessions();
        return result;
    },

    // Enable/disable toggle — persists engine-side (synced to the apps),
    // then reloads the entity list so `is_disabled` reflects locally.
    setEntityDisabled: async (id, disabled) => {
        await entityService.setEntityDisabled(id, disabled);
        await get().loadEntities();
    },
    
    // D23: plain passthrough of the derived-create contract — the engine
    // derives the id from `name` and the 201 echoes the SERVER-resolved id
    // (which can differ whenever `dedupeIdIfTaken` bumped a collision).
    // Selection/state always key on the echoed id, never the requested name.
    createEntity: async (name, characterProfileId, { dedupeIdIfTaken } = {}) => {
        set({ isLoading: true, error: null });
        try {
            const newEntity = await entityService.createEntity(name, characterProfileId, { dedupeIdIfTaken });
            set(produce(state => {
                state.entities.push(newEntity);
                state.selectedEntityId = newEntity.id;
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
