import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlayIcon, PauseIcon } from '../../constants/icons.jsx';
import {
    toggle as togglePlayback,
    subscribe,
    seek,
    seekBy,
    getState,
    formatDuration,
} from '../../services/chat/audioPlayer.js';
import {
    audioKeyIntent,
    formatClock,
    isTypingTarget,
    playbackProgress,
} from '../../services/chat/playbackUtils.js';
import { fetchMessageAudioObjectUrl } from '../../services/management/chatReadService.js';

/**
 * Audio bubble (F8): a play/pause button, a scrub track and a duration label.
 * All playback routes through the single shared player (audioPlayer.js) so only
 * one voice note plays at a time.
 *
 * ── TASK 04-4 ──────────────────────────────────────────────────────────────
 *
 * **Seek (step 1).** The track is a real `<input type="range">`. A div with a
 * click handler cannot be scrubbed: no drag, no touch, no keyboard, no
 * assistive-technology exposure. The range input is styled down to a thin line
 * (`.chat-audio-scrub`) and carries `aria-valuetext` so a screen reader says
 * "0:03 of 0:12" instead of "3".
 *
 * **The clock.** Progress comes from the shared player's state, which the player
 * throttles to ~4 Hz. Two consequences that matter:
 * - Only the bubble for the LOADED message listens to the clock. Every other
 *   bubble in the timeline leaves its position at 0 and does not re-render while
 *   a note plays, so a thread with fifty voice notes costs one animating row.
 * - A seek updates `currentTime` optimistically, because the element's
 *   `timeupdate` may not fire until the next ~250 ms tick — without that the
 *   handle would snap back under the user's finger.
 *
 * **Keyboard (step 3).** Space / ← / → are handled on the bubble element
 * itself, NOT on `window`. That is the whole safety property: a window listener
 * has to guess whether the user is typing and get it wrong eventually; a
 * listener on a focusable element only fires when that element has focus, which
 * is exactly the stated rule ("only when the bubble has focus"). The composer
 * can never be affected because focus is elsewhere.
 *
 * **Object URLs (step 5).** Holding the source is delegated to the shared
 * registry: this component never revokes the audio URL, because the PLAYER is
 * the holder while a note is loaded. A bubble unmounting mid-playback (the
 * timeline's render window slides while you listen) therefore cannot revoke the
 * bytes out from under the element, and the registry still releases them when
 * the note ends or another one starts. The IMAGE path in `ChatBubble` is the
 * opposite case — there the component IS the holder — and that is where the
 * per-mount cleanup lives.
 */
