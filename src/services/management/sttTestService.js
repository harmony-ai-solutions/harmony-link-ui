import { getManagementApiUrl, getApiPath, getJsonHeaders, handleResponse } from './baseService.js';

/**
 * STT test endpoint (Task 04-5).
 *
 * `POST /api/module-configs/stt/test` — the transcription twin of
 * `test-speech`. Stateless: it resolves an STT config (saved module, or the
 * canonical user entity's mapping when none is named), builds a temporary
 * client, runs ONE transcription, and reports what it resolved and what
 * happened. Nothing is written, so a broken setup can be tested repeatedly
 * without touching chat history.
 *
 * `handler` is injectable for tests, in the same spirit as the recorder's
 * `env` option — the payload shape is worth pinning without a server.
 *
 * @param {{ audioBase64: string, mimeType?: string, configId?: string }} request
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<object>} the engine body: `{status, text, language, ms, config, audio}`
 */
export async function testSttTranscription(request, options = {}) {
  const { audioBase64, mimeType, configId } = request || {};
  if (!audioBase64) {
    throw new Error('audioBase64 is required');
  }

  const body = {
    audio_base64: audioBase64,
    mime_type: mimeType || 'application/octet-stream',
  };
  // Absent config_id = "the config chat would use". Sending an empty string
  // instead would be indistinguishable from an id, and the engine's precedence
  // keys off emptiness — an explicit `""` would be a subtle lie.
  if (configId) body.config_id = configId;

  const fetchImpl = options.fetchImpl || fetch;
  const resp = await fetchImpl(
    `${getManagementApiUrl()}${getApiPath()}/module-configs/stt/test`,
    {
      method: 'POST',
      headers: getJsonHeaders(),
      body: JSON.stringify(body),
    },
  );
  // The provider's message lives in `error` on a failure, and handleResponse
  // surfaces it verbatim — which is exactly what the panel must show.
  await handleResponse(resp, 'Transcription test failed');
  return await resp.json();
}

/**
 * The STT module configurations available to test.
 *
 * Deliberately tolerant: a panel that cannot list configs must still be able to
 * test the MAPPED one, so a listing failure yields an empty list rather than
 * taking the whole section down.
 *
 * @param {{ fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<Array<{id: string, name: string, provider: string}>>}
 */
export async function listSttTestConfigs(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  try {
    const resp = await fetchImpl(
      `${getManagementApiUrl()}${getApiPath()}/module-configs/stt`,
      { headers: getJsonHeaders() },
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    const rows = Array.isArray(data) ? data : [];
    return rows
      .filter((row) => row && typeof row === 'object')
      .map((row) => ({
        id: String(row.id || ''),
        name: String(row.name || row.id || ''),
        provider: String(row.transcription?.provider || ''),
      }))
      .filter((row) => row.id);
  } catch {
    return [];
  }
}
