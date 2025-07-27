const mgmtApiURL = import.meta.env.VITE_MGMT_API_URL || "http://localhost";
const mgmtApiPort = import.meta.env.VITE_MGMT_API_PORT || "28081";
const mgmtApiPath = import.meta.env.VITE_MGMT_API_PATH || "/api";
const mgmtPublicApiPath = import.meta.env.VITE_MGMT_PUBLIC_API_PATH || "/public";
const mgmtApiKey = import.meta.env.VITE_MGMT_API_KEY || "admin";

/* Admin endpoints for config */
export async function getConfig() {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/config`, {
        headers: {"X-Admin-API-Key": mgmtApiKey}
    });
    if (!resp.ok) throw new Error("Failed to fetch config");
    return await resp.json();
}

export async function updateConfig(config, createBackup = true) {
    await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/config`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": mgmtApiKey
        },
        body: JSON.stringify({config: config, createBackup: createBackup}),
    });
}

/* Voice config endpoints */
export async function listVoiceConfigs() {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/voices`, {
        headers: {
            "X-Admin-API-Key": mgmtApiKey
        }
    });
    if (!resp.ok) throw new Error("Failed to list voice configs");
    return await resp.json();               // []string
}

export async function loadVoiceConfig(name) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/voices/${encodeURIComponent(name)}`, {
        headers: {
            "X-Admin-API-Key": mgmtApiKey
        }
    });
    if (!resp.ok) throw new Error("Failed to load voice config");
    return await resp.text();               // raw json string
}

export async function saveVoiceConfig(name, configJson) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/voices`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": mgmtApiKey
        },
        body: JSON.stringify({name, config: configJson})
    });
    if (!resp.ok) throw new Error("Failed to save voice config");
}

export async function deleteVoiceConfig(name) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/voices/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: {
            "X-Admin-API-Key": mgmtApiKey
        }
    });
    if (!resp.ok) throw new Error("Failed to delete voice config");
}

export async function renameVoiceConfig(oldName, newName) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/voices/${encodeURIComponent(oldName)}/rename`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": mgmtApiKey
        },
        body: JSON.stringify({newName})
    });
    if (!resp.ok) throw new Error("Failed to rename voice config");
}

/* Development endpoints for entity testing */
export async function getConnectedEntities() {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/development/entities`, {
        headers: {"X-Admin-API-Key": mgmtApiKey}
    });
    if (!resp.ok) throw new Error("Failed to fetch connected entities");
    return await resp.json();
}

export async function getEntityDetails(entityId) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/development/entities/${encodeURIComponent(entityId)}`, {
        headers: {"X-Admin-API-Key": mgmtApiKey}
    });
    if (!resp.ok) throw new Error("Failed to fetch entity details");
    return await resp.json();
}

export async function sendTestActionGraph(entityId, actionGraph) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/development/entities/${encodeURIComponent(entityId)}/test`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": mgmtApiKey
        },
        body: JSON.stringify(actionGraph)
    });
    if (!resp.ok) throw new Error("Failed to send test ActionGraph");
    return await resp.json();
}

/* Integrations endpoints */
export async function getDockerStatus() {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/docker-status`, {
        headers: {"X-Admin-API-Key": mgmtApiKey}
    });
    if (!resp.ok) throw new Error("Failed to fetch Docker status");
    return await resp.json();
}

export async function listIntegrations() {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/show`, {
        headers: {"X-Admin-API-Key": mgmtApiKey}
    });
    if (!resp.ok) throw new Error("Failed to fetch integrations");
    return await resp.json();
}

export async function getQuickstartRepoPath() {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/repo-path`, {
        headers: {"X-Admin-API-Key": mgmtApiKey}
    });
    if (!resp.ok) throw new Error("Failed to fetch quickstart repo path");
    return await resp.json();
}

