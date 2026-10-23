/**
 * Global inbox — pure helpers (Task 02-4).
 *
 * These are the list-shaping rules for the desktop inbox, kept free of React,
 * of the store and of any service import so they can be unit-tested with
 * `node --test` (`inboxUtils.test.js`). `ChatListView` composes them; nothing
 * here mutates its inputs.
 *
 * **Ordering rule (load-bearing):** the engine returns the inbox already
 * ordered `pinned DESC, last_activity_at DESC` — deduped by `participant_key` in
 * SQL. The UI therefore renders the array AS IT ARRIVES. {@link sortInbox}
 * exists for locally synthesised rows (an optimistic pin, a placeholder thread)
 * and must **not** be applied to a server response: re-sorting fights live
 * updates and makes a row jump under the pointer.
 */

/** Parse a timestamp to epoch millis; unparseable values sort last (as 0). */
function toTime(value) {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
}

/** The timestamp that decides a row's day group and its recency. */
function rowTime(row) {
    return toTime(row?.last_activity_at || row?.last_message?.created_at);
}

/** True when the row's thread is muted (entity-level `entities.is_muted`). */
export function isMuted(row) {
    return !!row?.muted;
}

/**
 * Fold a settings map onto the inbox rows.
 *
 * The engine's global list already joins `chat_conversation_settings` and
 * `entities.is_muted` into every row, so this is the seam for **optimistic**
 * updates: `setPinned`/`setArchived`/`setMuted` patch the map, the list
 * re-derives, and a failed request simply drops the patch. Rows with no entry
 * keep their current flags.
 *
 * @param {Array<object>} conversations - inbox rows
 * @param {Record<string, {pinned?: boolean, archived?: boolean, muted?: boolean,
 *   entity_disabled?: boolean}>} settingsMap - keyed by `participant_key`
 * @returns {Array<object>} a NEW array of NEW row objects (unchanged rows are
 *   returned by reference, so React can skip them)
 */
export function applySettings(conversations, settingsMap) {
    const map = settingsMap || {};
    const rows = conversations || [];
    return rows.map((row) => {
        const key = row?.participant_key;
        const patch = key ? map[key] : null;
        if (!patch) return row;
        return {
            ...row,
            // Only the keys actually present are replaced — a settings patch
            // that says nothing about `muted` must not silently unmute.
            ...(patch.pinned === undefined ? {} : { pinned: !!patch.pinned }),
            ...(patch.archived === undefined ? {} : { archived: !!patch.archived }),
            ...(patch.muted === undefined ? {} : { muted: !!patch.muted }),
            ...(patch.entity_disabled === undefined ? {} : { entity_disabled: !!patch.entity_disabled }),
        };
    });
}

/**
 * Order rows the way the inbox presents them: pinned first, then newest
 * activity first.
 *
 * STABLE: rows with an equal key keep their incoming order, so the server's
 * tie-breaking (`…, last_activity_at DESC, id`) survives a pass through here.
 *
 * **Do not call this on a server response** — it is already ordered, and
 * re-sorting on every live update makes rows jump. Use it only for rows the
 * client itself synthesised.
 *
 * @param {Array<object>} rows
 * @returns {Array<object>} a NEW array
 */
export function sortInbox(rows) {
    return (rows || []).slice().sort((a, b) => {
        if (!!a?.pinned !== !!b?.pinned) return a?.pinned ? -1 : 1;
        return rowTime(b) - rowTime(a);
    });
}

/**
 * Keep only the threads belonging to one AI partner.
 *
 * `entityId` is an OPTIONAL filter, not a requirement: `null`/`''` means "All
 * partners" and returns every row untouched (by reference, so the memoised list
 * stays identical). The partner of a row is its owning companion
 * (`entity_id`), which is what the chip row is built from.
 *
 * @param {Array<object>} rows
 * @param {string|null|undefined} entityId
 * @returns {Array<object>}
 */
export function filterByPartner(rows, entityId) {
    const list = rows || [];
    if (!entityId) return list;
    return list.filter((row) => row?.entity_id === entityId);
}

/** The three day buckets, in the order the inbox renders them. */
export const DAY_GROUPS = ['today', 'yesterday', 'earlier'];

/** Local midnight of `date`, so "today" means the user's today, not UTC's. */
function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/**
 * Bucket rows into `Today` / `Yesterday` / `Earlier` for scannability.
 *
 * Grouping is by fixed 24-hour day boundaries derived from LOCAL midnight —
 * not by a "within 24 h" window, which would put yesterday evening in "Today"
 * at 00:30. Rows keep their input order inside a bucket (the server order), and
 * empty buckets are omitted so the list never renders a bare heading.
 *
 * A row with no parseable timestamp lands in `earlier` rather than being
 * dropped: an unknown date must never hide a thread.
 *
 * @param {Array<object>} rows
 * @param {Date|number|string} [now] - reference "now" (default: the clock);
 *   injected so tests are deterministic.
 * @returns {Array<{key: 'today'|'yesterday'|'earlier', rows: Array<object>}>}
 */
export function groupByDay(rows, now = new Date()) {
    const today = startOfDay(now);
    const yesterday = today - 24 * 60 * 60 * 1000;
    const buckets = { today: [], yesterday: [], earlier: [] };

    for (const row of rows || []) {
        const time = rowTime(row);
        // `time === 0` = unparseable, and anything before yesterday is earlier.
        if (time >= today) buckets.today.push(row);
        else if (time >= yesterday) buckets.yesterday.push(row);
        else buckets.earlier.push(row);
    }

    return DAY_GROUPS
        .filter((key) => buckets[key].length > 0)
        .map((key) => ({ key, rows: buckets[key] }));
}

/**
 * Total unread messages, skipping muted threads — the Android inbox rule.
 *
 * A muted conversation still exists and still sorts, it simply never counts
 * toward the badge, because the user asked to be left alone about it.
 *
 * @param {Array<object>} rows
 * @returns {number}
 */
export function countUnread(rows) {
    let total = 0;
    for (const row of rows || []) {
        if (isMuted(row)) continue;
        const count = Number(row?.unread_count) || 0;
        if (count > 0) total += count;
    }
    return total;
}

/**
 * The unread badge value for ONE row — `0` when muted, so the badge can be
 * suppressed with a single check instead of duplicating the mute rule in JSX.
 *
 * @param {object} row
 * @returns {number}
 */
export function rowUnreadBadge(row) {
    if (isMuted(row)) return 0;
    return Math.max(0, Number(row?.unread_count) || 0);
}

/**
 * The distinct AI partners present in the inbox, for the filter chip row.
 *
 * Derived from the ROWS rather than the entity list on purpose: a chip must
 * never lead to an empty screen, so only companions that actually own a thread
 * get one. Order is first-appearance (i.e. the server's pinned-first order), so
 * the chips follow the same priority as the list.
 *
 * @param {Array<object>} rows
 * @param {Record<string, object>} [entityById]
 * @returns {Array<{id: string, name: string, profileId: string}>}
 */
export function partnerChips(rows, entityById) {
    const seen = new Set();
    const chips = [];
    for (const row of rows || []) {
        const id = row?.entity_id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const entity = entityById?.[id];
        chips.push({
            id,
            name: row?.companion_display_name
                || entity?.display_name
                || entity?.alias
                || id,
            profileId: row?.companion_profile_id || entity?.character_profile_id || '',
        });
    }
    return chips;
}
