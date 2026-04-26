import React, { useMemo, useCallback } from 'react';
import { MODULE_CONFIGS } from '../../constants/moduleConfiguration.js';
import ModuleConfigInlineEditor from './ModuleConfigInlineEditor.jsx';
import {
    getConfigUrl,
    findMatchingInstances,
    isLocalProvider
} from '../../utils/integrationMatcher.js';
import { controlIntegrationInstance } from '../../services/management/integrationsService.js';

// Helper: format provider display text for a config
const getProviderDisplay = (config, moduleType) => {
    if (moduleType === 'stt') {
        const transcriptionProvider = config.transcription?.provider || 'None';
        const vadProvider = config.vad?.provider || 'None';
        return `Transcription: ${transcriptionProvider}, VAD: ${vadProvider}`;
    }
    return config.provider || 'Unknown';
};

// Helper: look up the logo for a given provider from MODULE_CONFIGS
const getProviderLogo = (moduleType, providerId) => {
    const moduleDef = MODULE_CONFIGS[moduleType];
    if (!moduleDef) return null;
    for (const pDef of moduleDef.providers) {
        const option = pDef.providerOptions.find(opt => opt.id === providerId);
        if (option && option.logo) return option.logo;
    }
    return null;
};

// Helper: get all provider logos for a config (handles STT dual-provider)
const getProviderLogos = (config, moduleType) => {
    if (moduleType === 'stt') {
        const transLogo = getProviderLogo(moduleType, config.transcription?.provider);
        const vadLogo = getProviderLogo(moduleType, config.vad?.provider);
        return [transLogo, vadLogo].filter(Boolean);
    }
    const logo = getProviderLogo(moduleType, config.provider);
    return logo ? [logo] : [];
};

// Helper: check if config has any local provider that could be matched
const hasLocalProvider = (config, moduleType) => {
    if (moduleType === 'stt') {
        const transProvider = config.transcription?.provider;
        const vadProvider = config.vad?.provider;
        return (transProvider && isLocalProvider(transProvider)) ||
               (vadProvider && isLocalProvider(vadProvider));
    }
    return config.provider && isLocalProvider(config.provider);
};

