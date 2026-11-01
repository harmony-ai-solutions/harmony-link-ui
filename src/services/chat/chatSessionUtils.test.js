/**
 * Participant-session helpers — the N+1 model's keying and relay-direction
 * rules. Pure functions, so the invariants are locked without a socket.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    chatParticipantSet,
    chatScopeKey,
    socketKey,
    isOwnSessionEntity,
    shouldRelayUtterance,
    outgoingRecipients,
    COGNITION_CAPABILITY,
} from './chatSessionUtils.js';

test('chatParticipantSet always includes the persona and the companion', () => {
    // A brand-new chat arrives with only the partner id.
    assert.deepEqual(
        chatParticipantSet({ entityId: 'ai1', participantIds: ['ai1'] }, 'user'),
        ['ai1', 'user']
    );
    // An inbox row may carry the set in any order, duplicates included.
    assert.deepEqual(
        chatParticipantSet({ entityId: 'ai1', participantIds: ['user', 'ai1'], personaId: 'user' }, ''),
        ['ai1', 'user']
    );
    // Group threads keep every participant.
    assert.deepEqual(
        chatParticipantSet({ entityId: 'ai1', participantIds: ['ai1', 'ai2', 'user'] }, 'user'),
        ['ai1', 'ai2', 'user']
    );
    assert.deepEqual(chatParticipantSet(null, 'user'), ['user']);
});

test('chatScopeKey prefers the engine participant_key', () => {
    assert.equal(
        chatScopeKey({ participantKey: 'ai1:user', entityId: 'ai1', participantIds: ['ai1', 'user'] }, 'user'),
        'ai1:user'
    );
});

test('chatScopeKey derives a participant-set key for a brand-new chat', () => {
    // Sorted, so the same pair always resolves to the same session group.
    assert.equal(
        chatScopeKey({ entityId: 'ai1', participantIds: ['user', 'ai1'] }, 'user'),
        'ai1+user'
    );
    assert.equal(chatScopeKey(null, 'user'), '', 'no conversation, no session group');
    assert.equal(chatScopeKey({ entityId: 'ai1' }, ''), 'ai1');
});

test('socketKey encodes the chat, so two chats never share a persona socket', () => {
    assert.equal(socketKey('ai1:user', 'user'), 'ai1:user::user');
    assert.notEqual(socketKey('ai1:user', 'user'), socketKey('ai2:user', 'user'));
    assert.equal(socketKey('ai1:user', 'ai1'), 'ai1:user::ai1');
});

test('isOwnSessionEntity only matches the persona', () => {
    assert.equal(isOwnSessionEntity('user', 'user'), true);
    assert.equal(isOwnSessionEntity('ai1', 'user'), false);
    assert.equal(isOwnSessionEntity('', 'user'), false);
});

// Relative to the phone's ChatroomPolicy.routeIncoming (directional rule).
test('shouldRelayUtterance mirrors only a cognition-bearing partner session', () => {
    const base = { originEntityId: 'ai1', personaId: 'user' };
    assert.equal(shouldRelayUtterance({ ...base, originCapabilities: ['chat', COGNITION_CAPABILITY] }), true);
    // Unknown capabilities are not relay-readable (phone parity).
    assert.equal(shouldRelayUtterance({ ...base, originCapabilities: [] }), false);
    assert.equal(shouldRelayUtterance({ ...base, originCapabilities: undefined }), false);
    // A session without cognition already authored nothing to mirror.
    assert.equal(shouldRelayUtterance({ ...base, originCapabilities: ['chat'] }), false);
});

test('shouldRelayUtterance never forwards the persona session onward', () => {
    // Relaying the persona's own copy to the character would re-enter cognition
    // and produce a second reply (loop safety).
    assert.equal(
        shouldRelayUtterance({ originEntityId: 'user', personaId: 'user', originCapabilities: [COGNITION_CAPABILITY] }),
        false
    );
    assert.equal(shouldRelayUtterance({ originEntityId: '', personaId: 'user', originCapabilities: ['cognition'] }), false);
    assert.equal(shouldRelayUtterance({ originEntityId: 'ai1', personaId: '', originCapabilities: ['cognition'] }), false);
});

test('outgoingRecipients is the chatroom rule: every ACTIVE participant', () => {
    assert.deepEqual(
        outgoingRecipients([
            { entityId: 'ai1', connected: true },
            { entityId: 'user', connected: true },
            { entityId: 'ai2', connected: false },
        ]),
        ['ai1', 'user']
    );
    assert.deepEqual(outgoingRecipients([]), []);
});
