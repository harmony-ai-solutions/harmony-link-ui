import React, { useEffect, useState } from 'react';
import { getDevices, revokeDevice } from '../../services/management/syncService.js';

/**
 * Device Management Modal - Shows all synced devices and allows revocation
 */
export const DeviceManagementModal = ({ show, onClose }) => {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (show) {
            loadDevices();
        }
    }, [show]);

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

    const getStatusBadge = (device) => {
        if (device.is_approved === 1) {
            return <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400">Approved</span>;
        } else if (device.is_approved === 2) {
            return <span className="px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400">Rejected</span>;
        } else {
            return <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-400">Pending</span>;
        }
    };

    // Helper to extract value from nullable SQL types (NullString, NullTime)
    const getSafeValue = (field, defaultValue = 'Unknown') => {
        if (!field) return defaultValue;
        // Handle SQL NullString/NullTime objects from Go
        if (typeof field === 'object' && field.Valid) {
            return field.String || field.Time || defaultValue;
        }
        return field || defaultValue;
    };

    // Format timestamp
    const formatDate = (timestamp) => {
        if (!timestamp) return 'Unknown';
        // Handle SQL NullTime object
        const time = typeof timestamp === 'object' && timestamp.Valid ? timestamp.Time : timestamp;
        if (!time) return 'Unknown';
        const date = new Date(time);
        return date.toLocaleString();
    };

    if (!show) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="modal-content max-w-4xl w-full rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] flex flex-col">
                {/* Modal Header */}
                <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">
                            <span className="text-gradient-primary">Synced</span> Devices
                        </h2>
                        <p className="text-text-muted text-sm mt-1">Manage devices that can sync with this Harmony Link instance</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-text-muted hover:text-text-primary transition-colors p-2"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                        {/* Error Alert */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        {/* Loading State */}
                        {loading ? (
                            <div className="flex items-center justify-center h-96">
                                <p className="text-text-muted">Loading devices...</p>
                            </div>
                        ) : (
                            <>
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
                                                        <td className="px-6 py-4 text-sm text-text-primary font-medium">{getSafeValue(device.device_name)}</td>
                                                        <td className="px-6 py-4 text-sm text-text-muted">{getSafeValue(device.device_type)}</td>
                                                        <td className="px-6 py-4 text-sm text-text-muted">{getSafeValue(device.device_platform)}</td>
                                                        <td className="px-6 py-4 text-sm">
                                                            {getStatusBadge(device)}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-text-muted">
                                                            {formatDate(device.last_sync_timestamp)}
                                                        </td>
                                                        <td className="px-6 py-4 text-sm">
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
                            </>
                        )}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="border-t border-white/10 px-6 py-4 bg-background-base/50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="btn-secondary"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeviceManagementModal;
