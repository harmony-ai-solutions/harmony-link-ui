import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applySettings,
  sortInbox,
  filterByPartner,
  groupByDay,
  countUnread,
  rowUnreadBadge,
  isMuted,
  partnerChips,
  DAY_GROUPS,
} from './inboxUtils.js';

/** Build an inbox row; defaults describe a plain, read, active thread. */
const row = (participantKey, entityId, extra = {}) => ({
  participant_key: participantKey,
  entity_id: entityId,
  unread_count: 0,
  pinned: false,
  archived: false,
  muted: false,
  entity_disabled: false,
  last_activity_at: '2026-01-01T00:00:00Z',
  ...extra,
});

// ── applySettings ────────────────────────────────────────────────────────

test('applySettings patches flags by participant_key', () => {
  const rows = [row('ai1:user', 'ai1'), row('ai2:user', 'ai2')];
  const patched = applySettings(rows, { 'ai1:user': { pinned: true, muted: true } });
  assert.equal(patched[0].pinned, true);
  assert.equal(patched[0].muted, true);
  assert.equal(patched[1].pinned, false);
  assert.equal(patched[1].muted, false);
});

test('applySettings leaves rows without a settings entry untouched (by reference)', () => {
  const rows = [row('ai1:user', 'ai1'), row('ai2:user', 'ai2')];
  const patched = applySettings(rows, { 'ai1:user': { archived: true } });
  assert.equal(patched[1], rows[1], 'unpatched rows keep their identity for cheap re-renders');
  assert.equal(patched[0].archived, true);
});

test('applySettings does not clear flags it says nothing about', () => {
  // A pin-only patch must not unmute or unarchive the thread: that is the
  // read-modify-write trap the engine's settings upsert also guards against.
  const rows = [row('ai1:user', 'ai1', { muted: true, archived: true })];
  const patched = applySettings(rows, { 'ai1:user': { pinned: true } });
  assert.equal(patched[0].pinned, true);
  assert.equal(patched[0].muted, true);
  assert.equal(patched[0].archived, true);
});

test('applySettings does not mutate its inputs and tolerates missing arguments', () => {
  const rows = [row('ai1:user', 'ai1')];
  applySettings(rows, { 'ai1:user': { pinned: true } });
  assert.equal(rows[0].pinned, false);
  assert.deepEqual(applySettings(rows, null), rows);
  assert.deepEqual(applySettings(undefined, {}), []);
});

// ── sortInbox ────────────────────────────────────────────────────────────

test('sortInbox floats pinned threads above newer unpinned ones', () => {
  const rows = [
    row('a', 'ai1', { last_activity_at: '2026-01-03T00:00:00Z' }),
    row('b', 'ai1', { pinned: true, last_activity_at: '2026-01-01T00:00:00Z' }),
  ];
  assert.deepEqual(sortInbox(rows).map((r) => r.participant_key), ['b', 'a']);
});

test('sortInbox orders by activity descending among unpinned rows', () => {
  const rows = [
    row('old', 'ai1', { last_activity_at: '2026-01-01T00:00:00Z' }),
    row('new', 'ai1', { last_activity_at: '2026-01-05T00:00:00Z' }),
  ];
  assert.deepEqual(sortInbox(rows).map((r) => r.participant_key), ['new', 'old']);
});

test('sortInbox is stable for equal timestamps (server tie-break survives)', () => {
  const rows = [row('first', 'ai1'), row('second', 'ai1'), row('third', 'ai1')];
  assert.deepEqual(sortInbox(rows).map((r) => r.participant_key), ['first', 'second', 'third']);
});

test('sortInbox falls back to the last message time and does not mutate its input', () => {
  const rows = [
    row('a', 'ai1', { last_activity_at: null, last_message: { created_at: '2026-02-01T00:00:00Z' } }),
    row('b', 'ai1', { last_activity_at: null, last_message: { created_at: '2026-01-01T00:00:00Z' } }),
  ];
  assert.deepEqual(sortInbox(rows).map((r) => r.participant_key), ['a', 'b']);
  assert.deepEqual(rows.map((r) => r.participant_key), ['a', 'b'], 'input order untouched');
  assert.deepEqual(sortInbox(undefined), []);
});

// ── filterByPartner ──────────────────────────────────────────────────────

test('filterByPartner keeps only the chosen partner\'s threads', () => {
  const rows = [row('ai1:user', 'ai1'), row('ai2:user', 'ai2'), row('ai1:ai2:user', 'ai1')];
  assert.deepEqual(filterByPartner(rows, 'ai1').map((r) => r.participant_key), ['ai1:user', 'ai1:ai2:user']);
});

test('filterByPartner with no partner returns everything (All chip)', () => {
  const rows = [row('ai1:user', 'ai1'), row('ai2:user', 'ai2')];
  assert.equal(filterByPartner(rows, null), rows, 'returns the same array so the memo stays stable');
  assert.equal(filterByPartner(rows, ''), rows);
  assert.equal(filterByPartner(rows, undefined), rows);
  assert.deepEqual(filterByPartner(undefined, 'ai1'), []);
});

// ── groupByDay ───────────────────────────────────────────────────────────

