import test from 'node:test';
import assert from 'node:assert/strict';
import useUIModeStore, {
  UI_MODES,
  DEFAULT_UI_MODE,
  UI_MODE_RANK,
  isKnownMode,
  isModeAllowed,
} from './uiModeStore.js';

test('defaults to Simple mode', () => {
  const store = useUIModeStore.getState();
  assert.equal(store.mode, DEFAULT_UI_MODE);
  assert.equal(store.mode, 'simple');
});

test('exposes the three stacked modes in order', () => {
  const ids = UI_MODES.map((m) => m.id);
  assert.deepEqual(ids, ['simple', 'pro', 'dev']);
  assert.deepEqual(UI_MODE_RANK, { simple: 0, pro: 1, dev: 2 });
});

test('setMode stores a valid mode and falls back for unknown ids', () => {
  useUIModeStore.getState().setMode('dev');
  assert.equal(useUIModeStore.getState().mode, 'dev');

  useUIModeStore.getState().setMode('totally-bogus');
  assert.equal(useUIModeStore.getState().mode, DEFAULT_UI_MODE);
});

test('syncFromConfig reads general.uimode and falls back to the default', () => {
  useUIModeStore.getState().syncFromConfig({ general: { uimode: 'pro' } });
  assert.equal(useUIModeStore.getState().mode, 'pro');

  useUIModeStore.getState().syncFromConfig({ general: { uimode: 'made-up' } });
  assert.equal(useUIModeStore.getState().mode, DEFAULT_UI_MODE);

  useUIModeStore.getState().syncFromConfig({});
  assert.equal(useUIModeStore.getState().mode, DEFAULT_UI_MODE);
});

test('isKnownMode accepts only the three defined modes', () => {
  assert.equal(isKnownMode('simple'), true);
  assert.equal(isKnownMode('pro'), true);
  assert.equal(isKnownMode('dev'), true);
  assert.equal(isKnownMode('expert'), false);
  assert.equal(isKnownMode(undefined), false);
});

test('isModeAllowed implements the stacking rules', () => {
  // Simple mode: only simple items.
  assert.equal(isModeAllowed('simple', 'simple'), true);
  assert.equal(isModeAllowed('simple', 'pro'), false);
  assert.equal(isModeAllowed('simple', 'dev'), false);

  // Pro mode: simple + pro items.
  assert.equal(isModeAllowed('pro', 'simple'), true);
  assert.equal(isModeAllowed('pro', 'pro'), true);
  assert.equal(isModeAllowed('pro', 'dev'), false);

  // Dev mode: everything.
  assert.equal(isModeAllowed('dev', 'simple'), true);
  assert.equal(isModeAllowed('dev', 'pro'), true);
  assert.equal(isModeAllowed('dev', 'dev'), true);

  // Unknown modes/requirements degrade to the default (simple) rank.
  assert.equal(isModeAllowed('bogus', 'simple'), true);
  assert.equal(isModeAllowed('simple', 'bogus'), true);
});
