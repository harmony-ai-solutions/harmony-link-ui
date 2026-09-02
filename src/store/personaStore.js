import { create } from 'zustand';

/**
 * Tiny shared store slice that carries a "create persona" prefill across tabs.
 *
 * 3-2's "Create persona from this card" action sets `createPrefill` (identity
 * fields only — name / description / personality) and switches to the Personas
 * tab; PersonasView reads it on mount, opens its create form prefilled, then
 * clears it so the next create starts blank. No other cross-view state lives
 * here by design (KISS — personas are edited locally in PersonasView).
 */
const usePersonaStore = create((set) => ({
    // { name, description, personality } | null
    createPrefill: null,
    setCreatePrefill: (prefill) => set({ createPrefill: prefill }),
    clearCreatePrefill: () => set({ createPrefill: null }),
}));

export default usePersonaStore;
