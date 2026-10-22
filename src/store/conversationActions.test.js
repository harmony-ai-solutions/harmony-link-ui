import test from 'node:test';
import assert from 'node:assert/strict';
import useToastStore, { clearToasts } from './toastStore.js';
import {
  CONVERSATION_ACTIONS,
  CONVERSATION_TOAST_KEYS,
  conversationToastKey,
  announceConversationAction,
} from './conversationActions.js';

test('exposes exactly the three Phase 02 actions', () => {
  assert.deepEqual(CONVERSATION_ACTIONS, ['pin', 'archive', 'mute']);
  assert.deepEqual(Object.keys(CONVERSATION_TOAST_KEYS).sort(), ['archive', 'mute', 'pin']);
});

test('maps applied and reverted directions to distinct keys', () => {
  assert.equal(conversationToastKey('pin', true), 'conversationPinned');
  assert.equal(conversationToastKey('pin', false), 'conversationUnpinned');
  assert.equal(conversationToastKey('archive', true), 'conversationArchived');
  assert.equal(conversationToastKey('archive', false), 'conversationUnarchived');
  assert.equal(conversationToastKey('mute', true), 'conversationMuted');
  assert.equal(conversationToastKey('mute', false), 'conversationUnmuted');
});

test('unknown actions resolve to null', () => {
  assert.equal(conversationToastKey('delete', true), null);
  assert.equal(conversationToastKey(undefined, true), null);
});

test('announceConversationAction pushes a success toast through translate', () => {
  clearToasts();
  const seen = [];
  const translate = (key) => {
    seen.push(key);
    return `translated:${key}`;
  };

  const id = announceConversationAction('mute', true, translate);
  assert.equal(typeof id, 'string');
  assert.deepEqual(seen, ['toast.conversationMuted']);

  const [toast] = useToastStore.getState().toasts;
  assert.equal(toast.kind, 'success');
  assert.equal(toast.message, 'translated:toast.conversationMuted');
});

test('announceConversationAction stays silent for unknown actions or missing translate', () => {
  clearToasts();
  assert.equal(announceConversationAction('bogus', true, (k) => k), null);
  assert.equal(announceConversationAction('pin', true, null), null);
  assert.equal(useToastStore.getState().toasts.length, 0);
});
