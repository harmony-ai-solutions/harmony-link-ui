// Base service configuration and utilities
const mgmtApiURL = import.meta.env.VITE_MGMT_API_URL || "http://localhost";
const mgmtApiPort = import.meta.env.VITE_MGMT_API_PORT || "28081";
const mgmtApiPath = import.meta.env.VITE_MGMT_API_PATH || "/api";
const mgmtPublicApiPath = import.meta.env.VITE_MGMT_PUBLIC_API_PATH || "/public";
const mgmtApiKey = import.meta.env.VITE_MGMT_API_KEY || "admin";

/**
 * Get the management API base URL
 * @returns {string} The management API base URL
 */
export function getManagementApiUrl() {
    return `${mgmtApiURL}:${mgmtApiPort}`;
}

/**
 * Get the management API key
 * @returns {string} The API key for authentication
 */
export function getApiKey() {
    return mgmtApiKey;
}

/**
 * Get the management API path
 * @returns {string} The API path
 */
export function getApiPath() {
    return mgmtApiPath;
}

/**
 * Get the public API path
 * @returns {string} The public API path
 */
export function getPublicApiPath() {
    return mgmtPublicApiPath;
}

/**
 * Create standard headers for authenticated requests
 * @returns {Object} Headers object with API key
 */
export function getAuthHeaders() {
    return {
        "X-Admin-API-Key": mgmtApiKey
    };
}

/**
 * Create standard headers for authenticated JSON requests
 * @returns {Object} Headers object with API key and content type
 */
export function getJsonHeaders() {
    return {
        "Content-Type": "application/json",
        "X-Admin-API-Key": mgmtApiKey
    };
}

/**
 * Handle fetch response errors
 * Attempts to extract detailed error information from the response body
 * before falling back to the provided generic message.
 *
 * @param {Response} response - The fetch response
 * @param {string} errorMessage - Fallback error message when body cannot be parsed
 * @throws {Error} Throws error if response is not ok, with backend detail attached
 */
export async function handleResponse(response, errorMessage) {
    if (!response.ok) {
        let detail = null;
        try {
            const body = await response.json();
            if (body.error) {
                detail = body.error;
            }
            // Preserve structured metadata from DockerError responses
            if (body.isDockerError) {
                const err = new Error(detail || errorMessage);
                err.isDockerError = true;
                err.dockerAvailable = body.dockerAvailable;
                throw err;
            }
        } catch (parseErr) {
            // If we already built a structured error above, re-throw it
            if (parseErr.isDockerError || (parseErr instanceof Error && parseErr.message !== errorMessage && detail === null)) {
                throw parseErr;
            }
            // Otherwise body wasn't JSON — fall through to generic message
        }

        // Use the extracted detail when available, otherwise the generic message
        throw new Error(detail || errorMessage);
    }
    return response;
}
