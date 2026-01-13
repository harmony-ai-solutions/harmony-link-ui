import React, { useState } from 'react';
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
    
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="modal-content max-w-md w-full mx-4">
                <h2 className="text-xl font-semibold mb-4 text-accent-primary">Upload Image</h2>
                
                <div className="space-y-4">
                    {/* File Input */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Select Image
                        </label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-accent-primary/20 file:text-accent-primary hover:file:bg-accent-primary/30 file:cursor-pointer transition-colors"
                        />
                        <p className="mt-1 text-xs text-text-muted">PNG, JPEG, or WEBP. Max 10MB.</p>
                    </div>
                    
                    {/* Preview */}
                    {preview && (
                        <div className="border border-border-default rounded-lg overflow-hidden">
                            <img 
                                src={preview} 
                                alt="Preview" 
                                className="w-full h-48 object-cover"
                            />
                        </div>
                    )}
                    
                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-2">
                            Description (Optional)
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={1000}
                            rows={3}
                            className="input-field w-full resize-none"
                            placeholder="Describe this image..."
                        />
                        <p className="mt-1 text-xs text-text-muted">{description.length}/1000 characters</p>
                    </div>
                    
                    {/* Error Message */}
                    {error && (
                        <div className="alert-error">
                            <p className="text-sm">{error}</p>
                        </div>
                    )}
                    
                    {/* Actions */}
                    <div className="flex justify-end gap-2 pt-4">
                        <button
                            onClick={onClose}
                            disabled={uploading}
                            className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpload}
                            disabled={!file || uploading}
                            className="btn-primary px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {uploading ? 'Uploading...' : 'Upload'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
