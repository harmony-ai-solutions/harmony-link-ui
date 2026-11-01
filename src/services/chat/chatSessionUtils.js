/**
 * Desktop chat — participant-session helpers (the "N+1 session model").
 *
 * Every Soulbits Entity perceives an interaction SUBJECTIVELY: it owns its own
 * copy of the conversation, authored from its own perspective. The engine
 * expresses that as one interaction row (and therefore one POV copy of every
 * message) PER PARTICIPANT. A chat therefore needs one engine session
 * (WebSocket) per participant — the persona's AND each partner's — exactly
 * like the phone app's `startInteractionSession` (D-18/D-21).
 *
 * Pure functions only, so the socket-keying and relay-direction rules are
 * locked by `node --test` without the service layer's `import.meta.env` reads.
 */

/**
 * The participant set whose sessions belong to ONE chat.
 *
 * The companion (`entityId`) and the persona we chat as are always present:
 * a brand-new chat arrives with only the partner id (ChatView adds the persona
 * for the engine), and an inbox row may carry the set in any order. Duplicates
 * are collapsed; the empty ids are dropped.
 *
 * @param {{ entityId?: string, participantIds?: string[], participant_ids?: string[],
 *   personaId?: string }|null|undefined} conversation
 * @param {string} [fallbackPersonaId]
 * @returns {string[]} the entity ids, partner first
 */
export function chatParticipantSet(conversation, fallbackPersonaId = '') {
    const personaId = conversation?.personaId || fallbackPersonaId || '';
    const ids = [
        conversation?.entityId,
        ...(conversation?.participantIds || conversation?.participant_ids || []),
        personaId,
    ];
    const seen = new Set();
    const out = [];
    for (const id of ids) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push(id);
    }
    return out;
}

/**
 * The identity of the OPEN CHAT's session group (a local registry key — it is
 * never sent to the engine).
 *
 * `participant_key` is authoritative when the row carries one. A brand-new
 * chat has none yet, so the sorted participant set is used instead: it is
 * stable across renders and distinguishes two chats that share a persona
 * (Marcella+user vs Claire+user), which is exactly the race the phone app
 * scopes its connection ids against.
 *
 * @param {object|null|undefined} conversation
 * @param {string} [fallbackPersonaId]
 * @returns {string} '' when the conversation names no participant
 */
export function chatScopeKey(conversation, fallbackPersonaId = '') {
    if (!conversation) return '';
    const explicit = conversation.participantKey || conversation.participant_key || '';
    if (explicit) return explicit;
    const participants = chatParticipantSet(conversation, fallbackPersonaId);
    return participants.slice().sort().join('+');
}

/**
 * Registry key for ONE participant's socket.
 *
 * The participant set is part of the key on purpose: a persona socket must
 * belong to its chat, never be a shared `entity-user` slot. Sharing it made
 * two chats fight over the same session on the phone ("Already Connected" /
 * stale-socket failures, see EntitySessionService's connection-id comment).
 *
 * @param {string} scopeKey
 * @param {string} entityId
 * @returns {string}
 */
export function socketKey(scopeKey, entityId) {
    return `${scopeKey}::${entityId}`;
}

/** True when `entityId` is the persona whose POV the desktop reads/renders. */
export function isOwnSessionEntity(entityId, personaId) {
    return !!entityId && entityId === personaId;
}

/** Engine capability that marks a session as a POV AUTHOR (cognition). */
export const COGNITION_CAPABILITY = 'cognition';

/**
 * Whether an utterance that ARRIVED on `originEntityId`'s session must be
 * relayed to the other local participant sessions of the same chat.
 *
 * Mirrors the phone's `ChatroomPolicy.routeIncoming` (directional rule):
 *   - a cognition-bearing partner authors its own POV copy, so the OTHER
 *     participants (notably the persona session, whose engine-side Session
 *     Utterance Recorder writes the persona-POV copy) need the same payload;
 *   - the persona's OWN session never relays onward — forwarding it to the
 *     character would re-enter cognition and produce a second reply.
 *
 * The capability list comes from INIT_ENTITY SUCCESS. An unknown list is NOT
 * relay-readable, matching the phone: without cognition the session cannot
 * have authored a POV copy worth mirroring.
 *
 * @param {{ originEntityId?: string, originCapabilities?: string[],
 *   personaId?: string }} params
 * @returns {boolean}
 */
export function shouldRelayUtterance({ originEntityId, originCapabilities, personaId }) {
    if (!originEntityId || !personaId) return false;
    if (originEntityId === personaId) return false;
    return Array.isArray(originCapabilities)
        && originCapabilities.includes(COGNITION_CAPABILITY);
}

/**
 * The participant sessions that receive an OUTGOING utterance.
 *
 * The shipped policy is the phone's Chatroom: EVERY active participant sees
 * every utterance. That includes the persona's own session — that delivery is
 * what makes the engine's Session Utterance Recorder author the persona-POV
 * copy — and the partner's session, whose cognition is what answers.
 *
 * @param {Array<{ entityId: string, connected: boolean }>} sessions
 * @returns {string[]} entity ids, in the order given
 */
export function outgoingRecipients(sessions) {
    return (sessions || [])
        .filter((session) => session && session.entityId && session.connected)
        .map((session) => session.entityId);
}
