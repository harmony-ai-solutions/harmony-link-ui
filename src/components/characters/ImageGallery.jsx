import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import useCharacterProfileStore from '../../store/characterProfileStore';
import ImageUploadModal from './ImageUploadModal';

/**
 * Component for displaying and managing a gallery of character images
 * @param {Object} props
 * @param {string} props.profileId - ID of the character profile
 * @param {number|null} props.visionConfigId - ID of the selected vision configuration
 */
export default function ImageGallery({ profileId, visionConfigId }) {
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [editingImage, setEditingImage] = useState(null);
    const [analyzingImageId, setAnalyzingImageId] = useState(null);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [showVlAnalysis, setShowVlAnalysis] = useState(false);
    const menuRef = useRef(null);

    const images = useCharacterProfileStore(state => state.getImagesForProfile(profileId));
    const loadImages = useCharacterProfileStore(state => state.loadImages);
    const deleteImage = useCharacterProfileStore(state => state.deleteImage);
    const setPrimaryImage = useCharacterProfileStore(state => state.setPrimaryImage);
    const updateImageMetadata = useCharacterProfileStore(state => state.updateImageMetadata);
    const analyzeImage = useCharacterProfileStore(state => state.analyzeImage);

    useEffect(() => {
        loadImages(profileId);
    }, [profileId, loadImages]);

    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setOpenMenuId(null);
            }
        };

        if (openMenuId !== null) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [openMenuId]);

    const handleSetPrimary = async (imageId) => {
        try {
            await setPrimaryImage(profileId, imageId);
            setOpenMenuId(null);
        } catch (error) {
            alert('Failed to set primary image: ' + error.message);
        }
    };

    const handleDelete = async (imageId) => {
        if (!confirm('Are you sure you want to delete this image?')) return;

        try {
            await deleteImage(profileId, imageId);
            setOpenMenuId(null);
        } catch (error) {
            alert('Failed to delete image: ' + error.message);
        }
    };

    const handleEditDescription = (image) => {
        setEditingImage(image.id);
        setShowVlAnalysis(false); // Reset to collapsed
    };

    const handleSaveDescription = async (imageId) => {
        const editDescription = document.getElementById('edit-description')?.value || '';
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
        setShowVlAnalysis(false);
    };

    const handleAnalyze = async (imageId) => {
        if (!visionConfigId) {
            alert('Please select a Vision Integration above before analyzing images.');
            return;
        }
        setAnalyzingImageId(imageId);
        setOpenMenuId(null);
        try {
            await analyzeImage(profileId, imageId, visionConfigId);
            // Reload images to get the updated VL data
            await loadImages(profileId);
        } catch (error) {
            alert('Failed to analyze image: ' + error.message);
        } finally {
            setAnalyzingImageId(null);
        }
    };

    const toggleMenu = (imageId) => {
        setOpenMenuId(openMenuId === imageId ? null : imageId);
    };

    // Get current image for edit modal
    const currentEditImage = editingImage ? images.find(img => img.id === editingImage) : null;

    return (
        <div className="space-y-3">
            {/* Gallery toolbar */}
            <div className="character-editor-section">
                <div className="character-editor-section-header" style={{ justifyContent: 'space-between' }}>
                    <div className="flex items-center gap-2">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Character Images
                        <span className="integration-count-pill text-xs px-2 py-0.5 rounded-full font-medium" style={{ textTransform: 'none', letterSpacing: 'normal' }}>
                            {images.length} {images.length === 1 ? 'image' : 'images'}
                        </span>
                    </div>
                    <button
                        onClick={() => setShowUploadModal(true)}
                        className="btn-primary py-1 px-3 text-xs"
                        style={{ textTransform: 'none', letterSpacing: 'normal' }}
                    >
                        + Upload Image
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {images.map(image => (
                    <div
                        key={image.id}
                        className="relative rounded-lg overflow-hidden transition-all cursor-pointer group"
                        style={{
                            border: image.is_primary
                                ? '2px solid var(--color-accent-primary)'
                                : '1px solid rgba(255,255,255,0.08)',
                            boxShadow: image.is_primary
                                ? '0 0 0 3px rgba(var(--color-accent-primary-rgb),0.18)'
                                : 'none',
                        }}
                        onClick={() => setLightboxImage(image)}
                    >
                        {/* Main image - clickable for lightbox */}
                        <img
                            src={image.data_url}
                            alt={image.description || 'Character image'}
                            className="w-full aspect-square object-cover"
                        />
                        
                        {/* Screen border indicator - appears on hover */}
                        <div className="absolute inset-0 border-2 border-white/0 group-hover:border-white/30 rounded-lg transition-all duration-200 pointer-events-none flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <svg className="w-8 h-8 text-white/70 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            </div>
                        </div>

                        {/* Primary badge - top-left, read-only */}
                        {image.is_primary && (
                            <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded shadow-lg">
                                Primary
                            </div>
                        )}

                        {/* Three-dot menu button - top-right, subtle */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleMenu(image.id);
                            }}
                            className="absolute top-1.5 right-1.5 w-6 h-6 rounded flex items-center justify-center
                                bg-black/30 border border-white/10 text-white/70
                                hover:opacity-100 hover:bg-black/60 hover:border-white/30
                                transition-all duration-200 z-10"
                            title="Actions"
                        >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="5" r="2" />
                                <circle cx="12" cy="12" r="2" />
                                <circle cx="12" cy="19" r="2" />
                            </svg>
                        </button>

                        {/* Dropdown menu */}
                        {openMenuId === image.id && (
                            <div
                                ref={menuRef}
                                className="absolute top-8 right-1.5 z-30 min-w-[130px] rounded-lg overflow-hidden"
                                style={{
                                    background: 'linear-gradient(135deg, var(--color-background-elevated) 0%, var(--color-background-surface) 100%)',
                                    border: '1px solid var(--color-border-default)',
                                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {!image.is_primary && (
                                    <button
                                        onClick={() => handleSetPrimary(image.id)}
                                        className="w-full px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 hover:bg-white/5 transition-colors text-orange-400"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Set Primary
                                    </button>
                                )}
                                {visionConfigId && (
                                    <button
                                        onClick={() => handleAnalyze(image.id)}
                                        disabled={analyzingImageId === image.id}
                                        className="w-full px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 hover:bg-white/5 transition-colors text-purple-400 disabled:opacity-50"
                                    >
                                        {analyzingImageId === image.id ? (
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        )}
                                        Analyze
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        handleEditDescription(image);
                                        setOpenMenuId(null);
                                    }}
                                    className="w-full px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 hover:bg-white/5 transition-colors text-blue-400"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    Edit Description
                                </button>
                                <div className="border-t border-white/10 my-0.5"></div>
                                <button
                                    onClick={() => handleDelete(image.id)}
                                    className="w-full px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 hover:bg-white/5 transition-colors text-red-400"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete
                                </button>
                            </div>
                        )}

                        {/* VL badge - bottom-right, half-transparent, passive indicator */}
                        {image.vl_model && (
                            <div
                                className="absolute bottom-2 right-2 bg-purple-600/50 backdrop-blur-sm text-white text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1 pointer-events-none"
                                title={`Analyzed by ${image.vl_model}: ${image.vl_model_interpretation || ''}`}
                            >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                VL
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {images.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-10">
                    <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--color-background-elevated)', border: '1px solid var(--color-border-default)', opacity: 0.5 }}
                    >
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: 'var(--color-text-muted)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No images yet. Upload one to get started!</p>
                </div>
            )}

            {/* Upload Modal */}
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

            {/* Edit Description Modal - using portal to avoid stacking context issues */}
            {editingImage && currentEditImage && createPortal(
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]">
                    <div
                        className="character-editor-modal max-w-2xl w-full mx-4 flex flex-col"
                        style={{ maxHeight: '90vh' }}
                    >
                        {/* Header — fixed, never scrolls */}
                        <div className="character-editor-modal-header flex-shrink-0">
                            <div className="character-editor-modal-tint" />
                            <div className="character-editor-modal-stripe" />
                            <div className="relative flex items-center gap-3 px-6 py-4">
                                <div className="character-editor-icon-badge">
                                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </div>
                                <h2 className="text-lg font-bold text-gradient-primary leading-tight">Edit Image Description</h2>
                            </div>
                        </div>

                        {/* Scrollable content — flex-1 + min-h-0 allow overflow-y-auto to engage */}
                        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-6">
                            {/* Image preview — clamp scales with the modal ceiling (90vh)
                                minus fixed overhead (~28rem: header + textarea + footer + gaps).
                                min 12rem so small images aren't squished; cap at 50vh. */}
                            <div
                                className="rounded-lg overflow-hidden"
                                style={{ background: 'var(--color-background-base)' }}
                            >
                                <img
                                    src={currentEditImage.data_url}
                                    alt="Current image"
                                    className="w-full object-contain"
                                    style={{ maxHeight: 'clamp(12rem, calc(70vh - 28rem), 50vh)' }}
                                />
                            </div>

                            {/* Description textarea */}
                            <div>
                                <textarea
                                    id="edit-description"
                                    defaultValue={currentEditImage.description || ''}
                                    maxLength={1000}
                                    rows={4}
                                    className="input-field w-full resize-none"
                                    placeholder="Describe this image..."
                                    autoFocus
                                />
                                <p className="mt-1 text-xs text-text-muted">
                                    {(currentEditImage.description?.length || 0)}/1000 characters
                                </p>
                            </div>

                            {/* VL Analysis section with collapse toggle */}
                            {currentEditImage.vl_model_interpretation && (
                                <div>
                                    <button
                                        onClick={() => setShowVlAnalysis(!showVlAnalysis)}
                                        className="flex items-center gap-2 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
                                    >
                                        <svg
                                            className={`w-4 h-4 transition-transform ${showVlAnalysis ? 'rotate-90' : ''}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                        VL Analysis ({currentEditImage.vl_model}):
                                    </button>

                                    {/* Keep textarea in the DOM; animate max-height so the
                                        collapse is smooth and the parent scrollbar never flashes */}
                                    <div
                                        style={{
                                            maxHeight: showVlAnalysis ? '300px' : '0px',
                                            overflow: 'hidden',
                                            transition: 'max-height 0.25s ease',
                                        }}
                                    >
                                        <div className="mt-2">
                                            <textarea
                                                readOnly
                                                value={currentEditImage.vl_model_interpretation}
                                                rows={8}
                                                className="input-field w-full resize-none text-xs"
                                                style={{ cursor: 'default', color: 'var(--color-text-secondary)' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer — fixed, never scrolls */}
                        <div className="character-editor-footer flex-shrink-0">
                            <div className="flex-1" />
                            <div className="flex gap-3 flex-shrink-0">
                                <button
                                    onClick={handleCancelEdit}
                                    className="btn-secondary px-5 py-2 text-sm font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleSaveDescription(editingImage)}
                                    className="btn-primary px-5 py-2 text-sm font-semibold"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Lightbox Modal */}
            {lightboxImage && createPortal(
                <LightboxModal
                    image={lightboxImage}
                    images={images}
                    onClose={() => setLightboxImage(null)}
                    onNavigate={(image) => setLightboxImage(image)}
                />,
                document.body
            )}
        </div>
    );
}

/**
 * Lightbox modal with navigation arrows and fading description overlay
 * @param {Object} props
 * @param {Object} props.image - Current image to display
 * @param {Array} props.images - All images in gallery for navigation
 * @param {Function} props.onClose - Close handler
 * @param {Function} props.onNavigate - Navigate to another image
 */
function LightboxModal({ image, images, onClose, onNavigate }) {
    const [showOverlay, setShowOverlay] = useState(true);
    const currentIndex = images.findIndex(img => img.id === image.id);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < images.length - 1;

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowLeft' && hasPrev) {
                onNavigate(images[currentIndex - 1]);
            } else if (e.key === 'ArrowRight' && hasNext) {
                onNavigate(images[currentIndex + 1]);
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, hasPrev, hasNext, images, onNavigate, onClose]);

    // Auto-hide overlay after 3 seconds of no mouse movement
    useEffect(() => {
        let timeout;
        const handleMouseMove = () => {
            setShowOverlay(true);
            clearTimeout(timeout);
            timeout = setTimeout(() => setShowOverlay(false), 3000);
        };

        const container = document.getElementById('lightbox-container');
        if (container) {
            container.addEventListener('mousemove', handleMouseMove);
            // Start the auto-hide timer
            timeout = setTimeout(() => setShowOverlay(false), 3000);
        }

        return () => {
            if (container) container.removeEventListener('mousemove', handleMouseMove);
            clearTimeout(timeout);
        };
    }, []);

    return (
        <div
            id="lightbox-container"
            className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[9999]"
            onClick={onClose}
        >
            {/* Close button */}
            <button
                onClick={onClose}
                className={`absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 border border-white/20 text-white flex items-center justify-center hover:bg-black/70 transition-all z-10 ${showOverlay ? 'opacity-100' : 'opacity-0'}`}
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>

            {/* Previous arrow */}
            {hasPrev && (
                <button
                    onClick={(e) => { e.stopPropagation(); onNavigate(images[currentIndex - 1]); }}
                    className={`absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 border border-white/20 text-white flex items-center justify-center hover:bg-black/70 transition-all z-10 ${showOverlay ? 'opacity-100' : 'opacity-0'}`}
                >
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            )}

            {/* Next arrow */}
            {hasNext && (
                <button
                    onClick={(e) => { e.stopPropagation(); onNavigate(images[currentIndex + 1]); }}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 border border-white/20 text-white flex items-center justify-center hover:bg-black/70 transition-all z-10 ${showOverlay ? 'opacity-100' : 'opacity-0'}`}
                >
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>
            )}

            {/* Image counter */}
            <div className={`absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/50 border border-white/20 text-white text-xs font-medium transition-all z-10 ${showOverlay ? 'opacity-100' : 'opacity-0'}`}>
                {currentIndex + 1} / {images.length}
            </div>

            {/* Image */}
            <img
                src={image.data_url}
                alt={image.description || 'Character image'}
                className="max-w-[90vw] max-h-[90vh] object-contain"
                onClick={(e) => e.stopPropagation()}
            />

            {/* Description overlay - fades in/out */}
            {(image.description || image.vl_model) && (
                <div
                    className={`absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 via-black/60 to-transparent transition-opacity duration-300 ${showOverlay ? 'opacity-100' : 'opacity-0'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {image.description && (
                        <p className="text-white text-sm font-medium max-w-2xl mx-auto">
                            {image.description}
                        </p>
                    )}                    
                </div>
            )}
        </div>
    );
}
