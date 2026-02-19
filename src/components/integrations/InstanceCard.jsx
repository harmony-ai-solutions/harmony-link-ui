import React, { useState, useEffect, useCallback } from 'react';
import { getInstanceWebURLs, cancelIntegrationInstanceOperation } from '../../services/management/integrationsService.js';
import { openSystemUrl } from '../../services/management/systemService.js';
import RenameInstanceModal from './RenameInstanceModal.jsx';

const InstanceCard = ({ integrationName, instanceName, instance, onControl, onConfigure, onConfigFiles, onRename, currentOperation }) => {
    const [webURLs, setWebURLs] = useState([]);
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [showLogsModal, setShowLogsModal] = useState(false);
    const [showContainers, setShowContainers] = useState(false);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [showErrorTooltip, setShowErrorTooltip] = useState(false);

    // Web URL polling
    useEffect(() => {
        let interval;

        const fetchWebURLs = async () => {
            if (instance.status === 'running') {
                try {
                    const data = await getInstanceWebURLs(integrationName, instanceName);
                    setWebURLs(data.webURLs);
                } catch (error) {
                    console.error(`Failed to fetch web URLs for ${integrationName}/${instanceName}:`, error);
                    setWebURLs([]);
                }
            } else {
                setWebURLs([]);
            }
        };

        fetchWebURLs();

        if (instance.status === 'running') {
            interval = setInterval(fetchWebURLs, 5000);
        }

        return () => { if (interval) clearInterval(interval); };
    }, [integrationName, instanceName, instance.status]);

    // Elapsed time ticker for logs modal
    useEffect(() => {
        if (!showLogsModal || !currentOperation?.inProgress || !currentOperation?.startTime) return;

        const tick = () => {
            setElapsedSeconds(Math.floor((Date.now() - new Date(currentOperation.startTime).getTime()) / 1000));
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [showLogsModal, currentOperation]);

    const getStatusDotClass = (status) => {
        switch (status) {
            case 'running': return 'bg-green-500';
            case 'stopped': return 'bg-red-500';
            case 'configured': return 'bg-blue-500';
            case 'not_found': return 'bg-gray-500';
            case 'docker_unavailable': return 'bg-yellow-500';
            case 'partially_running': return 'bg-orange-500';
            case 'error': return 'bg-purple-500';
            default: return 'bg-gray-500';
        }
    };

    const getDeviceIcon = (deviceType) => {
        switch (deviceType) {
            case 'nvidia': return '🟢';
            case 'amd': return '🔴';
            case 'amd-wsl': return '🔴';
            case 'intel': return '🔵';
            case 'cpu': return '💻';
            default: return '⚙️';
        }
    };

    const handleOpenWebInterface = async (url) => {
        try {
            await openSystemUrl(url);
        } catch (error) {
            console.log('System browser opening failed, falling back to window.open:', error.message);
            window.open(url, '_blank');
        }
    };

    const hasActiveContainers = () => {
        return instance.containers && instance.containers.some(c => c.state !== 'not_created');
    };

    const handleRename = async (newInstanceName) => {
        try {
            await onRename(integrationName, instanceName, newInstanceName);
            setShowRenameModal(false);
        } catch (error) {
            console.error('Failed to rename instance:', error);
            throw error;
        }
    };

    const handleCancelOperation = async () => {
        try {
            await cancelIntegrationInstanceOperation(integrationName, instanceName);
        } catch (error) {
            console.error('Failed to cancel operation:', error);
        }
    };

    const formatProgressLine = (line) => {
        const progressMatch = line.match(/^(.+?)\s+(\[=*>?\s*\])\s*(.+)$/);
        if (!progressMatch) return line;

        const [, prefix, , suffix] = progressMatch;
        const maxProgressWidth = 20;
        let progressPercent = 0;

        const percentMatch = suffix.match(/(\d+(?:\.\d+)?)%/);
        if (percentMatch) {
            progressPercent = parseFloat(percentMatch[1]);
        } else {
            const sizeMatch = suffix.match(/(\d+(?:\.\d+)?[KMGT]?B)\/(\d+(?:\.\d+)?[KMGT]?B)/);
            if (sizeMatch) {
                const current = parseFloat(sizeMatch[1]);
                const total = parseFloat(sizeMatch[2]);
                if (total > 0) progressPercent = (current / total) * 100;
            }
        }

        const filledWidth = Math.floor((progressPercent / 100) * maxProgressWidth);
        const emptyWidth = maxProgressWidth - filledWidth - 1;
        const bar = '[' +
            '='.repeat(Math.max(0, filledWidth)) +
            (filledWidth > 0 ? '>' : '') +
            ' '.repeat(Math.max(0, emptyWidth)) +
            ']';

        return `${prefix} ${bar} ${suffix}`;
    };

    const isRunning = instance.status === 'running' || instance.status === 'partially_running';
    const imagePullKeys = currentOperation?.progress?.imagePulls
        ? Object.keys(currentOperation.progress.imagePulls)
        : [];

    return (
        <div className="instance-row">
            {/* Subtle accent-secondary tint overlay */}
            <div className="instance-row-tint" />

            {/* ── Main instance row ─────────────────────────────────────── */}
            <div className="relative flex items-center gap-2.5 pl-14 pr-4 py-2.5 flex-wrap">

                {/* [1] Status dot */}
                <span className={`flex-shrink-0 w-2 h-2 rounded-full ${getStatusDotClass(instance.status)}`} />

                {/* [2] Instance name — no forced truncation, wraps if needed */}
                <span
                    className="text-sm font-semibold min-w-0 break-words"
                    style={{ color: 'var(--color-text-primary)' }}
                >
                    {instance.name}
                </span>

                {/* [3] Device type badge */}
                {instance.deviceType && (
                    <span
                        className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full"
                        style={{
                            backgroundColor: 'var(--color-background-surface)',
                            border: '1px solid var(--color-border-default)',
                            color: 'var(--color-text-secondary)',
                        }}
                    >
                        {getDeviceIcon(instance.deviceType)} {instance.deviceType.toUpperCase()}
                    </span>
                )}

                {/* [4] Status label — suppressed when an error is present (error badge takes its place) */}
                {!instance.error && (
                    <span className="text-xs flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
                        {instance.status?.replace(/_/g, ' ') ?? 'N/A'}
                    </span>
                )}

                {/* [5] Error badge — replaces status text; hover reveals styled tooltip immediately */}
                {instance.error && (
                    <span className="relative flex-shrink-0 inline-flex items-center">
                        {/* Warning icon trigger — no background or border, just the symbol */}
                        <span
                            className="text-sm cursor-help inline-flex items-center leading-none"
                            style={{ color: 'var(--color-warning)' }}
                            onMouseEnter={() => setShowErrorTooltip(true)}
                            onMouseLeave={() => setShowErrorTooltip(false)}
                        >
                            ⚠
                        </span>

                        {/* Immediate hover tooltip — positioned above the badge */}
                        {showErrorTooltip && (
                            <div
                                className="absolute bottom-full left-0 mb-2 z-30 text-xs rounded px-2.5 py-1.5 pointer-events-none"
                                style={{
                                    backgroundColor: 'var(--color-background-elevated)',
                                    border: '1px solid var(--color-warning)',
                                    color: 'var(--color-text-primary)',
                                    boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
                                    whiteSpace: 'normal',
                                    wordBreak: 'break-word',
                                    minWidth: '14rem',
                                    maxWidth: '24rem',
                                }}
                            >
                                {instance.error}
                            </div>
                        )}
                    </span>
                )}

                {/* [6] Inline operation progress (compact, while operation active) */}
                {currentOperation?.inProgress && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div
                            className="w-3 h-3 rounded-full animate-spin flex-shrink-0"
                            style={{
                                border: '2px solid transparent',
                                borderBottomColor: 'var(--color-accent-primary)',
                                borderRightColor: 'var(--color-accent-primary)',
                            }}
                        />
                        <span
                            className="text-xs truncate max-w-36"
                            style={{ color: 'var(--color-text-secondary)' }}
                        >
                            {currentOperation.message ?? `${currentOperation.type}…`}
                        </span>
                        {currentOperation.progress && (
                            <div
                                className="w-16 rounded-full h-1.5 flex-shrink-0"
                                style={{ backgroundColor: 'var(--color-background-surface)' }}
                            >
                                <div
                                    className="h-1.5 rounded-full transition-all duration-300"
                                    style={{
                                        width: `${currentOperation.progress.overallPercent}%`,
                                        backgroundColor: 'var(--color-accent-primary)',
                                    }}
                                />
                            </div>
                        )}
                    </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* [7] Action buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">

                    <button
                        onClick={() => onConfigure(integrationName, instanceName)}
                        disabled={!!currentOperation}
                        className="instance-action-btn"
                    >
                        Configure
                    </button>

                    {isRunning ? (
                        <button
                            onClick={() => onControl(integrationName, instanceName, 'stop')}
                            disabled={!!currentOperation}
                            className="instance-action-btn-danger"
                        >
                            {currentOperation?.type === 'stop' ? 'Stopping…' : 'Stop'}
                        </button>
                    ) : (
                        <button
                            onClick={() => onControl(integrationName, instanceName, 'start')}
                            disabled={!!currentOperation}
                            className="instance-action-btn-success"
                        >
                            {currentOperation?.type === 'start' ? 'Starting…' : 'Start'}
                        </button>
                    )}

                    <button
                        onClick={() => onControl(integrationName, instanceName, 'restart')}
                        disabled={!!currentOperation}
                        className="instance-action-btn-warning"
                    >
                        {currentOperation?.type === 'restart' ? 'Restarting…' : 'Restart'}
                    </button>

                    <button
                        onClick={() => onConfigFiles(integrationName, instanceName)}
                        disabled={!!currentOperation}
                        className="instance-action-btn-info"
                    >
                        Config Files
                    </button>

                    <button
                        onClick={() => setShowRenameModal(true)}
                        disabled={!!currentOperation || hasActiveContainers()}
                        className="instance-action-btn"
                        title={hasActiveContainers() ? 'Cannot rename while Docker containers exist' : 'Rename instance'}
                    >
                        Rename
                    </button>

                    {isRunning && webURLs && webURLs.map((url, i) => (
                        <button
                            key={`web-ui-${i}`}
                            onClick={() => handleOpenWebInterface(url)}
                            className="instance-action-btn-accent"
                        >
                            Open Web UI
                        </button>
                    ))}

                    {/* Logs icon button — opens operation log modal */}
                    {currentOperation && (
                        <button
                            onClick={() => setShowLogsModal(true)}
                            className="instance-action-btn-icon"
                            title="View operation logs"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z" />
                            </svg>
                        </button>
                    )}

                    {/* Container details toggle */}
                    {instance.containers && instance.containers.length > 0 && (
                        <button
                            onClick={() => setShowContainers(!showContainers)}
                            className="instance-action-btn-icon"
                            title={showContainers ? 'Hide containers' : 'Show container details'}
                        >
                            <svg
                                className="w-3.5 h-3.5"
                                style={{
                                    transform: showContainers ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.2s ease',
                                }}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    )}

                </div>
            </div>

            {/* ── Container Details Expansion ───────────────────────────── */}
            {showContainers && instance.containers && instance.containers.length > 0 && (
                <div
                    className="pl-14 pr-4 pb-3"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                >
                    <div
                        className="mt-1.5 rounded-lg overflow-hidden"
                        style={{
                            border: '1px solid var(--color-border-default)',
                            backgroundColor: 'var(--color-background-base)',
                        }}
                    >
                        {/* Header */}
                        <div
                            className="px-3 py-1.5"
                            style={{
                                borderBottom: '1px solid rgba(255,255,255,0.06)',
                                background: 'linear-gradient(to right, var(--color-background-elevated), transparent)',
                            }}
                        >
                            <span
                                className="text-xs font-semibold uppercase tracking-wide"
                                style={{ color: 'var(--color-text-secondary)' }}
                            >
                                Containers
                            </span>
                        </div>

                        {/* Container rows */}
                        {instance.containers.map((container, idx) => (
                            <div
                                key={container.id || idx}
                                className="flex items-center gap-3 px-3 py-1.5 text-xs"
                                style={{
                                    color: 'var(--color-text-muted)',
                                    borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                                }}
                            >
                                <span
                                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${container.state === 'running' ? 'bg-green-500' : 'bg-gray-500'}`}
                                />
                                <span className="font-medium flex-shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                                    {container.name}
                                </span>
                                <span>{container.state}</span>
                                {container.health && <span>({container.health})</span>}
                                {container.ports && container.ports.length > 0 && (
                                    <span className="ml-1">
                                        Ports: {container.ports.map(p => `${p.publicPort || p.privatePort}/${p.type}`).join(', ')}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Rename Modal ─────────────────────────────────────────── */}
            <RenameInstanceModal
                isOpen={showRenameModal}
                onClose={() => setShowRenameModal(false)}
                onRename={handleRename}
                integrationName={integrationName}
                instanceName={instanceName}
                deviceType={instance.deviceType}
            />

            {/* ── Operation Logs Modal ──────────────────────────────────── */}
            {showLogsModal && currentOperation && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowLogsModal(false)}
                >
                    <div
                        className="relative w-[600px] max-h-[72vh] flex flex-col rounded-xl overflow-hidden"
                        style={{
                            border: '1px solid var(--color-border-default)',
                            background: 'linear-gradient(135deg, var(--color-background-elevated) 0%, var(--color-background-base) 100%)',
                            boxShadow: '0 25px 60px -12px rgba(0,0,0,0.6)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div
                            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                            style={{
                                borderBottom: '1px solid rgba(255,255,255,0.08)',
                                background: 'linear-gradient(135deg, var(--color-nuance-integrations), transparent 60%)',
                                backgroundSize: '100% 100%',
                            }}
                        >
                            <div
                                className="absolute inset-x-0 top-0 h-full pointer-events-none"
                                style={{
                                    background: 'linear-gradient(135deg, var(--color-nuance-integrations) 0%, transparent 55%)',
                                    opacity: 0.1,
                                }}
                            />
                            <div className="relative flex items-center gap-2.5">
                                <div
                                    className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: 'var(--color-nuance-integrations)', opacity: 0.8 }}
                                >
                                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0121 9.414V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                        Operation Logs — {instanceName}
                                    </h4>
                                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                        {currentOperation.type} · {elapsedSeconds}s elapsed
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowLogsModal(false)}
                                className="relative text-lg leading-none transition-colors"
                                style={{ color: 'var(--color-text-muted)' }}
                            >
                                ✕
                            </button>
                        </div>

                        {/* Progress bar */}
                        {currentOperation.progress && (
                            <div
                                className="px-4 py-2.5 flex-shrink-0"
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                            >
                                <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                                    <span>Step {currentOperation.progress.currentStep} of {currentOperation.progress.totalSteps}</span>
                                    <span>{currentOperation.progress.overallPercent}%</span>
                                </div>
                                <div
                                    className="w-full rounded-full h-1.5"
                                    style={{ backgroundColor: 'var(--color-background-surface)' }}
                                >
                                    <div
                                        className="h-1.5 rounded-full transition-all duration-300"
                                        style={{
                                            width: `${currentOperation.progress.overallPercent}%`,
                                            backgroundColor: 'var(--color-nuance-integrations)',
                                        }}
                                    />
                                </div>
                                {currentOperation.phase && (
                                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                        Phase: {currentOperation.phase.replace(/_/g, ' ')}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Image pull progress */}
                        {imagePullKeys.length > 0 && (
                            <div
                                className="px-4 py-2 flex-shrink-0"
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                            >
                                <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                                    Image Pulls:
                                </p>
                                {imagePullKeys.map(imageName => {
                                    const pull = currentOperation.progress.imagePulls[imageName];
                                    return (
                                        <div
                                            key={imageName}
                                            className="flex items-center justify-between text-xs mb-1"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        >
                                            <span className="truncate max-w-52" title={imageName}>
                                                {imageName.split(':')[0]}
                                            </span>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <span
                                                    className="px-1.5 py-0.5 rounded text-xs text-white"
                                                    style={{
                                                        backgroundColor:
                                                            pull.status === 'complete' ? 'var(--color-success)' :
                                                            pull.status === 'extracting' ? 'var(--color-warning)' :
                                                            'var(--color-info)',
                                                        opacity: 0.85,
                                                    }}
                                                >
                                                    {pull.status}
                                                </span>
                                                {pull.percent > 0 && <span>{pull.percent}%</span>}
                                                {pull.size && <span style={{ opacity: 0.6 }}>{pull.size}</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Scrollable log output */}
                        <div
                            className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs space-y-0.5"
                            style={{
                                backgroundColor: 'var(--color-background-base)',
                                color: 'var(--color-text-secondary)',
                            }}
                        >
                            {currentOperation.output && currentOperation.output.length > 0 ? (
                                currentOperation.output.map((line, i) => (
                                    <div key={i} className="truncate opacity-80" title={line}>
                                        {formatProgressLine(line)}
                                    </div>
                                ))
                            ) : (
                                <span className="italic" style={{ color: 'var(--color-text-muted)' }}>
                                    No output yet…
                                </span>
                            )}
                        </div>

                        {/* Footer */}
                        <div
                            className="flex justify-between items-center px-4 py-2.5 flex-shrink-0"
                            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
                        >
                            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                {currentOperation.inProgress ? 'Operation in progress…' : 'Operation complete.'}
                            </span>
                            {currentOperation.inProgress && (
                                <button
                                    onClick={handleCancelOperation}
                                    className="text-xs px-3 py-1 rounded font-semibold text-white transition-all"
                                    style={{ backgroundColor: 'var(--color-error)' }}
                                >
                                    Cancel Operation
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstanceCard;
