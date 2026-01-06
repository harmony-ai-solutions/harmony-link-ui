/**
 * Merges an initial configuration object with a set of default values.
 * 
 * If the initial configuration is null, undefined, or empty, it returns the defaults.
 * Otherwise, it only fills in keys that are truly missing (undefined) in the initial config,
 * preserving existing values even if they are empty strings, null, or zero.
 * 
 * @param {Object} initial - The initial configuration from the backend.
 * @param {Object} defaults - The default configuration values.
 * @returns {Object} The merged configuration.
 */
export const mergeConfigWithDefaults = (initial, defaults) => {
    // If it's effectively empty, use all defaults
    if (!initial || Object.keys(initial).length === 0) {
        return { ...defaults };
    }

    // Otherwise, only fill in keys that are truly undefined or missing
    const merged = { ...defaults };
    Object.keys(initial).forEach(key => {
        if (initial[key] !== undefined) {
            merged[key] = initial[key];
        }
    });
    
    return merged;
};
