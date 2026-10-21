import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeMessages,
  prependOlderMessages,
  replaceMessage,
  removeMessage,
  messageDirection,
  isUnreadInbound,
  lastMessage,
  conversationPreview,
  truncatePreview,
  sortConversations,
  upsertConversation,
  removeConversation,
  conversationKey,
  normalizeChatConversation,
  setEntityFlag,
  isAnyTyping,
  partitionChatEntities,
  deriveParticipantKey,
  toTime,
} from './chatStoreUtils.js';

const msg = (id, createdAt, extra = {}) => ({
  id,
  created_at: createdAt,
  sender_entity_id: 'ai',
  content: id,
  message_type: 'text',
  is_read: true,
  ...extra,
});

test('mergeMessages adds new messages and keeps them ordered oldest-first', () => {
  const existing = [msg('b', '2026-01-02T00:00:00Z'), msg('a', '2026-01-01T00:00:00Z')];
  const merged = mergeMessages(existing, [msg('c', '2026-01-03T00:00:00Z')]);
  assert.deepEqual(merged.map((m) => m.id), ['a', 'b', 'c']);
});

test('mergeMessages never drops already-loaded pages', () => {
  const page1 = [msg('a', '2026-01-01T00:00:00Z'), msg('b', '2026-01-02T00:00:00Z')];
  const page2 = [msg('c', '2026-01-03T00:00:00Z')];
  const merged = mergeMessages(page1, page2);
  assert.equal(merged.length, 3);
  assert.ok(merged.some((m) => m.id === 'a'));
});

test('mergeMessages lets a fresher copy win (edits / read flags)', () => {
  const existing = [msg('a', '2026-01-01T00:00:00Z', { content: 'old', is_read: false })];
  const merged = mergeMessages(existing, { id: 'a', content: 'new', is_read: true });
  assert.equal(merged[0].content, 'new');
  assert.equal(merged[0].is_read, true);
});

test('mergeMessages does not mutate its inputs', () => {
  const existing = [msg('a', '2026-01-01T00:00:00Z')];
  const incoming = [msg('b', '2026-01-02T00:00:00Z')];
  mergeMessages(existing, incoming);
  assert.equal(existing.length, 1);
  assert.equal(incoming.length, 1);
});

test('prependOlderMessages collapses duplicates', () => {
  const current = [msg('b', '2026-01-02T00:00:00Z')];
  const older = [msg('a', '2026-01-01T00:00:00Z'), msg('b', '2026-01-02T00:00:00Z')];
  const merged = prependOlderMessages(current, older);
  assert.deepEqual(merged.map((m) => m.id), ['a', 'b']);
});

test('replaceMessage updates in place and appends when missing', () => {
  const messages = [msg('a', '2026-01-01T00:00:00Z'), msg('b', '2026-01-02T00:00:00Z')];
  const updated = replaceMessage(messages, { id: 'a', content: 'edited', is_edited: true });
  assert.equal(updated[0].content, 'edited');
  assert.equal(updated[0].is_edited, true);
  const appended = replaceMessage(messages, msg('c', '2026-01-03T00:00:00Z'));
  assert.equal(appended.length, 3);
});

test('removeMessage drops the row by id', () => {
  const messages = [msg('a', '2026-01-01T00:00:00Z'), msg('b', '2026-01-02T00:00:00Z')];
  assert.deepEqual(removeMessage(messages, 'a').map((m) => m.id), ['b']);
});

test('messageDirection treats own-entity senders as outbound', () => {
  assert.equal(messageDirection({ sender_entity_id: 'me' }, 'me'), 'out');
  assert.equal(messageDirection({ sender_entity_id: 'ai' }, 'me'), 'in');
});

test('isUnreadInbound only flags unread inbound messages', () => {
  assert.equal(isUnreadInbound({ sender_entity_id: 'ai', is_read: false }, 'me'), true);
  assert.equal(isUnreadInbound({ sender_entity_id: 'ai', is_read: true }, 'me'), false);
  assert.equal(isUnreadInbound({ sender_entity_id: 'me', is_read: false }, 'me'), false);
});

test('lastMessage returns the newest row', () => {
  assert.equal(lastMessage([msg('a', '2026-01-01T00:00:00Z'), msg('b', '2026-01-02T00:00:00Z')]).id, 'b');
  assert.equal(lastMessage([]), null);
});

test('conversationPreview renders media hints', () => {
  assert.equal(conversationPreview({ message_type: 'audio', content: '' }), '🎤 Voice message');
  assert.equal(conversationPreview({ message_type: 'image', content: '' }), '🖼️ Photo');
  assert.equal(conversationPreview({ message_type: 'text', content: 'hi' }), 'hi');
  assert.equal(conversationPreview(null), '');
});

test('truncatePreview caps long strings with an ellipsis', () => {
  assert.equal(truncatePreview('hello', 10), 'hello');
  assert.equal(truncatePreview('abcdefghij', 5), 'abcd…');
});

test('sortConversations orders by most recent activity', () => {
  const list = [
    { participant_key: 'a+b', interaction_id: 'old', last_activity_at: '2026-01-01T00:00:00Z' },
    { participant_key: 'a+c', interaction_id: 'new', last_activity_at: '2026-01-03T00:00:00Z' },
  ];
  assert.deepEqual(sortConversations(list).map((c) => c.participant_key), ['a+c', 'a+b']);
});

