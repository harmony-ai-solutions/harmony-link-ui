import { create } from 'zustand';
import { produce } from 'immer';
import * as moduleService from '../services/management/moduleService.js';

const useModuleConfigStore = create((set, get) => ({
    // State - organized by module type
    configs: {
        backend: [],
        countenance: [],
        movement: [],
        rag: [],
        stt: [],
        tts: []
    },
    selectedModuleType: 'backend',
    selectedConfigId: null,
    isLoading: false,
    error: null,
    
    // Actions
    setModuleType: (moduleType) => {
        set({ selectedModuleType: moduleType, selectedConfigId: null });
    },
    
    loadConfigs: async (moduleType) => {
        set({ isLoading: true, error: null });
        try {
            const configs = await moduleService.listModuleConfigs(moduleType);
            set(produce(state => {
                state.configs[moduleType] = configs;
                state.isLoading = false;
            }));
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },
    
    createConfig: async (moduleType, name, config) => {
        set({ isLoading: true, error: null });
        try {
            const result = await moduleService.createModuleConfig(moduleType, name, config);
            set(produce(state => {
                state.configs[moduleType].push(result);
                state.isLoading = false;
            }));
            return result;
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },
    
    updateConfig: async (moduleType, id, name, config) => {
        set({ isLoading: true, error: null });
        try {
            await moduleService.updateModuleConfig(moduleType, id, name, config);
            set(produce(state => {
                const index = state.configs[moduleType].findIndex(c => c.id === id);
                if (index !== -1) {
                    state.configs[moduleType][index] = { id, name, config };
                }
                state.isLoading = false;
            }));
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },
    
    deleteConfig: async (moduleType, id) => {
        set({ isLoading: true, error: null });
        try {
            await moduleService.deleteModuleConfig(moduleType, id);
            set(produce(state => {
                state.configs[moduleType] = state.configs[moduleType].filter(c => c.id !== id);
                if (state.selectedConfigId === id) {
                    state.selectedConfigId = null;
                }
                state.isLoading = false;
            }));
        } catch (error) {
            set({ error: error.message, isLoading: false });
            throw error;
        }
    },
    
    // Getters
    getConfigs: (moduleType) => {
        const state = get();
        return state.configs[moduleType] || [];
    },
    
    getConfigById: (moduleType, id) => {
        const state = get();
        return state.configs[moduleType]?.find(c => c.id === id);
    }
}));

export default useModuleConfigStore;