// Local-midnight-based reference: grouping must follow the USER's day, not UTC.
const NOW = new Date(2026, 5, 15, 14, 30, 0); // 2026-06-15 14:30 local
const at = (daysAgo, hour = 12) => {
  const d = new Date(2026, 5, 15 - daysAgo, hour, 0, 0);
  return d.toISOString();
};

test('groupByDay buckets into today / yesterday / earlier', () => {
  const groups = groupByDay([
    row('today-1', 'ai1', { last_activity_at: at(0, 9) }),
    row('today-2', 'ai1', { last_activity_at: at(0, 13) }),
    row('yesterday', 'ai1', { last_activity_at: at(1, 23) }),
    row('older', 'ai1', { last_activity_at: at(9) }),
  ], NOW);

  assert.deepEqual(groups.map((g) => g.key), ['today', 'yesterday', 'earlier']);
  assert.deepEqual(groups[0].rows.map((r) => r.participant_key), ['today-1', 'today-2']);
  assert.deepEqual(groups[1].rows.map((r) => r.participant_key), ['yesterday']);
  assert.deepEqual(groups[2].rows.map((r) => r.participant_key), ['older']);
});

test('groupByDay uses calendar days, not a rolling 24h window', () => {
  // 23:50 yesterday is ~15h before "now", so a "within 24h" rule would call it
  // today. It must be yesterday.
  const groups = groupByDay([row('late', 'ai1', { last_activity_at: at(1, 23) })], NOW);
  assert.deepEqual(groups.map((g) => g.key), ['yesterday']);
});

test('groupByDay keeps input order inside a bucket and omits empty buckets', () => {
  const groups = groupByDay([
    row('b', 'ai1', { last_activity_at: at(0, 8) }),
    row('a', 'ai1', { last_activity_at: at(0, 10) }),
  ], NOW);
  assert.deepEqual(groups.map((g) => g.key), ['today'], 'no bare Yesterday/Earlier heading');
  assert.deepEqual(groups[0].rows.map((r) => r.participant_key), ['b', 'a']);
});

test('groupByDay puts unparseable timestamps in earlier rather than dropping them', () => {
  const groups = groupByDay([row('broken', 'ai1', { last_activity_at: 'not-a-date' })], NOW);
  assert.deepEqual(groups.map((g) => g.key), ['earlier']);
  assert.equal(groups[0].rows.length, 1);
});

test('groupByDay handles an empty list and a fixed bucket order', () => {
  assert.deepEqual(groupByDay([], NOW), []);
  assert.deepEqual(DAY_GROUPS, ['today', 'yesterday', 'earlier']);
});

// ── countUnread / rowUnreadBadge ─────────────────────────────────────────

test('countUnread sums unread across threads', () => {
  const rows = [row('a', 'ai1', { unread_count: 2 }), row('b', 'ai1', { unread_count: 3 })];
  assert.equal(countUnread(rows), 5);
});

test('countUnread skips muted threads but still counts their neighbours', () => {
  const rows = [
    row('muted', 'ai1', { unread_count: 9, muted: true }),
    row('loud', 'ai1', { unread_count: 1 }),
  ];
  assert.equal(countUnread(rows), 1);
});

test('countUnread tolerates missing counts, negatives and an empty list', () => {
  assert.equal(countUnread([]), 0);
  assert.equal(countUnread(undefined), 0);
  assert.equal(countUnread([row('a', 'ai1', { unread_count: null })]), 0);
  assert.equal(countUnread([row('a', 'ai1', { unread_count: -3 })]), 0);
});

test('rowUnreadBadge suppresses the badge when muted (Android rule)', () => {
  assert.equal(rowUnreadBadge(row('a', 'ai1', { unread_count: 4 })), 4);
  assert.equal(rowUnreadBadge(row('a', 'ai1', { unread_count: 4, muted: true })), 0);
  assert.equal(isMuted(row('a', 'ai1', { muted: true })), true);
  assert.equal(isMuted({}), false);
});

// ── partnerChips ─────────────────────────────────────────────────────────

test('partnerChips lists each owning companion once, in first-appearance order', () => {
  const chips = partnerChips([
    row('ai2:user', 'ai2', { companion_display_name: 'Marcus' }),
    row('ai1:user', 'ai1', { companion_display_name: 'Claire' }),
    row('ai1:ai2:user', 'ai1', { companion_display_name: 'Claire' }),
  ]);
  assert.deepEqual(chips.map((c) => c.id), ['ai2', 'ai1']);
  assert.deepEqual(chips.map((c) => c.name), ['Marcus', 'Claire']);
});

test('partnerChips falls back to the entity list, then the id', () => {
  const chips = partnerChips(
    [row('ai1:user', 'ai1'), row('ai9:user', 'ai9')],
    { ai1: { id: 'ai1', display_name: 'Claire', character_profile_id: 'p-claire' } }
  );
  assert.deepEqual(chips[0], { id: 'ai1', name: 'Claire', profileId: 'p-claire' });
  assert.deepEqual(chips[1], { id: 'ai9', name: 'ai9', profileId: '' });
  assert.deepEqual(partnerChips(undefined), []);
});
