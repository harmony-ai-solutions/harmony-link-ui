import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

/* Integrations endpoints */
export async function getDockerStatus() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/docker-status`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to fetch Docker status");
    return await resp.json();
}

export async function listIntegrations() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/show`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to fetch integrations");
    return await resp.json();
}

export async function refreshIntegrationStatuses() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/refresh`, {
        method: "POST",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to refresh integration statuses");
    return await resp.json();
}

export async function getQuickstartRepoPath() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/repo-path`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to fetch quickstart repo path");
    return await resp.json();
}

export async function setQuickstartRepoPath(path) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/repo-path`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({path})
    });
    await handleResponse(resp, "Failed to set quickstart repo path");
}

// Instance-specific Integration Management
export async function getIntegrationInstances(integrationName) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/${encodeURIComponent(integrationName)}/instances`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to fetch instances for ${integrationName}`);
    return await resp.json();
}

export async function createIntegrationInstance(integrationName, instanceData) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/${encodeURIComponent(integrationName)}/instances`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(instanceData)
    });
    await handleResponse(resp, `Failed to create instance for ${integrationName}`);
}

export async function deleteIntegrationInstance(integrationName, instanceName) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to delete instance ${instanceName} for ${integrationName}`);
}

export async function getIntegrationInstanceConfig(integrationName, instanceName) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/config`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to fetch config for instance ${instanceName} of ${integrationName}`);
    return await resp.json();
}

export async function saveIntegrationInstanceConfig(integrationName, instanceName, content) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/config`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({content})
    });
    await handleResponse(resp, `Failed to save config for instance ${instanceName} of ${integrationName}`);
}

export async function controlIntegrationInstance(integrationName, instanceName, action) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/control`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({action})
    });
    await handleResponse(resp, `Failed to perform ${action} on instance ${instanceName} of ${integrationName}`);
}

export async function cancelIntegrationInstanceOperation(integrationName, instanceName) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/cancel`, {
        method: "POST",
        headers: getJsonHeaders(),
    });
    await handleResponse(resp,`Failed to cancel operation for instance ${instanceName} of ${integrationName}`);
}

export async function getIntegrationInstanceStatus(integrationName, instanceName) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/status`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to fetch status for instance ${instanceName} of ${integrationName}`);
    return await resp.json();
}

export async function getInstanceWebURLs(integrationName, instanceName) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/web-urls`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to fetch web URLs for instance ${instanceName} of ${integrationName}`);
    return await resp.json();
}

export async function getIntegrationTemplate(name, deviceType = 'cpu') {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/${encodeURIComponent(name)}/template?device=${encodeURIComponent(deviceType)}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to fetch template for ${name}`);
    return await resp.text();
}

// Instance-specific Config Files
export async function getIntegrationInstanceConfigFiles(integrationName, instanceName) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/config-files`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp,`Failed to fetch config files for instance ${instanceName} of ${integrationName}`);
    return await resp.json();
}

export async function readIntegrationInstanceConfigFile(integrationName, instanceName, filename) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/config-files/${encodeURIComponent(filename)}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp,`Failed to read config file ${filename} for instance ${instanceName} of ${integrationName}`);
    return await resp.text();
}

export async function saveIntegrationInstanceConfigFile(integrationName, instanceName, filename, content) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/config-files/${encodeURIComponent(filename)}`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({content})
    });
    await handleResponse(resp, `Failed to save config file ${filename} for instance ${instanceName} of ${integrationName}`);
}

export async function revertIntegrationInstanceConfigFile(integrationName, instanceName, filename) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/config-files/${encodeURIComponent(filename)}/revert`, {
        method: "POST",
        headers: getJsonHeaders(),
    });
    await handleResponse(resp,`Failed to revert config file ${filename} for instance ${instanceName} of ${integrationName}`);
}

export async function getAvailableIntegrationsForProvider(moduleName, providerName) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/integrations/available-for-provider?module=${encodeURIComponent(moduleName)}&provider=${encodeURIComponent(providerName)}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, `Failed to fetch available integrations for ${moduleName}/${providerName}`);
    return await resp.json();
}
