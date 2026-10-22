import { getManagementApiUrl, getApiPath, getPublicApiPath, getAuthHeaders, getJsonHeaders, handleResponse } from './baseService.js';

/* Admin endpoints for config */
export async function getConfig() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/config`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to fetch config");
    return await resp.json();
}

export async function updateConfig(config, createBackup = true) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/config`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({config: config, createBackup: createBackup}),
    });
    await handleResponse(resp, "Failed to update config");
}

/* Voice config endpoints */
export async function listVoiceConfigs() {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/voices`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to list voice configs");
    return await resp.json();
}

export async function loadVoiceConfig(name) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/voices/${encodeURIComponent(name)}`, {
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to load voice config");
    return await resp.text();
}

export async function saveVoiceConfig(name, configJson) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/voices`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({name, config: configJson})
    });
    await handleResponse(resp, "Failed to save voice config");
}

export async function updateVoiceConfig(name, configJson) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/voices/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: getJsonHeaders(),
        body: JSON.stringify({config: configJson})
    });
    await handleResponse(resp, "Failed to update voice config");
}

export async function deleteVoiceConfig(name) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/voices/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await handleResponse(resp, "Failed to delete voice config");
}

export async function renameVoiceConfig(oldName, newName) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/voices/${encodeURIComponent(oldName)}/rename`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify({newName})
    });
    await handleResponse(resp, "Failed to rename voice config");
}

/* Public endpoints for app name/version */
export async function getAppName() {
    const resp = await fetch(`${getManagementApiUrl()}${getPublicApiPath()}/appname`);
    await handleResponse(resp, "Failed to fetch app name");
    const data = await resp.json();
    return data.appName;
}

export async function getAppVersion() {
    const resp = await fetch(`${getManagementApiUrl()}${getPublicApiPath()}/appversion`);
    await handleResponse(resp, "Failed to fetch app version");
    const data = await resp.json();
    return data.appVersion;
}

/* Provider configuration endpoints */
/**
 * Coerce a module-level provider config into the account-shaped body the
 * provider probe routes expect ({type, api_key, base_url, extra}).
 *
 * The engine's POST /api/providers/verify and POST /api/providers/models take
 * account fields, not the module config object: `api_key` is lifted out,
 * `base_url` is the account base URL (soulvoice stores it under `endpoint`,
 * most others under `baseurl`), and everything else rides along in `extra`,
 * which the engine merges into the per-provider config JSON verbatim.
 *
 * @param {string} module - Module type ('tts', 'stt', 'vad', …); used by the
 *                          models route as the model-filter selector
 * @param {string} provider - Provider type ('soulvoice', 'openai', …)
 * @param {object} config - Per-provider module config object
 */
export function buildProviderProbeBody(module, provider, config) {
    const cfg = (config && typeof config === 'object') ? config : {};
    return {
        type: provider,
        api_key: cfg.apikey || cfg.apiKey || cfg.api_key || '',
        base_url: cfg.baseurl || cfg.baseUrl || cfg.base_url || cfg.endpoint || '',
        extra: cfg,
        module: module || undefined,
    };
}

/**
 * Stateless provider credential/connectivity check.
 *
 * Re-pointed onto POST /api/providers/verify (the retired POST
 * /api/validate-provider). Resolves with the engine's VerifyResult:
 *   { state, detail?, payload? }
 * where `state` is one of valid | invalid | throttled | blocked |
 * scope_limited | unreachable. A non-valid state is a legitimate 200 verdict,
 * not a thrown error — callers must map the state to a message.
 *
 * @returns {Promise<{state: string, detail?: string, payload?: object}>}
 */
export async function validateProviderConfig(module, provider, config) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/providers/verify`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(buildProviderProbeBody(module, provider, config))
    });
    await handleResponse(resp, `Failed to verify provider configuration for ${module}/${provider}`);
    return await resp.json();
}

/**
 * Live model discovery.
 *
 * Re-pointed onto POST /api/providers/models (the retired POST /api/models).
 * The engine answers { models: [ModelInfo], voices? } where ModelInfo uses
 * `label` for the display name; normalize it to `name` for the pickers.
 * A listing failure is a 200 with an empty list plus `error`.
 *
 * @returns {Promise<{models: Array, voices?: Array, error?: string}>}
 */
export async function listProviderModels(module, provider, config) {
    const resp = await fetch(`${getManagementApiUrl()}${getApiPath()}/providers/models`, {
        method: "POST",
        headers: getJsonHeaders(),
        body: JSON.stringify(buildProviderProbeBody(module, provider, config))
    });
    await handleResponse(resp, `Failed to fetch models for ${module}/${provider}`);
    const data = await resp.json();
    const models = Array.isArray(data.models)
        ? data.models.map((m) => ({ ...m, name: m.name || m.label || m.id }))
        : [];
    return { ...data, models };
}

export async function parseImaginationWorkflow(workflowJSON) {
    const resp = await fetch(
        `${getManagementApiUrl()}${getApiPath()}/module-configs/imagination/parse-workflow`,
        {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify({ workflow_json: workflowJSON }),
        }
    );
    await handleResponse(resp, 'Failed to parse imagination workflow');
    return await resp.json(); // { nodes: [ { id, title, class_type, inputs: [...] } ] }
}

/**
 * Performs a stateless test image generation against an imagination provider API.
 * No entity or running module is required. A temporary client is instantiated
 * server-side for the duration of the call.
 *
 * @param {string} provider - Provider ID ('comfyui', 'xai', 'google', 'openai', 'openrouter')
 * @param {object} config   - Provider config object
 * @param {string} profile  - Workflow profile name (ComfyUI only, ignored for others)
 * @param {string} positivePrompt - Positive image prompt
 * @param {string} negativePrompt - Negative image prompt (optional, pass "" to omit)
 * @param {number} seed     - Seed value; 0 = random seed chosen by server
 * @returns {Promise<{images: string[], seed_used: number}>}
 */
export async function testImaginationGeneration(provider, config, profile, positivePrompt, negativePrompt, seed = 0) {
    const resp = await fetch(
        `${getManagementApiUrl()}${getApiPath()}/module-configs/imagination/test-generation`,
        {
            method: 'POST',
            headers: getJsonHeaders(),
            body: JSON.stringify({
                provider,
                config,
                profile,
                positive_prompt: positivePrompt,
                negative_prompt: negativePrompt || '',
                seed: seed || 0,
            }),
        }
    );
    await handleResponse(resp, 'Imagination test generation failed');
    return await resp.json(); // { images: [...dataURLs], seed_used: number }
}
