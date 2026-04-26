/**
 * Integration Matcher Utility
 *
 * Matches module config URLs to specific integration instances by port number.
 * The backend enriches port data from .env files, so port matching works for
 * all instance states (running, stopped, configured, never-started, host-networked).
 */

// Provider -> URL field name mapping
export const PROVIDER_URL_FIELDS = {
    openaicompatible: 'baseurl',
    harmonyspeech: 'endpoint',
    comfyui: 'baseurl',
    ollama: 'baseurl'
};

// Module slot labels for display
export const MODULE_SLOT_LABELS = {
    backend: 'AI Backend / LLM',
    tts: 'Text-to-Speech',
    stt: 'Speech-to-Text',
    rag: 'RAG',
    movement: 'Movement',
    cognition: 'Cognition',
    imagination: 'Imagination',
    vision: 'Vision'
};

/**
 * Normalize a hostname to localhost for comparison.
 * Handles: localhost, 127.0.0.1, 0.0.0.0, [::1]
 */
function normalizeHost(host) {
    if (!host) return null;
    const lower = host.toLowerCase();
    if (lower === 'localhost' || lower === '127.0.0.1' || lower === '0.0.0.0' || lower === '[::1]') {
        return 'localhost';
    }
    return host;
}

/**
 * Extract host and port from a URL string.
 * @param {string} urlString - URL like "http://localhost:8080/v1"
 * @returns {{ host: string, port: number } | null}
 */
export function extractHostPort(urlString) {
    if (!urlString || typeof urlString !== 'string') {
        return null;
    }

    let urlStr = urlString.trim();
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
        urlStr = 'http://' + urlStr;
    }

    try {
        const url = new URL(urlStr);
        const host = normalizeHost(url.hostname);
        const port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);

        if (!host || isNaN(port) || port <= 0) {
            return null;
        }
        return { host, port };
    } catch (e) {
        const match = urlStr.match(/^(?:http:\/\/|https:\/\/)?([^:\/]+)(?::(\d+))?(?:\/|$)/);
        if (match) {
            const host = normalizeHost(match[1]);
            const port = match[2] ? parseInt(match[2], 10) : 80;
            if (host && port > 0) {
                return { host, port };
            }
        }
        return null;
    }
}

/**
 * Get all ports exposed by an integration instance.
 * Reads from container ports — the backend populates these from Docker API
 * and falls back to .env HOST_PORT values for non-running instances.
 * @param {Object} instance - Integration instance object
 * @returns {Set<number>} - Set of port numbers
 */
export function getInstancePorts(instance) {
    const ports = new Set();
    if (!instance || !instance.containers) return ports;

    for (const container of instance.containers) {
        if (container.ports) {
            for (const port of container.ports) {
                if (port.publicPort) {
                    ports.add(port.publicPort);
                }
            }
        }
    }
    return ports;
}

/**
 * Find integration instances that match a config's URL by port number.
 *
 * @param {string} configUrl - The URL from the module config (e.g., "http://localhost:8080/v1")
 * @param {Array} allInstances - Array of instance objects from useAllIntegrationInstances hook
 * @returns {Array} - Array of matching instances with metadata
 */
export function findMatchingInstances(configUrl, allInstances) {
    if (!configUrl || !allInstances || !Array.isArray(allInstances)) {
        return [];
    }

    const urlInfo = extractHostPort(configUrl);
    if (!urlInfo || !urlInfo.port) {
        return [];
    }

    const matches = [];

    for (const item of allInstances) {
        const { integrationName, instanceName, instance } = item;
        if (!instance) continue;

        const instancePorts = getInstancePorts(instance);

        if (instancePorts.has(urlInfo.port)) {
            const isRunning = instance.status === 'running';
            matches.push({
                integrationName,
                instanceName,
                instance,
                isRunning
            });
        }
    }

    return matches;
}

/**
 * Get the URL field value from a config based on provider and module type.
 *
 * The API returns configs with nested provider sub-objects:
 *   { provider: "openaicompatible", openaicompatible: { baseurl: "..." } }
 *
 * @param {Object} config - Module config object from the API
 * @param {string} moduleType - Module type (backend, tts, stt, rag, etc.)
 * @returns {string | null} - The URL value or null if not applicable
 */
export function getConfigUrl(config, moduleType) {
    if (!config) return null;

    // Handle STT special case: dual providers (transcription and vad)
    if (moduleType === 'stt') {
        const transProvider = config.transcription?.provider;
        if (transProvider && PROVIDER_URL_FIELDS[transProvider]) {
            const urlField = PROVIDER_URL_FIELDS[transProvider];
            const providerConfig = config.transcription[transProvider];
            if (providerConfig && providerConfig[urlField]) {
                return providerConfig[urlField];
            }
        }
        const vadProvider = config.vad?.provider;
        if (vadProvider && PROVIDER_URL_FIELDS[vadProvider]) {
            const urlField = PROVIDER_URL_FIELDS[vadProvider];
            const providerConfig = config.vad[vadProvider];
            if (providerConfig && providerConfig[urlField]) {
                return providerConfig[urlField];
            }
        }
        return null;
    }

    // Regular case: single provider
    const provider = config.provider;
    if (!provider) return null;

    const urlField = PROVIDER_URL_FIELDS[provider];
    if (!urlField) return null; // Not a local provider

    const providerConfig = config[provider];
    if (!providerConfig) return null;

    return providerConfig[urlField] || null;
}

/**
 * Check if a provider uses a local URL field (can point at local integrations).
 */
export function isLocalProvider(provider) {
    return provider && provider in PROVIDER_URL_FIELDS;
}

/**
 * Filter instances to only inactive (non-running) ones.
 * Includes partially_running as inactive since they need attention.
 */
export function getInactiveMatches(matches) {
    if (!matches || !Array.isArray(matches)) return [];
    return matches.filter(m => !m.isRunning);
}
