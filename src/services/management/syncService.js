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
