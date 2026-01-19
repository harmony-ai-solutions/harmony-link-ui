import React, { useEffect, useState } from 'react';
import { getDevices, revokeDevice, approveDevice, rejectDevice } from '../../services/management/syncService.js';

/**
 * Device Management View - Shows all synced devices and allows revocation
 */
export const DeviceManagementView = () => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadDevices();
    }, []);

    const loadDevices = async () => {
        try {
            setLoading(true);
            setError(null);
            const result = await getDevices();
            setDevices(result || []);
        } catch (err) {
            console.error('Failed to load devices:', err);
            setError('Failed to load devices');
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (deviceId) => {
        if (!window.confirm('Are you sure you want to revoke access for this device?')) {
            return;
        }

        try {
            await revokeDevice(deviceId);
            await loadDevices(); // Reload list
        } catch (err) {
            console.error('Failed to revoke device:', err);
            setError('Failed to revoke device access');
        }
    };

    const handleApprove = async (deviceId) => {
        try {
            await approveDevice(deviceId);
            await loadDevices(); // Reload list
        } catch (err) {
            console.error('Failed to approve device:', err);
            setError('Failed to approve device');
        }
    };

    const handleReject = async (deviceId) => {
        try {
            await rejectDevice(deviceId);
            await loadDevices(); // Reload list
        } catch (err) {
            console.error('Failed to reject device:', err);
            setError('Failed to reject device');
        }
    };

    const getStatusBadge = (device) => {
        if (device.is_approved === 1) {
            return <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400">Approved</span>;
        } else if (device.is_approved === 2) {
            return <span className="px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400">Rejected</span>;
        } else {
            return <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-400">Pending</span>;
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'Never';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <p className="text-text-muted">Loading devices...</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-text-primary">Synced Devices</h2>
                <p className="text-text-muted mt-1">Manage devices that can sync with this Harmony Link instance</p>
            </div>

            {/* Error Alert */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {/* Empty State */}
            {devices.length === 0 ? (
                <div className="border border-white/10 rounded-lg p-8 text-center">
                    <p className="text-text-muted">No devices have requested sync access yet.</p>
                    <p className="text-text-muted text-sm mt-2">When devices request to connect, they will appear here.</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-white/10">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10 bg-background-elevated/50">
                                <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">Device Name</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">Type</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">Platform</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">Status</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">Last Sync</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map(device => (
                                <tr key={device.device_id} className="border-b border-white/5 hover:bg-background-elevated/50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-text-primary font-medium">{device.device_name}</td>
                                    <td className="px-6 py-4 text-sm text-text-muted">{device.device_type}</td>
                                    <td className="px-6 py-4 text-sm text-text-muted">{device.device_platform}</td>
                                    <td className="px-6 py-4 text-sm">
                                        {getStatusBadge(device)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-text-muted">
                                        {formatDate(device.last_sync_timestamp)}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {device.is_approved === 0 && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleApprove(device.device_id)}
                                                    className="px-3 py-2 rounded text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => handleReject(device.device_id)}
                                                    className="px-3 py-2 rounded text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                        {device.is_approved === 1 && (
                                            <button
                                                onClick={() => handleRevoke(device.device_id)}
                                                className="px-3 py-2 rounded text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                            >
                                                Revoke
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default DeviceManagementView;
