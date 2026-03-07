import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import useCharacterProfileStore from '../../store/characterProfileStore';

/**
 * Modal for uploading new character images
 * @param {Object} props
 * @param {string} props.profileId - ID of the character profile
 * @param {Function} props.onClose - Callback to close the modal
 */
export default function ImageUploadModal({ profileId, onClose }) {
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [description, setDescription] = useState('');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);
    const uploadImage = useCharacterProfileStore(state => state.uploadImage);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        // Validate file type
        if (!selectedFile.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        // Validate file size (10MB max)
        if (selectedFile.size > 10 * 1024 * 1024) {
            setError('Image size must be less than 10MB');
            return;
        }

        setFile(selectedFile);
        setError(null);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result);
        };
        reader.readAsDataURL(selectedFile);
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Please select a file');
            return;
        }

        setUploading(true);
        setError(null);

        try {
            await uploadImage(profileId, file, description);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const modalContent = (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
            <div
                className="character-editor-modal max-w-md w-full mx-4 flex flex-col"
                style={{ maxHeight: '90vh' }}
            >
                {/* Header */}
                <div className="character-editor-modal-header flex-shrink-0">
                    <div className="character-editor-modal-tint" />
                    <div className="character-editor-modal-stripe" />
                    <div className="relative flex justify-between items-center px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="character-editor-icon-badge">
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                            </div>
                            <h2 className="text-lg font-bold text-gradient-primary leading-tight">Upload Image</h2>
                        </div>
                        <button
                            onClick={onClose}
                            disabled={uploading}
                            className="relative text-text-muted hover:text-text-primary transition-colors p-1 rounded hover:bg-white/5 disabled:opacity-40"
                            title="Close"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-6 bg-background-base">
                    {/* File Input */}
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">Select Image</label>
                        {/* Hidden native input — triggered by the styled button below */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="btn-primary py-1.5 px-4 text-xs font-semibold flex-shrink-0"
                            >
                                Choose File
                            </button>
                            {file ? (
                                <span className="character-editor-label-unit truncate max-w-[16rem]" title={file.name}>
                                    {file.name}
                                </span>
                            ) : (
                                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No file chosen</span>
                            )}
                        </div>
                        <p className="character-editor-hint">PNG, JPEG, or WEBP. Max 10MB.</p>
                    </div>

                    {/* Preview */}
                    {preview && (
                        <div
                            className="rounded-lg overflow-hidden flex items-center justify-center"
                            style={{
                                background: 'var(--color-background-base)',
                                border: '1px solid rgba(255,255,255,0.08)',
                            }}
                        >
                            <img
                                src={preview}
                                alt="Preview"
                                className="w-full object-contain"
                                style={{ maxHeight: 'clamp(12rem, calc(70vh - 20rem), 60vh)' }}
                            />
                        </div>
                    )}

                    {/* Description */}
                    <div className="character-editor-field-group">
                        <label className="character-editor-label">
                            Description
                            <span className="character-editor-label-unit">optional</span>
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={1000}
                            rows={3}
                            className="input-field w-full resize-none"
                            placeholder="Describe this image..."
                        />
                        <p className="character-editor-hint">{description.length}/1000 characters</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-error)' }}>
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="character-editor-footer flex-shrink-0">
                    <div className="flex-1" />
                    <div className="flex gap-3 flex-shrink-0">
                        <button
                            onClick={onClose}
                            disabled={uploading}
                            className="btn-secondary px-5 py-2 text-sm font-semibold disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpload}
                            disabled={!file || uploading}
                            className="btn-primary px-5 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading ? (
                                <span className="flex items-center gap-2">
                                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                    </svg>
                                    Uploading…
                                </span>
                            ) : 'Upload'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
