import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useTranslation } from 'react-i18next';
import useCharacterProfileStore from '../../store/characterProfileStore';

/**
 * Component for importing character cards (PNG files with embedded metadata)
 * @param {Object} props
 * @param {Function} [props.onSuccess] - Callback when import is successful
 */
export default function CharacterCardImport({ onSuccess }) {
    const { t } = useTranslation('characters');
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [droppedFields, setDroppedFields] = useState(null);
    const [pendingResult, setPendingResult] = useState(null);
    const importCharacterCard = useCharacterProfileStore(state => state.importCharacterCard);
    
    const onDrop = async (acceptedFiles) => {
        if (acceptedFiles.length === 0) return;
        
        const file = acceptedFiles[0];
        setUploading(true);
        setError(null);
        setDroppedFields(null);
        
        try {
            const result = await importCharacterCard(file);
            // If non-spec fields were dropped on import, surface them to the
            // user before proceeding (no-unknown-fields policy).
            if (result?.dropped_fields?.length > 0) {
                setDroppedFields(result.dropped_fields);
                setPendingResult(result);
            } else {
                onSuccess?.(result);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const handleContinueAfterWarning = () => {
        const result = pendingResult;
        setDroppedFields(null);
        setPendingResult(null);
        onSuccess?.(result);
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
                data-tutorial-id="char-import-dropzone"
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
                        <p className="text-text-muted">{t('import.uploading')}</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <svg className="mx-auto h-12 w-12 text-text-disabled" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="text-lg font-medium text-text-primary">
                            {isDragActive ? t('import.dropActive') : t('import.dropIdle')}
                        </p>
                        <p className="text-sm text-text-muted">{t('import.orClick')}</p>
                        <p className="text-xs text-text-disabled mt-2">{t('import.formats')}</p>
                    </div>
                )}
            </div>
            
            {error && (
                <div className="alert-error">
                    <p className="text-sm">{error}</p>
                </div>
            )}

            {droppedFields && (
                <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                        </svg>
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-yellow-500">
                                {t('import.droppedFieldsTitle', { count: droppedFields.length })}
                            </p>
                            <p className="text-xs text-text-muted">
                                {t('import.droppedFieldsHint')}
                            </p>
                            <ul className="text-xs text-text-muted mt-2 space-y-0.5 max-h-32 overflow-y-auto">
                                {droppedFields.map((field) => (
                                    <li key={field} className="font-mono">{field}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <button
                        onClick={handleContinueAfterWarning}
                        className="btn-primary w-full text-sm"
                    >
                        {t('buttons.continue')}
                    </button>
                </div>
            )}
        </div>
    );
}
