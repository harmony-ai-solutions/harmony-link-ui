import { create } from 'zustand';
import { produce } from 'immer';
import * as characterService from '../services/management/characterService.js';
import { moveListItem } from '../utils/characterFilterUtils.js';

/**
 * Zustand store for character categories (plan 03-2).
 *
 * Categories are DESKTOP-LOCAL organisation: they are not synced, so this store
 * owns no sync state and never listens for inbound records. It is deliberately
 * separate from the profile store — the category list has its own loading and
 * error surface, and a slow category request must never skeleton the character
 * grid.
 *
 * Membership writes are REPLACE-style (the engine sets the category's membership
 * to exactly the ids it is given), which is what makes the card menu's checkbox
 * list work in one call. Every mutation reconciles against the engine's answer
 * rather than trusting the optimistic patch: the counts a chip shows must agree
 * with what the server will return on the next load.
 */
const useCategoryStore = create((set, get) => ({
    // State
    categories: [],
    /** True only for the INITIAL load — mutations must not skeleton the chips. */
    isLoading: false,
    error: null,
    /** Profile id whose "Add to category" write is in flight (per-card spinner). */
    pendingProfileId: null,

    /**
     * Load every category in the user's drag order.
     *
     * `isLoading` is set for the initial paint only: once a list exists,
     * refetching after a mutation must not flash the chip row away.
     */
    loadCategories: async () => {
        const hadCategories = get().categories.length > 0;
        if (!hadCategories) set({ isLoading: true, error: null });
        try {
            const categories = await characterService.listCharacterCategories();
            set({ categories: Array.isArray(categories) ? categories : [], isLoading: false, error: null });
        } catch (error) {
            set({ error: error.message, isLoading: false });
        }
    },

    /**
     * Create a category.
     *
     * The engine may REVIVE a previously deleted category with the same name
     * (the UNIQUE name index is physical), in which case the returned row
     * replaces nothing and is simply appended. A 409 surfaces as a thrown error
     * so the modal can show the clash inline on the name field.
     *
     * @param {string} name
     * @returns {Promise<Object>} the created/revived category
     */
    createCategory: async (name) => {
        try {
            const created = await characterService.createCharacterCategory(name);
            set(produce((state) => {
                const index = state.categories.findIndex((c) => c.id === created.id);
                if (index === -1) {
                    state.categories.push(created);
                } else {
                    // A revived tombstone keeps its id — replace in place and
                    // let the next load sort it to its new position.
                    state.categories[index] = created;
                }
                state.error = null;
            }));
            // Re-read so the drag order matches the engine's (a revive is
            // appended to the end, which the local push above cannot know).
            await get().loadCategories();
            return created;
        } catch (error) {
            set({ error: error.message });
            throw error;
        }
    },

    /**
     * Rename a category. Optimistic label swap, then reconcile.
     * @param {string} id
     * @param {string} name
     * @returns {Promise<Object>}
     */
    renameCategory: async (id, name) => {
        const previous = get().categories.find((c) => c.id === id);
        if (!previous) throw new Error('category not found');
        const previousName = previous.name;

        set(produce((state) => {
            const target = state.categories.find((c) => c.id === id);
            if (target) target.name = name;
        }));

        try {
            const updated = await characterService.renameCharacterCategory(id, name);
            set(produce((state) => {
                const index = state.categories.findIndex((c) => c.id === id);
                if (index !== -1) state.categories[index] = updated;
                state.error = null;
            }));
            return updated;
        } catch (error) {
            // Restore the exact previous label — a failed rename must not leave
            // a chip advertising a name the database does not hold.
            set(produce((state) => {
                const target = state.categories.find((c) => c.id === id);
                if (target) target.name = previousName;
                state.error = error.message;
            }));
            throw error;
        }
    },

    /**
     * Delete a category.
     *
     * The CHARACTERS are not touched — this only removes the grouping. The local
     * row is dropped immediately (the modal already confirmed), and a failure
     * restores the snapshot.
     *
     * @param {string} id
     * @returns {Promise<void>}
     */
    deleteCategory: async (id) => {
        const snapshot = get().categories;
        const target = snapshot.find((c) => c.id === id);
        if (!target) return;

        set({ categories: snapshot.filter((c) => c.id !== id) });
        try {
            await characterService.deleteCharacterCategory(id);
            set({ error: null });
        } catch (error) {
            set({ categories: snapshot, error: error.message });
            throw error;
        }
    },

    /**
     * Persist a new drag order.
     *
     * The list is reordered locally FIRST (a drag must not wait on the network),
     * then the engine is told the new order and its answer replaces the local
     * one. On failure the previous order is restored.
     *
     * @param {number} fromIndex
     * @param {number} toIndex
     * @returns {Promise<void>}
     */
    reorderCategories: async (fromIndex, toIndex) => {
        const previous = get().categories;
        const next = moveListItem(previous, fromIndex, toIndex);
        if (next === previous) return; // no-op drag

        set({ categories: next });
        try {
            const ordered = await characterService.reorderCharacterCategories(next.map((c) => c.id));
            if (Array.isArray(ordered) && ordered.length > 0) {
                set({ categories: ordered, error: null });
            } else {
                set({ error: null });
            }
        } catch (error) {
            set({ categories: previous, error: error.message });
            throw error;
        }
    },

    /**
     * Set a profile's category membership to exactly `categoryIds`.
     *
     * This is the card menu's checkbox write: the menu sends every CHECKED box,
     * so unchecking is expressed by omission. One request per touched category,
     * issued in parallel — a profile usually lives in one or two, and the
     * alternative (one request per checkbox) multiplies round-trips for the
     * common case.
     *
     * The local rows are patched optimistically so the chip counts move with the
     * click, then each response replaces its own category wholesale.
     *
     * @param {string} profileId
     * @param {string[]} categoryIds - the complete desired set
     * @returns {Promise<void>}
     */
    setProfileCategories: async (profileId, categoryIds) => {
        if (!profileId) return;
        const desired = new Set(
            (Array.isArray(categoryIds) ? categoryIds : []).filter((id) => typeof id === 'string' && id !== '')
        );

        const before = get().categories;

        // Derive the change set ONCE: every category the profile is currently in
        // (may need removal) plus every one it should end up in (needs adding).
        // Each entry carries the exact membership to send, so the optimistic
        // patch and the request can never disagree.
        const plan = [];
        before.forEach((category) => {
            const currentIds = Array.isArray(category.profile_ids) ? category.profile_ids : [];
            const wasMember = currentIds.includes(profileId);
            const shouldBeMember = desired.has(category.id);
            if (!wasMember && !shouldBeMember) return;

            const withoutProfile = currentIds.filter((id) => id !== profileId);
            const nextIds = shouldBeMember ? [...withoutProfile, profileId] : withoutProfile;
            if (wasMember === shouldBeMember) return; // already correct — skip the write
            plan.push({ categoryId: category.id, ids: nextIds });
        });
        if (plan.length === 0) return;

        const planned = new Map(plan.map(({ categoryId, ids }) => [categoryId, ids]));
        set({
            categories: before.map((category) => {
                const nextIds = planned.get(category.id);
                if (!nextIds) return category;
                return {
                    ...category,
                    profile_ids: nextIds,
                    // Keep the projection honest so a chip count never disagrees
                    // with the grid while the requests are in flight.
                    member_count: nextIds.length,
                };
            }),
            pendingProfileId: profileId,
            error: null,
        });

        try {
            const results = await Promise.all(
                plan.map(({ categoryId, ids }) => characterService.setCharacterCategoryMembers(categoryId, ids))
            );

            // Replace each touched category with the engine's answer. Anything
            // the engine could not assign (a profile deleted elsewhere) is
            // therefore reflected truthfully.
            set(produce((state) => {
                results.forEach((updated) => {
                    if (!updated || typeof updated.id !== 'string') return;
                    const index = state.categories.findIndex((c) => c.id === updated.id);
                    if (index !== -1) state.categories[index] = updated;
                });
                state.pendingProfileId = null;
            }));
        } catch (error) {
            set({ categories: before, pendingProfileId: null, error: error.message });
            throw error;
        }
    },

    /**
     * Category ids a profile currently belongs to, read from the loaded list.
     * Used by the card menu to pre-check its boxes without a request.
     *
     * @param {string} profileId
     * @returns {string[]}
     */
    categoryIdsForProfile: (profileId) => {
        if (!profileId) return [];
        return get().categories
            .filter((category) => Array.isArray(category.profile_ids) && category.profile_ids.includes(profileId))
            .map((category) => category.id);
    },

    /** Clears the last error (the modal toasts it, then resets). */
    clearError: () => set({ error: null }),
}));

export default useCategoryStore;
