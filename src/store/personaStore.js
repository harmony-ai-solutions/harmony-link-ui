import { create } from 'zustand';

/**
 * Tiny shared store slice that carries a cross-tab "open the persona editor"
 * request.
 *
 * 2-4's "Create persona from this card" action performs the full-copy create in
 * the Characters tab (duplicate profile → create persona entity → alias sync),
 * then stores the new persona's id here and switches to the Personas tab;
 * PersonasView reads it once its list is loaded, opens the full card editor for
 * that persona, then clears it. No other cross-view state lives here by design
 * (KISS — personas are edited locally in PersonasView).
 */
const usePersonaStore = create((set) => ({
    // persona entity id to open in the editor after switching tabs | null
    requestEditPersonaId: null,
    requestEditPersona: (id) => set({ requestEditPersonaId: id }),
    clearRequestEditPersona: () => set({ requestEditPersonaId: null }),
}));

export default usePersonaStore;