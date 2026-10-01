import { useTranslation } from 'react-i18next';

/**
 * Typing / recording dots (F5). Renders the three-dot animation plus a label.
 * Driven by the TYPING_INDICATOR / RECORDING_INDICATOR socket events.
 */
const TypingIndicator = ({ name, recording = false, compact = false }) => {
    const { t } = useTranslation();
    const label = recording
        ? t('chat:status.recording', { name })
        : t('chat:status.typing', { name });

    if (compact) {
        return (
            <span className="chat-typing-dots" aria-label={label}>
                <span /><span /><span />
            </span>
        );
    }

    return (
        <div className="chat-typing-row">
            <div className="chat-typing-bubble">
                <span className="chat-typing-dots"><span /><span /><span /></span>
                <span className="chat-typing-label">{label}</span>
            </div>
        </div>
    );
};

export default TypingIndicator;