export default function ModuleConfigRow({
    config,
    moduleType,
    onEdit,
    onCopy,
    onDelete,
    isEditorOpen,
    onToggleEditor,
    allInstances,
    onInstancesRefresh
}) {
    const providerDisplay = getProviderDisplay(config, moduleType);
    const providerLogos = getProviderLogos(config, moduleType);

    // Find matching integration instances for this config
    const matchingInstances = useMemo(() => {
        if (!allInstances || !Array.isArray(allInstances) || allInstances.length === 0) {
            return [];
        }

        // Skip if config doesn't have a local provider
        if (!hasLocalProvider(config, moduleType)) {
            return [];
        }

        const configUrl = getConfigUrl(config, moduleType);
        if (!configUrl) return [];

        return findMatchingInstances(configUrl, allInstances);
    }, [config, moduleType, allInstances]);

    // Determine status based on matching instances
    const statusInfo = useMemo(() => {
        if (matchingInstances.length === 0) {
            return { type: 'none', message: '' };
        }

        // Check if any instance is fully running
        const runningInstance = matchingInstances.find(m => m.isRunning);
        if (runningInstance) {
            return { type: 'running', message: 'Integration running' };
        }

        // Check if any instance is partially running
        const partialInstance = matchingInstances.find(
            m => m.instance?.status === 'partially_running'
        );
        if (partialInstance) {
            return {
                type: 'partial',
                message: 'Integration partially running',
                instances: matchingInstances
            };
        }

        // All matched instances are inactive
        return {
            type: 'inactive',
            message: 'Integration offline',
            instances: matchingInstances
        };
    }, [matchingInstances]);

    // Handle start/restart button click
    const handleStart = useCallback(async () => {
        if ((statusInfo.type !== 'inactive' && statusInfo.type !== 'partial') || !statusInfo.instances) {
            return;
        }

        for (const item of statusInfo.instances) {
            try {
                await controlIntegrationInstance(item.integrationName, item.instanceName, 'start');
            } catch (e) {
                console.error(`Failed to start ${item.integrationName}/${item.instanceName}:`, e);
            }
        }

        // Refresh after starting
        if (onInstancesRefresh) {
            onInstancesRefresh();
        }
    }, [statusInfo, onInstancesRefresh]);

    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete the configuration "${config.name}"?`)) {
            onDelete(config.id, config.name);
        }
    };

    return (
        <div className="module-config-row">
            {/* Subtle accent-secondary tint overlay */}
            <div className="module-config-row-tint" />

            {/* ── Config sub-row ─────────────────────────────────────── */}
            <div className="relative flex items-center gap-2.5 pl-14 pr-4 py-2.5">

                {/* [1] Config name */}
                <span
                    className="text-sm font-semibold min-w-0 break-words"
                    style={{ color: 'var(--color-text-primary)' }}
                >
                    {config.name}
                </span>

                {/* [2] Provider badge with logo */}
                <span
                    className="flex-shrink-0 text-xs font-bold px-3 py-1 rounded-full border shadow-sm inline-flex items-center gap-1.5"
                    style={{
                        backgroundColor: 'var(--color-background-base)',
                        borderColor: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--color-text-secondary)'
                    }}
                >
                    {providerLogos.map((logo, i) => (
                        logo && <img key={i} src={logo} alt="" className="w-4 h-4 rounded" />
                    ))}
                    {providerDisplay}
                </span>

                {/* [Integration Status Indicator] */}
                {statusInfo.type === 'running' && (
                    <span
                        className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                        style={{
                            backgroundColor: 'rgba(34, 197, 94, 0.15)',
                            color: 'var(--color-success)'
                        }}
                        title={statusInfo.message}
                    >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-success)' }} />
                        Running
                    </span>
                )}

                {statusInfo.type === 'inactive' && (
                    <span className="flex-shrink-0 inline-flex items-center gap-2">
                        <span
                            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                            style={{
                                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                                color: 'var(--color-warning)'
                            }}
                            title={statusInfo.message}
                        >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-warning)' }} />
                            Offline
                        </span>
                        <button
                            onClick={handleStart}
                            className="instance-action-btn-success text-xs py-0.5 px-2"
                            title="Start integration"
                        >
                            Start
                        </button>
                    </span>
                )}

                {statusInfo.type === 'partial' && (
                    <span className="flex-shrink-0 inline-flex items-center gap-2">
                        <span
                            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                            style={{
                                backgroundColor: 'rgba(234, 179, 8, 0.15)',
                                color: 'var(--color-warning)'
                            }}
                            title={statusInfo.message}
                        >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-warning)' }} />
                            Partial
                        </span>
                        <button
                            onClick={handleStart}
                            className="instance-action-btn-success text-xs py-0.5 px-2"
                            title="Restart integration"
                        >
                            Restart
                        </button>
                    </span>
                )}

                {/* [3] Spacer */}
                <div className="flex-1" />

                {/* [4] Action buttons — named text buttons + chevron */}
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">

                    <button
                        onClick={() => onEdit(config)}
                        className="module-action-btn"
                        title="Edit Configuration"
                    >
                        Edit
                    </button>

                    <button
                        onClick={() => onCopy(config)}
                        className="module-action-btn"
                        title="Copy Configuration"
                    >
                        Copy
                    </button>

                    <button
                        onClick={handleDelete}
                        className="module-action-btn-danger"
                        title="Delete Configuration"
                    >
                        Delete
                    </button>

                    {/* Chevron toggle — expands/collapses inline editor */}
                    <button
                        onClick={onToggleEditor}
                        className="module-action-btn-icon"
                        title={isEditorOpen ? 'Hide Configuration' : 'Show Configuration'}
                    >
                        <svg
                            className="w-3.5 h-3.5"
                            style={{
                                transform: isEditorOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease',
                            }}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>

                </div>

            </div>

            {/* ── Inline Editor Expansion Panel ──────────────────────── */}
            {isEditorOpen && (
                <div className="pl-14 pr-4 pb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="mt-1.5">
                        <ModuleConfigInlineEditor
                            moduleType={moduleType}
                            mode="edit"
                            config={config}
                            onSave={() => onToggleEditor()}
                            onCancel={() => onToggleEditor()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}