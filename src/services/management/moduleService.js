import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

// Generic functions for all module types
export async function listModuleConfigs(moduleType) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/module-configs/${moduleType}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to list ${moduleType} configurations`);
    return await resp.json();
}

export async function getModuleConfig(moduleType, id) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/module-configs/${moduleType}/${id}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to get ${moduleType} configuration`);
    return await resp.json();
}

export async function createModuleConfig(moduleType, name, config) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/module-configs/${moduleType}`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({ name, config })
    });
    await handleResponse(resp, `Failed to create ${moduleType} configuration`);
    return await resp.json();
}

export async function updateModuleConfig(moduleType, id, name, config) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/module-configs/${moduleType}/${id}`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify({ name, config })
    });
    await handleResponse(resp, `Failed to update ${moduleType} configuration`);
    return await resp.json();
}

export async function deleteModuleConfig(moduleType, id) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/module-configs/${moduleType}/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to delete ${moduleType} configuration`);
}
