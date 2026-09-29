import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SmileIcon, ImageIcon, MicIcon, StopIcon } from '../../constants/icons.jsx';
import EmojiPicker from './EmojiPicker.jsx';

/**
 * Chat input box (F4) with an emoji picker (F11), a picture button (F15) and a
 * voice-note recorder (F7).
 *
 * Enter sends, Shift+Enter inserts a newline. Voice notes are recorded with the
 * browser MediaRecorder and handed to the caller as base64 (no data-URL prefix),
 * matching the engine's utterance contract.
 */
const ChatInput = ({ onSendText, onSendAudio, onSendImage, onSendEmojiAction, disabled }) => {
    const { t } = useTranslation();
    const [text, setText] = useState('');
    const [showEmoji, setShowEmoji] = useState(false);
    const [recording, setRecording] = useState(false);
    const [error, setError] = useState(null);

    const fileInputRef = useRef(null);
    const recorderRef = useRef(null);
    const chunksRef = useRef([]);
    const startedAtRef = useRef(0);

    const submit = () => {
        const value = text.trim();
        if (!value) return;
        onSendText?.(value);
        setText('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
        }
    };

    const pickEmoji = (emoji) => {
        setText((prev) => prev + emoji);
        setShowEmoji(false);
    };

    const handleImagePick = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const result = String(reader.result || '');
            const base64 = result.includes(',') ? result.split(',')[1] : result;
            onSendImage?.({ imageBase64: base64, mimeType: file.type || 'image/png', caption: '' });
        };
        reader.onerror = () => setError(t('chat:errors.generic'));
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const startRecording = async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            chunksRef.current = [];
            startedAtRef.current = Date.now();
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) chunksRef.current.push(event.data);
            };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
                const duration = (Date.now() - startedAtRef.current) / 1000;
                const reader = new FileReader();
                reader.onload = () => {
                    const result = String(reader.result || '');
                    const base64 = result.includes(',') ? result.split(',')[1] : result;
                    onSendAudio?.({ audioBase64: base64, mimeType: blob.type, duration });
                };
                reader.onerror = () => setError(t('chat:input.recordingFailed'));
                reader.readAsDataURL(blob);
                stream.getTracks().forEach((track) => track.stop());
            };
            recorderRef.current = recorder;
            recorder.start();
            setRecording(true);
        } catch {
            setError(t('chat:input.micDenied'));
        }
    };

    const stopRecording = () => {
        recorderRef.current?.stop();
        recorderRef.current = null;
        setRecording(false);
    };

    return (
        <div className="chat-input-wrap">
            {error && <div className="chat-input-error">{error}</div>}

            <div className="chat-input-bar">
                <button
                    type="button"
                    className="chat-input-icon-btn"
                    title={t('chat:input.emoji')}
                    onClick={() => setShowEmoji((v) => !v)}
                >
                    <SmileIcon className="w-5 h-5" />
                </button>
                <button
                    type="button"
                    className="chat-input-icon-btn"
                    title={t('chat:input.attachImage')}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <ImageIcon className="w-5 h-5" />
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImagePick}
                />

                <textarea
                    className="chat-input-textarea"
                    rows={1}
                    value={text}
                    placeholder={t('chat:input.placeholder')}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled || recording}
                />

                <button
                    type="button"
                    className={`chat-input-icon-btn ${recording ? 'chat-input-icon-btn-recording' : ''}`}
                    title={recording ? t('chat:input.stopRecording') : t('chat:input.record')}
                    onClick={recording ? stopRecording : startRecording}
                    disabled={disabled}
                >
                    {recording ? <StopIcon className="w-5 h-5" /> : <MicIcon className="w-5 h-5" />}
                </button>

                <button
                    type="button"
                    className="btn-primary chat-input-send"
                    onClick={submit}
                    disabled={disabled || !text.trim()}
                >
                    {t('chat:input.send')}
                </button>
            </div>

            {showEmoji && (
                <EmojiPicker
                    onPick={pickEmoji}
                    onPickAction={onSendEmojiAction}
                    onClose={() => setShowEmoji(false)}
                />
            )}
        </div>
    );
};

export default ChatInput;
