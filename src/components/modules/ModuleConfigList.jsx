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
        'countenance': 'Countenance'
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
        <div className="bg-neutral-800 rounded p-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-white">
                    {formatModuleTypeName(moduleType)} Configurations
                </h2>
                <button
                    onClick={onCreate}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                    Create New
                </button>
            </div>

            {isLoading && configs.length === 0 ? (
                <div className="flex justify-center p-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
            ) : configs.length === 0 ? (
                <div className="text-center p-8 text-gray-400 bg-neutral-900 rounded border border-neutral-700">
                    No {moduleType} configurations found. Create your first one!
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-neutral-700">
                                <th className="py-3 px-4 text-gray-400 font-medium">Name</th>
                                <th className="py-3 px-4 text-gray-400 font-medium">Provider</th>
                                <th className="py-3 px-4 text-gray-400 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {configs.map((config) => (
                                <tr key={config.id} className="border-b border-neutral-700 hover:bg-neutral-750 transition-colors">
                                    <td className="py-3 px-4 text-white font-medium">{config.name}</td>
                                    <td className="py-3 px-4 text-gray-300">
                                        {getProviderDisplay(config, moduleType)}
                                    </td>
                                    <td className="py-3 px-4 text-right space-x-2">
                                        <button
                                            onClick={() => onEdit(config)}
                                            className="text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(config.id, config.name)}
                                            className="text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
