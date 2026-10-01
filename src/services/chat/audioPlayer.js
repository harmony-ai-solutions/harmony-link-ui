/**
 * Shared audio player (F8).
 *
 * The phone app had a bug from creating one <audio> element per bubble; this
 * module keeps a SINGLE hidden HTMLAudioElement for the whole chat screen, so
 * playing a new voice note always stops the previous one and memory stays flat.
 *
 * Playback sources are object URLs fetched lazily from the blob endpoint
 * (chatService.fetchMessageAudioObjectUrl) — audio is never inlined in the
 * timeline payload.
 */

let element = null;
let currentMessageId = null;
const listeners = new Set();

function getElement() {
    if (element) return element;
    if (typeof Audio === 'undefined') return null;
    element = new Audio();
    element.addEventListener('ended', () => {
        const finished = currentMessageId;
        currentMessageId = null;
        notify();
        // Revoke the finished object URL to release memory.
        if (finished && objectUrls.has(finished)) {
            URL.revokeObjectURL(objectUrls.get(finished));
            objectUrls.delete(finished);
        }
    });
    element.addEventListener('pause', notify);
    element.addEventListener('play', notify);
    return element;
}

/** messageId → object URL currently loaded (for revocation). */
const objectUrls = new Map();

function notify() {
    const state = getState();
    for (const listener of listeners) {
        try {
            listener(state);
        } catch {
            /* ignore listener errors */
        }
    }
}

/** Current playback state: which message is playing, and progress. */
export function getState() {
    const el = getElement();
    return {
        playingMessageId: el && !el.paused ? currentMessageId : null,
        currentTime: el ? el.currentTime : 0,
        duration: el && Number.isFinite(el.duration) ? el.duration : 0,
    };
}

/** Subscribe to playback state changes. Returns an unsubscribe function. */
export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Toggle playback for a message's audio.
 *
 * @param {string} messageId
 * @param {() => Promise<string|null>} loadUrl - lazily resolves the audio URL
 * @returns {Promise<void>}
 */
export async function toggle(messageId, loadUrl) {
    const el = getElement();
    if (!el) return;

    // Same message → toggle pause/play.
    if (currentMessageId === messageId) {
        if (el.paused) {
            await el.play().catch(() => {});
        } else {
            el.pause();
        }
        return;
    }

    // Different message → stop the old one and start the new one.
    el.pause();
    currentMessageId = messageId;

    let url = objectUrls.get(messageId);
    if (!url) {
        url = await loadUrl();
        if (url) objectUrls.set(messageId, url);
    }
    if (!url) {
        currentMessageId = null;
        notify();
        return;
    }
    el.src = url;
    el.currentTime = 0;
    await el.play().catch(() => {});
    notify();
}

/** Stop playback and release any cached object URLs. */
export function stop() {
    const el = getElement();
    if (el) {
        el.pause();
        el.src = '';
    }
    currentMessageId = null;
    for (const url of objectUrls.values()) {
        URL.revokeObjectURL(url);
    }
    objectUrls.clear();
    notify();
}

/** Format seconds as m:ss (for the bubble duration label). */
export function formatDuration(seconds) {
    if (!seconds || !Number.isFinite(seconds)) return '0:00';
    const total = Math.round(seconds);
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export default { toggle, stop, subscribe, getState, formatDuration };
