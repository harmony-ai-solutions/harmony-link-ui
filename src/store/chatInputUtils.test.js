import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_IMAGES,
  MAX_IMAGE_BYTES,
  ENTER_HINT_STORAGE_KEY,
  DRAFT_KEY_PREFIX,
  EMOJI_SHORTCODES,
  activeShortcodeToken,
  applyShortcode,
  buildScenarioInsertion,
  clearDraft,
  composerState,
  dismissEnterHint,
  draftStorageKey,
  formatScenarioContext,
  isSendKey,
  loadDraft,
  placeholderKeyFor,
  planImageMessages,
  rejectionSummary,
  saveDraft,
  searchShortcodes,
  selectImages,
  shouldShowEnterHint,
} from './chatInputUtils.js';
import { entityScenario } from './chatStoreUtils.js';

/**
 * Task 02-8 — composer parity.
 *
 * Everything here is pure, so no DOM is involved: `localStorage` is replaced by
 * a tiny in-memory stand-in, which also lets the "storage unavailable" paths be
 * exercised by a storage object that throws.
 */

/** Minimal `Storage` stand-in. */
const makeStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    get size() {
      return map.size;
    },
  };
};

/** A storage whose every operation throws (private mode / quota). */
const brokenStorage = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('denied'); },
  removeItem: () => { throw new Error('denied'); },
};

const file = (name, size = 1024, type = 'image/png') => ({ name, size, type });

// ── 1. Multiple images ───────────────────────────────────────────────────

test('supports five images per send', () => {
  assert.equal(MAX_IMAGES, 5);
});

test('selectImages accepts up to the cap and rejects the rest', () => {
  const files = [
    file('a.png'), file('b.png'), file('c.png'), file('d.png'), file('e.png'), file('f.png'),
  ];
  const { accepted, rejected } = selectImages(files);
  assert.equal(accepted.length, 5);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].name, 'f.png');
  assert.equal(rejected[0].reason, 'limit');
});

test('selectImages counts already-staged images against the cap', () => {
  // Picking 3 then 3 more must not produce six.
  const { accepted, rejected } = selectImages(
    [file('d.png'), file('e.png'), file('f.png')],
    [file('a.png'), file('b.png'), file('c.png')],
  );
  assert.equal(accepted.length, 2);
  assert.deepEqual(accepted.map((f) => f.name), ['d.png', 'e.png']);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason, 'limit');
});

test('selectImages rejects a file over the size cap', () => {
  const { accepted, rejected } = selectImages([
    file('ok.png', MAX_IMAGE_BYTES),
    file('huge.png', MAX_IMAGE_BYTES + 1),
  ]);
  assert.deepEqual(accepted.map((f) => f.name), ['ok.png']);
  assert.deepEqual(rejected, [{ name: 'huge.png', reason: 'tooLarge' }]);
});

test('selectImages rejects a non-image file', () => {
  const { accepted, rejected } = selectImages([file('cv.pdf', 100, 'application/pdf')]);
  assert.equal(accepted.length, 0);
  assert.deepEqual(rejected, [{ name: 'cv.pdf', reason: 'notImage' }]);
});

test('selectImages tolerates an empty or missing list', () => {
  assert.deepEqual(selectImages(undefined), { accepted: [], rejected: [] });
  assert.deepEqual(selectImages([]), { accepted: [], rejected: [] });
});

test('planImageMessages sends one payload per image and captions only the first', () => {
  const images = [{ id: '1' }, { id: '2' }, { id: '3' }];
  const plan = planImageMessages(images, '  look at this  ');
  assert.equal(plan.length, 3);
  assert.equal(plan[0].caption, 'look at this');
  // Repeating the caption would put the same sentence in three bubbles.
  assert.equal(plan[1].caption, '');
  assert.equal(plan[2].caption, '');
  assert.equal(plan[0].image.id, '1');
});

test('planImageMessages handles no images and no caption', () => {
  assert.deepEqual(planImageMessages([], 'text'), []);
  assert.deepEqual(planImageMessages(null), []);
  assert.equal(planImageMessages([{ id: '1' }], '').length, 1);
});

