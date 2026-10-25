import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';
import { selectPrimaryImage, resolveImageVariant } from '../../utils/characterImageUtils.js';

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
 * @property {'ready'|'pending'|'unavailable'} [thumbnail_state] - Preview
 *   tri-state (contract 1.8.0). `pending` means ?variant=thumb will generate
 *   it; `unavailable` means only the original is servable.
 * @property {boolean} [has_thumbnail] - Legacy ready-only flag (== ready)
 * @property {string} [vl_model] - VL model used for analysis (e.g. "gpt-4o")
 * @property {string} [vl_model_interpretation] - Detailed objective description from VL model
 * @property {string} created_at
 * @property {string} updated_at
 *
 * NOTE: metadata-only since parity contract 1.8.0 — there is NO `data_url`.
 * Bytes are loaded lazily as object URLs (see fetchCharacterImageObjectUrl).
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
 * Toggle a character profile's favourite bit.
 *
 * Mirrors the engine's NARROW `PUT /api/v1/character-profiles/:id/favorite`
 * route (`{ is_favorite: boolean }`). This exists so the UI never sends a
 * partial profile body to `PUT /character-profiles/:id`: that handler binds the
 * FULL `CharacterProfileConfig`, so any field omitted from the body is written
 * back as its zero value — a partial update there would wipe the card. Use this
 * for favourites, and mirror the same narrow shape for any future flag
 * (pinned-style) rather than reusing the full update.
 *
 * The engine also re-stamps `updated_at`, which is what carries the change to
 * the phone: the app's only change tracking is `updated_at > lastSync`.
 *
 * @param {string} id
 * @param {boolean} favorite
 * @returns {Promise<{id: string, is_favorite: boolean}>}
 */
export async function setCharacterProfileFavorite(id, favorite) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles/${id}/favorite`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify({ is_favorite: !!favorite })
    });
    await handleResponse(resp, "Failed to update favorite");
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

/**
 * Duplicate a character profile as a full-card copy. Mirrors the backend
 * `POST /api/v1/character-profiles/:id/duplicate` route: all V3 spec + Soulbits
 * fields are copied with a fresh id; the name is derived via the copy-suffix
 * convention unless overridden by `overrides.name`. Returns the new profile in
 * the same shape as GET profile (no images / is_favorite).
 *
 * @param {string} profileId
 * @param {{ name?: string }} [overrides] - Optional overrides; only `name`
 *   (non-empty string) is sent as a JSON body, otherwise no body is sent.
 * @returns {Promise<CharacterProfile>}
 */
export async function duplicateCharacterProfile(profileId, overrides = {}) {
    const name = overrides && typeof overrides.name === 'string' && overrides.name.trim() !== '' ? overrides.name : null;
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-profiles/${profileId}/duplicate`, {
        method: "POST",
        headers: name ? getJsonHeaders() : getAuthHeaders(),
        ...(name ? { body: JSON.stringify({ name }) } : {})
    });
    await handleResponse(resp, "Failed to duplicate character profile");
    return await resp.json();
}

// Character Categories (plan 03-2)
//
// Desktop-local organisation — NOT synced. The phone keeps its own categories
// in app-local SQLite, so these exist only on this machine. Categories group
// character PROFILES; deleting one never deletes a character.

/**
 * @typedef {Object} CharacterCategory
 * @property {string} id
 * @property {string} name
 * @property {number} sort_order
 * @property {number} member_count - Projection filled by the engine, not a column
 * @property {string[]} profile_ids - Projection: the live profiles in the category
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * List every category in the user's drag order.
 *
 * Each item carries `member_count` and `profile_ids`, so the chip row and the
 * card menu's checkbox list are served by ONE request — no per-chip follow-up.
 *
 * @returns {Promise<CharacterCategory[]>}
 */
export async function listCharacterCategories() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-categories`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to list character categories");
    return await resp.json();
}

/**
 * Create a category.
 *
 * Throws on a 409 ("category name is already in use") — the caller surfaces the
 * clash inline so the user can pick another name. A name held by a DELETED
 * category is revived by the engine rather than rejected.
 *
 * @param {string} name
 * @returns {Promise<CharacterCategory>}
 */
export async function createCharacterCategory(name) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-categories`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({ name })
    });
    await handleResponse(resp, "Failed to create category");
    return await resp.json();
}

