import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAllIntegrationInstances from '../../hooks/useAllIntegrationInstances.js';
import { controlIntegrationInstance } from '../../services/management/integrationsService.js';
import { uploadPreset } from '../../services/management/presetService.js';
import { LogPrint } from '../../utils/logger.js';

/**
 * Local AI one-click setup card.
 *
 * Simple-mode helpers that let a beginner get a working AI without ever seeing
 * a provider form:
 *
 *  1. Local AI (Docker): shows whether the local inference integration is
 *     running and offers a one-click Start.
 *  2. Preset bundles: "Balanced", "Fast", and "High Quality" sampling presets,
 *     installed on demand through the existing preset system.
 *
 * All of this reuses existing services — no engine-side chat code involved.
 */

// Integration names that represent a local, Docker-hosted inference server.
const LOCAL_AI_INTEGRATIONS = [
    'llamacpp',
    'ollama',
    'vllm',
    'openaicompatible',
    'textgen',
    'koboldcpp',
    'aphrodite',
];

// Bundled preset names. The engine seeds matching YAML files at startup; these
// buttons re-upload them on demand so a fresh install works immediately.
const PRESET_BUNDLES = ['Balanced', 'Fast', 'High Quality'];

const LocalAISetupCard = () => {
    const { t } = useTranslation();
    const { allInstances, refresh, isLoading } = useAllIntegrationInstances(10000);

    const [busyInstance, setBusyInstance] = useState(null);
    const [feedback, setFeedback] = useState('');

    const localInstances = useMemo(
        () => allInstances.filter((i) => LOCAL_AI_INTEGRATIONS.includes(i.integrationName)),
        [allInstances],
    );

    const running = localInstances.filter((i) => i.instance?.state === 'running' || i.instance?.running);
    const stopped = localInstances.filter((i) => !(i.instance?.state === 'running' || i.instance?.running));

    const handleStart = async (integrationName, instanceName) => {
        const key = `${integrationName}/${instanceName}`;
        setBusyInstance(key);
        try {
            await controlIntegrationInstance(integrationName, instanceName, 'start');
            setFeedback(t('chat:localAI.startRequested'));
            // Give Docker a moment, then refresh the status.
            setTimeout(() => refresh(), 2500);
        } catch (err) {
            LogPrint('Failed to start local AI instance: ' + err.message);
            setFeedback(t('chat:localAI.startFailed'));
        } finally {
            setBusyInstance(null);
        }
    };

    const handleApplyBundle = async (name) => {
        try {
            // The engine also seeds these; uploading is idempotent and covers
            // installs where the presets directory was cleared.
            await uploadPreset(name, buildBundleYaml(name));
            setFeedback(t('chat:localAI.bundleReady', { name }));
        } catch (err) {
            LogPrint('Failed to install preset bundle: ' + err.message);
            setFeedback(t('chat:localAI.bundleFailed', { name }));
        }
    };

    return (
        <div className="card p-5 space-y-5">
            {/* Local AI status */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-text-primary">{t('chat:localAI.title')}</h3>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        running.length > 0
                            ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                            : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                    }`}>
                        {running.length > 0 ? t('chat:localAI.running') : t('chat:localAI.notRunning')}
                    </span>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed mb-3">
                    {t('chat:localAI.description')}
                </p>

                {isLoading ? (
                    <p className="text-xs text-text-muted">{t('common:status.loading')}</p>
                ) : localInstances.length === 0 ? (
                    <p className="text-xs text-text-muted">{t('chat:localAI.noInstances')}</p>
                ) : stopped.length > 0 ? (
                    <div className="space-y-2">
                        {stopped.slice(0, 3).map((i) => {
                            const key = `${i.integrationName}/${i.instanceName}`;
                            return (
                                <div key={key} className="flex items-center justify-between gap-3 bg-background-elevated/40 rounded-lg px-3 py-2">
                                    <span className="text-xs text-text-secondary truncate">
                                        {i.integration?.displayName || i.integrationName} · {i.instanceName}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn-primary text-xs px-3 py-1"
                                        disabled={busyInstance === key}
                                        onClick={() => handleStart(i.integrationName, i.instanceName)}
                                    >
                                        {busyInstance === key ? t('common:status.loading') : t('chat:localAI.start')}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-xs text-green-400">{t('chat:localAI.allRunning')}</p>
                )}
            </div>

            {/* Preset bundles */}
            <div className="pt-4 border-t border-white/5">
                <h3 className="text-sm font-bold text-text-primary mb-1">{t('chat:localAI.bundlesTitle')}</h3>
                <p className="text-[11px] text-text-muted leading-relaxed mb-3">
                    {t('chat:localAI.bundlesDescription')}
                </p>
                <div className="flex flex-wrap gap-2">
                    {PRESET_BUNDLES.map((name) => (
                        <button
                            key={name}
                            type="button"
                            className="btn-secondary text-xs px-3 py-1.5"
                            onClick={() => handleApplyBundle(name)}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            </div>

            {feedback && (
                <p className="text-[11px] text-accent-primary">{feedback}</p>
            )}
        </div>
    );
};

/** Builds the YAML body for a bundled preset (mirrors config/presets.go). */
function buildBundleYaml(name) {
    const bundles = {
        Balanced: 'description: A well-rounded default for everyday conversation.\ntemperature: 0.9\ntop_p: 0.95\ntop_k: 40\nmin_p: 0.05\nrepetition_penalty: 1.1\n',
        Fast: 'description: Lower latency and shorter replies — great for quick back-and-forth.\ntemperature: 0.7\ntop_p: 0.9\nmax_tokens: 256\ntop_k: 20\nrepetition_penalty: 1.05\n',
        'High Quality': 'description: More creative and detailed replies. Uses more resources per message.\ntemperature: 1.0\ntop_p: 0.98\nmax_tokens: 1024\ntop_k: 60\nmin_p: 0.02\nrepetition_penalty: 1.15\n',
    };
    return bundles[name] || '';
}

export default LocalAISetupCard;
