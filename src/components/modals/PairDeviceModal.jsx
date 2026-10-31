import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-qr-code';
import { createLanPairing, createCloudPairing, getSyncGroupKeyStatus } from '../../services/management/syncService.js';
import useCloudAccount from '../../hooks/useCloudAccount.js';
import { LogPrint } from '../../utils/logger.js';

/**
 * PairDeviceModal — "Pair a device" (plan 7-15, task W §2).
 *
 * One modal, a segmented [Local network | Soulbits Cloud] control, one large QR
 * at a time, a countdown ring for the payload TTL, a regenerate button and the
 * engine/security badge beneath. Visual language follows DeviceApprovalModal +
 * the app's dark glass theme.
 *
 * LAN (engine E1): POST /api/sync/pairing/lan mints a FRESH single-use secret
 * each call — displaying the QR is the consent gesture — so we fetch on tab-open
 * and on every regenerate. QR content is the payload JSON.
 *
 * Cloud (engine E2): POST /api/sync/pairing/cloud returns the v3 cloud QR
 * payload (`{v, kind, relay_url, pairing_token, account_hint, dataset_id}`). It
 * requires `device_authorized` AND an initialized sync group (contract 1.9.0):
 * a QR minted before the group exists can never be joined, so the tab shows
 * "Turn on cloud sync first" and mints automatically once the key appears.
 */

const DEFAULT_TTL = 300;

function CountdownRing({ remaining, total }) {
    const R = 26;
    const C = 2 * Math.PI * R;
    const ratio = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
    const offset = C * (1 - ratio);
    const expired = remaining <= 0;
    const warn = !expired && remaining <= 30;
    const stroke = expired ? 'var(--color-text-muted)' : warn ? 'var(--color-warning, #e0a030)' : 'var(--color-accent-primary)';

    return (
        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
            <circle cx="36" cy="36" r={R} fill="none" stroke="var(--color-border-glass)" strokeWidth="5" />
            <circle
                cx="36"
                cy="36"
                r={R}
                fill="none"
                stroke={stroke}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={offset}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
            />
        </svg>
    );
}

function SecurityBadge({ payload, isCloud, t }) {
    if (isCloud) {
        return (
            <span className="px-2.5 py-1 rounded text-xs font-semibold bg-accent-primary/15 text-accent-primary border border-accent-primary/30">
                {t('pairing.badge.cloudRelay')}
            </span>
        );
    }
    const mode = payload?.mode;
    const hasFingerprint = Boolean(payload?.fingerprint);
    if (mode === 'secure' && hasFingerprint) {
        return (
            <span className="px-2.5 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400 border border-green-500/30 inline-flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                {t('pairing.badge.verified')}
            </span>
        );
    }
    if (mode === 'secure') {
        return (
            <span className="px-2.5 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400">
                {t('pairing.badge.secure')}
            </span>
        );
    }
    if (mode === 'insecure-ssl') {
        return (
            <span className="px-2.5 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-400">
                {t('pairing.badge.insecureSsl')}
            </span>
        );
    }
    // unencrypted (first-class in 7-15 — neutral, no nudge)
    return (
        <span className="px-2.5 py-1 rounded text-xs font-semibold bg-white/10 text-text-muted">
            {t('pairing.badge.unencrypted')}
        </span>
    );
}