export async function setQuickstartRepoPath(path) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/repo-path`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": mgmtApiKey
        },
        body: JSON.stringify({path})
    });
    if (!resp.ok) throw new Error("Failed to set quickstart repo path");
}

// Instance-specific Integration Management
export async function getIntegrationInstances(integrationName) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/${encodeURIComponent(integrationName)}/instances`, {
        headers: {"X-Admin-API-Key": mgmtApiKey}
    });
    if (!resp.ok) throw new Error(`Failed to fetch instances for ${integrationName}`);
    return await resp.json();
}

export async function createIntegrationInstance(integrationName, instanceData) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/${encodeURIComponent(integrationName)}/instances`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": mgmtApiKey
        },
        body: JSON.stringify(instanceData)
    });
    if (!resp.ok) throw new Error(`Failed to create instance for ${integrationName}`);
}

export async function deleteIntegrationInstance(integrationName, instanceName) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}`, {
        method: "DELETE",
        headers: {
            "X-Admin-API-Key": mgmtApiKey
        }
    });
    if (!resp.ok) throw new Error(`Failed to delete instance ${instanceName} for ${integrationName}`);
}

export async function getIntegrationInstanceConfig(integrationName, instanceName) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/config`, {
        headers: {"X-Admin-API-Key": mgmtApiKey}
    });
    if (!resp.ok) throw new Error(`Failed to fetch config for instance ${instanceName} of ${integrationName}`);
    return await resp.json();
}

export async function saveIntegrationInstanceConfig(integrationName, instanceName, content) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/config`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": mgmtApiKey
        },
        body: JSON.stringify({content})
    });
    if (!resp.ok) throw new Error(`Failed to save config for instance ${instanceName} of ${integrationName}`);
}

export async function controlIntegrationInstance(integrationName, instanceName, action) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/control`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": mgmtApiKey
        },
        body: JSON.stringify({action})
    });
    if (!resp.ok) throw new Error(`Failed to perform ${action} on instance ${instanceName} of ${integrationName}`);
}

export async function cancelIntegrationInstanceOperation(integrationName, instanceName) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/cancel`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": mgmtApiKey
        }
    });
    if (!resp.ok) throw new Error(`Failed to cancel operation for instance ${instanceName} of ${integrationName}`);
}

export async function getIntegrationInstanceStatus(integrationName, instanceName) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/status`, {
        headers: {"X-Admin-API-Key": mgmtApiKey}
    });
    if (!resp.ok) throw new Error(`Failed to fetch status for instance ${instanceName} of ${integrationName}`);
    return await resp.json();
}

export async function getInstanceWebURLs(integrationName, instanceName) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/web-urls`, {
        headers: {"X-Admin-API-Key": mgmtApiKey}
    });
    if (!resp.ok) throw new Error(`Failed to fetch web URLs for instance ${instanceName} of ${integrationName}`);
    return await resp.json();
}

export async function getIntegrationTemplate(name, deviceType = 'cpu') {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/${encodeURIComponent(name)}/template?device=${encodeURIComponent(deviceType)}`, {
        headers: {"X-Admin-API-Key": mgmtApiKey}
    });
    if (!resp.ok) throw new Error(`Failed to fetch template for ${name}`);
    return await resp.text();
}


// Instance-specific Config Files
export async function getIntegrationInstanceConfigFiles(integrationName, instanceName) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/config-files`, {
        headers: {"X-Admin-API-Key": mgmtApiKey}
    });
    if (!resp.ok) throw new Error(`Failed to fetch config files for instance ${instanceName} of ${integrationName}`);
    return await resp.json();
}

