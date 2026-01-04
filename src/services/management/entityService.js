import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

export async function listEntities() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to list entities");
    return await resp.json();
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
