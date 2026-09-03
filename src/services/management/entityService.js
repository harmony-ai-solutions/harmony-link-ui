import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

export async function listEntities() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to list entities");
    const data = await resp.json();
    
    // Convert object format {id: {...}} to array format [{id: 'id', ...}]
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        return Object.entries(data).map(([id, entity]) => ({
            id,
            ...entity
        }));
    }
    
    return data;
}

export async function getEntity(id) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${id}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to get entity");
    return await resp.json();
}

/**
 * Create an AI entity in ONE atomic request: id + character profile link +
 * display alias land in a single engine transaction — there is no
 * create→alias-PUT window anymore that could orphan a half-configured entity.
 * The engine answers 400 {"error":"entity alias is already in use"} when
 * `alias` exact-matches another live entity's alias (`entities.alias` partial
 * UNIQUE index), so pass a pre-deduped alias (`deriveEntityAlias`).
 * @param {string} id - Entity id.
 * @param {string|null} characterProfileId - Linked character profile id.
 * @param {string} [alias] - Display alias; included in the POST body ONLY
 *   when a non-empty string is passed (omitted → exact legacy wire format, so
 *   all 2-arg call sites keep behaving identically).
 * @returns {Promise<{id: string, character_profile_id: string|null, entity_type: string|null, alias: string|null}>}
 */
export async function createEntity(id, characterProfileId, alias) {
    const body = { id, character_profile_id: characterProfileId };
    if (typeof alias === 'string' && alias !== '') {
        body.alias = alias;
    }
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(body)
    });
    await handleResponse(resp, "Failed to create entity");
    return await resp.json();
}

/**
 * Create a persona (user-type) entity. Mirrors `createEntity` but sends the
 * optional `entity_type: 'user'` marker (management `handleCreateEntity`
 * supports it) so the engine treats it as a chat-only persona rather than an
 * AI entity. Same atomic id + profile + alias semantics (and the same clean
 * 400 on alias conflict) as `createEntity`.
 * @param {string} id - Entity id (also the persona name).
 * @param {string} characterProfileId - Linked character profile id.
 * @param {string} [alias] - Display alias; included in the POST body ONLY
 *   when a non-empty string is passed (omitted → exact legacy wire format, so
 *   all 2-arg call sites keep behaving identically).
 * @returns {Promise<{id: string, character_profile_id: string|null, entity_type: string, alias: string|null}>}
 */
export async function createPersonaEntity(id, characterProfileId, alias) {
    const body = { id, character_profile_id: characterProfileId, entity_type: 'user' };
    if (typeof alias === 'string' && alias !== '') {
        body.alias = alias;
    }
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(body)
    });
    await handleResponse(resp, "Failed to create entity");
    return await resp.json();
}

export async function updateEntity(id, characterProfileId, lifecycleConfig, alias) {
    const body = {};
    if (characterProfileId !== undefined && characterProfileId !== null) {
        body.character_profile_id = characterProfileId;
    }
    if (lifecycleConfig !== undefined && lifecycleConfig !== null) {
        body.lifecycle_config = lifecycleConfig;
    }
    if (alias !== undefined && alias !== null) {
        body.alias = alias;
    }
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${id}`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify(body)
    });
    await handleResponse(resp, "Failed to update entity");
    return await resp.json();
}

export async function updateEntityMappings(id, mappings) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${id}/mappings`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify(mappings)
    });
    await handleResponse(resp, "Failed to update entity mappings");
    return await resp.json();
}

export async function deleteEntity(id) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to delete entity");
}

export async function renameEntity(oldId, newId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${oldId}/rename`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({ new_id: newId })
    });
    await handleResponse(resp, "Failed to rename entity");
    return await resp.json();
}

export async function resetEntityLifecycleConfig(entityId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${entityId}/reset-lifecycle-config`, {
        method: "POST",
        headers: getJsonHeaders()
    });
    await handleResponse(resp, "Failed to reset entity lifecycle config");
    return await resp.json();
}
