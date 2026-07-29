import { create } from 'zustand';

/**
 * Store for the Dynamic Background toggle.
 * Kept separate from applicationConfig so toggling the checkbox in
 * General Settings takes effect immediately (no save required).
 *
 * On app load, the value is seeded from applicationConfig.general.animatedbackground.
 * When the user saves settings, the config is persisted to the backend as usual;
 * this store just makes the UI respond instantly.
 */
const useDynamicBackgroundStore = create((set) => ({
    enabled: true, // default: on (matches GeneralSettingsView default)

    setEnabled: (val) => set({ enabled: val }),

    /** Called once after config loads to sync the initial state from the backend. */
    syncFromConfig: (config) => {
        const enabled = config?.general?.animatedbackground !== false;
        set({ enabled });
    },
}));

export default useDynamicBackgroundStore;
