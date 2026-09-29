import { getManagementApiUrl, getApiPath, getAuthHeaders, handleResponse } from './baseService.js';

/**
 * Developer tools — read-only service (Phase 3-2).
 *
 * Every helper here hits a READ-ONLY endpoint added for the Developer-mode
 * Inspector and Dev Tools screens. There is deliberately no mutation helper:
 * the plan's safety rule ("no dev action skips the normal service layer") is
 * enforced by simply not offering a write path.
 */

/**
 * Fetch the single-entity Inspector overview (D1): modules, sessions, emotion
 * state, memory counts and conversations.
 *
 * @param {string} entityId
 * @returns {Promise<object>}
 */
export async function getDevInspector(entityId) {
    const resp = await fetch(
        `${getManagementApiUrl()}${getApiPath()}/development/inspector/entities/${encodeURIComponent(entityId)}`,
        { headers: getAuthHeaders() }
    );
    await handleResponse(resp, 'Failed to load inspector data');
    return await resp.json();
}

/**
 * Fetch recently logged prompts (D2), optionally scoped to an entity/type.
 *
 * @param {{ entityId?: string, promptType?: string, limit?: number }} [options]
 * @returns {Promise<Array<object>>}
 */
export async function listDevPrompts({ entityId, promptType, limit } = {}) {
    const params = new URLSearchParams();
    if (entityId) params.set('entityId', entityId);
    if (promptType) params.set('promptType', promptType);
    if (limit) params.set('limit', String(limit));
    const query = params.toString();
    const resp = await fetch(
        `${getManagementApiUrl()}${getApiPath()}/development/prompts${query ? `?${query}` : ''}`,
        { headers: getAuthHeaders() }
    );
    await handleResponse(resp, 'Failed to load prompts');
    const data = await resp.json();
    return data?.prompts || [];
}

/**
 * Fetch the applied database schema (D6). Mirrors the `dump-schema` output.
 *
 * @returns {Promise<Array<{type: string, name: string, sql: string}>>}
 */
export async function getDevSchema() {
    const resp = await fetch(
        `${getManagementApiUrl()}${getApiPath()}/development/schema`,
        { headers: getAuthHeaders() }
    );
    await handleResponse(resp, 'Failed to load schema');
    const data = await resp.json();
    return data?.schema || [];
}

/**
 * Fetch every migration with its applied flag (D6). Read-only — the UI never
 * applies or rolls back migrations.
 *
 * @returns {Promise<{migrations: Array<object>, total: number, applied: number, pending: number}>}
 */
export async function getDevMigrations() {
    const resp = await fetch(
        `${getManagementApiUrl()}${getApiPath()}/development/migrations`,
        { headers: getAuthHeaders() }
    );
    await handleResponse(resp, 'Failed to load migrations');
    const data = await resp.json();
    return {
        migrations: data?.migrations || [],
        total: data?.total || 0,
        applied: data?.applied || 0,
        pending: data?.pending || 0,
    };
}
