import React, { useState, useEffect } from 'react';
import useModuleConfigStore from '../store/moduleConfigStore.js';
import ModuleConfigList from './modules/ModuleConfigList.jsx';
import ModuleConfigEditor from './modules/ModuleConfigEditor.jsx';
import DynamicOptionsGroup from './settings/DynamicOptionsGroup.jsx';
import {MODULE_TYPE_OPTIONS} from "../constants/moduleConfiguration.js";



export default function ModuleConfigurationsView() {
    const { loadConfigs, getConfigs, setModuleType, selectedModuleType } = useModuleConfigStore();
    const [showEditor, setShowEditor] = useState(false);
    const [editingConfig, setEditingConfig] = useState(null);
    
    useEffect(() => {
        loadConfigs(selectedModuleType);
    }, [selectedModuleType]);
    
    const handleModuleTypeChange = (moduleType) => {
        setModuleType(moduleType);
        setShowEditor(false);
        setEditingConfig(null);
    };
    
    const handleCreate = () => {
        setEditingConfig(null);
        setShowEditor(true);
    };
    
    const handleEdit = (config) => {
        setEditingConfig(config);
        setShowEditor(true);
    };
    
    const handleClose = () => {
        setShowEditor(false);
        setEditingConfig(null);
        loadConfigs(selectedModuleType); // Refresh list
    };
    
    return (
        <div className="flex flex-col min-h-full bg-background-base">
            {/* View Header */}
            <div className="bg-background-surface/30 backdrop-blur-sm border-b border-white/5 px-6 py-4">
                <h1 className="text-2xl font-extrabold tracking-tight">
                    <span className="text-gradient-primary">Module</span> Configurations
                </h1>
                <p className="text-xs text-text-muted mt-0.5 font-medium">
                    Manage AI module configurations and provider settings
                </p>
            </div>

            {/* Module Type Selection Tabs */}
            <div className="bg-background-surface/50 border-b border-white/5 sticky top-0 z-10 backdrop-blur-md">
                <div className="flex overflow-x-auto no-scrollbar scroll-smooth px-2">
                    {MODULE_TYPE_OPTIONS.map((moduleType) => (
                        <button
                            key={moduleType.id}
                            onClick={() => handleModuleTypeChange(moduleType.id)}
                            className={`flex items-center gap-2 px-6 py-3.5 text-sm font-bold whitespace-nowrap border-b-2 transition-all duration-200 group ${
                                selectedModuleType === moduleType.id
                                    ? 'border-accent-primary text-accent-primary bg-background-elevated/40'
                                    : 'border-transparent text-text-muted hover:text-text-secondary hover:bg-white/5'
                            }`}
                        >
                            <span className={`text-xl transition-transform duration-200 ${
                                selectedModuleType === moduleType.id ? 'scale-110' : 'group-hover:scale-110 opacity-70 group-hover:opacity-100'
                            }`}>
                                {moduleType.emoji || '⚙️'}
                            </span>
                            {moduleType.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 p-6">
                {/* Module Configuration List */}
                <ModuleConfigList
                    moduleType={selectedModuleType}
                    configs={getConfigs(selectedModuleType)}
                    onCreate={handleCreate}
                    onEdit={handleEdit}
                />
            </div>
            
            {/* Editor Modal */}
            {showEditor && (
                <ModuleConfigEditor
                    moduleType={selectedModuleType}
                    config={editingConfig}
                    onClose={handleClose}
                />
            )}
        </div>
    );
}
