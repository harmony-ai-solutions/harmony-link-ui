import { useCallback } from 'react';
import useEntitySettingsStore from '../store/entitySettingsStore.js';

/**
 * Main hook for accessing the entity settings store
 * Provides all store actions and state selectors
 */
export const useEntitySettings = () => {
    const store = useEntitySettingsStore();
    
    return {
        // State selectors
        entities: store.entities,
        selectedEntityId: store.selectedEntityId,
        selectedModuleId: store.selectedModuleId,
        isDirty: store.isDirty,
        validationErrors: store.validationErrors,
        
        // Actions
        initializeStore: store.initializeStore,
        selectEntity: store.selectEntity,
        selectModule: store.selectModule,
        addEntity: store.addEntity,
        deleteEntity: store.deleteEntity,
        renameEntity: store.renameEntity,
        duplicateEntity: store.duplicateEntity,
        updateEntitySetting: store.updateEntitySetting,
        getEntitySetting: store.getEntitySetting,
        updateModuleSettings: store.updateModuleSettings,
        getModuleSettings: store.getModuleSettings,
        batchUpdateSettings: store.batchUpdateSettings,
        setValidationError: store.setValidationError,
        getValidationErrors: store.getValidationErrors,
        clearValidationErrors: store.clearValidationErrors,
        exportSettings: store.exportSettings,
        resetStore: store.resetStore,
        markClean: store.markClean,
        markDirty: store.markDirty,
        
        // Computed getters
        getSelectedEntity: store.getSelectedEntity,
        getSelectedEntityId: store.getSelectedEntityId,
        getSelectedModuleId: store.getSelectedModuleId,
        getSelectedModuleSettings: store.getSelectedModuleSettings,
        getEntityCount: store.getEntityCount,
        getEntityIds: store.getEntityIds,
        isDirtyState: store.isDirtyState,
        hasValidationErrors: store.hasValidationErrors
    };
};

/**
 * Hook for accessing a specific entity's settings
 * @param {string} entityId - The entity ID to access
 */
export const useEntityData = (entityId) => {
    const entities = useEntitySettingsStore(state => state.entities);
    const updateEntitySetting = useEntitySettingsStore(state => state.updateEntitySetting);
    const getEntitySetting = useEntitySettingsStore(state => state.getEntitySetting);
    const updateModuleSettings = useEntitySettingsStore(state => state.updateModuleSettings);
    const getModuleSettings = useEntitySettingsStore(state => state.getModuleSettings);
    const getValidationErrors = useEntitySettingsStore(state => state.getValidationErrors);
    
    const entityData = entities[entityId] || null;
    
    const updateSetting = useCallback((path, value) => {
        updateEntitySetting(entityId, path, value);
    }, [entityId, updateEntitySetting]);
    
    const getSetting = useCallback((path) => {
        return getEntitySetting(entityId, path);
    }, [entityId, getEntitySetting]);
    
    const updateModule = useCallback((moduleId, settings) => {
        updateModuleSettings(entityId, moduleId, settings);
    }, [entityId, updateModuleSettings]);
    
    const getModule = useCallback((moduleId) => {
        return getModuleSettings(entityId, moduleId);
    }, [entityId, getModuleSettings]);
    
    const getErrors = useCallback(() => {
        return getValidationErrors(entityId);
    }, [entityId, getValidationErrors]);
    
    return {
        entityData,
        updateSetting,
        getSetting,
        updateModule,
        getModule,
        getErrors,
        exists: !!entityData
    };
};

/**
 * Hook for accessing a specific field within an entity
 * @param {string} entityId - The entity ID
 * @param {string} path - Dot notation path to the field
 */
