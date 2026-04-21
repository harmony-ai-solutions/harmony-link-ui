import { useState, useEffect, useCallback, useRef } from 'react';
import usePresetStore from '../../store/presetStore.js';
import { uploadPreset, deletePreset } from '../../services/management/presetService.js';
import ConfirmDialog from '../modals/ConfirmDialog.jsx';

/**
 * Preset selector dropdown that loads available presets and fires onChange.
 * Includes upload (with file picker) and delete controls.
 */
const PresetSelector = ({ value, onChange }) => {
    const { presets, loadPresets, loadPresetDetail, getPresetParams } = usePresetStore();
    const [isLoading, setIsLoading] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadName, setUploadName] = useState('');
    const [uploadContent, setUploadContent] = useState('');
    const [uploadError, setUploadError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadPresets();
    }, []);

    // Reset modal state on open
    const openUploadModal = () => {
        setUploadName('');
        setUploadContent('');
        setUploadError('');
        setShowUploadModal(true);
    };

    const handleChange = async (e) => {
        const selectedName = e.target.value;
        if (selectedName) {
            setIsLoading(true);
            await loadPresetDetail(selectedName);
            const params = getPresetParams(selectedName);
            onChange(selectedName, params || {});
            setIsLoading(false);
        } else {
            onChange('', {});
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Auto-fill name from filename if not already set
        if (!uploadName.trim()) {
            const baseName = file.name.replace(/\.(ya?ml|txt)$/i, '');
            setUploadName(baseName);
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            setUploadContent(event.target.result || '');
        };
        reader.onerror = () => {
            setUploadError('Failed to read file.');
        };
        reader.readAsText(file);
        // Reset so the same file can be re-selected
        e.target.value = '';
    };

    const handleUpload = useCallback(async () => {
        if (!uploadName.trim()) {
            setUploadError('Preset name is required.');
            return;
        }
        if (!uploadContent.trim()) {
            setUploadError('Preset content is required — paste YAML or load a file.');
            return;
        }
        setUploading(true);
        setUploadError('');
        try {
            await uploadPreset(uploadName.trim(), uploadContent);
            await loadPresets();
            // Auto-select the newly uploaded preset
            await loadPresetDetail(uploadName.trim());
            const params = getPresetParams(uploadName.trim());
            onChange(uploadName.trim(), params || {});
            setShowUploadModal(false);
        } catch (err) {
            setUploadError(err.message || 'Failed to upload preset.');
        } finally {
            setUploading(false);
        }
    }, [uploadName, uploadContent, loadPresets, loadPresetDetail, getPresetParams, onChange]);

    const handleDelete = useCallback(async () => {
        if (!value) return;
        try {
            await deletePreset(value);
            await loadPresets();
            onChange('', {});
        } catch (err) {
            console.error('Failed to delete preset:', err);
        }
    }, [value, loadPresets, onChange]);

    const requestDelete = () => {
        if (!value) return;
        setShowDeleteConfirm(true);
    };

    return (
        <>
            <div className="flex items-center gap-1.5 w-full">
                <select
                    value={value || ''}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="input-field flex-1 min-w-0 p-1.5 rounded text-sm custom-scrollbar"
                >
                    <option value="">None (Manual)</option>
                    {presets.map(p => (
                        <option key={p.name} value={p.name}>
                            {p.name} ({p.param_count} params)
                        </option>
                    ))}
                </select>
                {isLoading && <span className="ml-2 text-xs text-text-muted">Loading...</span>}
                <button
                    type="button"
                    onClick={openUploadModal}
                    className="module-action-btn"
                    title="Upload or create a new preset"
                >
                    + Add
                </button>
                {value && (
                    <button
                        type="button"
                        onClick={requestDelete}
                        className="module-action-btn-danger"
                        title="Delete selected preset"
                    >
                        Delete
                    </button>
                )}
            </div>

            {/* Upload Modal */}
            {showUploadModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowUploadModal(false)}>
                    <div className="modal-content max-w-lg w-full rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-8">
                            <h3 className="text-xl font-extrabold text-text-primary mb-6 tracking-tight">
                                Upload Sampling Preset
                            </h3>

                            <div className="space-y-5">
                                {/* Preset Name */}
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                                        Preset Name
                                    </label>
                                    <input
                                        type="text"
                                        value={uploadName}
                                        onChange={(e) => setUploadName(e.target.value)}
                                        className="input-field w-full py-2 px-3 text-sm"
                                        placeholder="e.g. My-Preset"
                                    />
                                </div>

                                {/* File picker */}
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                                        Load from File
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="btn-secondary text-xs px-3 py-2"
                                        >
                                            Choose File...
                                        </button>
                                        <span className="text-xs text-text-muted">.yaml or .txt</span>
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".yaml,.yml,.txt"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                </div>

                                {/* YAML textarea */}
                                <div>
                                    <label className="block text-xs font-medium text-text-secondary mb-1.5">
                                        YAML Content
                                    </label>
                                    <textarea
                                        value={uploadContent}
                                        onChange={(e) => setUploadContent(e.target.value)}
                                        className="input-field w-full p-2 rounded text-sm custom-scrollbar font-mono"
                                        rows={10}
                                        placeholder={"temperature: 0.7\ntop_p: 0.9\ntop_k: 40\ntypical_p: 1.0\nrepetition_penalty: 1.1"}
                                    />
                                </div>

                                {uploadError && <p className="text-xs text-error">{uploadError}</p>}

                                <div className="flex justify-end gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowUploadModal(false)}
                                        className="btn-secondary px-6 py-2.5"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleUpload}
                                        disabled={uploading}
                                        className="btn-primary px-8 py-2.5 shadow-lg shadow-accent-primary/20 disabled:opacity-50"
                                    >
                                        {uploading ? 'Uploading...' : 'Upload'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Delete Preset"
                message={`Delete preset '${value}'?\n\nThis will remove the preset file from the server. This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={() => { setShowDeleteConfirm(false); handleDelete(); }}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </>
    );
};

export default PresetSelector;
