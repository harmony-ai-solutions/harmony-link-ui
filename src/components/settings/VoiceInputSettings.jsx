import { useTranslation } from 'react-i18next';
import MicIssuePanel from '../chat/MicIssuePanel.jsx';
import SttTestPanel from './SttTestPanel.jsx';

/**
 * Voice Input settings section (Task 04-2 step 2, first half).
 *
 * Blank page on purpose, apart from the diagnostic: the STT *module* config
 * (provider, model, language) lives under Modules → STT, and duplicating it here
 * would create two places to edit one thing. What was missing was a way to find
 * out whether the machine can record at all, so this section answers exactly
 * that and links to the module screen for the rest.
 *
 * The check runs when this section is opened (mount) and it does NOT prompt:
 * `MicIssuePanel` defaults `requestAccess` to `false`, so opening Settings never
 * raises a microphone dialog — task 04-2 step 3. The only control that asks for
 * permission is the panel's own Retry, which is an explicit user action.
 */
const VoiceInputSettings = () => {
    const { t } = useTranslation();

    return (
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h2 className="text-lg font-bold text-text-primary pb-2 mb-6 flex items-center gap-3">
                <span className="text-gradient-primary">{t('chat:mic.settingsSection')}</span>
            </h2>

            <p className="mic-voice-section-note">{t('chat:mic.settingsDescription')}</p>

            {/* `autoCheck` is the whole point: opening this screen tells the user
                what the microphone situation is without asking for anything. */}
            <MicIssuePanel autoCheck showSupportHint />

            <div className="mic-voice-supported">
                <p className="font-semibold text-text-primary mb-1">
                    {t('chat:mic.managePermissions')}
                </p>
                <p>{t('chat:mic.managePermissionsBody')}</p>
            </div>

            {/* Task 04-5. The recorder check above answers "can this machine
                record at all"; this panel answers the next question — "and can
                the engine turn what it recorded into text?" — by running one
                real transcription against the resolved config. */}
            <SttTestPanel />
        </section>
    );
};

export default VoiceInputSettings;
