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

export async function createEntity(id, characterProfileId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({ id, character_profile_id: characterProfileId })
    });
    await handleResponse(resp, "Failed to create entity");
    return await resp.json();
}

export async function updateEntity(id, characterProfileId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${id}`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify({ character_profile_id: characterProfileId })
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
