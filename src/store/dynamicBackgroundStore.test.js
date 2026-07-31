import test from 'node:test';
import assert from 'node:assert/strict';
import useDynamicBackgroundStore, { BACKGROUND_VARIANTS, DEFAULT_VARIANT } from './dynamicBackgroundStore.js';

test('defaults to the Aurora style and syncs a configured variant', () => {
  const store = useDynamicBackgroundStore.getState();
  assert.equal(store.enabled, true);
  assert.equal(store.variant, 'aurora');
  assert.equal(store.auraEnabled, true);

  useDynamicBackgroundStore.getState().syncFromConfig({
    general: {
      animatedbackground: false,
      dynamicbackgroundvariant: 'sparkles',
      cursoraura: false,
    },
  });

  const updated = useDynamicBackgroundStore.getState();
  assert.equal(updated.enabled, false);
  assert.equal(updated.variant, 'sparkles');
  assert.equal(updated.auraEnabled, false);
});

test('exposes all four selectable variants', () => {
  const ids = BACKGROUND_VARIANTS.map((b) => b.id);
  assert.deepEqual(ids, ['aurora', 'shapes', 'sparkles', 'waves']);
});

test('setVariant stores a valid variant and falls back for unknown ids', () => {
  useDynamicBackgroundStore.setState({ enabled: true, variant: DEFAULT_VARIANT });

  useDynamicBackgroundStore.getState().setVariant('waves');
  assert.equal(useDynamicBackgroundStore.getState().variant, 'waves');

  useDynamicBackgroundStore.getState().setVariant('totally-bogus');
  assert.equal(useDynamicBackgroundStore.getState().variant, DEFAULT_VARIANT);
});

test('syncFromConfig ignores unknown variants and falls back to the default', () => {
  useDynamicBackgroundStore.getState().syncFromConfig({
    general: {
      animatedbackground: true,
      dynamicbackgroundvariant: 'made-up-variant',
    },
  });

  const updated = useDynamicBackgroundStore.getState();
  assert.equal(updated.enabled, true);
  assert.equal(updated.variant, DEFAULT_VARIANT);
});
