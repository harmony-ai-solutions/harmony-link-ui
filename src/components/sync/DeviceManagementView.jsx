import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDevices, getSyncServerStatus, revokeDevice, approveDevice, rejectDevice } from '../../services/management/syncService.js';
import { deviceApprovalWatcher } from '../../services/sync/deviceApprovalWatcher.js';

/**
 * Device Management View - Shows all synced devices and allows revocation.
 *
 * Rendered as the `sync` destination in the left rail. The equivalent modal
 * (components/modals/DeviceManagementModal.jsx) is kept as a compatibility
 * entry point from General Settings.
 *
 * Data sources (merge §5.3): the roster + per-device actions stay on the
 * rows-v1 `GET /api/sync/devices`; the changeset-v1 `GET
 * /api/sync/server/status` `clients[]` is merged in by `device_id` so a
 * connected device shows its live connected-at time and last-acked seq.
 */
export const DeviceManagementView = () => {
    const { t } = useTranslation();
    const [devices, setDevices] = useState([]);
    const [liveById, setLiveById] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadDevices();
        // Keep the live-connection columns fresh while the screen is open.
        const id = setInterval(loadLiveStatus, 5000);
        // A device approved out-of-band (LAN/cloud pairing) must surface here.
        const onPaired = () => { loadDevices(); };
        deviceApprovalWatcher.addPairedListener(onPaired);
        return () => {
            clearInterval(id);
            deviceApprovalWatcher.removePairedListener(onPaired);
        };
    }, []);

    const loadLiveStatus = async () => {
        try {
            const status = await getSyncServerStatus();
            const map = {};
            (status?.clients || []).forEach((client) => {
                map[client.device_id] = client;
            });
            setLiveById(map);
        } catch {
            // The authority view is additive; the roster still stands alone.
            setLiveById({});
        }
    };

    const loadDevices = async () => {
        try {
            setLoading(true);
            setError(null);
            const [result] = await Promise.all([getDevices(), loadLiveStatus()]);
            setDevices(result || []);
        } catch (err) {
            console.error('Failed to load devices:', err);
            setError(t('common:deviceManagement.loadFailed'));
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (deviceId) => {
        if (!window.confirm(t('common:deviceManagement.revokeConfirm'))) {
            return;
        }

        try {
            await revokeDevice(deviceId);
            await loadDevices(); // Reload list
        } catch (err) {
            console.error('Failed to revoke device:', err);
            setError(t('common:deviceManagement.revokeFailed'));
        }
    };

    const handleApprove = async (deviceId) => {
        try {
            await approveDevice(deviceId);
            await loadDevices(); // Reload list
        } catch (err) {
            console.error('Failed to approve device:', err);
            setError(t('common:deviceApproval.failed'));
        }
    };

    const handleReject = async (deviceId) => {
        try {
            await rejectDevice(deviceId);
            await loadDevices(); // Reload list
        } catch (err) {
            console.error('Failed to reject device:', err);
            setError(t('common:deviceApproval.rejected'));
        }
    };

    const getStatusBadge = (device) => {
        if (device.is_approved === 1) {
            return <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400">{t('common:deviceManagement.status.approved')}</span>;
        } else if (device.is_approved === 2) {
            return <span className="px-2 py-1 rounded text-xs font-semibold bg-red-500/20 text-red-400">{t('common:deviceManagement.status.rejected')}</span>;
        } else {
            return <span className="px-2 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-400">{t('common:deviceManagement.status.pending')}</span>;
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return t('common:deviceManagement.never');
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    };

    // connected_at from the changeset-v1 status is an ISO/RFC3339 string.
    const formatDateTime = (value) => {
        if (!value) return t('common:deviceManagement.never');
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? t('common:deviceManagement.never') : date.toLocaleString();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <p className="text-text-muted">{t('common:deviceManagement.loadingDevices')}</p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-text-primary">
                    {t('common:deviceManagement.syncedPrefix')} {t('common:deviceManagement.devices')}
                </h2>
                <p className="text-text-muted mt-1">{t('common:deviceManagement.subtitle')}</p>
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
                    <p className="text-text-muted">{t('common:deviceManagement.noDevices')}</p>
                    <p className="text-text-muted text-sm mt-2">{t('common:deviceManagement.noDevicesHint')}</p>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-white/10">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-background-elevated/50">
                                <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">{t('common:deviceManagement.columns.deviceName')}</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">{t('common:deviceManagement.columns.type')}</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">{t('common:deviceManagement.columns.platform')}</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">{t('common:deviceManagement.columns.status')}</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">{t('common:deviceManagement.columns.lastSync')}</th>
                                <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">{t('common:deviceManagement.columns.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {devices.map(device => (
                                <tr key={device.device_id} className="hover:bg-background-elevated/50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-text-primary font-medium">{device.device_name}</td>
                                    <td className="px-6 py-4 text-sm text-text-muted">{device.device_type}</td>
                                    <td className="px-6 py-4 text-sm text-text-muted">{device.device_platform}</td>
                                    <td className="px-6 py-4 text-sm">
                                        {getStatusBadge(device)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-text-muted">
                                        {liveById[device.device_id] ? (
                                            <>
                                                {formatDateTime(liveById[device.device_id].connected_at)}
                                                <span className="block text-xs">
                                                    {t('sync.seqValue', { seq: liveById[device.device_id].last_seq_acked })}
                                                </span>
                                            </>
                                        ) : formatDate(device.last_sync_timestamp)}
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        {device.is_approved === 0 && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleApprove(device.device_id)}
                                                    className="px-3 py-2 rounded text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                                                >
                                                    {t('common:deviceApproval.approve')}
                                                </button>
                                                <button
                                                    onClick={() => handleReject(device.device_id)}
                                                    className="px-3 py-2 rounded text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                                >
                                                    {t('common:deviceApproval.reject')}
                                                </button>
                                            </div>
                                        )}
                                        {device.is_approved === 1 && (
                                            <button
                                                onClick={() => handleRevoke(device.device_id)}
                                                className="px-3 py-2 rounded text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                            >
                                                {t('common:deviceManagement.revoke')}
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
