import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    SmileIcon,
    ImageIcon,
    MicIcon,
    StopIcon,
    SparklesIcon,
    XIcon,
    ChevronDownIcon,
} from '../../constants/icons.jsx';
import EmojiPicker from './EmojiPicker.jsx';
import Tooltip from '../ui/Tooltip.jsx';
import { toast } from '../../store/toastStore.js';
import useChatPrefsStore from '../../store/chatPrefsStore.js';
import { createVoiceRecorder, listInputDevices } from '../../services/audio/recorder.js';
import {
    MAX_RECORDING_MS,
    describeMicError,
    deviceLabel,
    formatDuration,
    micErrorKey,
    recordingProgress,
    ringGeometry,
} from '../../services/audio/recorderUtils.js';
import {
    MAX_IMAGES,
    MAX_IMAGE_BYTES,
    activeShortcodeToken,
    applyShortcode,
    buildScenarioInsertion,
    composerState,
    dismissEnterHint,
    isSendKey,
    loadDraft,
    placeholderKeyFor,
    planImageMessages,
    rejectionSummary,
    saveDraft,
    searchShortcodes,
    selectImages,
    shouldShowEnterHint,
} from '../../store/chatInputUtils.js';

/**
 * Chat input box (F4) with an emoji picker (F11), a picture button (F15) and a
 * voice-note recorder (F7).
 *
 * Task 04-1 turns the recorder into a real one:
 *
 *   1. **2:00 ceiling** — the take stops itself at {@link MAX_RECORDING_MS} and
 *      says so. The live timer and the ring inside the mic button make the
 *      limit visible before it arrives rather than as a surprise truncation.
 *   2. **MIME negotiation** — the type is probed and sent as `audio_type`, so
 *      the engine is told what the bytes actually are.
 *   3. **Device choice** — a picker in the recording popover, persisted in
 *      `chatPrefsStore` (`hl.chat.prefs` → `inputDeviceId`) and passed as
 *      `deviceId: { exact }`.
 *   4. **Level meter** — an `AnalyserNode` bar proves the mic is capturing; a
 *      completely silent take warns instead of silently producing nothing.
 *   5. **Cancel vs send** — ✕ discards, release sends, and a sub-0.5 s tap is
 *      thrown away with an explanation instead of becoming an empty bubble.
 *
 * Task 02-8 brings the composer to parity with Android:
 *
 *   1. **Multiple images** — up to {@link MAX_IMAGES} per send. They are staged
 *      in a thumbnail strip above the bar (removable one by one), and sending
 *      hands the whole batch to one callback: the socket sends ONE message per
 *      image, so a single click becomes N utterances but ONE composer clear.
 *   2. **`:shortcode:` autocomplete** — typed colons open a suggestion list that
 *      Tab/Enter accepts. The full picker is untouched beside it.
 *   3. **✨ scenario** — inserts the character's `scenario` as a quoted context
 *      line, matching Android. The text comes from the chat entity ChatView has
 *      already loaded, so it costs no request.
 *   4. **Draft persistence** — every keystroke is written to
 *      `hl.chat.draft.<thread>` and restored when the thread is reopened.
 *   5. **Enter sends / Shift+Enter newlines** — with an IME-safe guard and a
 *      one-time hint underneath.
 *   6. **Disabled state** — the placeholder states WHY the composer is inert
 *      instead of leaving an unexplained grey box.
 *
 * Enter sends, Shift+Enter inserts a newline. Voice notes are recorded with the
 * browser MediaRecorder and handed to the caller as base64 (no data-URL prefix),
 * matching the engine's utterance contract.
 *
 * @param {object} props
 * @param {(text: string) => void} [props.onSendText]
 * @param {(audio: object) => void} [props.onSendAudio]
 * @param {(payloads: Array<{imageBase64: string, mimeType: string, caption: string}>) => void} [props.onSendImages]
 * @param {(action: object) => void} [props.onSendEmojiAction]
 * @param {boolean} [props.disabled] - socket offline / send impossible
 * @param {'offline'|'aiDisabled'|null} [props.disabledReason] - why it is inert
 * @param {string} [props.scenario] - the character's authored scenario
 * @param {string} [props.draftKey] - per-thread draft key
 * @param {string} [props.entityId] - for the character's emoji actions
 */
