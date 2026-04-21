import { create } from 'zustand';
import { produce } from 'immer';
import { listPresets, getPreset } from '../services/management/presetService.js';

const usePresetStore = create((set, get) => ({
    presets: [],           // Array of { name, source, param_count, description }
    presetDetails: {},     // name → full params map (lazy loaded)
    isLoading: false,
    error: null,

    loadPresets: async () => {
        set(produce(state => { state.isLoading = true; state.error = null; }));
        try {
            const presets = await listPresets();
            set(produce(state => { state.presets = presets; state.isLoading = false; }));
        } catch (err) {
            set(produce(state => { state.error = err.message; state.isLoading = false; }));
        }
    },

    loadPresetDetail: async (name) => {
        try {
            const detail = await getPreset(name);
            set(produce(state => { state.presetDetails[name] = detail.params; }));
        } catch (err) {
            console.error(`Failed to load preset detail for ${name}:`, err);
        }
    },

    getPresetParams: (name) => {
        return get().presetDetails[name] || null;
    }
}));

export default usePresetStore;