/**
 * Storage Service Abstraction Layer
 * 
 * Unified interface for voice configuration storage that routes operations
 * to either the API backend (Harmony Link mode) or localStorage (Speech Engine mode).
 * 
 * This abstraction allows the TTS component to work seamlessly with both storage backends
 * without knowing which one is being used.
 */

import { isHarmonySpeechEngineMode } from '../../config/appMode.js';
import * as apiStorage from './apiStorage.js';
import * as localStorageAdapter from './localStorageAdapter.js';

/**
 * Get the appropriate storage implementation based on current mode
 * @returns {Object} Storage implementation (apiStorage or localStorageAdapter)
 */
const getStorageImplementation = () => {
  return isHarmonySpeechEngineMode() ? localStorageAdapter : apiStorage;
};

/**
 * List all available voice configurations
 * @returns {Promise<Array>} Array of configuration names
 */
export async function listVoiceConfigs() {
  const storage = getStorageImplementation();
  return storage.listVoiceConfigs();
}

/**
 * Load a specific voice configuration
 * @param {string} name - Configuration name
 * @returns {Promise<string>} Configuration JSON string
 */
export async function loadVoiceConfig(name) {
  const storage = getStorageImplementation();
  return storage.loadVoiceConfig(name);
}

/**
 * Save a voice configuration
 * @param {string} name - Configuration name
 * @param {string} configJson - Configuration JSON string
 * @returns {Promise<void>}
 */
export async function saveVoiceConfig(name, configJson) {
  const storage = getStorageImplementation();
  return storage.saveVoiceConfig(name, configJson);
}

/**
 * Delete a voice configuration
 * @param {string} name - Configuration name
 * @returns {Promise<void>}
 */
export async function deleteVoiceConfig(name) {
  const storage = getStorageImplementation();
  return storage.deleteVoiceConfig(name);
}

/**
 * Rename a voice configuration
 * @param {string} oldName - Current configuration name
 * @param {string} newName - New configuration name
 * @returns {Promise<void>}
 */
export async function renameVoiceConfig(oldName, newName) {
  const storage = getStorageImplementation();
  return storage.renameVoiceConfig(oldName, newName);
}
