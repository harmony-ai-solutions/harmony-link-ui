import test from 'node:test';
import assert from 'node:assert/strict';
import useToastStore, {
  toast,
  pushToast,
  clearToasts,
  MAX_VISIBLE_TOASTS,
  DEFAULT_TOAST_TIMEOUT_MS,
  ERROR_TOAST_TIMEOUT_MS,
  toastLifetimeFor,
  normalizeToastInput,
} from './toastStore.js';

/** Snapshot the current toasts (ids + messages + kinds). */
const current = () => useToastStore.getState().toasts.map((t) => ({ id: t.id, message: t.message, kind: t.kind }));

const reset = () => {
  clearToasts();
};

test('starts empty', () => {
  reset();
  assert.deepEqual(useToastStore.getState().toasts, []);
});

test('pushToast normalises a bare string to an info toast', () => {
  reset();
  pushToast('hello');
  const [only] = useToastStore.getState().toasts;
  assert.equal(only.message, 'hello');
  assert.equal(only.kind, 'info');
});

test('normalizeToastInput rejects unknown kinds and non-object input', () => {
  assert.deepEqual(normalizeToastInput('x'), { kind: 'info', message: 'x' });
  assert.equal(normalizeToastInput({ kind: 'nope', message: 'x' }).kind, 'info');
  assert.equal(normalizeToastInput({ kind: 'error', message: 42 }).message, '42');
  assert.equal(normalizeToastInput(null).message, '');
  assert.equal(normalizeToastInput(undefined).message, '');
});

test('toastLifetimeFor honours explicit positive, sticky 0, and per-kind defaults', () => {
  assert.equal(toastLifetimeFor('success'), DEFAULT_TOAST_TIMEOUT_MS);
  assert.equal(toastLifetimeFor('info'), DEFAULT_TOAST_TIMEOUT_MS);
  assert.equal(toastLifetimeFor('error'), ERROR_TOAST_TIMEOUT_MS);
  assert.equal(toastLifetimeFor('success', 1234), 1234);
  assert.equal(toastLifetimeFor('error', 1234), 1234);
  assert.equal(toastLifetimeFor('success', 0), 0);
  assert.equal(toastLifetimeFor('success', -5), DEFAULT_TOAST_TIMEOUT_MS);
  assert.equal(toastLifetimeFor('success', 'soon'), DEFAULT_TOAST_TIMEOUT_MS);
});

test('queue is capped: pushing past the cap drops the OLDEST toast', () => {
  reset();
  for (let i = 1; i <= MAX_VISIBLE_TOASTS + 2; i += 1) {
    pushToast({ kind: 'success', message: `m${i}`, timeout: 0 });
  }
  const messages = current().map((t) => t.message);
  assert.equal(messages.length, MAX_VISIBLE_TOASTS);
  // m1 and m2 were evicted; the newest survived.
  assert.deepEqual(messages, ['m3', 'm4', 'm5', 'm6']);
});

test('three toasts stack in push order and dismiss independently', () => {
  reset();
  const a = pushToast({ kind: 'success', message: 'A', timeout: 0 });
  const b = pushToast({ kind: 'success', message: 'B', timeout: 0 });
  const c = pushToast({ kind: 'info', message: 'C', timeout: 0 });

  assert.deepEqual(current().map((t) => t.message), ['A', 'B', 'C']);

  useToastStore.getState().dismissToast(b);
  assert.deepEqual(current().map((t) => t.message), ['A', 'C']);
  assert.deepEqual([a, c].every(Boolean), true);

  useToastStore.getState().dismissToast(a);
  assert.deepEqual(current().map((t) => t.message), ['C']);
});

test('dismissing an unknown id is a no-op and keeps the same array', () => {
  reset();
  pushToast({ message: 'only', timeout: 0 });
  const before = useToastStore.getState().toasts;
  useToastStore.getState().dismissToast('does-not-exist');
  assert.equal(useToastStore.getState().toasts, before);
});

test('auto-dismiss fires after the configured timeout', async () => {
  reset();
  pushToast({ kind: 'success', message: 'short', timeout: 25 });
  assert.equal(useToastStore.getState().toasts.length, 1);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(useToastStore.getState().toasts.length, 0);
});

test('manual dismiss cancels the pending timer (no double removal)', async () => {
  reset();
  const id = pushToast({ kind: 'success', message: 'manual', timeout: 25 });
  useToastStore.getState().dismissToast(id);
  assert.equal(useToastStore.getState().toasts.length, 0);
  // Let the original timer window elapse — it must not throw or resurrect.
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(useToastStore.getState().toasts.length, 0);
});

test('timeout 0 keeps a toast until dismissed', async () => {
  reset();
  pushToast({ kind: 'error', message: 'sticky', timeout: 0 });
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(useToastStore.getState().toasts.length, 1);
});

test('clearToasts empties the queue', () => {
  reset();
  toast.success('one');
  toast.error('two');
  assert.equal(useToastStore.getState().toasts.length, 2);
  toast.clear();
  assert.deepEqual(useToastStore.getState().toasts, []);
});

test('toast helpers set the right kind', () => {
  reset();
  toast.success('s');
  toast.error('e');
  toast.info('i');
  assert.deepEqual(current().map((t) => t.kind), ['success', 'error', 'info']);
});

test('pushing a toast returns its id', () => {
  reset();
  const id = toast.success('x');
  assert.equal(typeof id, 'string');
  assert.equal(useToastStore.getState().toasts[0].id, id);
});
