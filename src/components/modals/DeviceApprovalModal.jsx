import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Device Approval Modal - Shows pending device approval requests
 */
export const DeviceApprovalModal = ({ device, onApprove, onReject, show }) => {
    const { t } = useTranslation();

    if (!show || !device) {
        return null;
    }

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

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="modal-content max-w-md w-full rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="p-8">
                    <h2 className="text-xl font-extrabold text-text-primary mb-6 tracking-tight text-center">
                        {t('common:deviceApproval.title')}
                    </h2>
                    <div className="space-y-4 mb-6">
                        <div>
                            <p className="text-text-muted text-sm font-medium">{t('common:deviceApproval.deviceName')}</p>
                            <p className="text-text-primary font-semibold mt-1">{getSafeValue(device.device_name, 'Unknown Device')}</p>
                        </div>
                        <div>
                            <p className="text-text-muted text-sm font-medium">{t('common:deviceApproval.deviceType')}</p>
                            <p className="text-text-primary font-semibold mt-1">{getSafeValue(device.device_type, 'Unknown Type')}</p>
                        </div>
                        <div>
                            <p className="text-text-muted text-sm font-medium">{t('common:deviceApproval.platform')}</p>
                            <p className="text-text-primary font-semibold mt-1">{getSafeValue(device.device_platform, 'Unknown Platform')}</p>
                        </div>
                        <div>
                            <p className="text-text-muted text-sm font-medium">{t('common:deviceApproval.requestedAt')}</p>
                            <p className="text-text-primary font-semibold mt-1">{formatDate(device.approval_requested_at)}</p>
                        </div>
                    </div>

                    <div className="bg-accent-primary/10 border border-accent-primary/30 rounded-lg p-4">
                        <p className="text-[15px] leading-relaxed text-text-primary font-medium">
                            {t('common:deviceApproval.allowQuestion')}
                        </p>
                        <p className="text-text-secondary text-sm mt-2">
                            {t('common:deviceApproval.willHaveAccess')}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button onClick={onReject} className="btn-secondary flex-1 py-3">
                        {t('common:deviceApproval.reject')}
                    </button>
                    <button onClick={onApprove} className="btn-primary flex-1 py-3 shadow-lg shadow-accent-primary/20">
                        {t('common:deviceApproval.approve')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeviceApprovalModal;
