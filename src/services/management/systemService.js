import { getManagementApiUrl, getApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

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
  const response = await fetch(`${getManagementApiUrl()}${getApiPath()}/system/list-directories`, {
    method: 'POST',
    headers: getJsonHeaders(),
    body: JSON.stringify({
      path,
      recursive,
      maxDepth,
    }),
  });

  await handleResponse(response, 'Failed to list directories');
  return await response.json();
};

/**
 * Get the current working directory path
 * @returns {Promise<Object>} Response containing the working directory path
 */
export const getWorkingDirectory = async () => {
  const response = await fetch(`${getManagementApiUrl()}${getApiPath()}/system/working-directory`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  await handleResponse(response, 'Failed to get working directory');
  return await response.json();
};

/**
 * Get the user's home directory path
 * @returns {Promise<Object>} Response containing the home directory path
 */
export const getHomeDirectory = async () => {
  const response = await fetch(`${getManagementApiUrl()}${getApiPath()}/system/home-directory`, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  await handleResponse(response, 'Failed to get home directory');
  return await response.json();
};

export async function openSystemUrl(url) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/system/open-url`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({url})
    });
    await handleResponse(resp, `Failed to open URL in system browser: ${url}`);
    return await resp.json();
}
