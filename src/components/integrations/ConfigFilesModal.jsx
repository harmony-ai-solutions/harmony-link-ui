import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition, Tab } from '@headlessui/react';
import { getIntegrationInstanceConfigFiles, readIntegrationInstanceConfigFile, saveIntegrationInstanceConfigFile, revertIntegrationInstanceConfigFile, getIntegrationInstances, controlIntegrationInstance } from '../../services/managementApiService'; // Updated imports
import { Editor } from '@monaco-editor/react';

function classNames(...classes) {
    return classes.filter(Boolean).join(' ');
}

const ConfigFilesModal = ({ integrationName, instanceName, isOpen, onClose, onSave }) => { // Changed deviceType to instanceName, removed status
    const [configFiles, setConfigFiles] = useState([]);
    const [fileContents, setFileContents] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [showEditor, setShowEditor] = useState(false);
    const [instanceDeviceType, setInstanceDeviceType] = useState('cpu'); // To store the device type of the instance
    const [instanceStatus, setInstanceStatus] = useState(null); // To fetch and display current instance status

    const isRunning = instanceStatus && (instanceStatus.Status === 'running' || instanceStatus.Status === 'partially_running');

    const fetchInstanceData = async () => {
        try {
            const instances = await getIntegrationInstances(integrationName);
            const currentInstance = instances[instanceName];
            if (currentInstance) {
                setInstanceDeviceType(currentInstance.DeviceType || 'cpu');
                setInstanceStatus(currentInstance);
            } else {
                setError(`Instance ${instanceName} not found.`);
            }
        } catch (err) {
            console.error('Failed to fetch instance data:', err);
            setError(err.message || 'Failed to fetch instance data.');
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchInstanceData(); // Fetch instance data first to get device type
            loadConfigFiles();
            const interval = setInterval(fetchInstanceData, 5000); // Refresh instance data every 5 seconds
            return () => clearInterval(interval);
        }
    }, [isOpen, integrationName, instanceName]); // Added instanceName to dependencies

    const loadConfigFiles = async () => {
        setLoading(true);
        setError('');
        try {
            // Use instance-specific config files
            const files = await getIntegrationInstanceConfigFiles(integrationName, instanceName);
            setConfigFiles(files);
            if (files.length > 0) {
                const fileToLoad = files[0];
                setSelectedFile(fileToLoad);
                await loadFileContent(fileToLoad);
            }
        } catch (err) {
            console.error('Failed to load config files:', err);
            setError(err.message || 'Failed to load config files.');
        } finally {
            setLoading(false);
        }
    };

    const loadFileContent = async (file) => {
        setLoading(true);
        setError('');
        try {
            // Use instance-specific config file reading
            const content = await readIntegrationInstanceConfigFile(integrationName, instanceName, file.name);
            setFileContents(prev => ({ ...prev, [file.name]: content }));
        } catch (err) {
            console.error(`Failed to read file ${file.name}:`, err);
            setError(err.message || `Failed to read file ${file.name}.`);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (isRunning) {
            setError('Configuration changes are only allowed when containers are stopped.');
            return;
        }
        if (!selectedFile) return;
        setLoading(true);
        setError('');
        try {
            // Use instance-specific config file saving
            await saveIntegrationInstanceConfigFile(integrationName, instanceName, selectedFile.name, fileContents[selectedFile.name]);
            onSave();
        } catch (err) {
            console.error(`Failed to save file ${selectedFile.name}:`, err);
            setError(err.message || `Failed to save file ${selectedFile.name}.`);
        } finally {
            setLoading(false);
        }
    };

    const handleRevert = async () => {
        if (isRunning) {
            setError('Configuration changes are only allowed when containers are stopped.');
            return;
        }
        if (!selectedFile) return;

        if (!window.confirm(`Are you sure you want to revert "${selectedFile.name}" to its default state? This action cannot be undone.`)) {
            return;
        }

        setLoading(true);
        setError('');
        try {
            // Use instance-specific config file revert
            await revertIntegrationInstanceConfigFile(integrationName, instanceName, selectedFile.name);
            await loadFileContent(selectedFile);
            alert(`File "${selectedFile.name}" reverted successfully.`);
        } catch (err) {
            console.error(`Failed to revert file ${selectedFile.name}:`, err);
            setError(err.message || `Failed to revert file ${selectedFile.name}.`);
        } finally {
            setLoading(false);
        }
    };

    const handleTabChange = (index) => {
        const newSelectedFile = configFiles[index];
        setSelectedFile(newSelectedFile);
        if (!fileContents[newSelectedFile.name]) {
            loadFileContent(newSelectedFile);
        }
    };

    return (
        <Transition appear show={isOpen} as={Fragment} afterEnter={() => setShowEditor(true)} afterLeave={() => setShowEditor(false)}>
            <Dialog as="div" className="relative z-10" onClose={onClose}>
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black bg-opacity-75" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                            <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-gray-900 p-6 text-left align-middle shadow-xl transition-all">
                                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-white">
                                    Configure {integrationName} - Config Files ({instanceName}) [{instanceDeviceType}]
                                </Dialog.Title>
                                <div className="mt-2">
                                    {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
                                    {isRunning && (
                                        <div className="bg-yellow-900 border border-yellow-700 text-yellow-300 px-4 py-3 rounded relative mb-4" role="alert">
                                            <strong className="font-bold">Warning:</strong>
                                            <span className="block sm:inline"> This instance is currently running. Please stop it before making changes.</span>
                                        </div>
                                    )}
                                    {loading && configFiles.length === 0 ? (
                                        <div className="text-white text-center py-10">Loading...</div>
                                    ) : configFiles.length === 0 ? (
                                        <div className="text-white text-center py-10">No configurable files found for this integration and device type.</div>
                                    ) : (
                                        <Tab.Group onChange={handleTabChange}>
                                            <Tab.List className="flex space-x-1 rounded-xl bg-neutral-800 p-1">
                                                {configFiles.map((file) => (
                                                    <Tab
                                                        key={file.name}
                                                        className={({ selected }) =>
                                                            classNames(
                                                                'w-full rounded-lg py-2.5 text-sm font-medium leading-5 text-orange-400',
                                                                'ring-white ring-opacity-60 ring-offset-2 ring-offset-neutral-700 focus:outline-none focus:ring-2',
                                                                selected
                                                                    ? 'bg-neutral-800 shadow'
                                                                    : 'text-neutral-300 hover:bg-white/[0.12] hover:text-white'
                                                            )
                                                        }
                                                    >
                                                        {file.name}
                                                    </Tab>
                                                ))}
                                            </Tab.List>
                                            <Tab.Panels className="mt-2">
                                                {configFiles.map((file) => (
                                                    <Tab.Panel
                                                        key={file.name}
                                                        className={classNames(
                                                            'rounded-xl bg-neutral-800 p-3',
                                                            'ring-white ring-opacity-60 ring-offset-2 ring-offset-neutral-700 focus:outline-none focus:ring-2'
                                                        )}
                                                    >
                                                        {loading && selectedFile?.name === file.name ? (
                                                            <div className="text-white text-center py-10">Loading file content...</div>
                                                        ) : (
                                                            <>
                                                                <p className="text-neutral-400 text-sm mb-2">{file.description}</p>
                                                                {showEditor && (
                                                                    <Editor
                                                                        path={file.name}
                                                                        height="400px"
                                                                        theme="vs-dark"
                                                                        defaultLanguage={file.type === 'yaml' ? 'yaml' : file.type === 'json' ? 'json' : 'plaintext'}
                                                                        value={fileContents[file.name] || ''}
                                                                        onChange={(value) => setFileContents((prev) => ({...prev, [file.name]: value,}))}
                                                                        options={{
                                                                            minimap: { enabled: false },
                                                                            scrollBeyondLastLine: false,
                                                                            fontSize: 14,
                                                                            readOnly: isRunning,
                                                                        }}
                                                                    />
                                                                )}
                                                            </>
                                                        )}
                                                    </Tab.Panel>
                                                ))}
                                            </Tab.Panels>
                                        </Tab.Group>
                                    )}
                                </div>

                                <div className="mt-4 flex justify-end space-x-2">
                                    <button type="button" className="bg-neutral-700 hover:bg-neutral-500 font-bold py-1 px-2 mx-1 text-orange-400" onClick={onClose}>
                                        Close
                                    </button>
                                    {selectedFile && (
                                        <button type="button" className={`font-bold py-1 px-2 mx-1 text-orange-400 ${isRunning ? 'bg-gray-500 cursor-not-allowed' : 'bg-neutral-700 hover:bg-neutral-500'}`} onClick={handleRevert} disabled={loading || isRunning}>
                                            Revert to Default
                                        </button>
                                    )}
                                    <button type="button" className={`font-bold py-1 px-2 mx-1 text-orange-400 ${isRunning ? 'bg-gray-500 cursor-not-allowed' : 'bg-neutral-700 hover:bg-neutral-500'}`} onClick={handleSave} disabled={loading || !selectedFile || isRunning}>
                                        {loading ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};

export default ConfigFilesModal;