export const useEntityField = (entityId, path) => {
    const getEntitySetting = useEntitySettingsStore(state => state.getEntitySetting);
    const updateEntitySetting = useEntitySettingsStore(state => state.updateEntitySetting);
    const getValidationErrors = useEntitySettingsStore(state => state.getValidationErrors);
    
    // Subscribe to the specific field value
    const value = useEntitySettingsStore(state => {
        if (!state.entities[entityId]) return undefined;
        const keys = path.split('.');
        let current = state.entities[entityId];
        for (const key of keys) {
            if (current === null || current === undefined || typeof current !== 'object') {
                return undefined;
            }
            current = current[key];
        }
        return current;
    });
    
    const setValue = useCallback((newValue) => {
        updateEntitySetting(entityId, path, newValue);
    }, [entityId, path, updateEntitySetting]);
    
    const fieldErrors = useCallback(() => {
        const errors = getValidationErrors(entityId);
        return errors[path] || null;
    }, [entityId, path, getValidationErrors]);
    
    return {
        value,
        setValue,
        error: fieldErrors(),
        hasError: !!fieldErrors()
    };
};

/**
 * Hook for accessing the currently selected entity
 */
export const useSelectedEntity = () => {
    const selectedEntityId = useEntitySettingsStore(state => state.selectedEntityId);
    const selectedModuleId = useEntitySettingsStore(state => state.selectedModuleId);
    const getSelectedEntity = useEntitySettingsStore(state => state.getSelectedEntity);
    const getSelectedModuleSettings = useEntitySettingsStore(state => state.getSelectedModuleSettings);
    const selectEntity = useEntitySettingsStore(state => state.selectEntity);
    const selectModule = useEntitySettingsStore(state => state.selectModule);
    
    return {
        selectedEntityId,
        selectedModuleId,
        selectedEntity: getSelectedEntity(),
        selectedModuleSettings: getSelectedModuleSettings(),
        selectEntity,
        selectModule
    };
};

/**
 * Hook for validation state management
 * @param {string} entityId - Optional entity ID to scope validation to
 */
export const useValidation = (entityId = null) => {
    const setValidationError = useEntitySettingsStore(state => state.setValidationError);
    const getValidationErrors = useEntitySettingsStore(state => state.getValidationErrors);
    const clearValidationErrors = useEntitySettingsStore(state => state.clearValidationErrors);
    const hasValidationErrors = useEntitySettingsStore(state => state.hasValidationErrors);
    
    const setError = useCallback((path, error) => {
        if (entityId) {
            setValidationError(entityId, path, error);
        }
    }, [entityId, setValidationError]);
    
    const getErrors = useCallback(() => {
        return getValidationErrors(entityId);
    }, [entityId, getValidationErrors]);
    
    const clearErrors = useCallback(() => {
        clearValidationErrors(entityId);
    }, [entityId, clearValidationErrors]);
    
    const hasErrors = useCallback(() => {
        return hasValidationErrors(entityId);
    }, [entityId, hasValidationErrors]);
    
    return {
        setError,
        getErrors,
        clearErrors,
        hasErrors,
        errors: getErrors()
    };
};

/**
 * Hook for module-specific operations
 * @param {string} entityId - The entity ID
 * @param {string} moduleId - The module ID
 */
export const useModuleSettings = (entityId, moduleId) => {
    const getModuleSettings = useEntitySettingsStore(state => state.getModuleSettings);
    const updateModuleSettings = useEntitySettingsStore(state => state.updateModuleSettings);
    
    // Subscribe to the specific module settings
    const moduleSettings = useEntitySettingsStore(state => {
        if (!state.entities[entityId]) return {};
        return state.entities[entityId][moduleId] || {};
    });
    
    const updateSettings = useCallback((settings) => {
        updateModuleSettings(entityId, moduleId, settings);
    }, [entityId, moduleId, updateModuleSettings]);
    
    const getSettings = useCallback(() => {
        return getModuleSettings(entityId, moduleId);
    }, [entityId, moduleId, getModuleSettings]);
    
    return {
        moduleSettings,
        updateSettings,
        getSettings
    };
};

/**
 * Hook for dirty state management
 */
export const useDirtyState = () => {
    const isDirty = useEntitySettingsStore(state => state.isDirty);
    const markClean = useEntitySettingsStore(state => state.markClean);
    const markDirty = useEntitySettingsStore(state => state.markDirty);
    
    return {
        isDirty,
        markClean,
        markDirty
    };
};
