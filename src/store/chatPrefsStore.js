import { create } from 'zustand';
import {
    DEFAULT_PLAYBACK_RATE,
    PLAYBACK_RATES,
    sanitizePlaybackRate,
} from '../services/chat/playbackUtils.js';

/**
 * Desktop-only chat display preferences (F10 extras).
 *
 * These are local to this install and persisted in localStorage (they are not
 * engine state): chat font size, message spacing and the new-message sound
 * toggle. Reply mode is NOT stored here — it is per-conversation engine state,
 * driven through SET_REPLY_MODE (see chatStore.setReplyMode).
 */

const STORAGE_KEY = 'hl.chat.prefs';

export const FONT_SIZES = ['small', 'medium', 'large'];
export const SPACINGS = ['comfortable', 'compact'];

export const DEFAULT_CHAT_PREFS = {
    fontSize: 'medium',
    spacing: 'comfortable',
    sound: true,
    // Default to Instant: on CPU-only local inference a "realistic" reply adds
    // ~10s of artificial typing delay on top of generation time. Users can
    // still opt into Realistic in chat preferences.
    replyMode: 'instant',
    /**
     * Preferred microphone (Task 04-1 step 3).
     *
     * `''` means "let the system decide" — the correct default, because device
     * ids are per-origin AND per-session on some Chromium builds, so a
     * hard-coded id would be wrong on the next launch.
     */
    inputDeviceId: '',
    /**
     * Voice-note playback speed (Task 04-4 step 2).
     *
     * Persisted here rather than in the player so the choice survives a restart
     * (the player is a single shared element with no storage of its own), and
     * sanitised on load so a hand-edited or stale value cannot put the element
     * at 0× or 7×.
     */
    playbackRate: DEFAULT_PLAYBACK_RATE,
};

/** Load persisted prefs (best-effort; falls back to defaults). */
export function loadPrefs() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_CHAT_PREFS };
        const parsed = JSON.parse(raw);
        return {
            fontSize: FONT_SIZES.includes(parsed.fontSize) ? parsed.fontSize : DEFAULT_CHAT_PREFS.fontSize,
            spacing: SPACINGS.includes(parsed.spacing) ? parsed.spacing : DEFAULT_CHAT_PREFS.spacing,
            sound: parsed.sound !== false,
            replyMode: parsed.replyMode === 'instant' ? 'instant' : 'realistic',
            // Any string is a valid stored id (including the empty default);
            // a non-string means a hand-edited localStorage row — ignore it.
            inputDeviceId: typeof parsed.inputDeviceId === 'string'
                ? parsed.inputDeviceId
                : DEFAULT_CHAT_PREFS.inputDeviceId,
            playbackRate: sanitizePlaybackRate(parsed.playbackRate),
        };
    } catch {
        return { ...DEFAULT_CHAT_PREFS };
    }
}

function persist(prefs) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
        /* localStorage unavailable — non-fatal */
    }
}

const useChatPrefsStore = create((set, get) => ({
    ...loadPrefs(),

    /** Merge a partial prefs patch and persist. */
    updatePrefs: (patch) => {
        const next = { ...get(), ...patch };
        set(next);
        persist(next);
    },

    /** Set the per-conversation reply mode (also persisted as the last choice). */
    setReplyMode: (replyMode) => {
        const next = { ...get(), replyMode: replyMode === 'instant' ? 'instant' : 'realistic' };
        set(next);
        persist(next);
    },

    /**
     * Set the voice-note playback speed. Only the three supported rates are
     * accepted; `updatePrefs` is not used because it would happily persist a
     * number the player cannot apply.
     */
    setPlaybackRate: (rate) => {
        const next = { ...get(), playbackRate: sanitizePlaybackRate(rate) };
        set(next);
        persist(next);
    },
}));

export { PLAYBACK_RATES };

export default useChatPrefsStore;
