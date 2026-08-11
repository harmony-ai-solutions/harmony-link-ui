import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

/**
 * @typedef {Object} CharacterProfile
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} personality
 * @property {string} voice_characteristics
 * @property {string} [base_prompt] - Base system prompt for AI
 * @property {string} [scenario] - Character scenario/context
 * @property {number} typing_speed_wpm - Typing speed in words per minute for chat simulation
 * @property {number} audio_response_chance_percent - Percentage chance (0-100) character responds with audio
 * @property {string|null} [vision_config_id] - UUID of the Vision module config for image analysis
 * @property {string} created_at
 * @property {string} updated_at
 * @property {string} [first_mes] - Authored opening message delivered on a truly-new chat
 * @property {string} [mes_example] - Example dialogue showing how the character speaks
 * @property {string} [alternate_greetings] - JSON []string of alternative opening messages
 * @property {string} [post_history_instructions] - Instructions injected after chat history (UJB)
 * @property {string} [creator_notes] - Notes left by the card author
 * @property {string} [creator] - Original author of the character card
 * @property {string} [character_version] - Version string of this character
 * @property {string} [nickname] - Short name; drives the {{char}} macro
 * @property {string} [tags] - JSON []string of searchable tags
 * @property {string} [group_only_greetings] - JSON []string of group-chat-only greetings
 * @property {string} [extensions] - Raw JSON {} opaque extensions object (preserved for export)
 * @property {string} [assets] - Raw JSON [] full asset manifest (preserved for export)
 * @property {string} [card_provenance] - Raw JSON {} import provenance (read-only, import-managed)
 * @property {string} [character_book] - Raw JSON {} full lorebook (top-level + entries[])
 */

/**
 * @typedef {Object} CharacterImage
 * @property {string} id - UUID (UUIDv7 for new images)
 * @property {string} character_profile_id
 * @property {string} mime_type - image/png, image/jpeg, image/webp
 * @property {string} description - Short contextual label (auto-generated or manual)
 * @property {boolean} is_primary - Only one image per character can be primary
 * @property {number} display_order
 * @property {string} data_url - Base64 data URL for display (data:image/png;base64,...)
 * @property {string} [vl_model] - VL model used for analysis (e.g. "gpt-4o")
 * @property {string} [vl_model_interpretation] - Detailed objective description from VL model
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} CharacterCardImportResult
 * @property {string} status - "imported"
 * @property {string} id - Profile UUID
 * @property {string} name - Character name
 * @property {string[]} [dropped_fields] - Non-spec card keys detected and
 *   dropped on import (present only when non-empty). The UI surfaces these as
 *   a user warning (no-unknown-fields policy).
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

// Character Card Export (V3)

/**
 * Export a character profile as a Character Card V3 (JSON or PNG `ccv3`) and
 * trigger a browser download. Mirrors the backend
 * `GET /api/v1/character-profiles/:id/export?format=json|png` route.
 *
 * @param {string} profileId
 * @param {'json'|'png'} [format='png'] - 'png' embeds a ccv3 tEXt chunk (shareable); 'json' is the raw V3 card
 * @param {string} [filenameBase] - Base file name (defaults to 'character'); the extension is appended
 * @returns {Promise<void>}
 */
export async function exportCharacterCard(profileId, format = 'png', filenameBase = 'character') {
    const resp = await fetch(
        `${getManagementApiUrl()}${getApiPath()}/character-profiles/${profileId}/export?format=${encodeURIComponent(format)}`,
        { headers: getAuthHeaders() }
    );
    if (!resp.ok) {
        let msg = 'Failed to export character card';
        try {
            const e = await resp.json();
            msg = e.error || msg;
        } catch { /* response had no JSON body */ }
        throw new Error(msg);
    }
    const blob = await resp.blob();
    const ext = format === 'json' ? 'json' : 'png';
    const safe = String(filenameBase || 'character').replace(/[^\w.-]+/g, '_').replace(/^[._]+|[._]+$/g, '') || 'character';
    // Trigger a download in the Wails/Chromium webview.
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safe}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
 * @param {string} imageId 
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
 * @param {string} imageId 
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
 * @param {string} imageId 
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
 * @param {string} imageId 
 * @returns {Promise<void>}
 */
export async function setPrimaryImage(characterId, imageId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles/${characterId}/images/${imageId}/set-primary`, {
        method: "PUT",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to set primary image");
}

/**
 * Trigger VL analysis for a character image.
 * Runs two prompts: detailed interpretation (stored in vl_model_interpretation)
 * and a short contextual label (stored in description).
 * @param {string} characterId
 * @param {string} imageId
 * @param {string} visionConfigId - UUID of the Vision module config to use
 * @returns {Promise<{vl_model: string, vl_model_interpretation: string, description: string}>}
 */
export async function analyzeImage(characterId, imageId, visionConfigId) {
    const resp = await fetch(
        `${getManagementApiUrl()}${getApiPath()}/character-profiles/${characterId}/images/${imageId}/analyze-vision`,
        {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify({ vision_config_id: visionConfigId }),
        }
    );
    await handleResponse(resp, 'Failed to analyze image');
    return await resp.json();
}
