import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import useCharacterProfileStore from '../../store/characterProfileStore';

/**
 * Component for importing character cards (PNG files with embedded metadata)
 * @param {Object} props
 * @param {Function} [props.onSuccess] - Callback when import is successful
 */
export default function CharacterCardImport({ onSuccess }) {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const importCharacterCard = useCharacterProfileStore(state => state.importCharacterCard);
    
    const onDrop = async (acceptedFiles) => {
        if (acceptedFiles.length === 0) return;
        
        const file = acceptedFiles[0];
        setUploading(true);
        setError(null);
        
        try {
            const result = await importCharacterCard(file);
            onSuccess?.(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };
    
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/png': ['.png'] },
        maxFiles: 1,
        disabled: uploading,
    });
    
    return (
        <div className="space-y-4">
            <div
                {...getRootProps()}
                className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                    transition-colors duration-200
                    ${isDragActive ? 'border-accent-primary bg-accent-primary/10' : 'border-border-default hover:border-border-hover'}
                    ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                <input {...getInputProps()} />
                {uploading ? (
                    <div className="space-y-2">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto"></div>
                        <p className="text-text-muted">Importing character card...</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <svg className="mx-auto h-12 w-12 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-lg font-medium text-text-primary">
                            {isDragActive ? 'Drop the PNG file here' : 'Drag & drop a character card PNG'}
                        </p>
                        <p className="text-sm text-text-muted">or click to select file</p>
                        <p className="text-xs text-text-disabled mt-2">Supports Character Card V1, V2, and V3 formats</p>
                    </div>
                )}
            </div>
            
            {error && (
                <div className="alert-error">
                    <p className="text-sm">{error}</p>
                </div>
            )}
        </div>
    );
}