test('upsertConversation inserts, replaces and re-sorts', () => {
  const list = [{ participant_key: 'a+b', interaction_id: 'i1', last_activity_at: '2026-01-01T00:00:00Z' }];
  const inserted = upsertConversation(list, { participant_key: 'a+c', interaction_id: 'i2', last_activity_at: '2026-01-02T00:00:00Z' });
  assert.deepEqual(inserted.map((c) => c.participant_key), ['a+c', 'a+b']);
  const replaced = upsertConversation(inserted, { participant_key: 'a+b', interaction_id: 'i1', last_activity_at: '2026-01-05T00:00:00Z' });
  assert.deepEqual(replaced.map((c) => c.participant_key), ['a+b', 'a+c']);
  assert.equal(replaced.length, 2);
});

test('removeConversation drops by participant key', () => {
  const list = [{ participant_key: 'a+b' }, { participant_key: 'a+c' }];
  assert.deepEqual(removeConversation(list, 'a+b').map((c) => c.participant_key), ['a+c']);
});

// Regression (D3): the engine mints a NEW interaction when the participant set
// changes, so participant_key : interactions is 1:many. Threads must be keyed
// by participant_key — a new interaction id for the same pair REPLACES the row
// instead of adding a duplicate thread.
test('upsertConversation keys on participant_key, not interaction_id', () => {
  const list = [{ participant_key: 'a+b', interaction_id: 'i1', last_activity_at: '2026-01-01T00:00:00Z' }];
  const reopened = upsertConversation(list, {
    participant_key: 'a+b',
    interaction_id: 'i2', // new interaction, same conversation
    last_activity_at: '2026-01-09T00:00:00Z',
  });
  assert.equal(reopened.length, 1);
  assert.equal(reopened[0].interaction_id, 'i2');

  // Rows without a participant_key cannot identify a thread and are ignored.
  assert.equal(upsertConversation(list, { interaction_id: 'i3' }).length, 1);

  // Same interaction id under a different key is a different conversation.
  const two = upsertConversation(reopened, { participant_key: 'a+c', interaction_id: 'i2' });
  assert.equal(two.length, 2);
});

test('conversationKey exposes the participant key only', () => {
  assert.equal(conversationKey({ participant_key: 'a+b', interaction_id: 'i1' }), 'a+b');
  assert.equal(conversationKey({ interaction_id: 'i1' }), '');
  assert.equal(conversationKey(null), '');
});

test('normalizeChatConversation derives the partner and parses participant_ids', () => {
  const row = {
    interaction_id: 'i9',
    participant_key: 'a+b',
    interaction_scope: 'private',
    participant_ids: '["a","b"]',
    unread_count: 2,
    last_message: {
      id: 'm1',
      entity_id: 'a',
      sender_entity_id: 'b',
      interaction_id: 'i8',
      content: 'hi',
      message_type: 'text',
      audio_mime_type: 'audio/mpeg',
      created_at: '2026-01-02T00:00:00Z',
    },
  };
  const conv = normalizeChatConversation(row, 'a');
  assert.equal(conv.participant_key, 'a+b');
  assert.equal(conv.entity_id, 'a');
  assert.deepEqual(conv.participant_ids, ['a', 'b']);
  assert.equal(conv.partner_entity_id, 'b');
  assert.equal(conv.unread_count, 2);
  assert.equal(conv.last_activity_at, '2026-01-02T00:00:00Z');
  assert.equal(conv.last_message.has_audio, true);
  assert.equal(conv.last_message.has_image, false);
});

test('normalizeChatConversation tolerates a malformed participant_ids column', () => {
  const conv = normalizeChatConversation({ participant_key: 'a+b', participant_ids: 'not json' }, 'a');
  assert.deepEqual(conv.participant_ids, []);
  assert.equal(conv.partner_entity_id, '');
  assert.equal(conv.last_message, null);
});

test('setEntityFlag sets true and deletes when false', () => {
  const withTyping = setEntityFlag({}, 'ai', true);
  assert.equal(withTyping.ai, true);
  assert.equal(isAnyTyping(withTyping), true);
  const cleared = setEntityFlag(withTyping, 'ai', false);
  assert.equal(cleared.ai, undefined);
  assert.equal(isAnyTyping(cleared), false);
});

test('partitionChatEntities separates partners from personas and hides disabled AI', () => {
  const { partners, personas } = partitionChatEntities([
    { id: 'ai1', entity_type: 'ai' },
    { id: 'ai2', entity_type: 'ai', is_disabled: true },
    { id: 'me', entity_type: 'user' },
  ]);
  assert.deepEqual(partners.map((e) => e.id), ['ai1']);
  assert.deepEqual(personas.map((e) => e.id), ['me']);
});

test('deriveParticipantKey is deterministic for a private pair', () => {
  assert.equal(deriveParticipantKey(['b', 'a'], 'a', 'private'), 'a:b');
  assert.equal(deriveParticipantKey(['a', 'b'], 'b', 'private'), 'a:b');
});

test('toTime parses timestamps and treats garbage as zero', () => {
  assert.ok(toTime('2026-01-01T00:00:00Z') > 0);
  assert.equal(toTime('not-a-date'), 0);
  assert.equal(toTime(null), 0);
});
