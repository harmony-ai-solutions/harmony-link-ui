import React, { useEffect, useState, useMemo, useCallback } from 'react';
import useTutorialStore from '../../store/tutorialStore';
import { getConfig, updateConfig } from '../../services/management/configService.js';
import { LogDebug, LogError } from '../../utils/logger.js';
import TutorialOverlay from './TutorialOverlay';
import { waitForElement } from './waitForElement';
import { getStepDefinitions } from './tutorialSteps.jsx';

export default function TutorialController({ setSettingsTab, settingsTab }) {
    const isActive = useTutorialStore(state => state.isActive);
    const isPaused = useTutorialStore(state => state.isPaused);
    const currentStepIndex = useTutorialStore(state => state.currentStepIndex);
    const branchPath = useTutorialStore(state => state.branchPath);
    const completedStepIds = useTutorialStore(state => state.completedStepIds);
    const nextStep = useTutorialStore(state => state.nextStep);
    const prevStep = useTutorialStore(state => state.prevStep);
    const stopTutorial = useTutorialStore(state => state.stopTutorial);
    const goToStep = useTutorialStore(state => state.goToStep);
    const setBranch = useTutorialStore(state => state.setBranch);
    const completeTutorial = useTutorialStore(state => state.completeTutorial);
    const markStepCompleted = useTutorialStore(state => state.markStepCompleted);
    const resumeTutorial = useTutorialStore(state => state.resumeTutorial);

    const [isReady, setIsReady] = useState(false);
    const [nextDisabled, setNextDisabled] = useState(false);

    // Get filtered steps based on branch
    const steps = useMemo(() => {
        const allSteps = getStepDefinitions(setSettingsTab);
        return allSteps.filter(step => {
            // Steps with no branch property (undefined) or branch: null are shared — always shown
            if (step.branch == null) return true;
            // Once a branch is chosen, also include steps matching that branch
            if (branchPath == null) return false;
            return step.branch === branchPath;
        });
    }, [branchPath, setSettingsTab]);

    const currentStep = steps[currentStepIndex];
    const totalSteps = steps.length;

    // Auto-resume when user navigates to the current (paused) step's target tab
    useEffect(() => {
        if (!isPaused || !isActive || !currentStep?.tab) return;
        if (settingsTab === currentStep.tab) {
            resumeTutorial();
        }
    }, [isPaused, isActive, settingsTab, currentStep, resumeTutorial]);

    // Compute per-section step counts
    const { sectionLabel, stepInSection, totalInSection } = useMemo(() => {
        if (!currentStep?.sectionLabel) {
            return { sectionLabel: null, stepInSection: stepIndex + 1, totalInSection: totalSteps };
        }
        const label = currentStep.sectionLabel;
        // Find all steps in the same section within the filtered list
        const sectionSteps = steps.filter(s => s.sectionLabel === label);
        const posInSection = sectionSteps.findIndex(s => s.id === currentStep.id);
        return {
            sectionLabel: label,
            stepInSection: posInSection + 1,
            totalInSection: sectionSteps.length,
        };
    }, [steps, currentStep]);

    // Prerequisite checking
    const prerequisiteMet = useMemo(() => {
        if (!currentStep?.prerequisite) return true;
        const prereq = currentStep.prerequisite;
        if (prereq.validate) return prereq.validate();
        return completedStepIds.has(prereq.stepId);
    }, [currentStep, completedStepIds]);

    const prerequisiteStepIndex = useMemo(() => {
        if (!currentStep?.prerequisite) return null;
        return steps.findIndex(s => s.id === currentStep.prerequisite.stepId);
    }, [currentStep, steps]);

    // Prepare step: switch tab, run beforeStep, wait for element
    useEffect(() => {
        if (!isActive || isPaused || !currentStep) return;

        let cancelled = false;

        const prepare = async () => {
            setIsReady(false);

            // Switch tab if required
            if (currentStep.tab) {
                setSettingsTab(currentStep.tab);
            }

            // Execute beforeStep hook
            if (currentStep.beforeStep) {
                try {
                    await currentStep.beforeStep();
                } catch (err) {
                    console.error('[Tutorial] beforeStep error:', err);
                }
            }

            // Wait for target element
            try {
                await waitForElement(currentStep.targetSelector, 5000);
                if (!cancelled) setIsReady(true);
            } catch (err) {
                console.warn('[Tutorial] Element not found:', currentStep.targetSelector);
                if (!cancelled) {
                    // Auto-advance after a delay
                    setTimeout(() => {
                        if (!cancelled) nextStep();
                    }, 2000);
                }
            }
        };

        prepare();
        return () => { cancelled = true; };
    }, [isActive, currentStepIndex, currentStep, setSettingsTab, nextStep]);

    // Poll nextDisabledCheck for steps that require user action before advancing
    useEffect(() => {
        if (!isActive || isPaused || !currentStep?.nextDisabledCheck) {
            setNextDisabled(false);
            return;
        }

        const check = () => {
            setNextDisabled(!currentStep.nextDisabledCheck());
        };

        check();
        const intervalId = setInterval(check, 500);
        return () => clearInterval(intervalId);
    }, [isActive, isPaused, currentStep]);

    // Config persistence: save skip_tutorial when tutorial is dismissed
    useEffect(() => {
        const unsubscribe = useTutorialStore.subscribe((state, prevState) => {
            if (prevState.isActive && !state.isActive && state.shouldPersistOnStop) {
                persistTutorialSkipped();
            }
        });
        return () => unsubscribe();
    }, []);

    const persistTutorialSkipped = async () => {
        try {
            const config = await getConfig();
            const updatedConfig = {
                ...config,
                general: {
                    ...config.general,
                    skiptutorial: true,
                }
            };
            await updateConfig(updatedConfig, false);
            LogDebug('Tutorial completion saved to config');
        } catch (error) {
            LogError('Failed to save tutorial completion:', error);
        }
    };

    // Handlers
    const handleNext = useCallback(() => {
        if (currentStep?.id) {
            markStepCompleted(currentStep.id);
        }
        if (currentStepIndex === totalSteps - 1) {
            completeTutorial();
        } else {
            nextStep();
        }
    }, [currentStep, currentStepIndex, totalSteps, markStepCompleted, completeTutorial, nextStep]);

    const handlePrev = useCallback(() => {
        prevStep();
    }, [prevStep]);

    const handleSkip = useCallback(() => {
        stopTutorial();
    }, [stopTutorial]);

    const handleGoToStep = useCallback(() => {
        if (prerequisiteStepIndex !== null && prerequisiteStepIndex >= 0) {
            goToStep(prerequisiteStepIndex);
        }
    }, [prerequisiteStepIndex, goToStep]);

    // Don't render if inactive, paused, or step not ready
    if (!isActive || isPaused || !currentStep || !isReady) return null;

    // Handle edge case: step index exceeds filtered list
    if (currentStepIndex >= totalSteps) {
        completeTutorial();
        return null;
    }

    return (
        <TutorialOverlay
            targetSelector={currentStep.targetSelector}
            title={currentStep.title}
            content={currentStep.content}
            stepIndex={currentStepIndex}
            totalSteps={totalSteps}
            sectionLabel={sectionLabel}
            stepInSection={stepInSection}
            totalInSection={totalInSection}
            onNext={handleNext}
            onPrev={handlePrev}
            onSkip={handleSkip}
            onComplete={handleNext}
            placement={currentStep.placement || 'bottom'}
            showPrev={currentStepIndex > 0}
            isLastStep={currentStepIndex === totalSteps - 1}
            isBlocked={!prerequisiteMet}
            blockMessage={currentStep?.prerequisite?.message}
            onGoToStep={handleGoToStep}
            hideNextButton={currentStep.hideNextButton || false}
            nextDisabled={nextDisabled}
        />
    );
}
