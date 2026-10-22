import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useCloudAccount from '../../hooks/useCloudAccount.js';
import { LogPrint } from '../../utils/logger.js';

/**
 * CloudAccountCard — Soulbits Cloud account section (plan 7-15, task W §1).
 *
 * Renders the desktop's cloud identity inside the General Settings surface,
 * following that view's section/card conventions:
 *   - signed out → "Sign in to Soulbits Cloud" (portal sign-in opened in the
 *     system browser);
 *   - portal sign-in in progress (signed_in:false, device_authorization_pending)
 *     → "Finish signing in in your browser" with a subtle progress affordance and
 *     passive polling; the engine redeems the Allow click and flips to ready;
 *   - authorized → "Ready" badge + account identity + Sign out.
 *
 * The engine may have no cloud client configured: sign-in then fails with HTTP
 * 400 and we surface dedicated copy.
 */
export const CloudAccountCard = ({ className = '' }) => {
    const { t } = useTranslation();
    const { account, loading, error, expired, refresh, signIn, signOut } = useCloudAccount();

    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState(null);
    const [notConfigured, setNotConfigured] = useState(false);

    const signedIn = account?.signed_in === true;
    const authorized = account?.device_authorized === true;
    const pending = account?.device_authorization_pending === true;

    const handleSignIn = async () => {
        setBusy(true);
        setActionError(null);
        setNotConfigured(false);
        try {
            await signIn();
        } catch (err) {
            LogPrint('Cloud sign-in failed: ' + err.message);
            if (err.status === 400) {
                setNotConfigured(true);
            } else {
                setActionError(t('cloudAccount.signInFailed', { message: err.message }));
            }
        } finally {
            setBusy(false);
        }
    };

    const handleSignOut = async () => {
        setBusy(true);
        setActionError(null);
        try {
            await signOut();
        } catch (err) {
            LogPrint('Cloud sign-out failed: ' + err.message);
            setActionError(t('cloudAccount.signOutFailed', { message: err.message }));
        } finally {
            setBusy(false);
        }
    };

    const statusPill = () => {
        if (loading && !account) {
            return (
                <span className="px-2.5 py-1 rounded text-xs font-semibold bg-white/10 text-text-muted">
                    {t('cloudAccount.status.checking')}
                </span>
            );
        }
        if (!signedIn) {
            if (pending) {
                return (
                    <span className="px-2.5 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-400">
                        {t('cloudAccount.status.pending')}
                    </span>
                );
            }
            if (expired) {
                return (
                    <span className="px-2.5 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-400">
                        {t('cloudAccount.status.expired')}
                    </span>
                );
            }
            return (
                <span className="px-2.5 py-1 rounded text-xs font-semibold bg-white/10 text-text-muted">
                    {t('cloudAccount.status.signedOut')}
                </span>
            );
        }
        if (!authorized) {
            return (
                <span className="px-2.5 py-1 rounded text-xs font-semibold bg-yellow-500/20 text-yellow-400">
                    {t('cloudAccount.status.pending')}
                </span>
            );
        }
        return (
            <span className="px-2.5 py-1 rounded text-xs font-semibold bg-green-500/20 text-green-400">
                {t('cloudAccount.status.ready')}
            </span>
        );
    };

    return (
        <section className={`animate-in fade-in slide-in-from-bottom-2 duration-500 ${className}`}>
            <h2 className="text-lg font-bold text-text-primary pb-2 mb-6 flex items-center gap-3">
                <span className="text-gradient-primary">{t('cloudAccount.title')}</span>
            </h2>

            <div className="card p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-accent-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-text-primary">{t('cloudAccount.title')}</h3>
                            <p className="text-[11px] text-text-muted max-w-md">{t('cloudAccount.description')}</p>
                        </div>
                    </div>
                    {statusPill()}
                </div>

                {notConfigured && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                        <p className="text-yellow-400 text-sm">{t('cloudAccount.notConfigured')}</p>
                    </div>
                )}

                {actionError && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <p className="text-red-400 text-sm">{actionError}</p>
                    </div>
                )}

                {error && !account && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                        <p className="text-red-400 text-sm">{t('cloudAccount.loadFailed')}</p>
                    </div>
                )}

                {/* Portal sign-in in progress */}
                {!signedIn && pending && (
                    <div className="bg-accent-primary/10 border border-accent-primary/30 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-3">
                            <span className="block w-4 h-4 rounded-full border-2 border-accent-primary border-t-transparent animate-spin flex-shrink-0" />
                            <p className="text-sm text-text-primary font-medium">{t('cloudAccount.waitingTitle')}</p>
                        </div>
                        <p className="text-xs text-text-secondary">{t('cloudAccount.waitingBody')}</p>
                        <button onClick={refresh} disabled={busy} className="btn-secondary py-2.5 px-4 text-sm disabled:opacity-50">
                            {t('cloudAccount.refresh')}
                        </button>
                    </div>
                )}

                {/* Session expired on the engine side — sign in again, no sign-out needed */}
                {!signedIn && !pending && expired && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 space-y-3">
                        <p className="text-sm text-yellow-400 font-medium">{t('cloudAccount.expiredTitle')}</p>
                        <p className="text-xs text-text-secondary">{t('cloudAccount.expiredBody')}</p>
                        <button onClick={handleSignIn} disabled={busy} className="btn-primary py-2.5 px-5 text-sm disabled:opacity-50">
                            {busy ? t('cloudAccount.signingIn') : t('cloudAccount.signInAgain')}
                        </button>
                    </div>
                )}

                {/* Signed out */}
                {!signedIn && !pending && !expired && (
                    <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button onClick={handleSignIn} disabled={busy} className="btn-primary py-2.5 px-5 text-sm disabled:opacity-50">
                            {busy ? t('cloudAccount.signingIn') : t('cloudAccount.signIn')}
                        </button>
                        <button onClick={refresh} disabled={busy} className="btn-secondary py-2.5 px-4 text-sm disabled:opacity-50">
                            {t('cloudAccount.refresh')}
                        </button>
                        <span className="text-text-muted text-xs">{t('cloudAccount.signInHint')}</span>
                    </div>
                )}

                {/* Signed in */}
                {signedIn && (
                    <div className="space-y-4 pt-2">
                        <div className="divide-y divide-white/5">
                            <div className="flex items-start justify-between gap-4 py-2">
                                <span className="text-text-muted text-sm">{t('cloudAccount.accountLabel')}</span>
                                <span className="text-text-primary text-sm font-medium text-right">
                                    {account.email || account.account_hint || '—'}
                                </span>
                            </div>
                            {account.account_hint && account.email && account.account_hint !== account.email && (
                                <div className="flex items-start justify-between gap-4 py-2">
                                    <span className="text-text-muted text-sm">{t('cloudAccount.hintLabel')}</span>
                                    <span className="text-text-primary text-sm font-medium text-right">{account.account_hint}</span>
                                </div>
                            )}
                            <div className="flex items-start justify-between gap-4 py-2">
                                <span className="text-text-muted text-sm">{t('cloudAccount.deviceLabel')}</span>
                                <span className="text-text-primary text-sm font-medium text-right">
                                    {authorized ? t('cloudAccount.deviceAuthorized') : t('cloudAccount.devicePending')}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button onClick={handleSignOut} disabled={busy} className="btn-secondary py-2.5 px-4 text-sm disabled:opacity-50">
                                {busy ? t('cloudAccount.signingOut') : t('cloudAccount.signOut')}
                            </button>
                            <button onClick={refresh} disabled={busy} className="btn-secondary py-2.5 px-4 text-sm disabled:opacity-50">
                                {t('cloudAccount.refresh')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default CloudAccountCard;