export async function readIntegrationInstanceConfigFile(integrationName, instanceName, filename) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/config-files/${encodeURIComponent(filename)}`, {
        headers: {"X-Admin-API-Key": mgmtApiKey}
    });
    if (!resp.ok) throw new Error(`Failed to read config file ${filename} for instance ${instanceName} of ${integrationName}`);
    return await resp.text();
}

export async function saveIntegrationInstanceConfigFile(integrationName, instanceName, filename, content) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/config-files/${encodeURIComponent(filename)}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": mgmtApiKey
        },
        body: JSON.stringify({content})
    });
    if (!resp.ok) throw new Error(`Failed to save config file ${filename} for instance ${instanceName} of ${integrationName}`);
}

export async function revertIntegrationInstanceConfigFile(integrationName, instanceName, filename) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/${encodeURIComponent(integrationName)}/instances/${encodeURIComponent(instanceName)}/config-files/${encodeURIComponent(filename)}/revert`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": mgmtApiKey
        }
    });
    if (!resp.ok) throw new Error(`Failed to revert config file ${filename} for instance ${instanceName} of ${integrationName}`);
}

export async function getAvailableIntegrationsForProvider(moduleName, providerName) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/integrations/available-for-provider?module=${encodeURIComponent(moduleName)}&provider=${encodeURIComponent(providerName)}`, {
        headers: {"X-Admin-API-Key": mgmtApiKey}
    });
    if (!resp.ok) throw new Error(`Failed to fetch available integrations for ${moduleName}/${providerName}`);
    return await resp.json();
}

export async function validateProviderConfig(module, provider, config) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/validate-provider`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": mgmtApiKey
        },
        body: JSON.stringify({
            module: module,
            provider: provider,
            config: config
        })
    });
    if (!resp.ok) throw new Error(`Failed to validate provider configuration for ${module}/${provider}`);
    return await resp.json();
}

/* Simulator endpoints */
export async function connectSimulator(entityId) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/simulator/connect`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": mgmtApiKey
        },
        body: JSON.stringify({entity_id: entityId})
    });
    if (!resp.ok) throw new Error("Failed to connect simulator");
    return await resp.json();
}

export async function disconnectSimulator(entityId) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/simulator/disconnect/${encodeURIComponent(entityId)}`, {
        method: "DELETE",
        headers: {
            "X-Admin-API-Key": mgmtApiKey
        }
    });
    if (!resp.ok) throw new Error("Failed to disconnect simulator");
    return await resp.json();
}

export async function sendSimulatorEvent(entityId, event) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/simulator/send-event`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": mgmtApiKey
        },
        body: JSON.stringify({entity_id: entityId, event: event})
    });
    if (!resp.ok) throw new Error("Failed to send simulator event");
    return await resp.json();
}

export async function getSimulatorEventHistory(entityId, limit = 100) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/simulator/event-history/${encodeURIComponent(entityId)}?limit=${limit}`, {
        headers: {
            "X-Admin-API-Key": mgmtApiKey
        }
    });
    if (!resp.ok) throw new Error("Failed to fetch simulator event history");
    return await resp.json();
}

export async function getSimulatorStatus(entityId) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/simulator/status/${encodeURIComponent(entityId)}`, {
        headers: {
            "X-Admin-API-Key": mgmtApiKey
        }
    });
    if (!resp.ok) throw new Error("Failed to fetch simulator status");
    return await resp.json();
}

export async function getSimulatorConnections() {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/simulator/connections`, {
        headers: {
            "X-Admin-API-Key": mgmtApiKey
        }
    });
    if (!resp.ok) throw new Error("Failed to fetch simulator connections");
    return await resp.json();
}

export async function getSimulatorEntities() {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/simulator/entities`, {
        headers: {
            "X-Admin-API-Key": mgmtApiKey
        }
    });
    if (!resp.ok) throw new Error("Failed to fetch simulator entities");
    return await resp.json();
}

/* Public endpoints for app name/version */
export async function getAppName() {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtPublicApiPath}/appname`);
    if (!resp.ok) throw new Error("Failed to fetch app name");
    const data = await resp.json();
    return data.appName;
}

export async function getAppVersion() {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtPublicApiPath}/appversion`);
    if (!resp.ok) throw new Error("Failed to fetch app version");
    const data = await resp.json();
    return data.appVersion;
}
