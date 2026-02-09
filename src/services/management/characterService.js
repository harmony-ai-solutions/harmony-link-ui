import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

/**
 * @typedef {Object} CharacterProfile
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} personality
 * @property {string} appearance
 * @property {string} backstory
 * @property {string} voice_characteristics
 * @property {string} [base_prompt] - Base system prompt for AI
 * @property {string} [scenario] - Character scenario/context
 * @property {string} [example_dialogues] - Example conversations
 * @property {number} typing_speed_wpm - Typing speed in words per minute for chat simulation
 * @property {number} audio_response_chance_percent - Percentage chance (0-100) character responds with audio
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} CharacterImage
 * @property {number} id
 * @property {string} character_profile_id
 * @property {string} mime_type - image/png, image/jpeg, image/webp
 * @property {string} description
 * @property {boolean} is_primary - Only one image per character can be primary
 * @property {number} display_order
 * @property {string} data_url - Base64 data URL for display (data:image/png;base64,...)
 * @property {string} created_at
 * @note VL model fields are internal only and not included in API responses
 */

/**
 * @typedef {Object} CharacterCardImportResult
 * @property {CharacterProfile} profile
 * @property {CharacterImage} image
 * @property {string} message
 */

// Character Profile Operations

/**
 * List all character profiles
 * @returns {Promise<CharacterProfile[]>}
 */
export async function listCharacterProfiles() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to list character profiles");
    return await resp.json();
}

/**
 * Get a specific character profile by ID
 * @param {string} id 
 * @returns {Promise<CharacterProfile>}
 */
export async function getCharacterProfile(id) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles/${id}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to get character profile");
    return await resp.json();
}

/**
 * Create a new character profile
 * @param {Partial<CharacterProfile>} profile 
 * @returns {Promise<CharacterProfile>}
 */
export async function createCharacterProfile(profile) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(profile)
    });
    await handleResponse(resp, "Failed to create character profile");
    return await resp.json();
}

/**
 * Update an existing character profile
 * @param {string} id 
 * @param {Partial<CharacterProfile>} profile 
 * @returns {Promise<CharacterProfile>}
 */
export async function updateCharacterProfile(id, profile) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles/${id}`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify(profile)
    });
    await handleResponse(resp, "Failed to update character profile");
    return await resp.json();
}

/**
 * Delete a character profile
 * @param {string} id 
 * @returns {Promise<void>}
 */
export async function deleteCharacterProfile(id) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to delete character profile");
}

// Character Card Import

/**
 * Import a character card from a PNG file
 * @param {File} file 
 * @returns {Promise<CharacterCardImportResult>}
 */
export async function importCharacterCard(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles/import`, {
        method: 'POST',
        headers: getAuthHeaders(), // NOTE: Do NOT set Content-Type for FormData - browser sets it with boundary
        body: formData,
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import character card');
    }
    
    return response.json();
}

// Character Image Operations

/**
 * List images for a character profile
 * @param {string} characterId 
 * @returns {Promise<CharacterImage[]>}
 */
export async function listImages(characterId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles/${characterId}/images`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to list character images");
    return await resp.json();
}

/**
 * Get a specific character image
 * @param {string} characterId 
 * @param {number} imageId 
 * @returns {Promise<CharacterImage>}
 */
export async function getImage(characterId, imageId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles/${characterId}/images/${imageId}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to get character image");
    return await resp.json();
}

/**
 * Upload a new image for a character profile
 * @param {string} characterId 
 * @param {File} file 
 * @param {string} description 
 * @returns {Promise<CharacterImage>}
 */
export async function uploadImage(characterId, file, description = '') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('description', description);
    
    const response = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles/${characterId}/images`, {
        method: 'POST',
        headers: getAuthHeaders(), // NOTE: Do NOT set Content-Type for FormData
        body: formData,
    });
    
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload character image');
    }
    
    return response.json();
}

/**
 * Update image metadata
 * @param {string} characterId 
 * @param {number} imageId 
 * @param {Object} updates 
 * @returns {Promise<CharacterImage>}
 */
export async function updateImageMetadata(characterId, imageId, updates) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles/${characterId}/images/${imageId}`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify(updates)
    });
    await handleResponse(resp, "Failed to update image metadata");
    return await resp.json();
}

/**
 * Delete a character image
 * @param {string} characterId 
 * @param {number} imageId 
 * @returns {Promise<void>}
 */
export async function deleteImage(characterId, imageId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles/${characterId}/images/${imageId}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to delete character image");
}

/**
 * Set an image as the primary image for a character profile
 * @param {string} characterId 
 * @param {number} imageId 
 * @returns {Promise<void>}
 */
export async function setPrimaryImage(characterId, imageId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles/${characterId}/images/${imageId}/set-primary`, {
        method: "PUT",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to set primary image");
}
