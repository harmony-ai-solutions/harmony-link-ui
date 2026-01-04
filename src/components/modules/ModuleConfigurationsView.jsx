import React, { useState, useEffect } from 'react';
import useModuleConfigStore from '../../store/moduleConfigStore';
import ModuleConfigList from './ModuleConfigList';
import ModuleConfigEditor from './ModuleConfigEditor';
import DynamicOptionsGroup from '../settings/DynamicOptionsGroup.jsx';
import {MODULE_TYPE_OPTIONS} from "../../constants/moduleConfiguration.js";



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
        <div className="p-4">
            {/* Module Type Selection using DynamicOptionsGroup */}
            <div className="mb-4 p-4 bg-neutral-800 rounded">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Module Type
                </label>
                <DynamicOptionsGroup
                    options={MODULE_TYPE_OPTIONS}
                    selectedOption={selectedModuleType}
                    onSelectedChange={handleModuleTypeChange}
                    groupName="moduleTypeSelection"
                />
            </div>
            
            {/* Module Configuration List */}
            <ModuleConfigList
                moduleType={selectedModuleType}
                configs={getConfigs(selectedModuleType)}
                onCreate={handleCreate}
                onEdit={handleEdit}
            />
            
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