const ChatInput = ({
    onSendText,
    onSendAudio,
    onSendImages,
    onSendEmojiAction,
    disabled = false,
    disabledReason = null,
    scenario = '',
    draftKey = '',
    entityId,
}) => {
    const { t } = useTranslation();
    const [text, setText] = useState('');
    const [showEmoji, setShowEmoji] = useState(false);
    const [error, setError] = useState(null);
    const [images, setImages] = useState([]);
    /**
     * Caret position, tracked so the shortcode token is resolved at the CURSOR
     * rather than at the end of the message — editing a sentence in the middle
     * must complete the token the user is actually typing.
     */
    const [caret, setCaret] = useState(0);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    /**
     * Token signature the user dismissed with Escape.
     *
     * Stored as a signature (`start:query`) rather than a boolean: a boolean
     * would have to be reset on every keystroke, and forgetting one path would
     * leave the list permanently dead for that message. A signature only ever
     * suppresses the EXACT token it was dismissed on, so typing one more
     * character re-opens the list naturally.
     */
    const [dismissedToken, setDismissedToken] = useState('');
    const [showHint, setShowHint] = useState(false);

    /* ── Recording state (Task 04-1) ─────────────────────────────────── */
    /** True between `start` and the take resolving (send, cancel or error). */
    const [recording, setRecording] = useState(false);
    /** Elapsed milliseconds, republished every {@link TIMER_INTERVAL_MS}. */
    const [elapsedMs, setElapsedMs] = useState(0);
    /** Smoothed 0..1 input level for the meter. */
    const [level, setLevel] = useState(0);
    /** Audio inputs; populated after the permission grant fills in labels. */
    const [devices, setDevices] = useState([]);
    const [showDevicePicker, setShowDevicePicker] = useState(false);

    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);
    /**
     * Live recorder driver.
     *
     * A ref, not state: the driver owns timers and an `AudioContext`, so a
     * re-render must never be able to replace or garbage-collect it mid-take.
     */
    const recorderRef = useRef(null);
    /** True while a start request is in flight (guards double-clicks). */
    const startingRef = useRef(false);
    /** The take was finished by the 2:00 ceiling, so `onstop` must not re-toast. */
    const autoStoppedRef = useRef(false);

    const inputDeviceId = useChatPrefsStore((state) => state.inputDeviceId);
    const updatePrefs = useChatPrefsStore((state) => state.updatePrefs);
    /** Caret to restore after a programmatic text edit (emoji completion). */
    const pendingCaretRef = useRef(null);
    /** Object URLs created for the staged previews — revoked when they leave. */
    const previewUrlsRef = useRef(new Set());

    /**
     * `localStorage`, or undefined when it is unavailable.
     *
     * Reached through a try/catch because the property ACCESS itself throws in
     * some hardened/private-mode browsers, and a composer must never fail to
     * render because a convenience feature is unavailable.
     */
    const storage = useMemo(() => {
        try {
            return typeof window !== 'undefined' ? window.localStorage : undefined;
        } catch {
            return undefined;
        }
    }, []);

    const state = composerState({
        aiDisabled: disabledReason === 'aiDisabled',
        connected: !disabled,
    });
    const inert = state.disabled || recording;

    /**
     * The placeholder states WHY the box is inert (Task 02-8 step 6).
     *
     * Read from `state.reason` rather than from the raw props so the mapping
     * exists once: `composerState` already decided which condition wins, and
     * re-deriving it here could disagree (an unexplained `disabled` prop means
     * offline; a switched-off partner means `aiDisabled`).
     */
    const PLACEHOLDER_KEYS = {
        disabled: 'placeholderDisabled',
        offline: 'placeholderOffline',
        normal: 'placeholder',
    };
    const placeholder = t(`chat:input.${PLACEHOLDER_KEYS[placeholderKeyFor(state.reason)]}`);

    // The hint is shown once, the first time this build is used.
    useEffect(() => {
        setShowHint(shouldShowEnterHint(storage));
    }, [storage]);

    /**
     * Restore this thread's draft.
     *
     * Keyed on `draftKey` alone: switching threads must swap the text, and a
     * write-back on the old key is impossible because saving happens in
     * {@link updateText} (below) rather than in an effect — an effect pair would
     * race and copy the outgoing thread's text into the incoming thread's key.
     */
    useEffect(() => {
        const restored = loadDraft(storage, draftKey);
        setText(restored);
        setCaret(restored.length);
        setShowEmoji(false);
        setError(null);
    }, [draftKey, storage]);

    // Release preview object URLs when the composer unmounts.
    useEffect(() => () => {
        previewUrlsRef.current.forEach((url) => {
            try {
                URL.revokeObjectURL(url);
            } catch {
                /* already revoked */
            }
        });
        previewUrlsRef.current.clear();
    }, []);

    /** Every text mutation goes through here so the draft is always current. */
    const updateText = useCallback((next, nextCaret) => {
        setText(next);
        setCaret(Number.isFinite(nextCaret) ? nextCaret : next.length);
        saveDraft(storage, draftKey, next);
    }, [draftKey, storage]);

    // Restore the caret after a programmatic edit (emoji completion).
    useEffect(() => {
        const target = pendingCaretRef.current;
        if (target === null) return;
        pendingCaretRef.current = null;
        const node = textareaRef.current;
        if (!node) return;
        node.focus();
        node.setSelectionRange(target, target);
        setCaret(target);
    }, [text]);

    /* ── Emoji shortcode autocomplete ─────────────────────────────────── */

    const rawToken = useMemo(() => activeShortcodeToken(text, caret), [text, caret]);
    const tokenSignature = rawToken ? `${rawToken.start}:${rawToken.query}` : '';
    /**
     * The token whose suggestions are showing.
     *
     * Escape dismisses ONE exact token, so typing one more character re-opens
     * the list naturally instead of leaving it dead for the rest of the message.
     */
    const token = tokenSignature && tokenSignature !== dismissedToken ? rawToken : null;
    const suggestions = useMemo(
        () => (token ? searchShortcodes(token.query) : []),
        [token],
    );

    // A changing query must restart the highlight from the first row.
    const suggestionSignature = suggestions.map((item) => item.name).join(',');
    useEffect(() => {
        setSuggestionIndex(0);
    }, [suggestionSignature]);

    const acceptSuggestion = useCallback((suggestion) => {
        if (!token || !suggestion) return false;
        const applied = applyShortcode(text, token, suggestion.emoji);
        pendingCaretRef.current = applied.caret;
        updateText(applied.text, applied.caret);
        return true;
    }, [token, text, updateText]);

    /* ── Staged images ────────────────────────────────────────────────── */

    const removeImage = useCallback((id) => {
        setImages((current) => {
            const target = current.find((item) => item.id === id);
            if (target?.previewUrl) {
                try {
                    URL.revokeObjectURL(target.previewUrl);
                } catch {
                    /* already revoked */
                }
                previewUrlsRef.current.delete(target.previewUrl);
            }
            return current.filter((item) => item.id !== id);
        });
    }, []);

    const clearImages = useCallback(() => {
        setImages((current) => {
            current.forEach((item) => {
                if (!item.previewUrl) return;
                try {
                    URL.revokeObjectURL(item.previewUrl);
                } catch {
                    /* already revoked */
                }
                previewUrlsRef.current.delete(item.previewUrl);
            });
            return [];
        });
    }, []);

    const readAttachment = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            resolve({ base64, mimeType: file.type || 'image/png' });
        };
        reader.onerror = () => reject(new Error('read-failed'));
        reader.readAsDataURL(file);
    });

    const handleImagePick = async (event) => {
        const picked = Array.from(event.target.files || []);
        // Reset immediately: re-picking the same file must fire onChange again.
        event.target.value = '';
        if (picked.length === 0) return;

        const { accepted, rejected } = selectImages(picked, images);

        if (rejected.length > 0) {
            const summary = rejectionSummary(rejected);
            const first = rejected[0];
            if (summary.dominant === 'limit') {
                toast.error(t('chat:input.imageLimit', { max: MAX_IMAGES }));
            } else if (summary.dominant === 'tooLarge') {
                toast.error(t('chat:input.imageTooLarge', {
                    name: first.name,
                    size: Math.round(MAX_IMAGE_BYTES / (1024 * 1024)),
                }));
            } else {
                toast.error(t('chat:input.imageNotAnImage', { name: first.name }));
            }
        }

        if (accepted.length === 0) return;

        setError(null);
        for (const file of accepted) {
            try {
                const { base64, mimeType } = await readAttachment(file);
                let previewUrl = '';
                try {
                    previewUrl = URL.createObjectURL(file);
                    previewUrlsRef.current.add(previewUrl);
                } catch {
                    previewUrl = '';
                }
                setImages((current) => {
                    if (current.length >= MAX_IMAGES) {
                        if (previewUrl) {
                            URL.revokeObjectURL(previewUrl);
                            previewUrlsRef.current.delete(previewUrl);
                        }
                        return current;
                    }
                    return [...current, {
                        id: `${file.name || 'image'}-${file.size}-${current.length}-${Date.now()}`,
                        name: file.name || t('chat:input.imageFallbackName'),
                        size: file.size || 0,
                        mimeType,
                        base64,
                        previewUrl,
                    }];
                });
            } catch {
                setError(t('chat:input.imageReadFailed'));
            }
        }
    };

    /* ── Sending ──────────────────────────────────────────────────────── */

    /**
     * Send whatever the composer holds: the staged images (one socket message
     * each) or the typed text.
     *
     * A single composer clear either way, which is the whole point of staging —
     * clearing per image would wipe the batch after the first frame.
     */
    const submit = () => {
        if (inert) return;
        const value = text.trim();

        if (images.length > 0) {
            const payloads = planImageMessages(images, value).map(({ image, caption }) => ({
                imageBase64: image.base64,
                mimeType: image.mimeType,
                caption,
            }));
            onSendImages?.(payloads);
            clearImages();
            updateText('');
            markHintSeen();
            return;
        }

        if (!value) return;
        onSendText?.(value);
        updateText('');
        markHintSeen();
    };

    /** The Enter hint is help for the FIRST message, not furniture. */
    const markHintSeen = () => {
        if (!showHint) return;
        dismissEnterHint(storage);
        setShowHint(false);
    };

    const handleKeyDown = (e) => {
        // While the suggestion list is open it owns Enter and Tab — accepting a
        // completion must never also send the message.
        if (token && suggestions.length > 0) {
            if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                acceptSuggestion(suggestions[suggestionIndex] || suggestions[0]);
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSuggestionIndex((current) => (current + 1) % suggestions.length);
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSuggestionIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                // Suppress exactly THIS token — one more character re-opens it.
                setDismissedToken(tokenSignature);
                return;
            }
        }

        if (isSendKey(e)) {
            e.preventDefault();
            submit();
        }
        // Shift+Enter falls through to the textarea's own newline.
    };

    const pickEmoji = (emoji) => {
        const node = textareaRef.current;
        const at = node ? node.selectionStart : text.length;
        const next = text.slice(0, at) + emoji + text.slice(at);
        pendingCaretRef.current = at + emoji.length;
        updateText(next, at + emoji.length);
        setShowEmoji(false);
    };

    /** Insert the character's scenario as a quoted context line (Android parity). */
    const insertScenario = () => {
        const result = buildScenarioInsertion(text, scenario);
        if (!result.inserted) {
            // Nothing to insert (no authored scenario, or it is already there).
            toast.info(t(scenario ? 'chat:input.scenarioAlreadyThere' : 'chat:input.noScenario'));
            return;
        }
        pendingCaretRef.current = result.caret;
        updateText(result.text, result.caret);
    };

    /* ── Recording (Task 04-1) ────────────────────────────────────────── */

    /** Reset the transient recording UI. */
    const resetRecordingUi = useCallback(() => {
        setRecording(false);
        setElapsedMs(0);
        setLevel(0);
        setShowDevicePicker(false);
    }, []);

    /**
     * Begin a take.
     *
     * The device id comes from persisted prefs, so the picker choice survives a
     * restart. Every failure class gets its own copy — one generic "could not
     * record" is what made the phone's voice bugs unreportable.
     */
    const startRecording = useCallback(async () => {
        if (recorderRef.current || startingRef.current || disabled) return;
        startingRef.current = true;
        setError(null);
        autoStoppedRef.current = false;
        setElapsedMs(0);
        setLevel(0);

        const recorder = createVoiceRecorder({
            onTick: ({ elapsedMs: next }) => setElapsedMs(next),
            onLevel: setLevel,
            // `toastStore` has no `warning` kind; an info toast with explicit
            // copy is the honest way to say "nothing is reaching the mic".
            onSilence: () => toast.info(t('chat:input.micSilent')),
            onAutoStop: () => {
                autoStoppedRef.current = true;
            },
            onDeviceList: setDevices,
        });
        recorderRef.current = recorder;

        try {
            // `start` hands back the take promise, which resolves for EVERY exit
            // — the Send button, ✕ cancel and the 2:00 ceiling. Awaiting it here
            // is what makes the automatic stop actually deliver the audio.
            const { take } = await recorder.start({ deviceId: inputDeviceId });
            setRecording(true);

            try {
                const result = await take;
                if (result && !result.cancelled && result.audioBase64) {
                    if (autoStoppedRef.current) {
                        toast.info(t('chat:input.recordingCapped', {
                            limit: formatDuration(MAX_RECORDING_MS),
                        }));
                    }
                    onSendAudio?.({
                        audioBase64: result.audioBase64,
                        mimeType: result.mimeType,
                        duration: result.durationSeconds,
                    });
                }
            } catch (takeError) {
                // Sub-0.5 s take: discarded and explained, never sent.
                if (takeError?.code === 'tooShort') {
                    toast.info(t('chat:input.recordingTooShort'));
                } else if (takeError?.code !== 'cancelled') {
                    setError(t('chat:input.recordingFailed'));
                }
            }
        } catch (startError) {
            setError(t(micErrorKey(describeMicError(startError))));
        } finally {
            recorder.dispose();
            recorderRef.current = null;
            resetRecordingUi();
            startingRef.current = false;
        }
    }, [disabled, inputDeviceId, onSendAudio, resetRecordingUi, t]);

    /**
     * Finish the take and hand it to the caller.
     *
     * Only starts the stop; the delivery happens in {@link startRecording}'s
     * `await take`, so the send path exists exactly once.
     */
    const stopRecording = useCallback(() => {
        const recorder = recorderRef.current;
        if (!recorder) return;
        // The awaiting `take` in startRecording receives the result.
        recorder.stop().catch(() => {});
    }, []);

    /**
     * Discard the take without sending anything.
     *
     * `cancel()` alone is enough: it stops the recorder, settles the shared take
     * as `cancelled`, and releases the stream + `AudioContext`. Calling
     * `dispose()` here too would settle a take that is already settled, and the
     * `finally` in {@link startRecording} disposes as a backstop anyway.
     */
    const cancelRecording = useCallback(() => {
        const recorder = recorderRef.current;
        resetRecordingUi();
        recorder?.cancel();
    }, [resetRecordingUi]);

    /** Remember the chosen microphone for the next take and the next launch. */
    const pickDevice = useCallback((deviceId) => {
        updatePrefs({ inputDeviceId: deviceId });
        setShowDevicePicker(false);
    }, [updatePrefs]);

    /** Escape cancels a running take (the button has its own ✕). */
    useEffect(() => {
        if (!recording) return undefined;
        const onKey = (event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            cancelRecording();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [recording, cancelRecording]);

    /**
     * Enumerate inputs while the popover is open.
     *
     * Device LABELS are only populated once permission has been granted, and the
     * grant is what `startRecording` just performed — so this intentionally runs
     * after the take begins, not on app start (no auto-prompt, task 04-2 step 3).
     */
    useEffect(() => {
        if (!recording) return;
        listInputDevices().then((found) => {
            if (found.length > 0) setDevices(found);
        });
    }, [recording]);

    /**
     * Release everything on unmount.
     *
     * Without this the `AudioContext` and the microphone track outlive the
     * composer and the OS keeps showing the recording indicator.
     */
    useEffect(() => () => {
        const recorder = recorderRef.current;
        recorderRef.current = null;
        recorder?.dispose();
    }, []);

    /**
     * Auto-grow the textarea.
     *
     * A scenario insertion is several lines, and a one-row box that hides them
     * makes it look like the text was lost. `height: auto` first is what lets it
     * SHRINK again after a delete — without it the box only ever grows.
     */
    useEffect(() => {
        const node = textareaRef.current;
        if (!node) return;
        node.style.height = 'auto';
        node.style.height = `${node.scrollHeight}px`;
    }, [text]);

    const canSend = !inert && (text.trim().length > 0 || images.length > 0);

    return (
        <div className="chat-input-wrap">
            {error && <div className="chat-input-error">{error}</div>}

            {/* Staged images (Task 02-8 step 1). One thumbnail per file with its
                own remove control — a batch you cannot inspect or trim is just a
                five-file blind send. */}
            {images.length > 0 && (
                <div className="chat-input-attachments">
                    {images.map((image) => (
                        <div key={image.id} className="chat-input-attachment">
                            {image.previewUrl ? (
                                <img
                                    src={image.previewUrl}
                                    alt={image.name}
                                    className="chat-input-attachment-thumb"
                                />
                            ) : (
                                <span className="chat-input-attachment-thumb chat-input-attachment-thumb-empty" aria-hidden="true">
                                    🖼️
                                </span>
                            )}
                            <button
                                type="button"
                                className="chat-input-attachment-remove"
                                aria-label={t('chat:input.removeImage', { name: image.name })}
                                title={t('chat:input.removeImage', { name: image.name })}
                                onClick={() => removeImage(image.id)}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                    <span className="chat-input-attachment-count">
                        {t('chat:input.imageCount', { count: images.length, max: MAX_IMAGES })}
                    </span>
                </div>
            )}

            {/* Shortcode suggestions (Task 02-8 step 2). Rendered as a listbox
                under the composer so it never covers the text being typed. */}
            {token && suggestions.length > 0 && (
                <div className="chat-input-suggestions" role="listbox" aria-label={t('chat:input.emojiSuggestions')}>
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={suggestion.name}
                            type="button"
                            role="option"
                            aria-selected={index === suggestionIndex}
                            className={`chat-input-suggestion ${index === suggestionIndex ? 'chat-input-suggestion-active' : ''}`}
                            onMouseEnter={() => setSuggestionIndex(index)}
                            onClick={() => acceptSuggestion(suggestion)}
                        >
                            <span className="chat-input-suggestion-emoji">{suggestion.emoji}</span>
                            <span className="chat-input-suggestion-name">:{suggestion.name}:</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Recording popover (Task 04-1 steps 3–5). One place that answers
                the only three questions a user has mid-take: is it picking up
                sound, which microphone is it using, and how do I get out. */}
            {recording && (
                <div className="chat-recording-bar" role="group" aria-label={t('chat:input.recordingPanel')}>
                    <button
                        type="button"
                        className="chat-recording-cancel"
                        onClick={cancelRecording}
                        aria-label={t('chat:input.cancelRecording')}
                        title={t('chat:input.cancelRecording')}
                    >
                        <XIcon className="w-4 h-4" />
                    </button>

                    {/* Level meter: the only proof the mic is actually capturing. */}
                    <div className="chat-recording-meter" role="presentation">
                        <div
                            className="chat-recording-meter-fill"
                            style={{ width: `${Math.round(Math.min(1, Math.max(0, level)) * 100)}%` }}
                        />
                    </div>

                    <div className="chat-recording-meta">
                        <button
                            type="button"
                            className="chat-recording-device"
                            onClick={() => setShowDevicePicker((open) => !open)}
                            aria-expanded={showDevicePicker}
                            aria-haspopup="listbox"
                        >
                            <span className="chat-recording-device-label">
                                {deviceLabel(
                                    devices.find((device) => device.deviceId === inputDeviceId)
                                        || { deviceId: inputDeviceId, isDefault: !inputDeviceId },
                                    t,
                                    0,
                                )}
                            </span>
                            <ChevronDownIcon className="w-3.5 h-3.5" />
                        </button>

                        {showDevicePicker && (
                            <div
                                className="chat-recording-device-list"
                                role="listbox"
                                aria-label={t('chat:input.micDevice')}
                            >
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={!inputDeviceId}
                                    className={`chat-recording-device-option ${!inputDeviceId ? 'is-active' : ''}`}
                                    onClick={() => pickDevice('')}
                                >
                                    {t('chat:input.micDeviceDefault')}
                                </button>
                                {devices
                                    .filter((device) => !device.isDefault)
                                    .map((device, index) => (
                                        <button
                                            key={device.deviceId}
                                            type="button"
                                            role="option"
                                            aria-selected={device.deviceId === inputDeviceId}
                                            className={`chat-recording-device-option ${device.deviceId === inputDeviceId ? 'is-active' : ''}`}
                                            onClick={() => pickDevice(device.deviceId)}
                                        >
                                            {deviceLabel(device, t, index + 1)}
                                        </button>
                                    ))}
                                {devices.length <= 1 && (
                                    <span className="chat-recording-device-empty">
                                        {t('chat:input.micDeviceNone')}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <Tooltip content={t('chat:input.cancelRecording')}>
                        <button
                            type="button"
                            className="chat-recording-send"
                            onClick={stopRecording}
                        >
                            {t('chat:input.sendVoiceNote')}
                        </button>
                    </Tooltip>
                </div>
            )}

            <div className="chat-input-bar">
                <Tooltip content={t('chat:input.emoji')}>
                    <button
                        type="button"
                        className="chat-input-icon-btn"
                        onClick={() => setShowEmoji((v) => !v)}
                        disabled={inert}
                    >
                        <SmileIcon className="w-5 h-5" />
                    </button>
                </Tooltip>
                <Tooltip content={t('chat:input.attachImage')}>
                    <button
                        type="button"
                        className="chat-input-icon-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={inert}
                    >
                        <ImageIcon className="w-5 h-5" />
                    </button>
                </Tooltip>
                {/* ✨ Scenario (Task 02-8 step 3). Disabled rather than hidden when
                    the character has no authored scenario: an absent button looks
                    like a missing feature, a disabled one with a reason is honest. */}
                <Tooltip content={scenario
                    ? t('chat:input.insertScenario')
                    : t('chat:input.noScenario')}>
                    <button
                        type="button"
                        className="chat-input-icon-btn"
                        onClick={insertScenario}
                        disabled={inert || !scenario}
                    >
                        <SparklesIcon className="w-5 h-5" />
                    </button>
                </Tooltip>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleImagePick}
                />

                <textarea
                    ref={textareaRef}
                    className="chat-input-textarea"
                    rows={1}
                    value={text}
                    placeholder={placeholder}
                    onChange={(e) => {
                        updateText(e.target.value, e.target.selectionStart);
                    }}
                    onKeyDown={handleKeyDown}
                    onKeyUp={(e) => setCaret(e.currentTarget.selectionStart)}
                    onClick={(e) => setCaret(e.currentTarget.selectionStart)}
                    onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
                    disabled={inert}
                    aria-label={placeholder}
                />

                {/* Mic button (Task 04-1). While recording it becomes the
                    progress ring: the ring is the ceiling, the glyph stops the
                    take, and the timer beside it states the elapsed time so the
                    2:00 limit arrives visibly rather than as a cut-off. */}
                <Tooltip content={recording ? t('chat:input.stopRecording') : t('chat:input.record')}>
                    <button
                        type="button"
                        className={`chat-input-icon-btn chat-input-mic ${recording ? 'chat-input-icon-btn-recording' : ''}`}
                        onClick={recording ? stopRecording : startRecording}
                        disabled={disabled}
                        aria-pressed={recording}
                        aria-label={recording ? t('chat:input.stopRecording') : t('chat:input.record')}
                    >
                        {recording && (
                            <svg
                                className="chat-input-mic-ring"
                                viewBox="0 0 36 36"
                                aria-hidden="true"
                                focusable="false"
                            >
                                <circle className="chat-input-mic-ring-track" cx="18" cy="18" r="15.5" />
                                <circle
                                    className="chat-input-mic-ring-progress"
                                    cx="18"
                                    cy="18"
                                    r="15.5"
                                    strokeDasharray={ringGeometry(recordingProgress).dashArray}
                                    strokeDashoffset={ringGeometry(recordingProgress).dashOffset}
                                />
                            </svg>
                        )}
                        {recording ? <StopIcon className="w-4 h-4" /> : <MicIcon className="w-5 h-5" />}
                    </button>
                </Tooltip>

                {recording && (
                    <span className="chat-input-timer" role="timer" aria-live="off">
                        {formatDuration(elapsedMs)}
                        <span className="chat-input-timer-limit">/{formatDuration(MAX_RECORDING_MS)}</span>
                    </span>
                )}

                <button
                    type="button"
                    className="btn-primary chat-input-send"
                    onClick={submit}
                    disabled={!canSend}
                >
                    {t('chat:input.send')}
                </button>
            </div>

            {/* One-time Enter/Shift+Enter hint (Task 02-8 step 5). */}
            {showHint && !state.disabled && (
                <div className="chat-input-hint">{t('chat:input.enterHint')}</div>
            )}

            {showEmoji && (
                <EmojiPicker
                    entityId={entityId}
                    onPick={pickEmoji}
                    onPickAction={onSendEmojiAction}
                    onClose={() => setShowEmoji(false)}
                />
            )}
        </div>
    );
};

export default ChatInput;
