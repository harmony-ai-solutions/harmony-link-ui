import { create } from 'zustand';

/**
 * Progressive-disclosure UI modes.
 *
 * The modes stack: `dev` includes everything in `pro`, and `pro` includes
 * everything in `simple`. Every navigation item declares the lowest mode that
 * can see it (`minMode`), and the menu is filtered by comparing mode ranks.
 */
export const UI_MODES = [
    { id: 'simple', labelKey: 'uiMode:modes.simple.label', descriptionKey: 'uiMode:modes.simple.description' },
    { id: 'pro', labelKey: 'uiMode:modes.pro.label', descriptionKey: 'uiMode:modes.pro.description' },
    { id: 'dev', labelKey: 'uiMode:modes.dev.label', descriptionKey: 'uiMode:modes.dev.description' },
];

export const DEFAULT_UI_MODE = 'simple';

/** Rank lets us compare modes: simple < pro < dev. */
export const UI_MODE_RANK = { simple: 0, pro: 1, dev: 2 };

export const isKnownMode = (mode) => UI_MODES.some((m) => m.id === mode);

/** True when `mode` is at least as permissive as `minMode`. */
export const isModeAllowed = (mode, minMode) => {
    const current = UI_MODE_RANK[isKnownMode(mode) ? mode : DEFAULT_UI_MODE];
    const required = UI_MODE_RANK[isKnownMode(minMode) ? minMode : DEFAULT_UI_MODE];
    return current >= required;
};

/**
 * Store for the active UI mode.
 *
 * Kept separate from applicationConfig so the menu and settings page can react
 * instantly when the user flips the Simple / Pro / Developer switch. The choice
 * is persisted through the config service as `general.uimode`; this store only
 * mirrors it for the UI.
 */
const useUIModeStore = create((set) => ({
    mode: DEFAULT_UI_MODE,

    /** Set the active mode; unknown ids fall back to the default. */
    setMode: (mode) => set({ mode: isKnownMode(mode) ? mode : DEFAULT_UI_MODE }),

    /** Called once after config loads to sync the initial state from the backend. */
    syncFromConfig: (config) => {
        const mode = isKnownMode(config?.general?.uimode)
            ? config.general.uimode
            : DEFAULT_UI_MODE;
        set({ mode });
    },
}));

export default useUIModeStore;
