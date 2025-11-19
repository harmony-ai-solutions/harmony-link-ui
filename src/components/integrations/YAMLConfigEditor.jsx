import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { getIntegrationTemplate, getIntegrationInstanceConfig, saveIntegrationInstanceConfig, deleteIntegrationInstance, getIntegrationInstanceStatus } from '../../services/management/integrationsService.js';
import { Editor } from '@monaco-editor/react';

const YAMLConfigEditor = ({ integrationName, instanceName, isOpen, onClose, onSave }) => {
    const [config, setConfig] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showEditor, setShowEditor] = useState(false);
    const [instanceDeviceType, setInstanceDeviceType] = useState('cpu');
    const [instanceStatus, setInstanceStatus] = useState(null);

    const isRunning = instanceStatus && (instanceStatus.status === 'running' || instanceStatus.status === 'partially_running');

    const getDeviceIcon = (deviceType) => {
        switch (deviceType) {
            case 'nvidia': return '🟢'; // Green circle for NVIDIA
            case 'amd': return '🔴'; // Red circle for AMD
            case 'amd-wsl': return '🔴'; // Red circle for AMD
            case 'intel': return '🔵'; // Blue circle for Intel
            case 'cpu': return '💻'; // Laptop for CPU
            default: return '⚙️'; // Gear for unknown
        }
    };

    const fetchInstanceData = async () => {
        try {
            const currentInstance = await getIntegrationInstanceStatus(integrationName, instanceName);
            setInstanceDeviceType(currentInstance.deviceType || 'cpu');
            setInstanceStatus(currentInstance);
        } catch (err) {
            console.error('Failed to fetch instance data:', err);
            setInstanceStatus({ status: 'error', error: 'Failed to fetch data' });
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchInstanceData();
            loadConfig();
            const interval = setInterval(fetchInstanceData, 5000);
            return () => clearInterval(interval);
        }
    }, [isOpen, integrationName, instanceName]);

    const loadConfig = async () => {
        setLoading(true);
        setError('');
        try {
            const { content, exists } = await getIntegrationInstanceConfig(integrationName, instanceName);
            if (exists) {
                setConfig(content);
            } else {
                // Fetch Template for device type
                try {
                    const template = await getIntegrationTemplate(integrationName, instanceDeviceType);
                    setConfig(template);
                } catch (instanceErr) {
                    console.warn('Failed to get instance device type, using CPU template:', instanceErr);
                    // Fallback to CPU template if lookup fails
                    setInstanceDeviceType('cpu');
                    const template = await getIntegrationTemplate(integrationName, 'cpu');
                    setConfig(template);
                }
            }
        } catch (err) {
            console.error('Failed to load config:', err);
            setError(err.message || 'Failed to load configuration.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (isRunning) {
            setError('Configuration changes are only allowed when containers are stopped.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await saveIntegrationInstanceConfig(integrationName, instanceName, config);
            onSave();
        } catch (err) {
            console.error('Failed to save config:', err);
            setError(err.message || 'Failed to save configuration.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (isRunning) {
            setError('Configuration changes are only allowed when containers are stopped.');
            return;
        }
        if (!window.confirm(`Are you sure you want to delete the configuration for instance "${instanceName}" of "${integrationName}"? This action cannot be undone.`)) {
            return;
        }
        setLoading(true);
        setError('');
        try {
            await deleteIntegrationInstance(integrationName, instanceName);
            // Close the editor immediately after successful deletion
            onClose();
            // Also notify parent that something changed (for refresh)
            if (onSave) {
                onSave();
            }
        } catch (err) {
            console.error('Failed to delete config:', err);
            setError(err.message || 'Failed to delete configuration.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment} afterEnter={() => setShowEditor(true)} afterLeave={() => setShowEditor(false)}>
            <Dialog as="div" className="relative z-10" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black bg-opacity-75" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-gray-900 p-6 text-left align-middle shadow-xl transition-all">
                                <Dialog.Title
                                    as="h3"
                                    className="text-lg font-medium leading-6 text-white"
                                >
                                    Configure {integrationName} ({instanceName}) {getDeviceIcon(instanceDeviceType)} [{instanceDeviceType.toUpperCase()}]
                                </Dialog.Title>
                                <div className="mt-2">
                                    {error && <p className="text-red-400 text-sm">{error}</p>}
                                    {isRunning && (
                                        <div className="bg-yellow-900 border border-yellow-700 text-yellow-300 px-4 py-3 rounded relative mb-4" role="alert">
                                            <strong className="font-bold">Warning:</strong>
                                            <span className="block sm:inline"> This instance is currently running. Please stop it before making changes.</span>
                                        </div>
                                    )}
                                    {loading ? (
                                        <div className="text-white">Loading...</div>
                                    ) : (
                                        showEditor && <Editor
                                            height="500px"
                                            theme="vs-dark"
                                            defaultLanguage="yaml"
                                            value={config}
                                            onChange={(value) => setConfig(value)}
                                            options={{
                                                minimap: { enabled: false },
                                                scrollBeyondLastLine: false,
                                                fontSize: 14,
                                                readOnly: isRunning,
                                            }}
                                        />
                                    )}
                                </div>

                                <div className="mt-4 flex justify-between">
                                    <div>
                                        <button
                                            type="button"
                                            className={`font-bold py-1 px-2 mx-1 text-white ${isRunning ? 'bg-gray-500 cursor-not-allowed' : 'bg-red-700 hover:bg-red-500'}`}
                                            onClick={handleDelete}
                                            disabled={loading || isRunning}
                                        >
                                            {loading ? 'Deleting...' : 'Delete Instance'}
                                        </button>
                                    </div>
                                    <div className="flex justify-end space-x-2">
                                        <button
                                            type="button"
                                            className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400"
                                            onClick={onClose}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            className={`font-bold py-1 px-2 mx-1 text-orange-400 ${isRunning ? 'bg-gray-500 cursor-not-allowed' : 'bg-neutral-700 hover:bg-neutral-500'}`}
                                            onClick={handleSave}
                                            disabled={loading || isRunning}
                                        >
                                            {loading ? 'Saving...' : 'Save & Close'}
                                        </button>
                                    </div>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default YAMLConfigEditor;
