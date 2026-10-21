import { useCallback, useEffect, useRef, useState } from 'react';
import {
    getCloudAccount,
    startCloudSignin,
    signOutCloud,
} from '../services/management/cloudService.js';
import { openSystemUrl } from '../services/management/systemService.js';
import { LogError } from '../utils/logger.js';

/**
 * useCloudAccount — desktop Soulbits Cloud identity state (plan 7-15, task W).
 *
 * Shared by the Settings account card and the Pair modal so both surfaces agree
 * on sign-in / device-authorization state.
 *
 * Sign-in is portal-mediated (engine E2b): the engine hands back a portal
 * `/connect` URL, the user signs in THERE (email/password or Google) and clicks
 * Allow. While that is in flight the engine reports
 * `signed_in:false, device_authorization_pending:true`; once redeemed it flips to
 * `signed_in:true, device_authorized:true`. Polling `GET /api/cloud/account` on a
 * light interval while mounted is what picks up that flip without a manual
 * refresh. Exposes imperative helpers for the sign-in / sign-out actions.
 *
 * `expired` reports a server-observed session loss: a previously signed-in
 * snapshot flipping to `signed_in:false` on its own (e.g. the cloud PASETO
 * expired) rather than because this hook signed the user out. Callers render a
 * "sign in again" affordance for it; the normal sign-in flow supersedes the dead
 * session, so no sign-out step is needed. A successful sign-in (or a
 * user-initiated sign-out) clears the flag.
 *
 * @param {Object} [options]
 * @param {boolean} [options.poll=true] - Disable polling when false.
 * @param {number} [options.pollInterval=4000] - Poll period (ms).
 */
export default function useCloudAccount({ poll: enablePoll = true, pollInterval = 4000 } = {}) {
    const [account, setAccount] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expired, setExpired] = useState(false);
    const inFlightRef = useRef(false);
    // Last snapshot we observed, used to detect a signed-in → signed-out flip.
    const prevAccountRef = useRef(null);
    // Set while this hook's own signOut is driving the transition, so the
    // resulting signed_in:false is NOT mistaken for an expired session.
    const selfSignOutRef = useRef(false);

    const refresh = useCallback(async () => {
        if (inFlightRef.current) return null;
        inFlightRef.current = true;
        try {
            const next = await getCloudAccount();
            if (next && typeof next === 'object') {
                const prev = prevAccountRef.current;
                if (prev?.signed_in === true && next.signed_in !== true && !selfSignOutRef.current) {
                    // The engine dropped the session without us asking to sign out.
                    setExpired(true);
                }
                if (next.signed_in === true) {
                    // Signing back in (or a fresh valid session) clears the state.
                    setExpired(false);
                }
                prevAccountRef.current = next;
            }
            setAccount(next);
            setError(null);
            return next;
        } catch (err) {
            LogError('Failed to load cloud account', err);
            setError(err);
            return null;
        } finally {
            inFlightRef.current = false;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        if (!enablePoll) return undefined;
        const id = setInterval(() => { refresh(); }, pollInterval);
        return () => clearInterval(id);
    }, [enablePoll, pollInterval, refresh]);

    /**
     * Start the portal-mediated sign-in flow and open the portal URL in the
     * system browser, where the user signs in and clicks Allow. Throws (with
     * `.status === 400` when the engine has no cloud client configured) so the
     * caller can render the right copy.
     */
    const signIn = useCallback(async () => {
        const { url } = await startCloudSignin();
        await openSystemUrl(url);
        // The engine redeems the request once the user allows it on the portal;
        // refresh shortly so the UI picks up the pending → ready flip quickly.
        setTimeout(() => { refresh(); }, 1500);
        return url;
    }, [refresh]);

    const signOut = useCallback(async () => {
        selfSignOutRef.current = true;
        try {
            await signOutCloud();
            await refresh();
        } finally {
            // A user-initiated sign-out is never an expired session.
            selfSignOutRef.current = false;
            setExpired(false);
        }
    }, [refresh]);

    return {
        account,
        loading,
        error,
        expired,
        refresh,
        signIn,
        signOut,
    };
}
