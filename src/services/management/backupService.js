import { getManagementApiUrl, getApiPath, getJsonHeaders } from './baseService.js';

const API_BASE_URL = `${getManagementApiUrl()}${getApiPath()}`;

/**
 * Build an Error from a failed response, surfacing the engine's `{ error }` body
 * detail when present (the engine returns actionable copy, e.g. a 400 telling the
 * user to sign in for a soulbits-cloud target) and falling back to the generic
 * message otherwise. Mirrors the cloud service's error handling.
 *
 * @param {Response} response
 * @param {string} fallback
 * @returns {Promise<Error>}
 */
async function readApiError(response, fallback) {
    let detail = null;
    try {
        const body = await response.json();
        detail = body?.error ?? null;
    } catch {
        // Non-JSON body — fall back to the generic message.
    }
    const err = new Error(detail || fallback);
    err.status = response.status;
    return err;
}

/**
 * Backup Service - API calls for the engine's user-owned-storage backup (plan 2-6).
 *
 * The engine produces the encrypted artifact and uploads it to a caller-supplied
 * target (a local folder, WebDAV, or an OAuth provider); these routes just drive
 * it. The engine stores no backup data itself.
 */

/**
 * List the selectable backup target types.
 * @returns {Promise<Array>} Array of target descriptors ({ type, label, v1, note? })
 */
export async function listBackupTargets() {
    try {
        const response = await fetch(`${API_BASE_URL}/backup/targets`, {
            method: 'GET',
            headers: getJsonHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch backup targets');
        }
        const data = await response.json();
        return data?.targets || [];
    } catch (error) {
        console.error('Error fetching backup targets:', error);
        throw error;
    }
}

/**
 * Get the current data version — the skip-if-unchanged marker.
 * @returns {Promise<string>} The data version string
 */
export async function getBackupDataVersion() {
    try {
        const response = await fetch(`${API_BASE_URL}/backup/data-version`, {
            method: 'GET',
            headers: getJsonHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch backup data version');
        }
        const data = await response.json();
        return data?.dataVersion || '';
    } catch (error) {
        console.error('Error fetching backup data version:', error);
        throw error;
    }
}

/**
 * Probe a target (connectivity / credentials check).
 * @param {Object} target - target descriptor ({ type, destDir?, baseUrl?, username?, password?, accessToken?, inboxDir? })
 * @returns {Promise<Object>} The probe status
 */
export async function probeBackupTarget(target) {
    try {
        const response = await fetch(`${API_BASE_URL}/backup/targets/probe`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify(target)
        });
        if (!response.ok) {
            throw await readApiError(response, 'Failed to probe backup target');
        }
        return await response.json();
    } catch (error) {
        console.error('Error probing backup target:', error);
        throw error;
    }
}

/**
 * Create a backup artifact and upload it to the target.
 * @param {Object} payload - { target, deviceLabel?, targetAccount?, passphrase?, force?, dryRun?, includeSideObjects?, onConflict? }
 *   onConflict (hosted soulbits-cloud only): "hold" (default) returns a `held`
 *   conflict when another device wrote the cloud manifest; "overwrite" replaces it.
 * @returns {Promise<Object>} { skipped, recoveryCode, recoveryCodeIsNew, dataVersion,
 *   uploadedObjects, dedupedObjects, totalBytes, manifest, held? }
 *   held (present only when the push was held): { remoteGeneration,
 *   remoteDataVersion, remoteDeviceLabel, remoteSyncedAt,
 *   remoteSyncGroupFingerprint }.
 */
export async function createBackupArtifact(payload) {
    try {
        const response = await fetch(`${API_BASE_URL}/backup/artifact`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw await readApiError(response, 'Backup failed');
        }
        return await response.json();
    } catch (error) {
        console.error('Error creating backup artifact:', error);
        throw error;
    }
}

/**
 * Restore from a backup artifact. The engine assembles into a staging dir so a
 * live DB is never clobbered; the app swaps the dir in on next engine start.
 * @param {Object} payload - { target, recoveryCode?, passphrase?, dekBase64?, destDataDir?, skipSideObjects? }
 * @returns {Promise<Object>} { unwrapKind, dataVersion, schemaVersion, sideObjects, dbRows, dataDir, dbPath, manifest }
 */
export async function restoreBackupArtifact(payload) {
    try {
        const response = await fetch(`${API_BASE_URL}/backup/restore`, {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw await readApiError(response, 'Restore failed');
        }
        return await response.json();
    } catch (error) {
        console.error('Error restoring backup artifact:', error);
        throw error;
    }
}

/**
 * Get this device's current sync-group fingerprint (empty when unpaired) — used
 * to hint when a cloud backup belongs to a sync group this device is not part of
 * (owner ruling 2026-10-17).
 * @returns {Promise<string>} The fingerprint (sha256 hex) or ''
 */
export async function getBackupSyncGroupFingerprint() {
    try {
        const response = await fetch(`${API_BASE_URL}/backup/sync-group-fingerprint`, {
            method: 'GET',
            headers: getJsonHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch sync-group fingerprint');
        }
        const data = await response.json();
        return data?.fingerprint || '';
    } catch (error) {
        console.error('Error fetching sync-group fingerprint:', error);
        throw error;
    }
}
