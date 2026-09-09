/**
 * Entity session presence helpers — the FE side of
 * GET /api/entities/sessions (`{ [entityId]: [{device_type, handler_id}] }`).
 *
 * Pure and defensive: the map comes from a polled fetch and may be null
 * before the first load, and individual entries may be malformed — the list
 * must still render (all-null → "no active sessions" semantics).
 */

/**
 * Number of ACTIVE sessions the entity currently holds.
 * @param {Record<string, Array<{device_type: string, handler_id: string}>>|null} sessionsMap
 * @param {string|null|undefined} entityId
 * @returns {number}
 */
export function countActiveSessions(sessionsMap, entityId) {
    if (!sessionsMap || !entityId) return 0;
    const sessions = sessionsMap[entityId];
    if (!Array.isArray(sessions)) return 0;
    return sessions.length;
}

/**
 * Boolean predicate over {@link countActiveSessions} — drives the green
 * presence bubble on the entity list rows.
 * @returns {boolean}
 */
export function entityHasActiveSessions(sessionsMap, entityId) {
    return countActiveSessions(sessionsMap, entityId) > 0;
}

/**
 * Filter the entity list by presence.
 * @param {Array<{id: string}>|null} entities
 * @param {Record<string, Array>|null} sessionsMap
 * @param {'all'|'active'|undefined} filter - unknown values fall back to 'all'
 * @returns {Array} the filtered entities (never null)
 */
export function filterEntitiesByPresence(entities, sessionsMap, filter) {
    if (!Array.isArray(entities)) return [];
    if (filter !== 'active') return entities;
    return entities.filter(entity => entityHasActiveSessions(sessionsMap, entity.id));
}
