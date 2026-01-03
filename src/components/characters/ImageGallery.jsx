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
    const images = useCharacterProfileStore(state => state.getImagesForProfile(profileId));
    const loadImages = useCharacterProfileStore(state => state.loadImages);
    const deleteImage = useCharacterProfileStore(state => state.deleteImage);
    const setPrimaryImage = useCharacterProfileStore(state => state.setPrimaryImage);
    
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
    
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">Character Images</h3>
                <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                            ${image.is_primary ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'}
                        `}
                    >
                        <img
                            src={image.data_url}
                            alt={image.description || 'Character image'}
                            className="w-full aspect-square object-cover"
                        />
                        
                        {image.is_primary && (
                            <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs font-medium px-2 py-1 rounded">
                                Primary
                            </div>
                        )}
                        
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                            <div className="flex justify-between items-center gap-2">
                                {!image.is_primary && (
                                    <button
                                        onClick={() => handleSetPrimary(image.id)}
                                        className="text-white text-xs hover:text-blue-300 transition-colors"
                                        title="Set as primary"
                                    >
                                        Set Primary
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(image.id)}
                                    className="ml-auto text-white text-xs hover:text-red-300 transition-colors"
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
                <div className="text-center py-8 text-gray-500">
                    <p>No images yet. Upload one to get started!</p>
                </div>
            )}
            
            {showUploadModal && (
                <ImageUploadModal
                    profileId={profileId}
                    onClose={() => setShowUploadModal(false)}
                />
            )}
        </div>
    );
}
