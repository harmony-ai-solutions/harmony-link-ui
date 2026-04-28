import React, { useState } from 'react';
import ModuleConfigRow from './ModuleConfigRow.jsx';
import ModuleConfigInlineEditor from './ModuleConfigInlineEditor.jsx';

export default function ModuleCard({ moduleType, moduleInfo, configs, isLoading, onCreate, onEdit, onCopy, onDelete, onSaveNew, allInstances, onInstancesRefresh, dockerStatus }) {
    const [showConfigs, setShowConfigs] = useState(false);
    const [expandedConfigIds, setExpandedConfigIds] = useState(new Set());
    const [creatingConfig, setCreatingConfig] = useState(null);
    // creatingConfig: null | { mode: 'create', baseConfig: null } | { mode: 'copy', baseConfig: config }

    const configCount = configs.length;

    const toggleEditor = (configId) => {
        setExpandedConfigIds(prev => {
            const next = new Set(prev);
            if (next.has(configId)) {
                next.delete(configId);
            } else {
                next.add(configId);
            }
            return next;
        });
    };

    const handleAddConfig = () => {
        setCreatingConfig({ mode: 'create', baseConfig: null });
    };

    const handleCopy = (config) => {
        setCreatingConfig({ mode: 'copy', baseConfig: config });
    };

    return (
        <div className="module-row">
            {/* Accent tint overlay — top-left to transparent */}
            <div className="module-row-tint" />

            {/* Left accent stripe */}
            <div className="module-row-stripe" />

            {/* ── Main Row ──────────────────────────────────────────────── */}
            <div className="relative flex items-center gap-3 pl-5 pr-4 py-3">

                {/* [1] Chevron toggle */}
                <button
                    onClick={() => setShowConfigs(!showConfigs)}
                    className="module-row-chevron flex-shrink-0 w-6 h-6 flex items-center justify-center rounded"
                    title={showConfigs ? 'Hide Configurations' : 'Show Configurations'}
                >
                    <svg
                        className="w-4 h-4"
                        style={{
                            transform: showConfigs ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                        }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                </button>

                {/* [2] Module identity — emoji + name + description */}
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="module-row-name text-sm font-bold leading-tight break-words">
                        {moduleInfo.emoji} {moduleInfo.name}
                    </span>
                    <span className="text-xs leading-tight mt-0.5 break-words" style={{ color: 'var(--color-text-muted)' }}>
                        {moduleInfo.description}
                    </span>
                </div>

                {/* [3] Config count pill — centered in its own fixed-width zone */}
                <div className="flex items-center justify-center flex-shrink-0 w-48">
                    {isLoading ? (
                        <span className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
                            Loading…
                        </span>
                    ) : (
                        <span className="module-count-pill text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap">
                            {configCount === 0
                                ? 'No configs'
                                : `${configCount} config${configCount !== 1 ? 's' : ''}`}
                        </span>
                    )}
                </div>

                {/* [4] Action buttons — inline, left-anchored in their group */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={handleAddConfig}
                        className="btn-primary py-1 px-3 text-xs"
                    >
                        + Add Config
                    </button>
                </div>

            </div>

            {/* ── Expandable Config Sub-Rows ─────────────────────────── */}
            {showConfigs && (
                <div className="module-config-rows-container">
                    {/* Temporary New/Copy Config Row */}
                    {creatingConfig && (
                        <div className="module-config-row module-config-row-creating">
                            <div className="module-config-row-tint" />
                            <div className="relative flex items-center gap-2.5 pl-14 pr-4 py-2.5">
                                <span
                                    className="text-sm font-semibold min-w-0 break-words italic"
                                    style={{ color: 'var(--color-text-muted)' }}
                                >
                                    {creatingConfig.mode === 'copy'
                                        ? `Copy of ${creatingConfig.baseConfig.name}`
                                        : 'New Configuration'}
                                </span>
                                <div className="flex-1" />
                                <button
                                    onClick={() => setCreatingConfig(null)}
                                    className="module-action-btn-danger"
                                    title="Cancel"
                                >
                                    Cancel
                                </button>
                            </div>

                            {/* Inline editor — immediately expanded */}
                            <div className="pl-14 pr-4 pb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                                <div className="mt-1.5">
                                    <ModuleConfigInlineEditor
                                        moduleType={moduleType}
                                        mode={creatingConfig.mode}
                                        config={creatingConfig.baseConfig}
                                        onSave={() => {
                                            setCreatingConfig(null);
                                            if (onSaveNew) onSaveNew();
                                        }}
                                        onCancel={() => setCreatingConfig(null)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Existing config rows or empty state */}
                    {configs.length === 0 && !creatingConfig ? (
                        <div className="pl-14 py-2.5 text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
                            No configurations. Click "+ Add Config" to get started.
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            {configs.map((config) => (
                                <ModuleConfigRow
                                    key={config.id}
                                    config={config}
                                    moduleType={moduleType}
                                    onEdit={(cfg) => toggleEditor(cfg.id)}
                                    onCopy={handleCopy}
                                    onDelete={onDelete}
                                    isEditorOpen={expandedConfigIds.has(config.id)}
                                    onToggleEditor={() => toggleEditor(config.id)}
                                    allInstances={allInstances}
                                    onInstancesRefresh={onInstancesRefresh}
                                    dockerStatus={dockerStatus}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
