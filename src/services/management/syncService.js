import { getManagementApiUrl, getApiPath, getJsonHeaders } from './baseService.js';

const API_BASE_URL = `${getManagementApiUrl()}${getApiPath()}`;

/**
 * Sync Service - API calls for device synchronization
 */

/**
 * Get list of all devices
 * @returns {Promise<Array>} Array of device objects
 */
export async function getDevices() {
    try {
        const response = await fetch(`${API_BASE_URL}/sync/devices`, {
            method: 'GET',
            headers: getJsonHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch devices');
        }
        
        const data = await response.json();
        return data || [];
    } catch (error) {
        console.error('Error fetching devices:', error);
        throw error;
    }
}

/**
 * Get list of pending device approvals
 * @returns {Promise<Array>} Array of pending device objects
 */
export async function getPendingDevices() {
    try {
        const response = await fetch(`${API_BASE_URL}/sync/devices/pending`, {
            method: 'GET',
            headers: getJsonHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch pending devices');
        }
        
        const data = await response.json();
        return data || [];
    } catch (error) {
        console.error('Error fetching pending devices:', error);
        throw error;
    }
}

/**
 * Approve a device connection request
 * @param {string} deviceId - The device ID to approve
 * @returns {Promise<void>}
 */
export async function approveDevice(deviceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/sync/devices/${deviceId}/approve`, {
            method: 'POST',
            headers: getJsonHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to approve device');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error approving device:', error);
        throw error;
    }
}

/**
 * Reject a device connection request
 * @param {string} deviceId - The device ID to reject
 * @returns {Promise<void>}
 */
export async function rejectDevice(deviceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/sync/devices/${deviceId}/reject`, {
            method: 'POST',
            headers: getJsonHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to reject device');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error rejecting device:', error);
        throw error;
    }
}

/**
 * Revoke device access
 * @param {string} deviceId - The device ID to revoke
 * @returns {Promise<void>}
 */
export async function revokeDevice(deviceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/sync/devices/${deviceId}/revoke`, {
            method: 'POST',
            headers: getJsonHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to revoke device');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error revoking device:', error);
        throw error;
    }
}

/**
 * Get sync history for a specific device
 * @param {string} deviceId - The device ID
 * @returns {Promise<Array>} Array of sync history records
 */
export async function getSyncHistory(deviceId) {
    try {
        const response = await fetch(`${API_BASE_URL}/sync/${deviceId}/history`, {
            method: 'GET',
            headers: getJsonHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch sync history');
        }
        
        const data = await response.json();
        return data || [];
    } catch (error) {
        console.error('Error fetching sync history:', error);
        throw error;
    }
}

/**
 * Get the changeset-v1 SERVER (authority) status — the desktop's own sync
 * surface: authority flag, epoch/recording state, connected clients and the
 * pending device-approval count (plan 3-5b).
 * @returns {Promise<Object>} The server status object
 */
export async function getSyncServerStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/sync/server/status`, {
            method: 'GET',
            headers: getJsonHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to fetch sync server status');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching sync server status:', error);
        throw error;
    }
}

/**
 * Get the changeset-v1 CLIENT role status — only meaningful when this desktop
 * engine is itself configured as a client of a peer (plan 3-5). Returns the
 * same fields the phone screen shows.
 * @returns {Promise<Object>} The client status object
 */
export async function getSyncClientStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/sync/client/status`, {
            method: 'GET',
            headers: getJsonHeaders()
        });

        if (!response.ok) {
            throw new Error('Failed to fetch sync client status');
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching sync client status:', error);
        throw error;
    }
}

/**
 * Build an Error from a failed pairing response, attaching the HTTP status and
 * any `{ error }` detail so the Pair modal can branch (e.g. cloud `401` =
 * signed-out, `403` = this device not authorized, `502` = relay upstream).
 *
 * @param {Response} response
 * @param {string} fallback
 * @returns {Promise<Error>}
 */
async function readPairingError(response, fallback) {
    let detail = null;
    try {
        const body = await response.json();
        detail = body?.error ?? null;
    } catch {
        // Non-JSON body — use the generic message.
    }
    const err = new Error(detail || fallback);
    err.status = response.status;
    return err;
}

/**
 * Mint a fresh LAN pairing code (plan 7-15, engine E1).
 *
 * Each call mints a NEW single-use secret (displaying the QR is the consent
 * gesture), so call on tab-open and on every regenerate.
 *
 * @returns {Promise<Object>} `{ v, kind, ws, wss?, mode, fingerprint?, dataset_id,
 *                              name, secret, ttl, enrollment? }`
 */
export async function createLanPairing() {
    const response = await fetch(`${API_BASE_URL}/sync/pairing/lan`, {
        method: 'POST',
        headers: getJsonHeaders()
    });
    if (!response.ok) throw await readPairingError(response, 'Failed to create LAN pairing code');
    return await response.json();
}

/**
 * Mint a fresh cloud pairing code (plan 7-15, engine E2). The shape must be
 * IDENTICAL to the portal-minted code phones already parse.
 *
 * @returns {Promise<Object>} `{ relay_url, pairing_token, account_hint }`
 */
export async function createCloudPairing() {
    const response = await fetch(`${API_BASE_URL}/sync/pairing/cloud`, {
        method: 'POST',
        headers: getJsonHeaders()
    });
    if (!response.ok) throw await readPairingError(response, 'Failed to create cloud pairing code');
    return await response.json();
}
