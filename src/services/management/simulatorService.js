import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

/* Simulator endpoints */
export async function connectSimulator(entityId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/simulator/connect`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({entity_id: entityId})
    });
    await handleResponse(resp, "Failed to connect simulator");
    return await resp.json();
}

export async function disconnectSimulator(entityId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/simulator/disconnect/${encodeURIComponent(entityId)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to disconnect simulator");
    return await resp.json();
}

export async function sendSimulatorEvent(entityId, event) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/simulator/send-event`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({entity_id: entityId, event: event})
    });
    await handleResponse(resp, "Failed to send simulator event");
    return await resp.json();
}

export async function getSimulatorEventHistory(entityId, limit = 100) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/simulator/event-history/${encodeURIComponent(entityId)}?limit=${limit}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to fetch simulator event history");
    return await resp.json();
}

export async function getSimulatorGroupedEventHistory(entityId, limit = 100) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/simulator/event-history-grouped/${encodeURIComponent(entityId)}?limit=${limit}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to fetch simulator grouped event history");
    return await resp.json();
}

export async function getSimulatorStatus(entityId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/simulator/status/${encodeURIComponent(entityId)}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to fetch simulator status");
    return await resp.json();
}

export async function getSimulatorConnections() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/simulator/connections`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to fetch simulator connections");
    return await resp.json();
}

export async function getSimulatorEntities() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/simulator/entities`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to fetch simulator entities");
    return await resp.json();
}
