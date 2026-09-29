import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PlayIcon, PauseIcon } from '../../constants/icons.jsx';
import { toggle as togglePlayback, subscribe, getState, formatDuration } from '../../services/chat/audioPlayer.js';
import { fetchMessageAudioObjectUrl } from '../../services/management/chatService.js';

/**
 * Audio bubble (F8): a play/pause button, a progress bar and a duration label.
 * All playback routes through the single shared player (audioPlayer.js) so only
 * one voice note plays at a time.
 */
const AudioBubble = ({ message }) => {
    const { t } = useTranslation();
    const [playing, setPlaying] = useState(false);
    const [duration, setDuration] = useState(message.audio_duration || 0);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const unsubscribe = subscribe((state) => {
            const isThis = state.playingMessageId === message.id;
            setPlaying(isThis);
            if (isThis) {
                setProgress(state.duration ? state.currentTime / state.duration : 0);
                if (state.duration) setDuration(state.duration);
            } else {
                setProgress(0);
            }
        });
        return unsubscribe;
    }, [message.id]);

    const handleToggle = () => {
        togglePlayback(message.id, () => fetchMessageAudioObjectUrl(message.id));
    };

    return (
        <div className="chat-audio-bubble">
            <button
                type="button"
                className="chat-audio-play"
                onClick={handleToggle}
                aria-label={playing ? t('chat:bubble.pause') : t('chat:bubble.play')}
            >
                {playing ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4" />}
            </button>
            <div className="chat-audio-track">
                <div className="chat-audio-progress" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span className="chat-audio-duration">{formatDuration(duration)}</span>
        </div>
    );
};

export default AudioBubble;
