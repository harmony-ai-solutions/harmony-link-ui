import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders } from './baseService.js';

/**
 * Cloud Service — desktop Soulbits Cloud identity (plan 7-15, task W / engine E2).
 *
 * Wraps the engine's first-party cloud account endpoints. All routes are
 * admin-keyed (the shared management client already injects the admin API key).
 *
 * Wire contract (engine management contract 1.5.0):
 *   GET  /api/cloud/account                → { signed_in, account_hint, email?,
 *                                              device_id, device_authorized,
 *                                              device_authorization_pending }
 *   POST /api/cloud/signin/start           → { url }  (portal sign-in URL; open it
 *                                                       in the system browser and
 *                                                       click "Allow" there; 400
 *                                                       when the engine has no
 *                                                       cloud client configured)
 *   POST /api/cloud/signin/signout         → { status: "ok" }
 *
 * Pending semantics: a sign-in that has started on the portal but not yet been
 * allowed reports `signed_in:false, device_authorization_pending:true`; once the
 * user clicks Allow (and the engine redeems the request) it flips to
 * `signed_in:true, device_authorized:true`. Failure/expiry falls back to
 * `signed_in:false, device_authorization_pending:false` (no error field), i.e.
 * the signed-out state.
 *
 * Errors carry a `.status` property so callers can branch on the HTTP code
 * (e.g. sign-in `400` = "cloud sign-in is not configured on this engine") without
 * re-parsing the response body.
 */

const API_BASE_URL = `${getManagementApiUrl()}${getApiPath()}`;

/**
 * Build an Error from a failed response, attaching the HTTP status and any
 * `{ error }` detail the engine returned.
 *
 * @param {Response} response
 * @param {string} fallback
 * @returns {Promise<Error>}
 */
async function readApiError(response, fallback) {
    let detail = null;
    try {
        const body = await response.json();
        detail = body?.error ?? null;
    } catch {
        // Non-JSON body — fall back to the generic message.
    }
    const err = new Error(detail || fallback);
    err.status = response.status;
    return err;
}

/**
 * Fetch the desktop's cloud account status.
 * @returns {Promise<Object>}
 */
export async function getCloudAccount() {
    const response = await fetch(`${API_BASE_URL}/cloud/account`, {
        method: 'GET',
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw await readApiError(response, 'Failed to fetch cloud account');
    return await response.json();
}

/**
 * Begin the portal-mediated sign-in flow. Returns the portal `/connect` URL the
 * caller must open via the `system/open-url` management endpoint. The user signs
 * in on the portal (email/password or Google — their choice) and clicks Allow;
 * the engine redeems the request and the status polls flip to signed-in.
 * @returns {Promise<{url: string}>}
 */
export async function startCloudSignin() {
    const response = await fetch(`${API_BASE_URL}/cloud/signin/start`, {
        method: 'POST',
        headers: getJsonHeaders(),
    });
    if (!response.ok) throw await readApiError(response, 'Failed to start cloud sign-in');
    return await response.json();
}

/**
 * Sign the desktop out of Soulbits Cloud.
 * @returns {Promise<{status: string}>}
 */
export async function signOutCloud() {
    const response = await fetch(`${API_BASE_URL}/cloud/signin/signout`, {
        method: 'POST',
        headers: getJsonHeaders(),
    });
    if (!response.ok) throw await readApiError(response, 'Failed to sign out of cloud');
    return await response.json();
}
