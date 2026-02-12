import { getManagementApiUrl, getApiPath, getPublicApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

/* Admin endpoints for config */
export async function getConfig() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/config`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to fetch config");
    return await resp.json();
}

export async function updateConfig(config, createBackup = true) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/config`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({config: config, createBackup: createBackup}),
    });
    await handleResponse(resp, "Failed to update config");
}

/* Voice config endpoints */
export async function listVoiceConfigs() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/voices`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to list voice configs");
    return await resp.json();
}

export async function loadVoiceConfig(name) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/voices/${encodeURIComponent(name)}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to load voice config");
    return await resp.text();
}

export async function saveVoiceConfig(name, configJson) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/voices`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({name, config: configJson})
    });
    await handleResponse(resp, "Failed to save voice config");
}

export async function updateVoiceConfig(name, configJson) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/voices/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify({config: configJson})
    });
    await handleResponse(resp, "Failed to update voice config");
}

export async function deleteVoiceConfig(name) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/voices/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to delete voice config");
}

export async function renameVoiceConfig(oldName, newName) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/voices/${encodeURIComponent(oldName)}/rename`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({newName})
    });
    await handleResponse(resp, "Failed to rename voice config");
}

/* Public endpoints for app name/version */
export async function getAppName() {
    const resp = await fetch(`${getManagementApiUrl()}${getPublicApiPath()}/appname`);
    await handleResponse(resp, "Failed to fetch app name");
    const data = await resp.json();
    return data.appName;
}

export async function getAppVersion() {
    const resp = await fetch(`${getManagementApiUrl()}${getPublicApiPath()}/appversion`);
    await handleResponse(resp, "Failed to fetch app version");
    const data = await resp.json();
    return data.appVersion;
}

/* Provider configuration endpoints */
export async function validateProviderConfig(module, provider, config) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/validate-provider`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({
            module: module,
            provider: provider,
            config: config
        })
    });
    await handleResponse(resp, `Failed to validate provider configuration for ${module}/${provider}`);
    return await resp.json();
}

export async function listProviderModels(module, provider, config) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/models`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({
            module: module,
            provider: provider,
            config: config
        })
    });
    await handleResponse(resp, `Failed to fetch models for ${module}/${provider}`);
    return await resp.json();
}
