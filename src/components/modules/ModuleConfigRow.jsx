import React from 'react';
import { MODULE_CONFIGS } from '../../constants/moduleConfiguration.js';
import ModuleConfigInlineEditor from './ModuleConfigInlineEditor.jsx';

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

export default function ModuleConfigRow({ config, moduleType, onEdit, onCopy, onDelete, isEditorOpen, onToggleEditor }) {
    const providerDisplay = getProviderDisplay(config, moduleType);
    const providerLogos = getProviderLogos(config, moduleType);

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
