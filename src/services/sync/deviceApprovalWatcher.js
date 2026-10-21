import { getPendingDevices, getDevices, approveDevice, rejectDevice } from '../management/syncService.js';

/**
 * LocalStorage key holding the set of device ids we have already surfaced a
 * "paired" toast for. Persisted so a restart never re-toasts known devices
 * (plan 7-15, task W §3).
 */
const SEEN_PAIRED_DEVICES_KEY = 'harmony.pairedDeviceToast.seen';

/**
 * Device Approval Watcher - Polls for pending device approvals (and, since
 * plan 7-15, for devices that appear ALREADY-APPROVED — auto-approved by a LAN
 * pairing secret — so the desktop can raise a "«name» paired" toast).
 */
class DeviceApprovalWatcher {
    constructor() {
        this.intervalId = null;
        this.pollInterval = 2000; // 2 seconds (matching backend polling interval)
        this.listeners = [];
        // Paired-device listeners receive devices that newly appear approved.
        this.pairedListeners = [];
        // Guard: the seen-set is seeded once (first ever run) without toasting.
        this.pairedSeeded = false;
        // In-memory fallback seen-set for environments without localStorage.
        this.memSeen = new Set();
        this.memSeenInit = false;
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

        // Same tick also diff approved devices for the "paired" toast.
        await this.checkPairedDevices();
    }

    /**
     * Diff `GET /api/sync/devices` against a persisted seen-set: a device that
     * appears already-approved and was not seen before is a freshly paired
     * device (auto-approved engine-side by the QR secret, or approved manually).
     * Emits to pairedListeners with the device objects.
     *
     * First-ever run seeds the seen-set from current approved devices WITHOUT
     * toasting, so pre-existing devices never fire a toast.
     */
    async checkPairedDevices() {
        let devices;
        try {
            devices = await getDevices();
        } catch (error) {
            return; // Devices listing can fail while the engine restarts — ignore.
        }
        if (!Array.isArray(devices)) return;

        const approved = devices.filter(d => d && d.is_approved === 1);

        let seen = this._loadSeen();
        if (!this.pairedSeeded && seen === null) {
            // First ever run — seed silently and remember.
            this.pairedSeeded = true;
            this._saveSeen(new Set(approved.map(d => d.device_id)));
            return;
        }
        this.pairedSeeded = true;
        if (seen === null) seen = new Set();

        const newlyPaired = [];
        for (const device of approved) {
            if (device.device_id && !seen.has(device.device_id)) {
                seen.add(device.device_id);
                newlyPaired.push(device);
            }
        }

        if (newlyPaired.length > 0) {
            this._saveSeen(seen);
            newlyPaired.forEach(device => {
                this.pairedListeners.forEach(listener => {
                    try { listener(device); } catch { /* isolate listener errors */ }
                });
            });
        }
    }

    _loadSeen() {
        try {
            const raw = localStorage.getItem(SEEN_PAIRED_DEVICES_KEY);
            if (raw === null) return null;
            return new Set(JSON.parse(raw));
        } catch {
            // Storage unavailable — fall back to the in-memory seen-set so the
            // toast does not re-fire on every poll.
            return this.memSeenInit ? new Set(this.memSeen) : null;
        }
    }

    _saveSeen(seenSet) {
        // Always keep the in-memory mirror current (covers no-localStorage envs).
        this.memSeen = new Set(seenSet);
        this.memSeenInit = true;
        try {
            localStorage.setItem(SEEN_PAIRED_DEVICES_KEY, JSON.stringify([...seenSet]));
        } catch {
            /* storage unavailable — the in-memory mirror above prevents re-toasts */
        }
    }

    /**
     * Add a listener for freshly paired (already-approved) devices.
     * @param {Function} callback - Called with the newly paired device object.
     */
    addPairedListener(callback) {
        this.pairedListeners.push(callback);
    }

    /**
     * Remove a paired-device listener.
     * @param {Function} callback - Function to remove.
     */
    removePairedListener(callback) {
        this.pairedListeners = this.pairedListeners.filter(l => l !== callback);
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
