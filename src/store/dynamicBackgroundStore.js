import { create } from 'zustand';

/**
 * Available dynamic background variants.
 * Each maps to a full scene rendered by <DynamicBackground />.
 */
export const BACKGROUND_VARIANTS = [
    { id: 'aurora', labelKey: 'generalSettings:fields.dynamicBackground.variants.aurora' },
    { id: 'shapes', labelKey: 'generalSettings:fields.dynamicBackground.variants.shapes' },
    { id: 'sparkles', labelKey: 'generalSettings:fields.dynamicBackground.variants.sparkles' },
    { id: 'waves', labelKey: 'generalSettings:fields.dynamicBackground.variants.waves' },
];

export const DEFAULT_VARIANT = 'aurora';

export const isKnownVariant = (v) => BACKGROUND_VARIANTS.some((b) => b.id === v);

/**
 * Store for the Dynamic Background toggle + selected variant.
 * Kept separate from applicationConfig so toggling the checkbox in
 * General Settings takes effect immediately (no save required).
 *
 * On app load, the value is seeded from applicationConfig.general.animatedbackground,
 * applicationConfig.general.dynamicbackgroundvariant and
 * applicationConfig.general.cursoraura (standalone mouse aura toggle).
 * When the user saves settings, the config is persisted to the backend as usual;
 * this store just makes the UI respond instantly.
 */
const useDynamicBackgroundStore = create((set) => ({
    enabled: true, // default: on (matches GeneralSettingsView default)
    variant: DEFAULT_VARIANT, // default: aurora
    auraEnabled: true, // default: on — cursor-following aura is now a standalone feature

    setEnabled: (val) => set({ enabled: val }),

    setVariant: (val) => set({ variant: isKnownVariant(val) ? val : DEFAULT_VARIANT }),

    setAuraEnabled: (val) => set({ auraEnabled: val }),

    /** Called once after config loads to sync the initial state from the backend. */
    syncFromConfig: (config) => {
        const enabled = config?.general?.animatedbackground !== false;
        const variant = isKnownVariant(config?.general?.dynamicbackgroundvariant)
            ? config.general.dynamicbackgroundvariant
            : DEFAULT_VARIANT;
        const auraEnabled = config?.general?.cursoraura !== false;
        set({ enabled, variant, auraEnabled });
    },
}));

export default useDynamicBackgroundStore;
