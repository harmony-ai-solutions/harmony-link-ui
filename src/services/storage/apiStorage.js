/**
 * API Storage Implementation
 * 
 * Wraps existing management API calls from configService for Harmony Link mode.
 * This implementation routes all voice configuration operations through the backend API.
 */

import {
  listVoiceConfigs as apiListVoiceConfigs,
  loadVoiceConfig as apiLoadVoiceConfig,
  saveVoiceConfig as apiSaveVoiceConfig,
  deleteVoiceConfig as apiDeleteVoiceConfig,
  renameVoiceConfig as apiRenameVoiceConfig
} from '../management/configService.js';

/**
 * List all available voice configurations from API
 * @returns {Promise<Array>} Array of configuration names
 */
export function listVoiceConfigs() {
  return apiListVoiceConfigs();
}

/**
 * Load a specific voice configuration from API
 * @param {string} name - Configuration name
 * @returns {Promise<string>} Configuration JSON string
 */
export function loadVoiceConfig(name) {
  return apiLoadVoiceConfig(name);
}

/**
 * Save a voice configuration to API
 * @param {string} name - Configuration name
 * @param {string} configJson - Configuration JSON string
 * @returns {Promise<void>}
 */
export function saveVoiceConfig(name, configJson) {
  return apiSaveVoiceConfig(name, configJson);
}

/**
 * Delete a voice configuration from API
 * @param {string} name - Configuration name
 * @returns {Promise<void>}
 */
export function deleteVoiceConfig(name) {
  return apiDeleteVoiceConfig(name);
}

/**
 * Rename a voice configuration on API
 * @param {string} oldName - Current configuration name
 * @param {string} newName - New configuration name
 * @returns {Promise<void>}
 */
export function renameVoiceConfig(oldName, newName) {
  return apiRenameVoiceConfig(oldName, newName);
}
