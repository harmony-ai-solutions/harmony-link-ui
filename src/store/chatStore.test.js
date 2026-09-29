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
    { interaction_id: 'old', last_activity_at: '2026-01-01T00:00:00Z' },
    { interaction_id: 'new', last_activity_at: '2026-01-03T00:00:00Z' },
  ];
  assert.deepEqual(sortConversations(list).map((c) => c.interaction_id), ['new', 'old']);
});

test('upsertConversation inserts, replaces and re-sorts', () => {
  const list = [{ interaction_id: 'a', last_activity_at: '2026-01-01T00:00:00Z' }];
  const inserted = upsertConversation(list, { interaction_id: 'b', last_activity_at: '2026-01-02T00:00:00Z' });
  assert.deepEqual(inserted.map((c) => c.interaction_id), ['b', 'a']);
  const replaced = upsertConversation(inserted, { interaction_id: 'a', last_activity_at: '2026-01-05T00:00:00Z' });
  assert.deepEqual(replaced.map((c) => c.interaction_id), ['a', 'b']);
  assert.equal(replaced.length, 2);
});

test('removeConversation drops by interaction id', () => {
  const list = [{ interaction_id: 'a' }, { interaction_id: 'b' }];
  assert.deepEqual(removeConversation(list, 'a').map((c) => c.interaction_id), ['b']);
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
