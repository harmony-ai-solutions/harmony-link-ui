import { create } from 'zustand';
import { produce } from 'immer';
import { deepClone, deepGet, deepSet, generateNewEntityId, createEntityTemplate } from './storeUtils.js';

/**
 * Entity Settings Store using Zustand
 * Provides centralized state management for entity configurations
 */
const useEntitySettingsStore = create((set, get) => ({
    // State
    entities: {},
    selectedEntityId: '',
    selectedModuleId: 'backend',
    isDirty: false,
    validationErrors: {},
    
    // Initialization
    initializeStore: (initialSettings) => {
        set(produce(state => {
            state.entities = deepClone(initialSettings);
            state.isDirty = false;
            state.validationErrors = {};
            
            // Set initial selected entity if entities exist
            const entityIds = Object.keys(initialSettings);
            if (entityIds.length > 0 && !state.selectedEntityId) {
                state.selectedEntityId = entityIds[0];
            }
        }));
    },
    
    // Selection Management
    selectEntity: (entityId) => {
        set(produce(state => {
            if (state.entities[entityId]) {
                state.selectedEntityId = entityId;
            }
        }));
    },
    
    selectModule: (moduleId) => {
        set(produce(state => {
            state.selectedModuleId = moduleId || 'backend';
        }));
    },
    
    // Entity Management
    addEntity: (entityId = null) => {
        set(produce(state => {
            const newEntityId = entityId || generateNewEntityId(state.entities);
            state.entities[newEntityId] = createEntityTemplate();
            state.selectedEntityId = newEntityId;
            state.isDirty = true;
        }));
    },
    
    deleteEntity: (entityId) => {
        set(produce(state => {
            if (state.entities[entityId]) {
                delete state.entities[entityId];
                
                // Update selected entity if the deleted one was selected
                if (state.selectedEntityId === entityId) {
                    const remainingIds = Object.keys(state.entities);
                    state.selectedEntityId = remainingIds.length > 0 ? remainingIds[0] : '';
                }
                
                state.isDirty = true;
            }
        }));
    },
    
    renameEntity: (oldId, newId) => {
        const state = get();
        if (state.entities[oldId] && !state.entities[newId] && newId.trim() !== '') {
            set(produce(draft => {
                // Create new entity with new ID
                draft.entities[newId] = draft.entities[oldId];
                // Delete old entity
                delete draft.entities[oldId];
                
                // Update selected entity if it was the renamed one
                if (draft.selectedEntityId === oldId) {
                    draft.selectedEntityId = newId;
                }
                
                draft.isDirty = true;
            }));
            return true;
        }
        return false;
    },
    
    duplicateEntity: (entityId) => {
        set(produce(state => {
            if (state.entities[entityId]) {
                const newEntityId = generateNewEntityId(state.entities, `${entityId}-Copy`);
                state.entities[newEntityId] = deepClone(state.entities[entityId]);
                state.selectedEntityId = newEntityId;
                state.isDirty = true;
            }
        }));
    },
    
    // Settings Management
    updateEntitySetting: (entityId, path, value) => {
        set(produce(state => {
            if (state.entities[entityId]) {
                deepSet(state.entities[entityId], path, value);
                state.isDirty = true;
                
                // Clear validation errors for this path
                const errorKey = `${entityId}.${path}`;
                if (state.validationErrors[errorKey]) {
                    delete state.validationErrors[errorKey];
                }
            }
        }));
    },
    
    getEntitySetting: (entityId, path) => {
        const state = get();
        if (!state.entities[entityId]) return undefined;
        return deepGet(state.entities[entityId], path);
    },
    
    updateModuleSettings: (entityId, moduleId, settings) => {
        set(produce(state => {
            if (state.entities[entityId]) {
                state.entities[entityId][moduleId] = deepClone(settings);
                state.isDirty = true;
            }
        }));
    },
    
    getModuleSettings: (entityId, moduleId) => {
        const state = get();
        if (!state.entities[entityId]) return {};
        return state.entities[entityId][moduleId] || {};
    },
    
    // Batch operations
    batchUpdateSettings: (entityId, updates) => {
        set(produce(state => {
            if (state.entities[entityId]) {
                Object.entries(updates).forEach(([path, value]) => {
                    deepSet(state.entities[entityId], path, value);
                });
                state.isDirty = true;
            }
        }));
    },
    
    // Validation
    setValidationError: (entityId, path, error) => {
        set(produce(state => {
            const errorKey = `${entityId}.${path}`;
            if (error) {
                state.validationErrors[errorKey] = error;
            } else {
                delete state.validationErrors[errorKey];
            }
        }));
    },
    
    getValidationErrors: (entityId = null) => {
        const state = get();
        if (!entityId) return state.validationErrors;
        
        const entityErrors = {};
        const prefix = `${entityId}.`;
        Object.entries(state.validationErrors).forEach(([key, error]) => {
            if (key.startsWith(prefix)) {
                const path = key.substring(prefix.length);
                entityErrors[path] = error;
            }
        });
        return entityErrors;
    },
    
    clearValidationErrors: (entityId = null) => {
        set(produce(state => {
            if (!entityId) {
                state.validationErrors = {};
            } else {
                const prefix = `${entityId}.`;
                Object.keys(state.validationErrors).forEach(key => {
                    if (key.startsWith(prefix)) {
                        delete state.validationErrors[key];
                    }
                });
            }
        }));
    },
    
    // Persistence and State Management
    exportSettings: () => {
        const state = get();
        return deepClone(state.entities);
    },
    
    resetStore: (initialSettings) => {
        set(produce(state => {
            state.entities = deepClone(initialSettings);
            state.isDirty = false;
            state.validationErrors = {};
            
            // Reset selected entity if current selection no longer exists
            if (!state.entities[state.selectedEntityId]) {
                const entityIds = Object.keys(state.entities);
                state.selectedEntityId = entityIds.length > 0 ? entityIds[0] : '';
            }
        }));
    },
    
    markClean: () => {
        set(produce(state => {
            state.isDirty = false;
        }));
    },
    
    markDirty: () => {
        set(produce(state => {
            state.isDirty = true;
        }));
    },
    
    // Getters for computed values
    getSelectedEntity: () => {
        const state = get();
        return state.entities[state.selectedEntityId] || null;
    },
    
    getSelectedEntityId: () => {
        const state = get();
        return state.selectedEntityId;
    },
    
    getSelectedModuleId: () => {
        const state = get();
        return state.selectedModuleId;
    },
    
    getSelectedModuleSettings: () => {
        const state = get();
        const entity = state.entities[state.selectedEntityId];
        if (!entity) return {};
        return entity[state.selectedModuleId] || {};
    },
    
    getEntityCount: () => {
        const state = get();
        return Object.keys(state.entities).length;
    },
    
    getEntityIds: () => {
        const state = get();
        return Object.keys(state.entities);
    },
    
    isDirtyState: () => {
        const state = get();
        return state.isDirty;
    },
    
    hasValidationErrors: (entityId = null) => {
        const state = get();
        if (!entityId) {
            return Object.keys(state.validationErrors).length > 0;
        }
        
        const prefix = `${entityId}.`;
        return Object.keys(state.validationErrors).some(key => key.startsWith(prefix));
    }
}));

export default useEntitySettingsStore;
