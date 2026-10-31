import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '../../store/toastStore.js';
import { openMicSoundSettings } from '../../services/management/systemService.js';
import {
    MIC_ACTIONS,
    actionHasButton,
    actionPrompts,
    buildMicIssue,
} from '../../services/audio/micDiagnosticsUtils.js';
import { checkMicrophone, rememberMicIssue } from '../../services/audio/micDiagnostics.js';

/**
 * Microphone status / recovery panel (Task 04-2).
 *
 * Two modes, one visual language:
 *
 *   - **controlled** (`issue` prop) — the composer owns the result, because it
 *     is the take itself that failed. The panel reports every re-check through
 *     `onResolved` so the owner can clear it.
 *   - **self-checking** (`autoCheck`) — the Voice Input settings section simply
 *     mounts it, and the panel runs a NON-PROMPTING check on open (step 2's
 *     "when the Voice Input settings screen opens"). That is safe precisely
 *     because `checkMicrophone` only asks for permission on an explicit Retry.
 *
 * Every failure renders its own title, its own sentence and its own buttons, so
 * the three classes cannot be mistaken for one another. A reason with no useful
 * action renders no button rather than a dead one.
 *
 * @param {object} props
 * @param {object|null} [props.issue] - a controlled diagnostic result
 * @param {boolean} [props.autoCheck] - run a non-prompting check on mount
 * @param {boolean} [props.requestAccess] - let the mount check prompt (off by default)
 * @param {boolean} [props.compact] - composer layout
 * @param {boolean} [props.showSupportHint] - append the manual-where-to-click hint
 * @param {(issue: object) => void} [props.onResolved] - every re-check result
 * @param {() => void} [props.onDismiss] - render a dismiss control
 */
const MicIssuePanel = ({
    issue: controlledIssue = null,
    autoCheck = false,
    requestAccess = false,
    compact = false,
    showSupportHint = false,
    onResolved,
    onDismiss,
}) => {
    const { t } = useTranslation();
    const [checkedIssue, setCheckedIssue] = useState(null);
    const [checking, setChecking] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => () => { mountedRef.current = false; }, []);

    /** The controlled value wins; the self-checked one fills in otherwise. */
    const issue = controlledIssue ?? checkedIssue;

    /**
     * Run one check.
     *
     * `prompt` is passed explicitly rather than derived from state so the mount
     * path can say "never prompt" and the Retry path "do prompt" without a
     * second render deciding to raise a dialog.
     */
    const runCheck = useCallback(async (prompt) => {
        setChecking(true);
        try {
            const result = await checkMicrophone({ requestAccess: prompt });
            if (!mountedRef.current) return;
            setCheckedIssue(result);
            rememberMicIssue(result.reason);
            onResolved?.(result);
        } catch {
            // `checkMicrophone` is written not to throw; a throw means a genuinely
            // broken environment, which is reported as unknown rather than as
            // "your microphone is fine".
            if (!mountedRef.current) return;
            const fallback = buildMicIssue({ ok: false, reason: 'unknown' });
            setCheckedIssue(fallback);
            rememberMicIssue('unknown');
            onResolved?.(fallback);
        } finally {
            if (mountedRef.current) setChecking(false);
        }
    }, [onResolved]);

    // Mount check. Deliberately non-prompting unless the caller opts in — task
    // 04-2 step 3: never auto-prompt on app start.
    useEffect(() => {
        if (!autoCheck) return;
        runCheck(requestAccess);
        // Once per mount: `runCheck` is stable for a stable `onResolved`, and
        // re-running per render would re-enumerate devices on every keystroke.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /** Retry is the ONE action allowed to raise a permission dialog. */
    const runAction = useCallback((action) => {
        if (!actionHasButton(action)) return;
        if (actionPrompts(action)) {
            runCheck(true);
            return;
        }
        if (action === MIC_ACTIONS.OPEN_SOUND_SETTINGS) {
            openMicSoundSettings().catch(() => {
                toast.error(t('chat:mic.openSoundSettingsFailed'));
            });
        }
    }, [runCheck, t]);

    if (!issue) return null;

    const { copy, actions } = issue;
    const primaryLabel = t(copy.primary, { defaultValue: '' });
    const secondaryLabel = t(copy.secondary, { defaultValue: '' });
    const showPrimary = actionHasButton(actions.primary) && primaryLabel.length > 0;
    const showSecondary = actionHasButton(actions.secondary) && secondaryLabel.length > 0;

    return (
        <div
            className={`mic-issue mic-issue-${compact ? 'compact' : 'full'} is-${issue.reason}`}
            role={issue.ok ? 'status' : 'alert'}
            aria-live={issue.ok ? 'polite' : 'assertive'}
        >
            <div className="mic-issue-main">
                <span className="mic-issue-icon" aria-hidden="true">
                    {issue.ok ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                    )}
                </span>

                <div className="mic-issue-text">
                    <p className="mic-issue-title">{t(copy.title)}</p>
                    <p className="mic-issue-body">
                        {issue.ok ? t('chat:input.micAvailable') : t(copy.body)}
                    </p>
                    {issue.ok && issue.devices.length > 0 && (
                        <p className="mic-issue-meta">
                            {t('chat:input.micDeviceCount', { count: issue.devices.length })}
                        </p>
                    )}
                </div>
            </div>

            <div className="mic-issue-actions">
                {showPrimary && (
                    <button
                        type="button"
                        className="mic-issue-btn mic-issue-btn-primary"
                        onClick={() => runAction(actions.primary)}
                        disabled={checking}
                    >
                        {checking ? t('chat:mic.checking') : primaryLabel}
                    </button>
                )}
                {showSecondary && (
                    <button
                        type="button"
                        className="mic-issue-btn"
                        onClick={() => runAction(actions.secondary)}
                        disabled={checking}
                    >
                        {secondaryLabel}
                    </button>
                )}
                {onDismiss && (
                    <button
                        type="button"
                        className="mic-issue-btn mic-issue-btn-quiet"
                        onClick={onDismiss}
                    >
                        {t('common:buttons.close')}
                    </button>
                )}
            </div>

            {showSupportHint && !issue.ok && (
                <p className="mic-issue-support">
                    {t('chat:mic.supportHint')}
                </p>
            )}
        </div>
    );
};

export default MicIssuePanel;
