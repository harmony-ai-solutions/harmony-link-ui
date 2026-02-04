import { getPendingDevices, approveDevice, rejectDevice } from '../management/syncService.js';

/**
 * Device Approval Watcher - Polls for pending device approvals
 */
class DeviceApprovalWatcher {
    constructor() {
        this.intervalId = null;
        this.pollInterval = 2000; // 2 seconds (matching backend polling interval)
        this.listeners = [];
    }

    /**
     * Start watching for device approval requests
     */
    start() {
        if (this.intervalId) return; // Already running

        console.log('Starting device approval watcher...');
        this.intervalId = setInterval(() => this.checkPendingApprovals(), this.pollInterval);

        // Check immediately
        this.checkPendingApprovals();
    }

    /**
     * Stop watching for device approval requests
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('Stopped device approval watcher');
        }
    }

    /**
     * Check for pending device approvals
     */
    async checkPendingApprovals() {
        try {
            const pendingDevices = await getPendingDevices();

            if (pendingDevices && pendingDevices.length > 0) {
                // Notify all listeners
                this.listeners.forEach(listener => listener(pendingDevices));
            }
        } catch (error) {
            console.error('Error checking pending approvals:', error);
        }
    }

    /**
     * Add a listener for pending device changes
     * @param {Function} callback - Function to call with pending devices array
     */
    addListener(callback) {
        this.listeners.push(callback);
    }

    /**
     * Remove a listener
     * @param {Function} callback - Function to remove
     */
    removeListener(callback) {
        this.listeners = this.listeners.filter(l => l !== callback);
    }

    /**
     * Approve a device
     * @param {string} deviceId - The device ID to approve
     */
    async approveDevice(deviceId) {
        try {
            await approveDevice(deviceId);
            console.log(`Device ${deviceId} approved`);

            // Trigger immediate check
            this.checkPendingApprovals();
        } catch (error) {
            console.error('Error approving device:', error);
            throw error;
        }
    }

    /**
     * Reject a device
     * @param {string} deviceId - The device ID to reject
     */
    async rejectDevice(deviceId) {
        try {
            await rejectDevice(deviceId);
            console.log(`Device ${deviceId} rejected`);

            // Trigger immediate check
            this.checkPendingApprovals();
        } catch (error) {
            console.error('Error rejecting device:', error);
            throw error;
        }
    }
}

// Create singleton instance
export const deviceApprovalWatcher = new DeviceApprovalWatcher();

export default deviceApprovalWatcher;
