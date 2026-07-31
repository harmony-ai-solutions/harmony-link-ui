import test from 'node:test';
import assert from 'node:assert/strict';
import useDynamicBackgroundStore, { BACKGROUND_VARIANTS, DEFAULT_VARIANT, AURA_STYLES, DEFAULT_AURA_STYLE } from './dynamicBackgroundStore.js';

test('defaults to the Aurora style and syncs a configured variant', () => {
  const store = useDynamicBackgroundStore.getState();
  assert.equal(store.enabled, true);
  assert.equal(store.variant, 'aurora');
  assert.equal(store.auraEnabled, true);
  assert.equal(store.auraStyle, 'glow');

  useDynamicBackgroundStore.getState().syncFromConfig({
    general: {
      animatedbackground: false,
      dynamicbackgroundvariant: 'sparkles',
      cursoraura: false,
      cursoraurastyle: 'embers',
    },
  });

  const updated = useDynamicBackgroundStore.getState();
  assert.equal(updated.enabled, false);
  assert.equal(updated.variant, 'sparkles');
  assert.equal(updated.auraEnabled, false);
  assert.equal(updated.auraStyle, 'embers');
});

test('exposes all four selectable variants', () => {
  const ids = BACKGROUND_VARIANTS.map((b) => b.id);
  assert.deepEqual(ids, ['aurora', 'shapes', 'sparkles', 'waves']);
});

test('exposes all four selectable aura styles', () => {
  const ids = AURA_STYLES.map((s) => s.id);
  assert.deepEqual(ids, ['glow', 'ring', 'trail', 'embers']);
});

test('setVariant stores a valid variant and falls back for unknown ids', () => {
  useDynamicBackgroundStore.setState({ enabled: true, variant: DEFAULT_VARIANT });

  useDynamicBackgroundStore.getState().setVariant('waves');
  assert.equal(useDynamicBackgroundStore.getState().variant, 'waves');

  useDynamicBackgroundStore.getState().setVariant('totally-bogus');
  assert.equal(useDynamicBackgroundStore.getState().variant, DEFAULT_VARIANT);
});

test('setAuraStyle stores a valid style and falls back for unknown ids', () => {
  useDynamicBackgroundStore.setState({ auraStyle: DEFAULT_AURA_STYLE });

  useDynamicBackgroundStore.getState().setAuraStyle('ring');
  assert.equal(useDynamicBackgroundStore.getState().auraStyle, 'ring');

  useDynamicBackgroundStore.getState().setAuraStyle('totally-bogus');
  assert.equal(useDynamicBackgroundStore.getState().auraStyle, DEFAULT_AURA_STYLE);
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

test('syncFromConfig ignores unknown aura styles and falls back to the default', () => {
  useDynamicBackgroundStore.getState().syncFromConfig({
    general: {
      animatedbackground: true,
      dynamicbackgroundvariant: 'aurora',
      cursoraurastyle: 'made-up-style',
    },
  });

  const updated = useDynamicBackgroundStore.getState();
  assert.equal(updated.auraStyle, DEFAULT_AURA_STYLE);
});
