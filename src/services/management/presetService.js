import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

export async function listPresets() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/presets`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to list presets");
    const data = await resp.json();
    return data.presets;
}

export async function getPreset(name) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/presets/${encodeURIComponent(name)}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to get preset");
    return await resp.json();
}

export async function uploadPreset(name, content) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/presets`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({ name, content }),
    });
    await handleResponse(resp, "Failed to upload preset");
}

export async function deletePreset(name) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/presets/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to delete preset");
}