/**
 * Rename a category.
 * @param {string} id
 * @param {string} name
 * @returns {Promise<CharacterCategory>}
 */
export async function renameCharacterCategory(id, name) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-categories/${id}`, {
        method: "PATCH",
        headers: getJsonHeaders(),
        body: JSON.stringify({ name })
    });
    await handleResponse(resp, "Failed to rename category");
    return await resp.json();
}

/**
 * Delete a category. Characters are never deleted — they simply stop being
 * grouped, so the UI can warn about that explicitly.
 * @param {string} id
 * @returns {Promise<{status: string, id: string}>}
 */
export async function deleteCharacterCategory(id) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-categories/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to delete category");
    return await resp.json();
}

/**
 * Set a category's membership to exactly `profileIds`.
 *
 * This is a REPLACE, not an add: the card menu sends the complete checked set,
 * so unchecking a character works in the same single call. An empty array
 * clears the category.
 *
 * @param {string} categoryId
 * @param {string[]} profileIds
 * @returns {Promise<CharacterCategory>} the category with its resulting membership
 */
export async function setCharacterCategoryMembers(categoryId, profileIds) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-categories/${categoryId}/members`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({ profile_ids: Array.isArray(profileIds) ? profileIds : [] })
    });
    await handleResponse(resp, "Failed to update category members");
    return await resp.json();
}

/**
 * Remove one profile from one category. Removing a non-member is a success.
 * @param {string} categoryId
 * @param {string} profileId
 * @returns {Promise<Object>}
 */
export async function removeCharacterCategoryMember(categoryId, profileId) {
    const resp = await fetch(
        `${getManagementApiUrl()}${getApiPath()}/character-categories/${categoryId}/members/${profileId}`,
        { method: "DELETE", headers: getAuthHeaders() }
    );
    await handleResponse(resp, "Failed to remove category member");
    return await resp.json();
}

/**
 * Persist the drag order. Index becomes `sort_order`; ids the engine no longer
 * knows (deleted on another window) are skipped rather than failing the drag.
 * @param {string[]} orderedIds
 * @returns {Promise<CharacterCategory[]>} the re-ordered list
 */
