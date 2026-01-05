import React, { useState, useEffect } from 'react';
import useCharacterProfileStore from '../../store/characterProfileStore';
import ImageUploadModal from './ImageUploadModal';

/**
 * Component for displaying and managing a gallery of character images
 * @param {Object} props
 * @param {string} props.profileId - ID of the character profile
 */
export default function ImageGallery({ profileId }) {
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [editingImage, setEditingImage] = useState(null);
    const [editDescription, setEditDescription] = useState('');
    const images = useCharacterProfileStore(state => state.getImagesForProfile(profileId));
    const loadImages = useCharacterProfileStore(state => state.loadImages);
    const deleteImage = useCharacterProfileStore(state => state.deleteImage);
    const setPrimaryImage = useCharacterProfileStore(state => state.setPrimaryImage);
    const updateImageMetadata = useCharacterProfileStore(state => state.updateImageMetadata);
    
    useEffect(() => {
        loadImages(profileId);
    }, [profileId, loadImages]);
    
    const handleSetPrimary = async (imageId) => {
        try {
            await setPrimaryImage(profileId, imageId);
        } catch (error) {
            alert('Failed to set primary image: ' + error.message);
        }
    };
    
    const handleDelete = async (imageId) => {
        if (!confirm('Are you sure you want to delete this image?')) return;
        
        try {
            await deleteImage(profileId, imageId);
        } catch (error) {
            alert('Failed to delete image: ' + error.message);
        }
    };
    
    const handleEditDescription = (image) => {
        setEditingImage(image.id);
        setEditDescription(image.description || '');
    };
    
    const handleSaveDescription = async (imageId) => {
        try {
            await updateImageMetadata(profileId, imageId, { description: editDescription });
            setEditingImage(null);
            // Reload images to refresh the display
            await loadImages(profileId);
        } catch (error) {
            alert('Failed to update description: ' + error.message);
        }
    };
    
    const handleCancelEdit = () => {
        setEditingImage(null);
        setEditDescription('');
    };
    
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-orange-400">Character Images</h3>
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                    Upload Image
                </button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map(image => (
                    <div
                        key={image.id}
                        className={`
                            relative rounded-lg overflow-hidden border-2 transition-all
                            ${image.is_primary ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-neutral-600'}
                        `}
                    >
                        <img
                            src={image.data_url}
                            alt={image.description || 'Character image'}
                            className="w-full aspect-square object-cover"
                        />
                        
                        {/* Badges with shadow for better visibility */}
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                            {image.is_primary && (
                                <div className="bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
                                    Primary
                                </div>
                            )}
                            {image.description && (
                                <div className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded shadow-lg flex items-center gap-1"
                                     title={image.description}>
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Desc
                                </div>
                            )}
                        </div>
                        
                        {/* Actions with better contrast */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-3">
                            <div className="flex flex-wrap justify-between items-center gap-2 text-xs font-medium">
                                {!image.is_primary && (
                                    <button
                                        onClick={() => handleSetPrimary(image.id)}
                                        className="px-2 py-1 bg-orange-500/80 hover:bg-orange-500 text-white rounded transition-colors"
                                        title="Set as primary"
                                    >
                                        Set Primary
                                    </button>
                                )}
                                <button
                                    onClick={() => handleEditDescription(image)}
                                    className="px-2 py-1 bg-blue-500/80 hover:bg-blue-500 text-white rounded transition-colors"
                                    title="Edit description"
                                >
                                    {image.description ? 'Edit' : 'Add'} Desc
                                </button>
                                <button
                                    onClick={() => handleDelete(image.id)}
                                    className="ml-auto px-2 py-1 bg-red-500/80 hover:bg-red-500 text-white rounded transition-colors"
                                    title="Delete image"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            
            {images.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                    <p>No images yet. Upload one to get started!</p>
                </div>
            )}
            
            {/* Modals */}
            {showUploadModal && (
                <ImageUploadModal
                    profileId={profileId}
                    onClose={async () => {
                        const wasEmpty = images.length === 0;
                        setShowUploadModal(false);
                        // Reload images after upload
                        await loadImages(profileId);
                        // If this was the first image, set it as primary automatically
                        if (wasEmpty) {
                            const freshImages = useCharacterProfileStore.getState().getImagesForProfile(profileId);
                            if (freshImages && freshImages.length > 0) {
                                await handleSetPrimary(freshImages[0].id);
                            }
                        }
                    }}
                />
            )}
            
            {/* Edit Description Modal */}
            {editingImage && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-neutral-800 rounded-lg p-6 max-w-md w-full mx-4 border border-neutral-700">
                        <h2 className="text-xl font-semibold mb-4 text-orange-400">Edit Image Description</h2>
                        
                        <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            maxLength={1000}
                            rows={4}
                            className="w-full border border-neutral-600 rounded-lg px-3 py-2 bg-neutral-700 text-neutral-100 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                            placeholder="Describe this image..."
                            autoFocus
                        />
                        <p className="mt-1 text-xs text-gray-300">{editDescription.length}/1000 characters</p>
                        
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={handleCancelEdit}
                                className="px-4 py-2 border border-neutral-600 rounded-lg text-neutral-300 bg-neutral-700 hover:bg-neutral-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleSaveDescription(editingImage)}
                                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
