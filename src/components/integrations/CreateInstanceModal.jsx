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
                <h3 className="text-2xl font-bold mb-4" style={{ color: 'var(--color-accent-primary)' }}>
                    Create New Instance
                </h3>
                <p className="text-sm mb-5" style={{ color: 'var(--color-text-secondary)' }}>
                    for <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{integrationName}</span>
                </p>
                <form onSubmit={handleSubmit}>

                    <div className="mb-6">
                        <label htmlFor="deviceType" className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                            Device Type:
                        </label>
                        <DeviceTypeSelector
                            value={deviceType}
                            onChange={setDeviceType}
                        />
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                            Select the hardware device type for this instance.
                        </p>
                    </div>

                    <div className="mb-4">
                        <label htmlFor="instanceName" className="block text-sm font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                            Instance Name:
                        </label>
                        <input
                            type="text"
                            id="instanceName"
                            value={formData.instanceName}
                            onChange={(e) => setFormData({...formData, instanceName: e.target.value})}
                            placeholder="e.g., ollama-cpu-main, textgen-gpu-default"
                            className="input-field w-full font-mono text-sm"
                            required
                        />
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>A unique identifier for this instance.</p>
                    </div>

                    {error && (
                        <p className="text-sm mb-4" style={{ color: 'var(--color-error)' }}>{error}</p>
                    )}
                    <div className="flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary py-2 px-4 text-sm"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary py-2 px-4 text-sm disabled:opacity-50"
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
