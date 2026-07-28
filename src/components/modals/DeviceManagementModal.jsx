import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDevices, revokeDevice } from '../../services/management/syncService.js';

/**
 * Device Management Modal - Shows all synced devices and allows revocation
 */
export const DeviceManagementModal = ({ show, onClose }) => {
    const { t } = useTranslation();
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
            await loadDevices();
        } catch (err) {
            console.error('Failed to revoke device:', err);
            setError(t('common:deviceManagement.revokeFailed'));
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

    const getSafeValue = (field, defaultValue = 'Unknown') => {
        if (!field) return defaultValue;
        if (typeof field === 'object' && field.Valid) {
            return field.String || field.Time || defaultValue;
        }
        return field || defaultValue;
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return 'Unknown';
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
                <div className="px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold">
                            <span className="text-gradient-primary">{t('common:deviceManagement.syncedPrefix')}</span> {t('common:deviceManagement.devices')}
                        </h2>
                        <p className="text-text-muted text-sm mt-1">{t('common:deviceManagement.subtitle')}</p>
                    </div>
                    <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        {loading ? (
                            <div className="flex items-center justify-center h-96">
                                <p className="text-text-muted">{t('common:deviceManagement.loadingDevices')}</p>
                            </div>
                        ) : (
                            <>
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
                                                        <td className="px-6 py-4 text-sm text-text-primary font-medium">{getSafeValue(device.device_name)}</td>
                                                        <td className="px-6 py-4 text-sm text-text-muted">{getSafeValue(device.device_type)}</td>
                                                        <td className="px-6 py-4 text-sm text-text-muted">{getSafeValue(device.device_platform)}</td>
                                                        <td className="px-6 py-4 text-sm">{getStatusBadge(device)}</td>
                                                        <td className="px-6 py-4 text-sm text-text-muted">{formatDate(device.last_sync_timestamp)}</td>
                                                        <td className="px-6 py-4 text-sm">
                                                            {device.is_approved === 1 && (
                                                                <button onClick={() => handleRevoke(device.device_id)}
                                                                    className="px-3 py-2 rounded text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
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
                            </>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 bg-background-base/50 flex justify-end">
                    <button onClick={onClose} className="btn-secondary">
                        {t('common:buttons.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeviceManagementModal;