export async function reorderCharacterCategories(orderedIds) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/character-categories/reorder`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({ ordered_ids: Array.isArray(orderedIds) ? orderedIds : [] })
    });
    await handleResponse(resp, "Failed to reorder categories");
    return await resp.json();
}

// Character Card Import

/**
 * POST the card file to the import route and return the parsed JSON.
 *
 * @param {File} file
 * @param {Record<string,string>} [query] - extra query params (`dry_run`, `on_conflict`, `name`)
 * @returns {Promise<any>}
 */
async function postCharacterCardImport(file, query = {}) {
    const formData = new FormData();
    formData.append('file', file);

    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    });
    const suffix = params.toString() ? `?${params.toString()}` : '';

    const response = await fetch(
        `${getManagementApiUrl()}${getApiPath()}/character-profiles/import${suffix}`,
        {
            method: 'POST',
            headers: getAuthHeaders(), // NOTE: Do NOT set Content-Type for FormData - browser sets it with boundary
            body: formData,
        },
    );
    return response;
}

/**
 * Review a character card WITHOUT persisting anything (plan 03-5d).
 *
 * Calls the same import route with `?dry_run=1`, which parses the card and
 * answers with the detection summary (spec, counts, dropped fields) plus the
 * name-collision state — then returns before any write.
 *
 * This exists so the desktop preview is the SERVER's answer. Re-deriving the
 * spec, the lorebook count and the copy name in the browser would be a second
 * implementation of three rules, and a preview that disagrees with the import
 * is exactly the bug the review step is meant to remove.
 *
 * @param {File} file
 * @returns {Promise<{
 *   status: 'review', spec: string, spec_version: string, name: string,
 *   description_length: number, alternate_greeting_count: number,
 *   lorebook_entry_count: number, image_count: number, first_mes: string,
 *   dropped_field_count: number, dropped_fields?: string[],
 *   name_taken: boolean|null, existing_id?: string, existing_name?: string,
 *   suggested_name?: string,
 * }>}
 */
export async function previewCharacterCardImport(file) {
    const response = await postCharacterCardImport(file, { dry_run: 1 });
    if (!response.ok) {
        let message = 'Failed to read character card';
        try {
            const error = await response.json();
            message = error.error || message;
        } catch { /* no JSON body */ }
        throw new Error(message);
    }
    return response.json();
}

/**
 * Import a character card from a PNG file.
 *
 * @param {File} file
 * @param {{onConflict?: 'error'|'copy', name?: string}} [options]
 *   `onConflict: 'copy'` lets the engine pick the next copy name itself (the
 *   app/script path); `name` is the explicit "Import as copy" name from the
 *   review panel. Omitting both keeps the strict behaviour: a name clash
 *   answers **409** with the review summary attached, so nothing is written.
 * @returns {Promise<CharacterCardImportResult>}
 */
export async function importCharacterCard(file, options = {}) {
    const response = await postCharacterCardImport(file, {
        on_conflict: options.onConflict,
        name: options.name,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const err = new Error(error.error || 'Failed to import character card');
        // 409 carries the review payload so the caller can offer "Import as
        // copy" without re-parsing the file.
        err.status = response.status;
        err.nameTaken = !!error.name_taken;
        err.suggestedName = error.suggested || '';
        err.preview = error.dry_run || null;
        throw err;
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
 * List images for a character profile.
 *
 * Metadata-only (contract 1.8.0): items carry `id`, `is_primary`,
 * `thumbnail_state` and `has_thumbnail` — never `data_url`. Use
 * {@link fetchCharacterImageObjectUrl} / {@link fetchPrimaryCharacterImageObjectUrl}
 * to display the bytes.
 *
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
 * Build the URL for one character image. `variant: 'thumb'` asks for the
 * derived 512px preview; no variant returns the original bytes.
 *
 * @param {string} characterId
 * @param {string} imageId
 * @param {{ variant?: string|null }} [options]
 * @returns {string}
 */
export function getCharacterImageUrl(characterId, imageId, { variant = 'thumb' } = {}) {
    const base = `${getManagementApiUrl()}${getApiPath()}/character-profiles/${characterId}/images/${imageId}`;
    return variant ? `${base}?variant=${encodeURIComponent(variant)}` : base;
}

/**
 * Fetch one character image as an object URL. Auth headers are applied by the
 * fetch (an <img src> cannot carry them), and the caller owns the returned URL
 * — revoke it on unmount/replacement.
 *
 * Tri-state handling: a requested preview that the engine cannot serve (404
 * `{"fallback":"original"}` — `thumbnail_state: 'unavailable'`) transparently
 * retries the ORIGINAL bytes, so callers always get a usable image when the
 * original exists. `pending` thumbnails are generated by the route on demand.
 *
 * @param {string} characterId
 * @param {string} imageId
 * @param {{ variant?: string|null }} [options] - 'thumb' (default) or null for original
 * @returns {Promise<string|null>} object URL, or null when no bytes are servable
 */
export async function fetchCharacterImageObjectUrl(characterId, imageId, { variant = 'thumb' } = {}) {
    const fetchBlob = async (wantedVariant) => {
        const resp = await fetch(getCharacterImageUrl(characterId, imageId, { variant: wantedVariant }), {
            headers: getAuthHeaders()
        });
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return blob && blob.size > 0 ? blob : null;
    };

    let blob = await fetchBlob(variant);
    if (!blob && variant) blob = await fetchBlob(null);
    return blob ? URL.createObjectURL(blob) : null;
}

/**
 * Fetch a profile's primary image (see {@link selectPrimaryImage}) as an
 * object URL. The variant is resolved from the image's `thumbnail_state`, so an
 * `unavailable` preview goes straight to the original. Caller revokes the URL.
 *
 * @param {string} characterId
 * @param {{ variant?: string|null }} [options]
 * @returns {Promise<string|null>}
 */
export async function fetchPrimaryCharacterImageObjectUrl(characterId, { variant = 'thumb' } = {}) {
    const images = await listImages(characterId);
    const primary = selectPrimaryImage(images);
    if (!primary?.id) return null;
    return fetchCharacterImageObjectUrl(characterId, primary.id, {
        variant: resolveImageVariant(primary, variant),
    });
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
