import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

/* Development endpoints for entity testing */
export async function getConnectedEntities() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/development/entities`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to fetch connected entities");
    return await resp.json();
}

export async function getEntityDetails(entityId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/development/entities/${encodeURIComponent(entityId)}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to fetch entity details");
    return await resp.json();
}

export async function sendTestActionGraph(entityId, actionGraph) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/development/entities/${encodeURIComponent(entityId)}/test`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(actionGraph)
    });
    await handleResponse(resp, "Failed to send test ActionGraph");
    return await resp.json();
}
