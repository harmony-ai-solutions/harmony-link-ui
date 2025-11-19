import React, { useState, useEffect } from 'react';
import DeviceTypeSelector from './DeviceTypeSelector';

const RenameInstanceModal = ({ 
    integrationName, 
    instanceName, 
    deviceType,
    isOpen, 
    onClose, 
    onRename 
}) => {
    const [formData, setFormData] = useState({
        newInstanceName: instanceName
    });
    const [errors, setErrors] = useState({
        newInstanceName: ''
    });
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const validateField = (fieldName, value) => {
        const trimmedValue = value.trim();
        
        if (fieldName === 'newInstanceName') {
            if (!trimmedValue) {
                return 'Instance name is required';
            }
            if (trimmedValue.length > 40) {
                return 'Instance name must not exceed 40 characters';
            }
            if (!/^[a-zA-Z0-9_-]+$/.test(trimmedValue)) {
                return 'Only alphanumeric, dashes, and underscores allowed';
            }
            if (/\s/.test(trimmedValue)) {
                return 'Whitespace is not allowed';
            }
        }
        
        return '';
    };

    const handleFieldChange = (fieldName, value) => {
        setFormData(prev => ({ ...prev, [fieldName]: value }));
        
        // Clear error when user starts typing
        if (errors[fieldName]) {
            setErrors(prev => ({ ...prev, [fieldName]: '' }));
        }
    };

    const handleBlur = (fieldName) => {
        const error = validateField(fieldName, formData[fieldName]);
        setErrors(prev => ({ ...prev, [fieldName]: error }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate the field
        const newInstanceNameError = validateField('newInstanceName', formData.newInstanceName);
        
        if (newInstanceNameError) {
            setErrors({
                newInstanceName: newInstanceNameError
            });
            return;
        }

        setLoading(true);
        try {
            // Call the parent's onRename callback
            await onRename(
                formData.newInstanceName.trim()
            );
            // Modal will be closed by parent's handleRename
        } catch (err) {
            console.error('Failed to rename instance:', err);
            // Set a general error
            setErrors(prev => ({ 
                ...prev, 
                newInstanceName: err.message || 'Failed to rename instance.' 
            }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-neutral-800 p-6 rounded-lg shadow-xl w-full max-w-md">
                <h3 className="text-2xl font-bold mb-4 text-orange-400">
                    Rename Instance: {instanceName}
                </h3>
                <form onSubmit={handleSubmit}>

                    <div className="mb-6">
                        <label htmlFor="deviceType" className="block text-neutral-300 text-sm font-bold mb-2">
                            Device Type:
                        </label>
                        <DeviceTypeSelector
                            value={deviceType}
                            onChange={() => {}} // no-op
                            disabled={true}
                        />
                        <p className="text-neutral-400 text-xs mt-1">
                            Device type cannot be changed after creation.
                        </p>
                    </div>

                    <div className="mb-4">
                        <label htmlFor="newInstanceName" className="block text-neutral-300 text-sm font-bold mb-2">
                            Instance Name:
                        </label>
                        <input
                            type="text"
                            id="newInstanceName"
                            value={formData.newInstanceName}
                            onChange={(e) => handleFieldChange('newInstanceName', e.target.value)}
                            onBlur={() => handleBlur('newInstanceName')}
                            placeholder="e.g., ollama-cpu-main, textgen-gpu-default"
                            className="shadow appearance-none border border-neutral-600 rounded w-full py-2 px-3 text-neutral-200 leading-tight focus:outline-none focus:shadow-outline bg-neutral-700"
                            required
                        />
                        {errors.newInstanceName && (
                            <p className="text-red-500 text-xs mt-1">{errors.newInstanceName}</p>
                        )}
                        <p className="text-neutral-400 text-xs mt-1">
                            Unique identifier (max 40 chars, alphanumeric, dashes, underscores only).
                        </p>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-neutral-600 hover:bg-neutral-500 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                            disabled={loading}
                        >
                            {loading ? 'Renaming...' : 'Rename Instance'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RenameInstanceModal;
