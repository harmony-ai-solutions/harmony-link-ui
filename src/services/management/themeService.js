import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

export async function listThemes() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/themes`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to list themes");
    const data = await resp.json();
    return data.themes;
}

export async function getCurrentTheme() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/settings/current-theme`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to fetch current theme");
    return await resp.json();
}

export async function setCurrentTheme(themeId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/settings/current-theme`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify({ themeId }),
    });
    await handleResponse(resp, "Failed to update current theme");
}

export async function saveCustomTheme(theme) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/themes/custom`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(theme),
    });
    await handleResponse(resp, "Failed to save custom theme");
}

export async function deleteTheme(themeId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/themes/${encodeURIComponent(themeId)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to delete theme");
}
