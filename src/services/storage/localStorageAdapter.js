/**
 * LocalStorage Adapter Implementation
 * 
 * Implements localStorage-based storage for Speech Engine mode.
 * Mimics the original Speech Engine frontend's approach using browser localStorage
 * to persist voice configurations locally.
 */

/**
 * List all available voice configurations from localStorage
 * @returns {Promise<Array>} Array of configuration names
 */
export function listVoiceConfigs() {
  const configs = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith("voiceConfig_")) {
      configs.push(key.substring("voiceConfig_".length));
    }
  }
  return Promise.resolve(configs);
}

/**
 * Load a specific voice configuration from localStorage
 * @param {string} name - Configuration name
 * @returns {Promise<string>} Configuration JSON string
 */
export function loadVoiceConfig(name) {
  const configString = localStorage.getItem("voiceConfig_" + name);
  return Promise.resolve(configString);
}

/**
 * Save a voice configuration to localStorage
 * @param {string} name - Configuration name
 * @param {string} configJson - Configuration JSON string
 * @returns {Promise<void>}
 */
export function saveVoiceConfig(name, configJson) {
  localStorage.setItem("voiceConfig_" + name, configJson);
  return Promise.resolve();
}

/**
 * Update a voice configuration in localStorage
 * @param {string} name - Configuration name
 * @param {string} configJson - Configuration JSON string
 * @returns {Promise<void>}
 */
export function updateVoiceConfig(name, configJson) {
  // For localStorage, update is the same as save (overwrites by default)
  localStorage.setItem("voiceConfig_" + name, configJson);
  return Promise.resolve();
}

/**
 * Delete a voice configuration from localStorage
 * @param {string} name - Configuration name
 * @returns {Promise<void>}
 */
export function deleteVoiceConfig(name) {
  localStorage.removeItem("voiceConfig_" + name);
  return Promise.resolve();
}

/**
 * Rename a voice configuration in localStorage
 * @param {string} oldName - Current configuration name
 * @param {string} newName - New configuration name
 * @returns {Promise<void>}
 */
export function renameVoiceConfig(oldName, newName) {
  const configString = localStorage.getItem("voiceConfig_" + oldName);
  if (configString) {
    localStorage.setItem("voiceConfig_" + newName, configString);
    localStorage.removeItem("voiceConfig_" + oldName);
  }
  return Promise.resolve();
}
