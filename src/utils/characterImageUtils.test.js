import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPrimaryImage, resolveImageVariant } from './characterImageUtils.js';

test('selectPrimaryImage prefers the primary image, then the first', () => {
  const first = { id: 'a', is_primary: false };
  const primary = { id: 'b', is_primary: true };
  assert.equal(selectPrimaryImage([first, primary]), primary);
  assert.equal(selectPrimaryImage([first]), first);
  assert.equal(selectPrimaryImage([]), null);
  assert.equal(selectPrimaryImage(null), null);
});

test('resolveImageVariant maps the thumbnail tri-state onto a request variant', () => {
  // ready / pending both have a servable preview (pending is generated lazily).
  assert.equal(resolveImageVariant({ thumbnail_state: 'ready' }), 'thumb');
  assert.equal(resolveImageVariant({ thumbnail_state: 'pending' }), 'thumb');
  // unavailable has no preview — fetch the original instead.
  assert.equal(resolveImageVariant({ thumbnail_state: 'unavailable' }), null);
  // Missing metadata degrades to a thumb request (engine self-heals / falls back).
  assert.equal(resolveImageVariant({}), 'thumb');
  // An original-only request stays original regardless of the state.
  assert.equal(resolveImageVariant({ thumbnail_state: 'ready' }, null), null);
});
