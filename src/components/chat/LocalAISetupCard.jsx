import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useAllIntegrationInstances from '../../hooks/useAllIntegrationInstances.js';
import { controlIntegrationInstance } from '../../services/management/integrationsService.js';
import { uploadPreset } from '../../services/management/presetService.js';
import { LogPrint } from '../../utils/logger.js';

/**
 * Local AI setup card.
 *
 * Rendered in General Settings (General → Local AI). It lets a beginner get a
 * working local model without ever seeing a provider form:
 *
 *  1. Shows whether a local, Docker-hosted inference service is running and
 *     offers a one-click Start for any stopped instance.
 *  2. Offers the bundled response-style presets, collapsed by default.
 *
 * All of this reuses existing services — no engine-side chat code involved.
 * The card has no outer surface of its own, so the host section provides the
 * container (card) styling.
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

/**
 * Whether a flattened instance entry is running.
 *
 * The aggregated status endpoint returns IntegrationInstance objects whose
 * running state lives on `status` (running / partially_running / stopped /
 * configured). `state` only exists on individual containers, so we check both
 * to stay robust across payload shapes.
 */
const isInstanceRunning = (entry) => {
    const status = entry.instance?.status;
    if (status === 'running' || status === 'partially_running') return true;
    return (entry.instance?.containers || []).some((c) => c.state === 'running');
};

const LocalAISetupCard = () => {
    const { t } = useTranslation();
    const { allInstances, refresh, isLoading } = useAllIntegrationInstances(10000);

    const [busyInstance, setBusyInstance] = useState(null);
    const [feedback, setFeedback] = useState('');
    const [showBundles, setShowBundles] = useState(false);

    const localInstances = useMemo(
        () => allInstances.filter((i) => LOCAL_AI_INTEGRATIONS.includes(i.integrationName)),
        [allInstances],
    );

    const running = localInstances.filter(isInstanceRunning);
    const stopped = localInstances.filter((i) => !isInstanceRunning(i));

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
        <div className="space-y-3">
            {/* Status line */}
            <div className="flex items-start justify-between gap-3">
                <p className="text-xs text-text-muted leading-relaxed">
                    {t('chat:localAI.description')}
                </p>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    running.length > 0
                        ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                        : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                }`}>
                    {running.length > 0 ? t('chat:localAI.running') : t('chat:localAI.notRunning')}
                </span>
            </div>

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

            {feedback && (
                <p className="text-[11px] text-accent-primary">{feedback}</p>
            )}

            {/* Response-style presets — collapsed by default to keep this tidy. */}
            <div className="pt-3 border-t border-white/5">
                <button
                    type="button"
                    className="flex items-center gap-2 w-full text-left text-xs font-semibold text-text-secondary hover:text-accent-primary transition-colors"
                    onClick={() => setShowBundles((v) => !v)}
                    aria-expanded={showBundles}
                >
                    <span className="text-[10px]">{showBundles ? '▾' : '▸'}</span>
                    {t('chat:localAI.bundlesTitle')}
                </button>
                {showBundles && (
                    <div className="mt-3">
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
                )}
            </div>
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
