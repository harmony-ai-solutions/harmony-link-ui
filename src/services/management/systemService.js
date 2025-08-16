import { getApiKey, getManagementApiUrl } from './baseService.js';

/**
 * Directory Service API wrapper for directory browsing functionality
 */

/**
 * List directories at the specified path
 * @param {string} path - Directory path to list
 * @param {boolean} recursive - Whether to list recursively
 * @param {number} maxDepth - Maximum depth for recursive listing
 * @returns {Promise<Object>} Directory tree response
 */
export const listDirectories = async (path = '', recursive = false, maxDepth = 3) => {
  const response = await fetch(`${getManagementApiUrl()}/api/system/list-directories`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-API-Key': getApiKey(),
    },
    body: JSON.stringify({
      path,
      recursive,
      maxDepth,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  return await response.json();
};

export async function openSystemUrl(url) {
    const resp = await fetch(`${mgmtApiURL}:${mgmtApiPort}${mgmtApiPath}/system/open-url`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Admin-API-Key": getApiKey
        },
        body: JSON.stringify({url})
    });
    if (!resp.ok) throw new Error(`Failed to open URL in system browser: ${url}`);
    return await resp.json();
}
