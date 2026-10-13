import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getSyncServerStatus, getSyncClientStatus } from '../../services/management/syncService.js';
import { deviceApprovalWatcher } from '../../services/sync/deviceApprovalWatcher.js';
import { LogError } from '../../utils/logger.js';

/**
 * SyncStatusView — the changeset-v1 sync surface for the desktop (plan 3-5b).
 *
 * The desktop engine is normally the sync AUTHORITY: it leads, and phone engines
 * connect to it as clients. This view visualizes that SERVER role (authority
 * indicator, epoch/recording state, connected clients with last-acked progress)
 * plus the pending device-approval entry point (the existing DeviceApprovalModal
 * + watcher). When this desktop is itself configured as a CLIENT of a peer, it
 * also surfaces the same fields the phone screen shows.
 *
 * Data source: the engine management API. GET /api/sync/server/status (authority)
 * and GET /api/sync/client/status (this engine's own client role, if enabled).
 *
 * This is the changeset-v1 surface. It is separate from the rows-v1
 * DeviceManagementView (deleted in 6-4) — see the 3-5b report.
 */

const POLL_INTERVAL_MS = 3000;

// State → badge classes (the 9 client-role states; "authority" is its own view).
const STATE_BADGE = {
    syncing: 'bg-green-500/20 text-green-400',
    promoted: 'bg-green-500/20 text-green-400',
    pending_approval: 'bg-yellow-500/20 text-yellow-400',
    pairing: 'bg-yellow-500/20 text-yellow-400',
    connecting: 'bg-yellow-500/20 text-yellow-400',
    backoff: 'bg-yellow-500/20 text-yellow-400',
    rejected: 'bg-red-500/20 text-red-400',
    idle: 'bg-white/10 text-text-muted',
    stopped: 'bg-white/10 text-text-muted',
};

function stateBadgeClass(state) {
    return STATE_BADGE[state] || 'bg-white/10 text-text-muted';
}

function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
}

function StatusBadge({ state, t }) {
    return (
        <span className={`px-2.5 py-1 rounded text-xs font-semibold ${stateBadgeClass(state)}`}>
            {t(`sync.states.${state}`, { defaultValue: state })}
        </span>
    );
}

function Field({ label, children }) {
    return (
        <div className="flex items-start justify-between gap-4 py-2">
            <span className="text-text-muted text-sm">{label}</span>
            <span className="text-text-primary text-sm font-medium text-right">{children}</span>
        </div>
    );
}

