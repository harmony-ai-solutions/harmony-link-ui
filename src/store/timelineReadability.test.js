import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dayKey,
  dayDividerInfo,
  buildDayDividers,
  timelineWindow,
  slideWindowEnd,
  markMessagesRead,
  setMessagesReadFlag,
  unreadMessageIds,
  parseJsonStringArray,
  entityAlternateGreetings,
  nextGreetingIndex,
  isGreetingOpening,
  TIMELINE_RENDER_LIMIT,
  TIMELINE_PAGE,
} from './chatStoreUtils.js';

/**
 * Task 02-7 — timeline readability.
 *
 * Every case below is written against a LOCAL-time timestamp string, because the
 * day-divider rule is "the local date changed", not "24 hours passed". Tests run
 * in whatever zone the machine is in, so the fixtures use explicit local
 * constructors rather than `Z` literals wherever the boundary matters.
 */

/** Build a local-time message row. */
const msg = (id, createdAt, extra = {}) => ({
  id,
  created_at: createdAt,
  sender_entity_id: 'ai',
  entity_id: 'ai',
  content: id,
  message_type: 'text',
  is_read: true,
  ...extra,
});

// ── dayKey ───────────────────────────────────────────────────────────────

test('dayKey reads the LOCAL calendar day, not the UTC one', () => {
  // 23:30 local on the 12th is 22:30Z in UTC+1 — the UTC date is still the 12th,
  // but in UTC-5 the same instant is the 13th. Either way dayKey must answer
  // with the LOCAL date the user sees on their clock.
  const local = new Date(2026, 8, 12, 23, 30, 0);
  assert.equal(dayKey(local), '2026-09-12');
  assert.equal(dayKey(local.toISOString()), '2026-09-12');
});

test('dayKey pads month and day so keys compare lexicographically', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 12, 0, 0)), '2026-01-05');
});

test('dayKey returns an empty key for missing or unparseable timestamps', () => {
  assert.equal(dayKey(null), '');
  assert.equal(dayKey(undefined), '');
  assert.equal(dayKey(''), '');
  assert.equal(dayKey('not-a-date'), '');
});

// ── dayDividerInfo ───────────────────────────────────────────────────────

test('dayDividerInfo labels today and yesterday', () => {
  const now = new Date(2026, 8, 12, 15, 0, 0);
  assert.equal(dayDividerInfo(new Date(2026, 8, 12, 1, 0, 0), now).kind, 'today');
  assert.equal(dayDividerInfo(new Date(2026, 8, 11, 23, 59, 0), now).kind, 'yesterday');
});

test('dayDividerInfo calls anything older than yesterday a date', () => {
  const now = new Date(2026, 8, 12, 15, 0, 0);
  assert.equal(dayDividerInfo(new Date(2026, 8, 10, 23, 59, 0), now).kind, 'date');
});

test('dayDividerInfo computes yesterday by CALENDAR, so a DST month boundary is not off by an hour', () => {
  // Crossing a month boundary is the case a naive `now - 24h` gets wrong when a
  // DST transition shortens or lengthens the day in between.
  const now = new Date(2026, 2, 1, 0, 30, 0); // 1 March, 00:30 local
  assert.equal(dayDividerInfo(new Date(2026, 1, 28, 22, 0, 0), now).kind, 'yesterday');
  assert.equal(dayDividerInfo(new Date(2026, 1, 27, 22, 0, 0), now).kind, 'date');
});

test('dayDividerInfo returns null when the timestamp cannot be read', () => {
  assert.equal(dayDividerInfo('', new Date()), null);
  assert.equal(dayDividerInfo('nope', new Date()), null);
});

// ── buildDayDividers ─────────────────────────────────────────────────────

test('buildDayDividers opens the timeline with a divider', () => {
  const now = new Date(2026, 8, 12, 15, 0, 0);
  const dividers = buildDayDividers([msg('a', new Date(2026, 8, 12, 9, 0, 0))], now);
  assert.equal(dividers.length, 1);
  assert.equal(dividers[0].kind, 'today');
});

test('buildDayDividers emits ONE divider per local day, above its first message', () => {
  const now = new Date(2026, 8, 12, 15, 0, 0);
  const messages = [
    msg('a', new Date(2026, 8, 10, 9, 0, 0)),
    msg('b', new Date(2026, 8, 10, 18, 0, 0)),
    msg('c', new Date(2026, 8, 11, 8, 0, 0)),
    msg('d', new Date(2026, 8, 12, 8, 0, 0)),
    msg('e', new Date(2026, 8, 12, 14, 0, 0)),
  ];
  const dividers = buildDayDividers(messages, now);
  assert.deepEqual(dividers.map((d) => (d ? d.kind : null)), [
    'date', null, 'yesterday', 'today', null,
  ]);
});

test('buildDayDividers is correct across local midnight', () => {
  const now = new Date(2026, 8, 12, 0, 5, 0);
  const messages = [
    msg('before', new Date(2026, 8, 11, 23, 58, 0)),
    msg('after', new Date(2026, 8, 12, 0, 2, 0)),
  ];
  const dividers = buildDayDividers(messages, now);
  assert.equal(dividers[0].kind, 'yesterday');
  assert.equal(dividers[1].kind, 'today');
});

