import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { nextGreetingIndex, truncatePreview } from '../../store/chatStoreUtils.js';

/**
 * "Try another greeting" control (Task 02-7 step 3).
 *
 * Rendered under the FIRST message of a thread while the thread is still in its
 * opening state (first message is `message_type = 'greeting'`, the user has not
 * spoken yet). It cycles through the character's authored
 * `character_profiles.alternate_greetings` and sends the chosen text as the
 * user's first message.
 *
 * ── Two buttons, not one ─────────────────────────────────────────────────
 *
 * A single button that both cycles and sends would let a mis-click fire a
 * message the user never read — and it is irreversible, because the opening is
 * consumed on send. So cycling only PREVIEWS and the send is explicit.
 *
 * ── Why the alternates are not requested here ────────────────────────────
 *
 * They ride on the chat-entity option (`alternate_greetings`, lifted from the
 * nested profile by `listChatEntities`) which ChatView has already loaded, so
 * this control costs no extra request and cannot flicker a spinner inside a
 * message list.
 *
 * @param {object} props
 * @param {string[]} props.greetings - authored alternates (may be empty)
 * @param {(text: string) => void} props.onSend - send the chosen greeting
 * @param {boolean} [props.disabled] - socket offline / AI disabled
 */
const GreetingAlternates = ({ greetings, onSend, disabled = false }) => {
    const { t } = useTranslation();
    const list = Array.isArray(greetings) ? greetings.filter(Boolean) : [];
    const [index, setIndex] = useState(0);

    /**
     * Reset to the first alternate when the LIST changes (a different character
     * opened). Keyed on the joined text rather than on the array identity: a
     * store re-render hands over a fresh array of the same strings, and resetting
     * on that would yank the user back to the first greeting mid-choice.
     */
    const signature = list.join('\u0000');
    useEffect(() => {
        setIndex(0);
    }, [signature]);

    const selected = useMemo(() => list[index] || '', [list, index]);

    if (list.length === 0) return null;

    // One authored greeting is not a choice — there is nothing to cycle to.
    if (list.length === 1) return null;

    return (
        <div className="chat-greeting-alternates">
            <div className="chat-greeting-alternates-head">
                <span className="chat-greeting-alternates-label">
                    {t('chat:conversation.greeting.title')}
                </span>
                <span className="chat-greeting-alternates-count">
                    {t('chat:conversation.greeting.position', {
                        current: index + 1,
                        total: list.length,
                    })}
                </span>
            </div>
            <p className="chat-greeting-alternates-preview">
                {truncatePreview(selected, 180)}
            </p>
            <div className="chat-greeting-alternates-actions">
                <button
                    type="button"
                    className="chat-greeting-alternates-cycle"
                    onClick={() => setIndex((current) => nextGreetingIndex(current, list.length))}
                >
                    {t('chat:conversation.greeting.cycle')}
                </button>
                <button
                    type="button"
                    className="btn-primary chat-greeting-alternates-send"
                    disabled={disabled || !selected}
                    onClick={() => onSend(selected)}
                >
                    {t('chat:conversation.greeting.send')}
                </button>
            </div>
        </div>
    );
};

export default GreetingAlternates;
