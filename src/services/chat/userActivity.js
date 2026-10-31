/**
 * "When did the user last send something?" — the clock behind step 4's
 * autoplay window.
 *
 * ── WHY THIS IS NOT ZUSTAND STATE ──────────────────────────────────────────
 *
 * The autoplay decision needs the timestamp at the moment an inbound voice note
 * arrives, and nothing renders from it. Putting it in the chat store would
 * re-render every subscriber on every send (the sidebar, the inbox, the timeline
 * — all of them) for a value no component displays. It is a module-scoped
 * number, read by `shouldAutoplayAudio` and written by the send actions.
 *
 * It is deliberately NOT persisted: "the last action was 30 s ago" cannot
 * survive a restart in any meaningful way, and a stale timestamp restored from
 * localStorage would be exactly the "unexpected sound" the task forbids. An app
 * that just started has `0`, which every branch of the policy treats as
 * "the user is not watching".
 */

/** Epoch ms of the user's last send, or 0 when nothing has been sent yet. */
let lastSendAt = 0;

/** Record that the user just sent a message (text, voice, image or greeting). */
export function markUserSend(now = Date.now()) {
    lastSendAt = Number.isFinite(now) ? now : Date.now();
    return lastSendAt;
}

/** Epoch ms of the last send, or 0. Never a persisted value. */
export function getLastUserSendAt() {
    return lastSendAt;
}

/** Test helper (and the close-a-thread reset). */
export function resetUserSend() {
    lastSendAt = 0;
}

export default { markUserSend, getLastUserSendAt, resetUserSend };
