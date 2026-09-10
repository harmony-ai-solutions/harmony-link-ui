import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

export async function listEntities() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to list entities");
    const data = await resp.json();
    
    // Convert object format {id: {...}} to array format [{id: 'id', ...}]
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        return Object.entries(data).map(([id, entity]) => ({
            id,
            ...entity
        }));
    }
    
    return data;
}

export async function getEntity(id) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${id}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to get entity");
    return await resp.json();
}

/**
 * Create an AI entity via the server-derived-only contract (D15/D23/D66):
 * the engine derives the id from `name` (timestamped, D2) and defaults the
 * alias to the name — auto-suffixed on live collision (D30). `id` and
 * `alias` are server-assigned; requests carrying either are rejected with
 * 400, so none is ever sent here. `name` is a human name (spaces allowed)
 * and is never charset-validated client-side — reserved/empty names surface
 * as engine 400s through `handleResponse`.
 *
 * With `{ dedupeIdIfTaken: true }` the engine additionally resolves entity-id
 * collisions in-transaction — INCLUDING ids held by soft-deleted ghost rows,
 * which the live-only entity list cannot see. The 201 body echoes the
 * RESOLVED id: callers MUST use the returned `id` for all follow-ups
 * (selection/state), never the requested name.
 *
 * @param {string} name - Human display name; wire-only input that derives
 *   the id and defaults the alias.
 * @param {string|null} characterProfileId - Linked character profile id.
 * @param {{ dedupeIdIfTaken?: boolean }} [options] - `dedupeIdIfTaken`: let
 *   the engine resolve id collisions (soft-delete aware) instead of
 *   rejecting the create with 400.
 * @returns {Promise<{id: string, character_profile_id: string|null, entity_type: string|null, alias: string|null}>}
 *   `id` is the SERVER-derived id from the 201 body.
 */
export async function createEntity(name, characterProfileId, { dedupeIdIfTaken } = {}) {
    const body = { name, character_profile_id: characterProfileId };
    if (dedupeIdIfTaken) {
        body.dedupe_id_if_taken = true;
    }
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(body)
    });
    await handleResponse(resp, "Failed to create entity");
    return await resp.json();
}

/**
 * Create a persona (user-type) entity via the same server-derived-only
 * contract as {@link createEntity}, plus the `entity_type: 'user'` marker
 * (D66: it stays optional engine-side exactly as today — persona creates
 * depend on it) so the engine treats it as a chat-only persona rather than
 * an AI entity. Same derivation semantics: the engine mints the id from
 * `name`, defaults the alias (auto-suffixed on live collision, D30), and the
 * 201 body echoes the RESOLVED id — use the returned `id`, not the name.
 * @param {string} name - Human display name for the persona.
 * @param {string} characterProfileId - Linked character profile id.
 * @param {{ dedupeIdIfTaken?: boolean }} [options] - `dedupeIdIfTaken`: let
 *   the engine resolve id collisions (soft-delete aware) instead of
 *   rejecting the create with 400.
 * @returns {Promise<{id: string, character_profile_id: string|null, entity_type: string, alias: string|null}>}
 *   `id` is the SERVER-derived id from the 201 body.
 */
export async function createPersonaEntity(name, characterProfileId, { dedupeIdIfTaken } = {}) {
    const body = { name, character_profile_id: characterProfileId, entity_type: 'user' };
    if (dedupeIdIfTaken) {
        body.dedupe_id_if_taken = true;
    }
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(body)
    });
    await handleResponse(resp, "Failed to create entity");
    return await resp.json();
}

/**
 * Duplicate an AI entity in ONE atomic engine transaction
 * (`POST /entities/:id/duplicate`, no body). The copy gets a server-derived
 * id (copy-suffix series, soft-delete aware) and alias ("Name 2" series,
 * live-aware), verbatim copies of the source's module mappings +
 * lifecycle_config, and the SAME character profile linked live; its
 * muted/disabled flags are reset. AI entities only — the engine answers
 * 404 {"error":"entity not found"} and
 * 400 {"error":"persona entities cannot be duplicated"} with clean bodies
 * that `handleResponse` surfaces verbatim.
 * @param {string} entityId - Source entity id.
 * @returns {Promise<{id: string, character_profile_id: string|null, entity_type: string, alias: string}>}
 *   The parsed 201 body of the NEW copy — `id` is server-derived and differs
 *   from the source id whenever a suffix was needed (callers must use it).
 */
export async function duplicateEntity(entityId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${encodeURIComponent(entityId)}/duplicate`, {
        method: "POST",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to duplicate entity");
    return await resp.json();
}

export async function updateEntity(id, characterProfileId, lifecycleConfig, alias) {
    const body = {};
    if (characterProfileId !== undefined && characterProfileId !== null) {
        body.character_profile_id = characterProfileId;
    }
    if (lifecycleConfig !== undefined && lifecycleConfig !== null) {
        body.lifecycle_config = lifecycleConfig;
    }
    if (alias !== undefined && alias !== null) {
        body.alias = alias;
    }
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${id}`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify(body)
    });
    await handleResponse(resp, "Failed to update entity");
    return await resp.json();
}

export async function updateEntityMappings(id, mappings) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${id}/mappings`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify(mappings)
    });
    await handleResponse(resp, "Failed to update entity mappings");
    return await resp.json();
}

export async function deleteEntity(id) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to delete entity");
}

// D22: entity id-rename is REMOVED — the engine endpoint was deleted and ids
// are stable for life (D2/D23); "rename" is always an alias edit via
// `updateEntity`. The FE rename service and every caller were deleted with it.

export async function resetEntityLifecycleConfig(entityId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${entityId}/reset-lifecycle-config`, {
        method: "POST",
        headers: getJsonHeaders()
    });
    await handleResponse(resp, "Failed to reset entity lifecycle config");
    return await resp.json();
}

/**
 * Bulk active-session listing (GET /entities/sessions). Wire shape:
 * `{ [entityId]: [{device_type, handler_id}] }` — entities WITHOUT active
 * sessions are absent from the map, an empty registry serializes as `{}`.
 * Suspended (resumable, within-TTL) phone sessions are excluded engine-side:
 * only actively connected sessions count as "active" (presence badge).
 * @returns {Promise<Record<string, Array<{device_type: string, handler_id: string}>>>}
 */
export async function getEntitySessions() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/sessions`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to list entity sessions");
    return await resp.json();
}

/**
 * Force-disconnect EVERY session bound to the entity
 * (POST /entities/:id/sessions/stop). Active AND suspended sessions are
 * evicted; other entities are untouched; stopping an idle entity is a 200
 * no-op. The response echoes `{status, stopped}` — `stopped` is the number
 * of sessions that were bound to the entity before the eviction.
 * @param {string} entityId
 * @returns {Promise<{status: string, stopped: number}>}
 */
export async function stopEntitySessions(entityId) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${encodeURIComponent(entityId)}/sessions/stop`, {
        method: "POST",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to stop entity sessions");
    return await resp.json();
}

/**
 * Enable/disable toggle (PUT /entities/:id with `is_disabled`) — the same
 * synced entity flag the apps' Disabled-AIs screens read and the engine's
 * automation gates honour. The engine stamps updated_at so the change
 * propagates to connected apps via sync. Omit-not-supported: always send the
 * explicit boolean.
 * @param {string} entityId
 * @param {boolean} disabled
 */
export async function setEntityDisabled(entityId, disabled) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/entities/${encodeURIComponent(entityId)}`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify({ is_disabled: disabled })
    });
    await handleResponse(resp, "Failed to update entity disabled flag");
    return await resp.json();
}
