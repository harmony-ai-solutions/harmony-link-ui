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

/**
 * Available mouse aura styles. Each maps to a cursor-following effect
 * rendered by <DynamicBackground />.
 */
export const AURA_STYLES = [
    { id: 'glow', labelKey: 'generalSettings:fields.dynamicBackground.auraStyles.glow' },
    { id: 'ring', labelKey: 'generalSettings:fields.dynamicBackground.auraStyles.ring' },
    { id: 'trail', labelKey: 'generalSettings:fields.dynamicBackground.auraStyles.trail' },
    { id: 'embers', labelKey: 'generalSettings:fields.dynamicBackground.auraStyles.embers' },
];

export const DEFAULT_AURA_STYLE = 'glow';

export const isKnownAuraStyle = (v) => AURA_STYLES.some((s) => s.id === v);

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
    auraStyle: DEFAULT_AURA_STYLE, // default: glow (classic soft radial)

    setEnabled: (val) => set({ enabled: val }),

    setVariant: (val) => set({ variant: isKnownVariant(val) ? val : DEFAULT_VARIANT }),

    setAuraEnabled: (val) => set({ auraEnabled: val }),

    setAuraStyle: (val) => set({ auraStyle: isKnownAuraStyle(val) ? val : DEFAULT_AURA_STYLE }),

    /** Called once after config loads to sync the initial state from the backend. */
    syncFromConfig: (config) => {
        const enabled = config?.general?.animatedbackground !== false;
        const variant = isKnownVariant(config?.general?.dynamicbackgroundvariant)
            ? config.general.dynamicbackgroundvariant
            : DEFAULT_VARIANT;
        const auraEnabled = config?.general?.cursoraura !== false;
        const auraStyle = isKnownAuraStyle(config?.general?.cursoraurastyle)
            ? config.general.cursoraurastyle
            : DEFAULT_AURA_STYLE;
        set({ enabled, variant, auraEnabled, auraStyle });
    },
}));

export default useDynamicBackgroundStore;
