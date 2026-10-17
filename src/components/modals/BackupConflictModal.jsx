import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * BackupConflictModal — "Cloud backup conflict" (owner ruling 2026-10-17).
 *
 * Shown when POST /api/backup/artifact returns a `held` result: another device
 * wrote the cloud backup manifest with DIFFERENT data, so the engine refused to
 * overwrite it silently. Three actions:
 *   - Push mine (replace cloud backup) → re-run with onConflict:"overwrite".
 *   - Pull theirs (restore)            → the existing restore flow.
 *   - Cancel                           → change nothing.
 *
 * When the held manifest carries a syncGroupFingerprint that differs from this
 * device's (an empty local fingerprint counts as differing), a hint nudges the
 * user to pair the devices so data stays in sync.
 */
const BackupConflictModal = ({ isOpen, conflict, localFingerprint, busy = false, onPushMine, onPullTheirs, onCancel }) => {
    const { t } = useTranslation();

    if (!isOpen || !conflict) return null;

    const remoteFp = conflict.remoteSyncGroupFingerprint || '';
    const localFp = localFingerprint || '';
    const foreignGroup = remoteFp !== '' && remoteFp !== localFp;

    let syncedAt = conflict.remoteSyncedAt || '';
    if (syncedAt) {
        const d = new Date(syncedAt);
        if (!Number.isNaN(d.getTime())) syncedAt = d.toLocaleString();
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="modal-content max-w-md w-full rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-8">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-500/10 mb-6">
                        <svg className="h-7 w-7 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                    </div>

                    <h3 className="text-xl font-extrabold text-text-primary mb-3 tracking-tight text-center">
                        {t('generalSettings:backup.conflict.title')}
                    </h3>

                    <p className="text-[15px] leading-relaxed text-text-secondary font-medium text-center">
                        {t('generalSettings:backup.conflict.body', {
                            device: conflict.remoteDeviceLabel || '—',
                            syncedAt: syncedAt || '—',
                            generation: conflict.remoteGeneration ?? '—',
                        })}
                    </p>

                    {foreignGroup && (
                        <p className="mt-4 text-xs text-text-muted text-center">
                            {t('generalSettings:backup.conflict.syncGroupHint')}
                        </p>
                    )}

                    <div className="mt-8 space-y-3">
                        <button
                            onClick={onPushMine}
                            disabled={busy}
                            className="btn-primary w-full py-3 shadow-lg shadow-accent-primary/20 disabled:opacity-50"
                        >
                            {t('generalSettings:backup.conflict.pushMine')}
                        </button>
                        <button
                            onClick={onPullTheirs}
                            disabled={busy}
                            className="btn-secondary w-full py-3 disabled:opacity-50"
                        >
                            {t('generalSettings:backup.conflict.pullTheirs')}
                        </button>
                        <button
                            onClick={onCancel}
                            disabled={busy}
                            className="btn-secondary w-full py-3 disabled:opacity-50"
                        >
                            {t('generalSettings:backup.conflict.cancel')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BackupConflictModal;
