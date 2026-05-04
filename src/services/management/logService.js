import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, getApiKey, handleResponse } from './baseService.js';

/**
 * Fetch logs from the ring buffer with optional filters.
 */
export async function fetchLogs(params = {}) {
    const query = new URLSearchParams();
    if (params.component) query.set('component', params.component);
    if (params.entityId) query.set('entityId', params.entityId);
    if (params.minLevel) query.set('minLevel', params.minLevel);
    if (params.search) query.set('search', params.search);
    if (params.since) query.set('since', params.since);
    if (params.isPrompt !== undefined && params.isPrompt !== null) query.set('isPrompt', String(params.isPrompt));
    if (params.promptType) query.set('promptType', params.promptType);
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));

    const queryString = query.toString();
    const url = `${getManagementApiUrl()}${getApiPath()}/development/logs${queryString ? '?' + queryString : ''}`;
    
    const response = await fetch(url, {
        headers: getAuthHeaders(),
    });
    await handleResponse(response, "Failed to fetch logs");
    return await response.json();
}

/**
 * Get filtered log count.
 */
export async function getLogCount(params = {}) {
    const query = new URLSearchParams();
    if (params.component) query.set('component', params.component);
    if (params.entityId) query.set('entityId', params.entityId);
    if (params.minLevel) query.set('minLevel', params.minLevel);
    if (params.search) query.set('search', params.search);

    const queryString = query.toString();
    const url = `${getManagementApiUrl()}${getApiPath()}/development/logs/count${queryString ? '?' + queryString : ''}`;
    
    const response = await fetch(url, {
        headers: getAuthHeaders(),
    });
    await handleResponse(response, "Failed to get log count");
    return await response.json();
}

/**
 * Get current log level configuration.
 */
export async function fetchLogLevels() {
    const response = await fetch(`${getManagementApiUrl()}${getApiPath()}/development/logs/level`, {
        headers: getAuthHeaders(),
    });
    await handleResponse(response, "Failed to fetch log levels");
    return await response.json();
}

/**
 * Update log level configuration.
 */
export async function updateLogLevels(config) {
    const response = await fetch(`${getManagementApiUrl()}${getApiPath()}/development/logs/level`, {
        method: 'PUT',
        headers: getJsonHeaders(),
        body: JSON.stringify(config),
    });
    await handleResponse(response, "Failed to update log levels");
    return await response.json();
}

/**
 * Get list of known log component names.
 */
export async function fetchLogComponents() {
    const response = await fetch(`${getManagementApiUrl()}${getApiPath()}/development/logs/components`, {
        headers: getAuthHeaders(),
    });
    await handleResponse(response, "Failed to fetch components");
    return await response.json();
}

/**
 * Get list of known entity IDs from logs.
 */
export async function fetchLogEntities() {
    const response = await fetch(`${getManagementApiUrl()}${getApiPath()}/development/logs/entities`, {
        headers: getAuthHeaders(),
    });
    await handleResponse(response, "Failed to fetch entities");
    return await response.json();
}

/**
 * Get list of known prompt types from log entries.
 */
export async function fetchLogPromptTypes() {
    const response = await fetch(`${getManagementApiUrl()}${getApiPath()}/development/logs/prompt-types`, {
        headers: getAuthHeaders(),
    });
    await handleResponse(response, "Failed to fetch prompt types");
    return await response.json();
}

/**
 * Build the WebSocket URL for log streaming.
 * Includes apiKey as a query parameter since browsers cannot set WS headers.
 */
export function getLogStreamUrl() {
    const baseUrl = getManagementApiUrl();
    const url = new URL(baseUrl);
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${url.host}${getApiPath()}/development/logs/stream?apiKey=${encodeURIComponent(getApiKey())}`;
}