test('buildDayDividers does not re-open a day after an unreadable timestamp', () => {
  const now = new Date(2026, 8, 12, 15, 0, 0);
  const messages = [
    msg('a', new Date(2026, 8, 12, 9, 0, 0)),
    msg('bad', ''),
    msg('c', new Date(2026, 8, 12, 10, 0, 0)),
  ];
  const dividers = buildDayDividers(messages, now);
  assert.equal(dividers[0].kind, 'today');
  assert.equal(dividers[1], null);
  assert.equal(dividers[2], null, 'a bad timestamp must not reopen the same day');
});

test('buildDayDividers is index-aligned with its input, empty input included', () => {
  assert.deepEqual(buildDayDividers([], new Date()), []);
  const dividers = buildDayDividers([msg('a', ''), msg('b', '')], new Date());
  assert.deepEqual(dividers, [null, null]);
});

// ── timelineWindow / slideWindowEnd ──────────────────────────────────────

const linear = (n) => Array.from({ length: n }, (_, i) => msg(`m${i}`, new Date(2026, 0, 1, 0, i, 0)));

test('timelineWindow follows the tail when no end id is set', () => {
  const messages = linear(500);
  const { start, end } = timelineWindow(messages, null);
  assert.equal(end, 500);
  assert.equal(start, 500 - TIMELINE_RENDER_LIMIT);
  assert.equal(end - start, TIMELINE_RENDER_LIMIT);
});

test('timelineWindow is anchored to an ID, so a prepend does not shift it', () => {
  const messages = linear(300);
  const endId = messages[299].id;
  const before = timelineWindow(messages, endId);
  // Simulate an older page arriving: 50 rows PREPENDED.
  const older = Array.from({ length: 50 }, (_, i) => msg(`old${i}`, new Date(2025, 11, 31, 0, i, 0)));
  const after = timelineWindow([...older, ...messages], endId);
  assert.equal(after.end, before.end + 50, 'the end index moved with the prepend');
  // …but the WINDOW still ends at the same message, which is what the anchor needs.
  assert.equal(messages[before.end - 1].id, endId);
});

test('timelineWindow returns an empty-looking window for an unknown end id', () => {
  const messages = linear(10);
  const { start, end } = timelineWindow(messages, 'does-not-exist');
  assert.equal(end, 10);
  assert.equal(start, 0);
});

test('timelineWindow tolerates a nonsense limit', () => {
  const messages = linear(10);
  for (const limit of [0, -5, NaN, undefined]) {
    const { end } = timelineWindow(messages, null, limit);
    assert.equal(end, 10);
  }
});

test('slideWindowEnd slides one page toward older and back to the tail', () => {
  const messages = linear(500);
  const older = slideWindowEnd(messages, null, -TIMELINE_PAGE);
  assert.equal(older, messages[500 - TIMELINE_PAGE - 1].id);
  const back = slideWindowEnd(messages, older, TIMELINE_PAGE);
  assert.equal(back, null, 'reaching the tail drops the window');
});

test('slideWindowEnd never returns an out-of-range index', () => {
  const messages = linear(60);
  // Asking for far more than exists clamps to the FIRST message, so a window
  // end of 0 can never render an empty slice of a non-empty timeline.
  const older = slideWindowEnd(messages, null, -9999);
  assert.equal(older, messages[0].id);
  assert.deepEqual(timelineWindow(messages, older), { start: 0, end: 1 });
  // …and sliding forward past the end returns null.
  assert.equal(slideWindowEnd(messages, messages[10].id, 9999), null);
});

test('slideWindowEnd returns null for an empty timeline', () => {
  assert.equal(slideWindowEnd([], null, -TIMELINE_PAGE), null);
});

test('slideWindowEnd treats a non-finite delta as a no-op', () => {
  const messages = linear(500);
  const older = slideWindowEnd(messages, null, -TIMELINE_PAGE);
  assert.equal(slideWindowEnd(messages, older, NaN), older);
});

// ── Read receipts and the new-messages divider ───────────────────────────

test('markMessagesRead flips every unread row regardless of direction', () => {
  // The engine leaves the AI's own rows at is_read = 0 for life (its receipt
  // targets the PARTNER's rows, and entity_id is the character on every row), so
  // restricting the local flip to inbound rows would strand phantom unread rows
  // and the divider could never retire. See markMessagesRead.
  const messages = [
    msg('greeting', '2026-01-01T00:00:00Z', { is_read: false }),
    msg('ourTurn', '2026-01-01T00:01:00Z', { is_read: false }),
  ];
  const next = markMessagesRead(messages);
  assert.equal(next[0].is_read, true);
  assert.equal(next[1].is_read, true, 'an outbound row is stamped read on open');
});