export const SyncStatusView = () => {
    const { t } = useTranslation();

    const [server, setServer] = useState(null);
    const [client, setClient] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const inFlightRef = useRef(false);

    const refresh = useCallback(async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        try {
            const [serverStatus, clientStatus] = await Promise.all([
                getSyncServerStatus(),
                // The client role is optional on the desktop — a failure here
                // must not blank the authority view.
                getSyncClientStatus().catch(() => null),
            ]);
            setServer(serverStatus);
            setClient(clientStatus);
            setError(null);
        } catch (err) {
            LogError('Failed to load sync status', err);
            setError(t('sync.loadFailed'));
        } finally {
            inFlightRef.current = false;
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        refresh();
        const id = setInterval(refresh, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [refresh]);

    const clients = server?.clients || [];
    const epoch = server?.epoch || null;
    const pendingApprovals = server?.pending_approvals_count ?? 0;
    const authority = server?.authority === true;

    const reviewApprovals = () => {
        // Reuse the existing watcher → the global DeviceApprovalModal opens on
        // the next pending-device notification (HarmonyLinkApp listener).
        deviceApprovalWatcher.checkPendingApprovals();
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary">{t('sync.title')}</h2>
                    <p className="text-text-muted mt-1">{t('sync.subtitle')}</p>
                </div>
                <button onClick={refresh} className="btn-secondary px-4 py-2 text-sm">
                    {t('sync.refresh')}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            {loading && !server ? (
                <div className="flex items-center justify-center h-48">
                    <p className="text-text-muted">{t('sync.loading')}</p>
                </div>
            ) : (
                <>
                    {/* Authority + epoch */}
                    <div className="rounded-lg border border-white/10 bg-background-elevated/30 p-6">
                        <div className="flex items-center gap-3">
                            <span
                                className={`w-3 h-3 rounded-full ${authority ? 'bg-green-400' : 'bg-yellow-400'}`}
                            />
                            <h3 className="text-lg font-semibold text-text-primary">
                                {authority ? t('sync.authorityThisDevice') : t('sync.authorityPeer')}
                            </h3>
                        </div>
                        <p className="text-text-muted text-sm mt-2">
                            {authority ? t('sync.authorityThisDeviceHint') : t('sync.authorityPeerHint')}
                        </p>

                        <div className="mt-4 divide-y divide-white/5">
                            <Field label={t('sync.epochId')}>{epoch?.id || '—'}</Field>
                            <Field label={t('sync.epochStatus')}>
                                {epoch ? t(`sync.epochStates.${epoch.status}`, { defaultValue: epoch.status }) : '—'}
                            </Field>
                            <Field label={t('sync.recording')}>
                                {epoch?.recording ? t('sync.recordingOn') : t('sync.recordingOff')}
                            </Field>
                            <Field label={t('sync.lastSeq')}>{epoch?.last_seq ?? '—'}</Field>
                        </div>
                    </div>

                    {/* Connected clients */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold text-text-primary">
                                {t('sync.clientsTitle')}
                            </h3>
                            <span className="text-text-muted text-sm">
                                {t('sync.clientsCount', { count: clients.length })}
                            </span>
                        </div>

                        {clients.length === 0 ? (
                            <div className="border border-white/10 rounded-lg p-8 text-center">
                                <p className="text-text-muted">{t('sync.noClients')}</p>
                                <p className="text-text-muted text-sm mt-2">{t('sync.noClientsHint')}</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-white/10">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-background-elevated/50">
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">{t('sync.colDevice')}</th>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">{t('sync.colType')}</th>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">{t('sync.colConnectedSince')}</th>
                                            <th className="px-6 py-4 text-left text-sm font-semibold text-text-primary">{t('sync.colLastAcked')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {clients.map((c) => (
                                            <tr key={c.device_id} className="hover:bg-background-elevated/50 transition-colors">
                                                <td className="px-6 py-4 text-sm text-text-primary font-medium">
                                                    {c.device_name || c.device_id}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-text-muted">
                                                    {c.device_type || '—'}
                                                    {c.device_platform ? ` · ${c.device_platform}` : ''}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-text-muted">
                                                    {formatDateTime(c.connected_at)}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-text-muted">
                                                    {t('sync.seqValue', { seq: c.last_seq_acked })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Pending approvals */}
                    <div className="rounded-lg border border-white/10 bg-background-elevated/30 p-6 flex items-center justify-between gap-4">
                        <div>
                            <h3 className="text-lg font-semibold text-text-primary">{t('sync.pendingApprovalsTitle')}</h3>
                            <p className="text-text-muted text-sm mt-1">
                                {pendingApprovals > 0
                                    ? t('sync.pendingApprovalsCount', { count: pendingApprovals })
                                    : t('sync.pendingApprovalsNone')}
                            </p>
                        </div>
                        <button
                            onClick={reviewApprovals}
                            disabled={pendingApprovals === 0}
                            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${pendingApprovals > 0
                                ? 'btn-primary'
                                : 'bg-white/5 text-text-muted cursor-not-allowed'}`}
                        >
                            {t('sync.reviewApprovals')}
                        </button>
                    </div>

                    {/* This desktop's own client role (optional) */}
                    {client?.enabled && (
                        <div className="rounded-lg border border-white/10 bg-background-elevated/30 p-6">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-lg font-semibold text-text-primary">{t('sync.clientRoleTitle')}</h3>
                                <StatusBadge state={client.state} t={t} />
                            </div>
                            <div className="mt-4 divide-y divide-white/5">
                                <Field label={t('sync.clientPeer')}>{client.config?.peer_address || '—'}</Field>
                                <Field label={t('sync.clientDataset')}>{client.dataset_id || '—'}</Field>
                                <Field label={t('sync.clientPendingWrites')}>{client.pending_writes ?? 0}</Field>
                                {client.last_error && (
                                    <Field label={t('sync.clientLastError')}>{client.last_error}</Field>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default SyncStatusView;
