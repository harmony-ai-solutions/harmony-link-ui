import { useTranslation } from 'react-i18next';
import { UsersIcon } from '../../constants/icons.jsx';

/**
 * Impersonation selector (F12): choose which persona the user is chatting "as".
 * The chosen entity id is what messages are sent with (`entity_id` on the
 * utterance), so the AI companions relate to that identity.
 *
 * @param {{ personas: Array<{id: string, display_name?: string, alias?: string}>,
 *   value: string, onChange: (id: string) => void }} props
 */
const ImpersonationSelector = ({ personas, value, onChange }) => {
    const { t } = useTranslation();
    if (!personas || personas.length === 0) return null;

    return (
        <label className="chat-impersonation">
            <UsersIcon className="w-4 h-4 text-text-muted" />
            <span className="chat-impersonation-label">{t('chat:impersonation.label')}</span>
            <select
                className="chat-impersonation-select"
                value={value || ''}
                onChange={(e) => onChange?.(e.target.value)}
                title={t('chat:impersonation.description')}
            >
                {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                        {persona.display_name || persona.alias || persona.id}
                    </option>
                ))}
            </select>
        </label>
    );
};

export default ImpersonationSelector;