test('markMessagesRead returns the SAME array when nothing was unread', () => {
  const messages = [msg('a', '2026-01-01T00:00:00Z', { is_read: true })];
  assert.equal(markMessagesRead(messages), messages, 'no needless re-render');
});

test('markMessagesRead leaves a null read flag alone', () => {
  // normalizeChatMessage emits null when the projection omits is_read; that is
  // "unknown", not "unread", and must not be rewritten.
  const messages = [msg('a', '2026-01-01T00:00:00Z', { is_read: null })];
  assert.equal(markMessagesRead(messages)[0].is_read, null);
});

test('markMessagesRead retires the divider for a thread read on open', () => {
  // The 02-7 step 2 acceptance: after markRead no row is unread, so
  // firstUnreadIndex (isUnreadInbound) finds nothing and the divider disappears.
  const messages = [msg('a', '2026-01-01T00:00:00Z', { is_read: false })];
  const next = markMessagesRead(messages);
  assert.equal(next.some((m) => m.is_read === false), false);
});

test('unreadMessageIds snapshots exactly the rows a rollback must restore', () => {
  const messages = [
    msg('a', '2026-01-01T00:00:00Z', { is_read: false }),
    msg('b', '2026-01-01T00:01:00Z', { is_read: true }),
    msg('c', '2026-01-01T00:02:00Z', { is_read: false }),
    msg('d', '2026-01-01T00:03:00Z', { is_read: null }),
  ];
  assert.deepEqual(unreadMessageIds(messages), ['a', 'c']);
});

test('setMessagesReadFlag restores only the named rows', () => {
  const messages = [
    msg('a', '2026-01-01T00:00:00Z', { is_read: true }),
    msg('b', '2026-01-01T00:01:00Z', { is_read: true }),
  ];
  const next = setMessagesReadFlag(messages, ['a'], false);
  assert.equal(next[0].is_read, false);
  assert.equal(next[1].is_read, true);
});

test('setMessagesReadFlag is a no-op for an empty id set', () => {
  const messages = [msg('a', '2026-01-01T00:00:00Z')];
  assert.equal(setMessagesReadFlag(messages, [], false), messages);
});

// ── Greeting alternates ──────────────────────────────────────────────────

test('parseJsonStringArray reads the engine JSON column and trims entries', () => {
  assert.deepEqual(parseJsonStringArray('[" Hi ","There",""]'), ['Hi', 'There']);
});

test('parseJsonStringArray accepts an already-parsed array', () => {
  assert.deepEqual(parseJsonStringArray(['a', ' b ']), ['a', 'b']);
});

test('parseJsonStringArray degrades to [] instead of throwing', () => {
  for (const input of [null, undefined, '', '   ', 'not json', '{}', '3', '[1,2]']) {
    assert.deepEqual(parseJsonStringArray(input), []);
  }
});

test('entityAlternateGreetings reads the nested profile shape', () => {
  const entity = { id: 'claire', character_profile: { alternate_greetings: '["A","B"]' } };
  assert.deepEqual(entityAlternateGreetings(entity), ['A', 'B']);
});

test('entityAlternateGreetings prefers a flattened array on the entity', () => {
  const entity = {
    id: 'claire',
    alternate_greetings: '["Flat"]',
    character_profile: { alternate_greetings: '["Nested"]' },
  };
  assert.deepEqual(entityAlternateGreetings(entity), ['Flat']);
});

test('entityAlternateGreetings returns [] for a missing entity or profile', () => {
  assert.deepEqual(entityAlternateGreetings(null), []);
  assert.deepEqual(entityAlternateGreetings({ id: 'x' }), []);
});

test('nextGreetingIndex cycles and wraps in both directions', () => {
  assert.equal(nextGreetingIndex(0, 3), 1);
  assert.equal(nextGreetingIndex(2, 3), 0);
  assert.equal(nextGreetingIndex(0, 0), 0);
  assert.equal(nextGreetingIndex(NaN, 3), 1);
});

test('isGreetingOpening is true only while the greeting is unanswered', () => {
  const greeting = msg('g', '2026-01-01T00:00:00Z', { message_type: 'greeting', sender_entity_id: 'ai' });
  assert.equal(isGreetingOpening([greeting], 'persona'), true);

  // The user has spoken → the opening is over.
  const firstTurn = msg('u', '2026-01-01T00:01:00Z', { sender_entity_id: 'persona' });
  assert.equal(isGreetingOpening([greeting, firstTurn], 'persona'), false);
});

test('isGreetingOpening ignores partner messages that are not the user', () => {
  const greeting = msg('g', '2026-01-01T00:00:00Z', { message_type: 'greeting', sender_entity_id: 'ai' });
  const aside = msg('a', '2026-01-01T00:01:00Z', { sender_entity_id: 'ai' });
  assert.equal(isGreetingOpening([greeting, aside], 'persona'), true);
});

test('isGreetingOpening is false when the thread does not start with a greeting', () => {
  assert.equal(isGreetingOpening([msg('t', '2026-01-01T00:00:00Z')], 'persona'), false);
  assert.equal(isGreetingOpening([], 'persona'), false);
});
