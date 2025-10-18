/**
 * Application Mode Configuration
 * 
 * Centralized mode detection for unified frontend supporting both
 * Harmony Link and Harmony Speech Engine modes.
 */

export const APP_MODES = {
  HARMONY_LINK: 'harmony-link',
  SPEECH_ENGINE: 'speech-engine'
};

/**
 * Current application mode based on environment variable
 * Defaults to HARMONY_LINK if not specified
 */
export const APP_MODE = import.meta.env.VITE_APP_MODE || APP_MODES.HARMONY_LINK;

/**
 * Check if running in Harmony Speech Engine mode
 * @returns {boolean} True if in speech engine mode
 */
export const isHarmonySpeechEngineMode = () => APP_MODE === APP_MODES.SPEECH_ENGINE;

/**
 * Check if running in Harmony Link mode
 * @returns {boolean} True if in harmony link mode
 */
export const isHarmonyLinkMode = () => APP_MODE === APP_MODES.HARMONY_LINK;