export const PairDeviceModal = ({ show, onClose }) => {
    const { t } = useTranslation();
    const { account, signIn } = useCloudAccount({ poll: show });

    const [tab, setTab] = useState('lan');
    const [payload, setPayload] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [remaining, setRemaining] = useState(0);
    const [expired, setExpired] = useState(false);
    // Cloud sync (contract 1.9.0): the account's sync group must exist before a
    // QR can be minted. `hasGroupKey` gates the mint; the tab polls the key
    // status so the QR appears as soon as cloud sync is turned on elsewhere.
    const [hasGroupKey, setHasGroupKey] = useState(false);

    const totalRef = useRef(DEFAULT_TTL);
    const deadlineRef = useRef(0);

    const signedIn = account?.signed_in === true;
    const authorized = account?.device_authorized === true;
    const pending = account?.device_authorization_pending === true;
    const cloudReady = signedIn && authorized;

    const refreshGroupKey = useCallback(async () => {
        try {
            const ks = await getSyncGroupKeyStatus();
            setHasGroupKey(ks?.has_key === true);
            return ks?.has_key === true;
        } catch (err) {
            LogPrint('Sync group key status failed: ' + err.message);
            return false;
        }
    }, []);

    const fetchPayload = useCallback(async (kind) => {
        setLoading(true);
        setError(null);
        try {
            const next = kind === 'cloud' ? await createCloudPairing() : await createLanPairing();
            const ttl = Number(next?.ttl) > 0 ? Number(next.ttl) : DEFAULT_TTL;
            totalRef.current = ttl;
            deadlineRef.current = Date.now() + ttl * 1000;
            setRemaining(ttl);
            setExpired(false);
            setPayload(next);
        } catch (err) {
            LogPrint(`Pairing payload (${kind}) failed: ` + err.message);
            setPayload(null);
            if (kind === 'cloud' && err?.status === 409) {
                // The group disappeared (or was never on): show the guidance
                // state instead of a red error the user cannot act on.
                setHasGroupKey(false);
                setError(null);
            } else {
                setError(err);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    // On open: reset to LAN and mint a fresh LAN code.
    useEffect(() => {
        if (!show) return;
        setTab('lan');
        setExpired(false);
        setHasGroupKey(false);
        fetchPayload('lan');
    }, [show, fetchPayload]);

    // Countdown tick for the active payload's TTL.
    useEffect(() => {
        if (!show || !payload) return undefined;
        const tick = () => {
            const rem = Math.max(0, Math.round((deadlineRef.current - Date.now()) / 1000));
            setRemaining(rem);
            if (rem <= 0) setExpired(true);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [show, payload]);

    // Cloud tab: watch the sync-group key. Cloud pairing is impossible until
    // the desktop owns a group, so poll while the tab is open and no key exists
    // (the user may turn cloud sync on in the Sync view in another window).
    useEffect(() => {
        if (!show || tab !== 'cloud' || !cloudReady || hasGroupKey) return undefined;
        let cancelled = false;
        const check = () => {
            if (!cancelled) refreshGroupKey();
        };
        check();
        const id = setInterval(check, 3000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [show, tab, cloudReady, hasGroupKey, refreshGroupKey]);

    // Auto-mint the cloud QR once the device becomes authorized AND the group key
    // exists while the cloud tab is open (the portal Allow click flips the
    // engine's status; turning cloud sync on flips the key).
    useEffect(() => {
        if (!show || tab !== 'cloud') return;
        if (cloudReady && hasGroupKey && !payload && !loading && !error) {
            fetchPayload('cloud');
        }
    }, [show, tab, cloudReady, hasGroupKey, payload, loading, error, fetchPayload]);

    const handleSelectTab = (next) => {
        if (next === tab) return;
        setTab(next);
        setError(null);
        if (next === 'lan') {
            fetchPayload('lan');
        } else if (next === 'cloud' && cloudReady && hasGroupKey) {
            fetchPayload('cloud');
        } else {
            setPayload(null);
        }
    };

    const regenerate = () => {
        if (tab === 'lan') fetchPayload('lan');
        else if (cloudReady && hasGroupKey) fetchPayload('cloud');
    };

    if (!show) return null;

    const isCloud = tab === 'cloud';
    const qrValue = payload ? JSON.stringify(payload) : '';
    const showQr = payload && !loading && (isCloud ? cloudReady && hasGroupKey : true);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="modal-content max-w-lg w-full rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[92vh] flex flex-col">
                <div className="px-8 pt-6 pb-4 flex items-start justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-text-primary tracking-tight">
                            {t('pairing.title')}
                        </h2>
                        <p className="text-text-muted text-sm mt-1">{t('pairing.subtitle')}</p>
                    </div>
                    <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1 -mr-1">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Segmented control */}
                <div className="px-8">
                    <div className="flex bg-background-elevated/50 rounded-lg p-1 gap-1">
                        <button
                            type="button"
                            onClick={() => handleSelectTab('lan')}
                            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                                tab === 'lan'
                                    ? 'bg-accent-primary/25 text-accent-primary shadow-sm ring-1 ring-accent-primary/30'
                                    : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                            }`}
                        >
                            {t('pairing.tabs.lan')}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleSelectTab('cloud')}
                            className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                                isCloud
                                    ? 'bg-accent-primary/25 text-accent-primary shadow-sm ring-1 ring-accent-primary/30'
                                    : 'text-text-muted hover:text-text-primary hover:bg-white/5'
                            }`}
                        >
                            {t('pairing.tabs.cloud')}
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-8 py-6">
                    {/* LAN tab */}
                    {tab === 'lan' && (
                        <div className="space-y-5">
                            {loading && !payload && (
                                <div className="flex items-center justify-center h-64">
                                    <p className="text-text-muted">{t('pairing.generating')}</p>
                                </div>
                            )}
                            {error && !loading && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                    <p className="text-red-400 text-sm">{t('pairing.lanFailed')}</p>
                                </div>
                            )}
                            {showQr && (
                                <>
                                    <QrPanel
                                        t={t}
                                        value={qrValue}
                                        remaining={remaining}
                                        total={totalRef.current}
                                        expired={expired}
                                        onRegenerate={regenerate}
                                        loading={loading}
                                    />
                                    <div className="flex flex-col items-center gap-2 text-center">
                                        <p className="text-text-primary font-semibold">{payload?.name || '—'}</p>
                                        <SecurityBadge payload={payload} isCloud={false} t={t} />
                                        <p className="text-text-muted text-xs">{t('pairing.scanHint')}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Cloud tab */}
                    {tab === 'cloud' && (
                        <div className="space-y-5">
                            {!signedIn && pending && (
                                <div className="space-y-4 py-2">
                                    <div className="bg-accent-primary/10 border border-accent-primary/30 rounded-lg p-4 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <span className="block w-4 h-4 rounded-full border-2 border-accent-primary border-t-transparent animate-spin flex-shrink-0" />
                                            <p className="text-sm text-text-primary font-medium">{t('pairing.deviceWaitTitle')}</p>
                                        </div>
                                        <p className="text-xs text-text-secondary">{t('pairing.deviceWaitBody')}</p>
                                    </div>
                                </div>
                            )}

                            {!signedIn && !pending && (
                                <div className="text-center space-y-3 py-8">
                                    <p className="text-text-primary font-medium">{t('pairing.cloudSignInRequiredTitle')}</p>
                                    <p className="text-text-muted text-sm">{t('pairing.cloudSignInHint')}</p>
                                    <button
                                        onClick={() => { signIn().catch((err) => LogPrint('Cloud sign-in failed: ' + err.message)); }}
                                        className="btn-primary py-2.5 px-5 text-sm"
                                    >
                                        {t('pairing.cloudSignInButton')}
                                    </button>
                                </div>
                            )}

                            {/* Contract 1.9.0: no sync group ⇒ no joinable QR.
                                Point at the Sync view instead of a dead code. */}
                            {cloudReady && !hasGroupKey && (
                                <div className="text-center space-y-3 py-8">
                                    <p className="text-text-primary font-medium">{t('pairing.cloudGroupRequiredTitle')}</p>
                                    <p className="text-text-muted text-sm">{t('pairing.cloudGroupRequiredHint')}</p>
                                </div>
                            )}

                            {cloudReady && hasGroupKey && (
                                <>
                                    {loading && !payload && (
                                        <div className="flex items-center justify-center h-64">
                                            <p className="text-text-muted">{t('pairing.generating')}</p>
                                        </div>
                                    )}
                                    {error && !loading && (
                                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                            <p className="text-red-400 text-sm">{t('pairing.cloudFailed')}</p>
                                        </div>
                                    )}
                                    {showQr && (
                                        <>
                                            <QrPanel
                                                t={t}
                                                value={qrValue}
                                                remaining={remaining}
                                                total={totalRef.current}
                                                expired={expired}
                                                onRegenerate={regenerate}
                                                loading={loading}
                                            />
                                            <div className="flex flex-col items-center gap-2 text-center">
                                                <SecurityBadge payload={payload} isCloud t={t} />
                                                {payload?.account_hint && (
                                                    <p className="text-text-muted text-xs">{payload.account_hint}</p>
                                                )}
                                                <p className="text-text-muted text-xs">{t('pairing.scanHint')}</p>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-8 py-4 flex justify-end">
                    <button onClick={onClose} className="btn-secondary py-2.5 px-5 text-sm">
                        {t('common:buttons.close')}
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * QrPanel — the QR image with the TTL countdown ring, expiry overlay and the
 * regenerate control. Shared by both tabs.
 */
function QrPanel({ t, value, remaining, total, expired, onRegenerate, loading }) {
    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative">
                <div
                    className={`bg-white rounded-xl p-4 transition-all duration-300 ${
                        expired ? 'opacity-30 grayscale' : 'opacity-100'
                    }`}
                >
                    <QRCode value={value} size={200} bgColor="#ffffff" fgColor="#0b0b0f" />
                </div>
                {expired && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-black/40">
                        <p className="text-text-primary text-sm font-semibold">{t('pairing.expired')}</p>
                        <button onClick={onRegenerate} disabled={loading} className="btn-primary py-2 px-4 text-sm disabled:opacity-50">
                            {t('pairing.regenerate')}
                        </button>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex items-center justify-center w-[72px] h-[72px]">
                    <CountdownRing remaining={remaining} total={total} />
                    <span className="absolute text-sm font-bold text-text-primary">
                        {expired ? '0' : remaining}
                    </span>
                </div>
                <button onClick={onRegenerate} disabled={loading} className="btn-secondary py-2.5 px-4 text-sm disabled:opacity-50">
                    {t('pairing.regenerate')}
                </button>
            </div>
        </div>
    );
}

export default PairDeviceModal;
