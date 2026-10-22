import { create } from 'zustand';

/**
 * Developer tools UI preferences (Phase 3, D4).
 *
 * The only preference today is the "Raw JSON" toggle. When enabled, every
 * JSON viewer in the app (the shared ConfigurableJsonViewer, used by the RAG
 * manager, the simulator displays and the developer screens) expands to full
 * depth instead of a truncated view — so the toggle behaves consistently
 * across config screens without each screen needing its own switch.
 *
 * The choice is persisted to localStorage and is intentionally NOT part of the
 * engine config: it is a purely cosmetic, per-install developer preference.
 */
const STORAGE_KEY = 'hl.dev.rawJson';

/** Read the persisted preference (defaults to false when storage is blocked). */
function readRawJson() {
    try {
        return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

/** Persist the preference (best effort — storage may be unavailable). */
function writeRawJson(value) {
    try {
        localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
        /* non-fatal: the in-memory state still drives the current session */
    }
}

const useDevToolsStore = create((set, get) => ({
    /** True when raw (full-depth) JSON should be shown everywhere. */
    rawJson: readRawJson(),

    /** Set the raw-JSON preference explicitly. */
    setRawJson: (value) => {
        const next = !!value;
        writeRawJson(next);
        set({ rawJson: next });
    },

    /** Flip the raw-JSON preference. */
    toggleRawJson: () => {
        const next = !get().rawJson;
        writeRawJson(next);
        set({ rawJson: next });
    },
}));

export default useDevToolsStore;