test('rejectionSummary counts reasons and picks the dominant one', () => {
  const summary = rejectionSummary([
    { name: 'a', reason: 'limit' },
    { name: 'b', reason: 'limit' },
    { name: 'c', reason: 'tooLarge' },
  ]);
  assert.equal(summary.total, 3);
  assert.equal(summary.limit, 2);
  assert.equal(summary.tooLarge, 1);
  assert.equal(summary.dominant, 'limit');
});

test('rejectionSummary has no dominant reason for an empty list', () => {
  const summary = rejectionSummary([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.dominant, null);
});

// ── 2. Shortcode autocomplete ────────────────────────────────────────────

test('the shortcode dictionary is a usable size', () => {
  const size = Object.keys(EMOJI_SHORTCODES).length;
  assert.ok(size >= 250, `expected ~300 shortcodes, found ${size}`);
  assert.equal(EMOJI_SHORTCODES.smile, '😄');
  assert.ok(EMOJI_SHORTCODES.heart);
});

test('activeShortcodeToken finds a token at the caret', () => {
  // 'hello :smi' — the colon is at 6, so the replaced range starts there.
  const token = activeShortcodeToken('hello :smi', 10);
  assert.deepEqual(token, { start: 6, end: 10, query: 'smi' });
});

test('activeShortcodeToken swallows a closing colon the user already typed', () => {
  // People type the closing colon out of habit and still expect completion, so
  // it belongs to the replaced range rather than being left behind.
  const token = activeShortcodeToken(':smile:', 7);
  assert.deepEqual(token, { start: 0, end: 7, query: 'smile' });
});

test('activeShortcodeToken resolves the token BEFORE the caret', () => {
  // Editing mid-message must complete the token the reader is typing, not a
  // later one that happens to sit at the end of the box.
  const text = 'a :smi and :heart:';
  // Caret right after ":smi" (index 6), not at the end of the box.
  const token = activeShortcodeToken(text, 6);
  assert.equal(token.query, 'smi');
  assert.equal(token.start, 2);
});

test('a completed shortcode is not re-offered once the caret passes it', () => {
  // 'a :smi and :heart:' with the caret at the end resolves the LAST token.
  const token = activeShortcodeToken('a :smi and :heart:', 17);
  assert.equal(token.query, 'heart');
});

test('activeShortcodeToken requires a boundary before the colon', () => {
  // "10:30" and "note:" must not open a suggestion list.
  assert.equal(activeShortcodeToken('meet at 10:30', 13), null);
  assert.equal(activeShortcodeToken('note:', 5), null);
});

test('activeShortcodeToken ignores single-character and spaced queries', () => {
  assert.equal(activeShortcodeToken(':s', 2), null);
  assert.equal(activeShortcodeToken(':sm ile', 8), null);
});

test('searchShortcodes ranks prefix matches first and caps the list', () => {
  const results = searchShortcodes('sm');
  assert.ok(results.length > 0);
  assert.ok(results.every((item) => item.name.includes('sm')));
  assert.equal(results[0].name.startsWith('sm'), true);
  assert.ok(results.length <= 6);
});

test('searchShortcodes returns nothing for an empty query', () => {
  assert.deepEqual(searchShortcodes(''), []);
  assert.deepEqual(searchShortcodes(':'), []);
});

test('searchShortcodes finds a substring match and ranks the prefix above it', () => {
  // 'humb' is a PREFIX of humbug and a SUBSTRING of thumbsup, so the prefix one
  // leads and the substring still appears.
  const results = searchShortcodes('humb', { dictionary: { thumbsup: '👍', humbug: '🐛' } });
  assert.deepEqual(results.map((r) => r.name), ['humbug', 'thumbsup']);
});

test('searchShortcodes returns a substring-only match', () => {
  // 'umbu' is only ever in the middle — no prefix candidate exists.
  const results = searchShortcodes('umbu', { dictionary: { thumbsup: '👍', humbug: '🐛' } });
  assert.deepEqual(results.map((r) => r.name), ['humbug']);
});

test('applyShortcode replaces the token and places the caret after the emoji', () => {
  const token = { start: 6, end: 11 };
  const { text, caret } = applyShortcode('hello :smi', token, '😄');
  assert.equal(text, 'hello 😄');
  assert.equal(caret, 'hello 😄'.length);
});

test('applyShortcode keeps the text that follows a mid-message token', () => {
  const token = { start: 0, end: 7 };
  const { text, caret } = applyShortcode(':smile: and more', token, '😄');
  assert.equal(text, '😄 and more');
  assert.equal(caret, '😄'.length);
});

test('applyShortcode is a no-op without a token or an emoji', () => {
  assert.deepEqual(applyShortcode('abc', null, '😄'), { text: 'abc', caret: 3 });
  assert.deepEqual(applyShortcode('abc', { start: 0, end: 1 }, ''), { text: 'abc', caret: 3 });
});

// ── 3. Scenario insertion ────────────────────────────────────────────────

test('formatScenarioContext collapses whitespace and quotes the line', () => {
  const text = formatScenarioContext('A rainy night in\n\n  Osaka.  ');
  assert.equal(text, '> A rainy night in Osaka.');
});

test('formatScenarioContext returns an empty string without a scenario', () => {
  assert.equal(formatScenarioContext(''), '');
  assert.equal(formatScenarioContext(null), '');
  assert.equal(formatScenarioContext('   \n  '), '');
});

test('formatScenarioContext clips a long scenario with an ellipsis', () => {
  const long = 'x'.repeat(1000);
  const result = formatScenarioContext(long, { maxLength: 20 });
  assert.equal(result.length, 22); // "> " + 19 chars + "…"
  assert.equal(result.endsWith('…'), true);
});

test('buildScenarioInsertion appends a quoted line to an empty composer', () => {
  const result = buildScenarioInsertion('', 'A quiet café');
  assert.equal(result.text, '> A quiet café');
  assert.equal(result.inserted, true);
  assert.equal(result.caret, result.text.length);
});

test('buildScenarioInsertion separates the scenario from existing text', () => {
  const result = buildScenarioInsertion('hello there', 'A quiet café');
  assert.equal(result.text, 'hello there\n\n> A quiet café');
  assert.equal(result.inserted, true);
});

test('buildScenarioInsertion does not duplicate an identical scenario', () => {
  const first = buildScenarioInsertion('', 'A quiet café');
  const second = buildScenarioInsertion(first.text, 'A quiet café');
  assert.equal(second.inserted, false);
  assert.equal(second.text, first.text);
});

test('buildScenarioInsertion reports nothing inserted without a scenario', () => {
  const result = buildScenarioInsertion('hello', '');
  assert.equal(result.inserted, false);
  assert.equal(result.text, 'hello');
});

test('entityScenario reads both entity shapes', () => {
  assert.equal(entityScenario({ scenario: 'flat' }), 'flat');
  assert.equal(entityScenario({ character_profile: { scenario: 'nested' } }), 'nested');
  assert.equal(entityScenario({ scenario: '  padded  ' }), 'padded');
  assert.equal(entityScenario(null), '');
  assert.equal(entityScenario({}), '');
  assert.equal(entityScenario({ character_profile: { scenario: 42 } }), '');
});

// ── 4. Draft persistence ─────────────────────────────────────────────────

test('draftStorageKey prefers the interaction id', () => {
  assert.equal(
    draftStorageKey({ interactionId: 'i-1', participantKey: 'k-1', entityId: 'e-1' }),
    `${DRAFT_KEY_PREFIX}i-1`,
  );
});

test('draftStorageKey falls back for a brand-new thread', () => {
  // A thread has no interaction id until the first message mints one; losing the
  // draft at that moment is exactly what the fallback prevents.
  assert.equal(draftStorageKey({ participantKey: 'k-1' }), `${DRAFT_KEY_PREFIX}k-1`);
  assert.equal(draftStorageKey({ entityId: 'e-1' }), `${DRAFT_KEY_PREFIX}e-1`);
  assert.equal(draftStorageKey({ interaction_id: 'i-2' }), `${DRAFT_KEY_PREFIX}i-2`);
});

test('draftStorageKey returns an empty key without identity', () => {
  assert.equal(draftStorageKey(null), '');
  assert.equal(draftStorageKey({}), '');
  assert.equal(draftStorageKey({ interactionId: '   ' }), '');
});

test('a draft round-trips through storage', () => {
  const storage = makeStorage();
  const key = draftStorageKey({ interactionId: 'i-1' });
  saveDraft(storage, key, 'half-typed thought');
  assert.equal(loadDraft(storage, key), 'half-typed thought');
});

test('an empty draft removes the key instead of storing an empty string', () => {
  const storage = makeStorage();
  const key = draftStorageKey({ interactionId: 'i-1' });
  saveDraft(storage, key, 'text');
  saveDraft(storage, key, '');
  assert.equal(loadDraft(storage, key), '');
  assert.equal(storage.size, 0);
});

test('clearDraft removes a sent draft', () => {
  const storage = makeStorage();
  const key = draftStorageKey({ interactionId: 'i-1' });
  saveDraft(storage, key, 'text');
  assert.equal(clearDraft(storage, key), true);
  assert.equal(loadDraft(storage, key), '');
});

test('drafts are per conversation', () => {
  const storage = makeStorage();
  const a = draftStorageKey({ interactionId: 'a' });
  const b = draftStorageKey({ interactionId: 'b' });
  saveDraft(storage, a, 'for A');
  saveDraft(storage, b, 'for B');
  // Switching tabs and returning must restore the RIGHT thread's text.
  assert.equal(loadDraft(storage, a), 'for A');
  assert.equal(loadDraft(storage, b), 'for B');
});

test('draft helpers never throw when storage is unavailable', () => {
  const key = `${DRAFT_KEY_PREFIX}x`;
  assert.equal(loadDraft(brokenStorage, key), '');
  assert.equal(saveDraft(brokenStorage, key, 'text'), false);
  assert.equal(clearDraft(brokenStorage, key), false);
  assert.equal(loadDraft(undefined, key), '');
  assert.equal(saveDraft(undefined, key, 'text'), false);
  assert.equal(saveDraft(makeStorage(), '', 'text'), false);
});

test('a draft longer than the cap is truncated, not refused', () => {
  const storage = makeStorage();
  const key = draftStorageKey({ interactionId: 'i-1' });
  saveDraft(storage, key, 'x'.repeat(50000));
  assert.equal(loadDraft(storage, key).length, 20000);
});

// ── 5. Disabled composer ─────────────────────────────────────────────────

test('composerState reports the reason it is inert', () => {
  assert.deepEqual(composerState({ aiDisabled: true, connected: false }), {
    disabled: true, reason: 'aiDisabled',
  });
  assert.deepEqual(composerState({ connected: false }), { disabled: true, reason: 'offline' });
  assert.deepEqual(composerState({ connected: true }), { disabled: false, reason: null });
  // A switched-off partner cannot reply even with a perfect connection, so that
  // is the more useful of the two explanations.
});

test('placeholderKeyFor maps a reason to an i18n suffix', () => {
  assert.equal(placeholderKeyFor('aiDisabled'), 'disabled');
  assert.equal(placeholderKeyFor('offline'), 'offline');
  assert.equal(placeholderKeyFor(null), 'normal');
});

// ── 6. Send on Enter ─────────────────────────────────────────────────────

test('Enter sends', () => {
  assert.equal(isSendKey({ key: 'Enter' }), true);
});

test('Shift+Enter and every other modifier insert a newline', () => {
  assert.equal(isSendKey({ key: 'Enter', shiftKey: true }), false);
  assert.equal(isSendKey({ key: 'Enter', ctrlKey: true }), false);
  assert.equal(isSendKey({ key: 'Enter', altKey: true }), false);
  assert.equal(isSendKey({ key: 'Enter', metaKey: true }), false);
});

test('IME composition never sends', () => {
  // Confirming a Japanese/Chinese candidate fires Enter; sending there would
  // post a half-typed message on every selection.
  assert.equal(isSendKey({ key: 'Enter', isComposing: true }), false);
  assert.equal(isSendKey({ key: 'Enter', keyCode: 229 }), false);
});

test('other keys do not send', () => {
  assert.equal(isSendKey({ key: 'a' }), false);
  assert.equal(isSendKey(null), false);
});

test('the Enter hint is shown once and then stays dismissed', () => {
  const storage = makeStorage();
  assert.equal(shouldShowEnterHint(storage), true);
  dismissEnterHint(storage);
  assert.equal(storage.getItem(ENTER_HINT_STORAGE_KEY), '1');
  assert.equal(shouldShowEnterHint(storage), false);
});

test('the Enter hint stays hidden when storage is unavailable', () => {
  // Better to show nothing than a hint that reappears on every mount.
  assert.equal(shouldShowEnterHint(brokenStorage), false);
  assert.equal(shouldShowEnterHint(undefined), false);
  assert.equal(dismissEnterHint(brokenStorage), false);
});
