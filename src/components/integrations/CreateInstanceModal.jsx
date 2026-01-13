import React, { useState, useEffect, useMemo } from 'react';
import DeviceTypeSelector from './DeviceTypeSelector';
import { createIntegrationInstance } from '../../services/management/integrationsService.js';

const CreateInstanceModal = ({ integrationName, isOpen, onClose, onCreate }) => {
    // Generate hash once per modal open
    const randomHash = useMemo(() => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let hash = '';
        for (let i = 0; i < 8; i++) {
            hash += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return hash;
    }, []); // empty deps → runs once

    const [deviceType, setDeviceType] = useState('cpu');
    const [formData, setFormData] = useState({
        instanceName: `${integrationName}-${deviceType}-${randomHash}`,
        deviceType
    });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            deviceType,
            instanceName: `${integrationName}-${deviceType}-${randomHash}`
        }));
    }, [deviceType, integrationName, randomHash]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            await createIntegrationInstance(integrationName, formData);
            onCreate(); // Notify parent that instance was created
        } catch (err) {
            console.error('Failed to create instance:', err);
            setError(err.message || 'Failed to create instance.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50">
            <div className="modal-content w-full max-w-md">
                <h3 className="text-2xl font-bold mb-4 text-orange-400">
                    Create New Instance for {integrationName}
                </h3>
                <form onSubmit={handleSubmit}>

                    <div className="mb-6">
                        <label htmlFor="deviceType" className="block text-neutral-300 text-sm font-bold mb-2">
                            Device Type:
                        </label>
                        <DeviceTypeSelector
                            value={deviceType}
                            onChange={setDeviceType}
                        />
                        <p className="text-neutral-400 text-xs mt-1">
                            Select the hardware device type for this instance.
                        </p>
                    </div>

                    <div className="mb-4">
                        <label htmlFor="instanceName" className="block text-neutral-300 text-sm font-bold mb-2">
                            Instance Name:
                        </label>
                        <input
                            type="text"
                            id="instanceName"
                            value={formData.instanceName}
                            onChange={(e) => setFormData({...formData, instanceName: e.target.value})}
                            placeholder="e.g., ollama-cpu-main, textgen-gpu-default"
                            className="shadow appearance-none border border-neutral-600 rounded w-full py-2 px-3 text-neutral-200 leading-tight focus:outline-none focus:shadow-outline bg-neutral-700"
                            required
                        />
                        <p className="text-neutral-400 text-xs mt-1">A unique identifier for this instance.</p>
                    </div>

                    {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
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
                            {loading ? 'Creating...' : 'Create Instance'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateInstanceModal;
