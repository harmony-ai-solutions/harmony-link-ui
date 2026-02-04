import React from 'react';
import useModuleConfigStore from '../../store/moduleConfigStore';

// Helper function to format module type names for display
const formatModuleTypeName = (moduleType) => {
    const nameMap = {
        'backend': 'Backend',
        'tts': 'TTS',
        'stt': 'STT',
        'rag': 'RAG',
        'movement': 'Movement',
        'cognition': 'Cognition'
    };
    return nameMap[moduleType] || moduleType;
};

// Helper function to get provider display text for a config
const getProviderDisplay = (config, moduleType) => {
    if (moduleType === 'stt') {
        // STT has multiple providers: transcription and VAD
        const transcriptionProvider = config.transcription?.provider || 'None';
        const vadProvider = config.vad?.provider || 'None';
        return `Transcription: ${transcriptionProvider}, VAD: ${vadProvider}`;
    }
    
    // For other module types, just get the provider field
    return config.provider || 'Unknown';
};

export default function ModuleConfigList({ moduleType, configs, onCreate, onEdit }) {
    const { deleteConfig, isLoading } = useModuleConfigStore();

    const handleDelete = async (id, name) => {
        if (window.confirm(`Are you sure you want to delete the configuration "${name}"?`)) {
            try {
                await deleteConfig(moduleType, id);
            } catch (error) {
                alert(`Failed to delete configuration: ${error.message}`);
            }
        }
    };

    return (
        <div className="card-surface overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-sm backdrop-blur-sm">
            <div className="border-b border-white/5 px-6 py-4 flex justify-between items-center bg-background-surface/60">
                <div>
                    <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        <span className="text-gradient-primary">{formatModuleTypeName(moduleType)}</span> Configurations
                    </h2>
                    <p className="text-[11px] text-text-muted font-medium mt-0.5">Manage and deploy {moduleType} instances</p>
                </div>
                <button
                    onClick={onCreate}
                    className="btn-primary py-2 px-5 rounded-lg font-bold text-xs tracking-wider uppercase shadow-lg shadow-accent-primary/20 transition-all hover:scale-105 active:scale-95"
                >
                    Create New
                </button>
            </div>

            <div className="p-0">
                {isLoading && configs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary"></div>
                        <p className="text-text-muted font-bold text-xs animate-pulse">Fetching configurations...</p>
                    </div>
                ) : configs.length === 0 ? (
                    <div className="text-center p-20 bg-background-base/30 rounded-lg border border-dashed border-border-default m-4">
                        <div className="text-4xl mb-4 opacity-40">📭</div>
                        <h3 className="text-text-secondary font-bold text-sm">No configurations found</h3>
                        <p className="text-text-muted text-xs mt-1">Get started by creating your first {moduleType} setup.</p>
                        <button onClick={onCreate} className="mt-6 text-accent-primary hover:text-accent-primary-hover font-bold text-xs underline underline-offset-4">Create one now</button>
                    </div>
                ) : (
                    <div className="overflow-x-auto no-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-background-elevated/20">
                                    <th className="py-4 px-6">
                                        <span className="text-text-primary font-black text-[11px] uppercase tracking-[0.2em]">Configuration Name</span>
                                    </th>
                                    <th className="py-4 px-6">
                                        <span className="text-text-primary font-black text-[11px] uppercase tracking-[0.2em]">Provider</span>
                                    </th>
                                    <th className="py-4 px-6 text-right">
                                        <span className="text-text-primary font-black text-[11px] uppercase tracking-[0.2em]">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {configs.map((config) => (
                                    <tr key={config.id} className="border-b border-white/5 hover:bg-white/5 transition-all duration-200 group">
                                        <td className="py-5 px-6">
                                            <span className="text-text-primary font-bold text-base group-hover:text-accent-primary transition-colors">{config.name}</span>
                                        </td>
                                        <td className="py-5 px-6">
                                            <span className="text-xs text-text-secondary font-bold bg-background-base/50 px-3 py-1.5 rounded-full border border-white/5 shadow-sm">
                                                {getProviderDisplay(config, moduleType)}
                                            </span>
                                        </td>
                                        <td className="py-5 px-6 text-right">
                                            <div className="flex justify-end gap-3">
                                                <button
                                                    onClick={() => onEdit(config)}
                                                    className="p-2.5 rounded-xl bg-info/10 text-info hover:bg-info hover:text-white transition-all duration-300 shadow-sm hover:shadow-info/20 hover:scale-110 active:scale-95"
                                                    title="Edit Configuration"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(config.id, config.name)}
                                                    className="p-2.5 rounded-xl bg-error/10 text-error hover:bg-error hover:text-white transition-all duration-300 shadow-sm hover:shadow-error/20 hover:scale-110 active:scale-95"
                                                    title="Delete Configuration"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m4-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
