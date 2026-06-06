import { create } from 'zustand';

const useTutorialStore = create((set, get) => ({
    isActive: false,
    isPaused: false,
    currentStepIndex: 0,
    branchPath: null,
    isComplete: false,
    completedStepIds: new Set(),
    shouldPersistOnStop: false,

    startTutorial: () => set({
        isActive: true,
        isPaused: false,
        currentStepIndex: 0,
        branchPath: null,
        isComplete: false,
        completedStepIds: new Set(),
        shouldPersistOnStop: false,
    }),

    stopTutorial: () => set({
        isActive: false,
        isPaused: false,
        shouldPersistOnStop: true,
    }),

    nextStep: () => set((state) => ({
        currentStepIndex: state.currentStepIndex + 1,
    })),

    prevStep: () => set((state) => ({
        currentStepIndex: Math.max(0, state.currentStepIndex - 1),
    })),

    goToStep: (index) => set({ currentStepIndex: index }),

    setBranch: (path) => set({ branchPath: path }),

    completeTutorial: () => set({
        isActive: false,
        isPaused: false,
        isComplete: true,
        shouldPersistOnStop: true,
    }),

    resetTutorial: () => set({
        isActive: false,
        isPaused: false,
        currentStepIndex: 0,
        branchPath: null,
        isComplete: false,
        completedStepIds: new Set(),
        shouldPersistOnStop: false,
    }),

    pauseTutorial: () => set({
        isPaused: true,
    }),

    resumeTutorial: () => set({
        isPaused: false,
    }),

    markStepCompleted: (stepId) => set((state) => {
        const newSet = new Set(state.completedStepIds);
        newSet.add(stepId);
        return { completedStepIds: newSet };
    }),
}));

export default useTutorialStore;