const AudioBubble = ({ message }) => {
    const { t } = useTranslation();
    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(message.audio_duration || 0);
    const [currentTime, setCurrentTime] = useState(0);
    /**
     * The scrubber's own value while a drag is in progress. While `null` the
     * handle follows the player; while set it follows the pointer, so a drag is
     * not fought by the element's own state updates.
     */
    const [dragTime, setDragTime] = useState(null);

    useEffect(() => {
        const unsubscribe = subscribe((state) => {
            const loaded = state.loadedMessageId === message.id;
            setPlaying(state.playingMessageId === message.id);
            if (!loaded) {
                // Not the loaded message: reset and, crucially, do NOT adopt the
                // clock. This is what keeps the rest of the timeline still.
                setCurrentTime(0);
                return;
            }
            setCurrentTime(state.currentTime);
            if (state.duration) setDuration(state.duration);
        });
        // Adopt the current state on mount: a bubble that scrolls back into the
        // render window while its note plays must show the live position.
        const now = getState();
        if (now.loadedMessageId === message.id) {
            setCurrentTime(now.currentTime);
            setPlaying(now.playingMessageId === message.id);
            if (now.duration) setDuration(now.duration);
        }
        return unsubscribe;
    }, [message.id]);

    /**
     * Fall back to the stored duration when the element has no metadata yet.
     * `audio_duration` is the engine's estimate (word count for AI speech), so
     * it is only a floor for the label — the real duration replaces it as soon
     * as `loadedmetadata` fires.
     */
    const effectiveDuration = duration || message.audio_duration || 0;
    const shownTime = dragTime ?? currentTime;
    const progress = playbackProgress(shownTime, effectiveDuration);

    const handleToggle = useCallback(() => {
        togglePlayback(message.id, () => fetchMessageAudioObjectUrl(message.id));
    }, [message.id]);

    const handleSeekCommit = useCallback((time) => {
        seek(message.id, time);
        setCurrentTime(time);
    }, [message.id]);

    /**
     * Drive the seek from the range input's own value.
     *
     * The element resolves click-to-position, drag, touch AND arrow keys itself,
     * and it is the only thing that knows where the thumb can actually sit — it
     * insets the usable track by half a thumb width, which hand-rolled
     * `clientX / rect.width` maths gets wrong by a few percent at both ends.
     * So the element's value is authoritative and no pointer arithmetic is done
     * here at all. `dragTime` mirrors it during a drag so a `timeupdate` that
     * was already in flight cannot yank the handle backwards.
     */
    const handleScrubInput = (event) => {
        const value = Number(event.target.value);
        if (!Number.isFinite(value)) return;
        setDragTime(value);
        handleSeekCommit(value);
    };

    const handleKeyDown = (event) => {
        // Belt and braces on top of the event scope: if anything focusable and
        // EDITABLE ever renders inside a bubble (an inline transcript editor is
        // the obvious future case), Space must stay a space.
        if (isTypingTarget(event.target)) return;
        const intent = audioKeyIntent(event);
        if (!intent) return;
        // Claim the key so the page does not also scroll on Space / ← →.
        event.preventDefault();
        event.stopPropagation();
        if (intent.action === 'toggle') {
            handleToggle();
            return;
        }
        if (intent.action === 'seek') {
            // A seek on an unloaded note is a no-op in the player; reflect that
            // instead of moving the handle over a track nothing is playing.
            if (seekBy(message.id, intent.delta)) {
                const next = getState().currentTime;
                setCurrentTime(next);
            }
        }
    };

    const label = playing ? t('chat:bubble.pause') : t('chat:bubble.play');
    const positionLabel = t('chat:bubble.audioPosition', {
        position: formatClock(shownTime),
        duration: formatClock(effectiveDuration),
        defaultValue: '{{position}} of {{duration}}',
    });

    return (
        <div
            className="chat-audio-bubble"
            // Focusable so Space/←/→ can be scoped to it (step 3). `tabIndex=0`
            // makes it reachable by keyboard without turning every bubble into a
            // tab stop inside a form — there is exactly one stop per voice note,
            // which is also the natural reading order.
            tabIndex={0}
            role="group"
            aria-label={t('chat:bubble.voiceMessage')}
            onKeyDown={handleKeyDown}
        >
            <button
                type="button"
                className="chat-audio-play"
                onClick={handleToggle}
                aria-label={label}
                // The button is inside the group; Space on it would otherwise
                // both activate the button and bubble up to the group handler.
                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') e.stopPropagation(); }}
            >
                {playing ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
            </button>

            <input
                type="range"
                className="chat-audio-scrub"
                min={0}
                max={effectiveDuration || 0}
                step={0.01}
                value={shownTime}
                // Disabled until the note is loaded: a scrubber that accepts
                // input but cannot move anything is a lie.
                disabled={!effectiveDuration}
                aria-label={t('chat:bubble.audioSeek')}
                aria-valuetext={positionLabel}
                style={{ '--chat-audio-progress': `${Math.round(progress * 100)}%` }}
                // `onChange` on a range input is React's `input` event, so a drag
                // seeks continuously — which is what "allow scrubbing" means.
                // Releasing hands control back to the player's clock, which is
                // already at the seeked position.
                onChange={handleScrubInput}
                onPointerUp={() => setDragTime(null)}
                onPointerCancel={() => setDragTime(null)}
                onBlur={() => setDragTime(null)}
            />

            <span className="chat-audio-duration">
                {formatDuration(effectiveDuration)}
            </span>
        </div>
    );
};

export default AudioBubble;
