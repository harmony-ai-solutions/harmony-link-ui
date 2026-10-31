import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { createVoiceRecorder } from '../../services/audio/recorder.js';
import { describeMicError } from '../../services/audio/recorderUtils.js';
import { buildMicIssue } from '../../services/audio/micDiagnosticsUtils.js';
import { listSttTestConfigs, testSttTranscription } from '../../services/management/sttTestService.js';
import MicIssuePanel from '../chat/MicIssuePanel.jsx';
import {
  AUDIO_FILE_ACCEPT,
  STT_TEST_RECORD_MS,
  audioClipLabel,
  formatElapsed,
  resolvedConfigRows,
  sttTestAudioPayload,
  sttTestControls,
  sttTestError,
  sttTestOutcome,
  validateAudioFile,
} from '../../services/audio/sttTestUtils.js';

/**
 * STT test panel (Task 04-5).
 *
 * Lives in Settings → Voice Input. The whole point is diagnosis: a user with a
 * broken speech-to-text setup should be able to see WHICH config was used and
 * WHY it failed, without reading a log file.
 *
 * Three decisions carry the design:
 *
 * 1. **The engine reports the resolved config, the panel only renders it.**
 *    Re-deriving "provider + model + language" from the module list here would
 *    describe a *different* config than the one that ran the moment anything
 *    changed in between — and a diagnostic that lies about what it tested is
 *    worse than none. See `handleTestSTT`.
 *
 * 2. **Failures are shown verbatim.** The provider's own sentence ("401 invalid
 *    api key for model whisper-1") is the single most useful debugging aid
 *    there is. Only the *fallback* is translated, and it appears under the raw
 *    text rather than replacing it.
 *
 * 3. **"Heard nothing" is not "failed".** A 200 with empty text means the
 *    provider answered — a microphone or format problem. Rendering it red would
 *    send the user to re-enter a key that works.
 *
 * No config selector is required: with nothing selected the engine falls back
 * to the canonical `user` entity's mapping, i.e. the config a real voice note
 * would use. The dropdown exists to test a config BEFORE mapping it.
 */
const SttTestPanel = () => {
  const { t } = useTranslation();

  const [configs, setConfigs] = useState([]);
  const [configId, setConfigId] = useState('');
  /** @type {[{audioBase64: string, mimeType: string, durationMs: number, fileName?: string, source: string}|null, Function]} */
  const [clip, setClip] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [error, setError] = useState(null);
  const [fileError, setFileError] = useState('');
  const [micIssue, setMicIssue] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef(null);
  const stopTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  /** Config list is advisory — a failure must not disable the panel. */
  useEffect(() => {
    let cancelled = false;
    listSttTestConfigs().then((rows) => {
      if (!cancelled) setConfigs(rows);
    });
    return () => { cancelled = true; };
  }, []);

  /** Always dispose the recorder and the auto-stop timer on unmount. */
  useEffect(() => () => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    recorderRef.current?.dispose();
    recorderRef.current = null;
  }, []);

  const clearResult = useCallback(() => {
    setOutcome(null);
    setError(null);
  }, []);

  /**
   * Record exactly {@link STT_TEST_RECORD_MS} and stop.
   *
   * A fixed-length take rather than a manual one: the panel is a diagnostic, and
   * "hold the button and talk" introduces a second variable (how long did the
   * user hold it?) into a test whose result is meant to be comparable.
   */
  const startRecording = useCallback(async () => {
    if (isRecording || isTranscribing) return;
    clearResult();
    setFileError('');
    setMicIssue(null);
    setElapsedMs(0);

    const recorder = createVoiceRecorder({
      onTick: ({ elapsedMs: next }) => setElapsedMs(next),
    });
    recorderRef.current = recorder;

    try {
      const { take } = await recorder.start({});
      setIsRecording(true);
      // Auto-stop. Kept in a ref so a manual Stop / unmount can cancel it —
      // otherwise a stale timer would fire `stop()` on a disposed recorder.
      stopTimerRef.current = setTimeout(() => {
        stopTimerRef.current = null;
        recorder.stop().catch(() => {});
      }, STT_TEST_RECORD_MS);

      const result = await take;
      if (result && !result.cancelled && result.audioBase64) {
        setClip({
          audioBase64: result.audioBase64,
          mimeType: result.mimeType,
          durationMs: Math.round((result.durationSeconds || 0) * 1000),
          source: 'recording',
        });
      }
    } catch (startError) {
      // Same taxonomy as the composer (04-2): the panel must not be the one
      // place that reports a blocked microphone as "something went wrong".
      setMicIssue(buildMicIssue({ ok: false, reason: describeMicError(startError) }));
    } finally {
      if (stopTimerRef.current) {
        clearTimeout(stopTimerRef.current);
        stopTimerRef.current = null;
      }
      recorder.dispose();
      recorderRef.current = null;
      setIsRecording(false);
      setElapsedMs(0);
    }
  }, [clearResult, isRecording, isTranscribing]);

  /** Stop the auto-stop timer, then let the take resolve normally. */
  const stopRecording = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    recorderRef.current?.stop().catch(() => {});
  }, []);

  /** Upload a file as the test clip. */
  const handleFile = useCallback(async (event) => {
    const file = event?.target?.files?.[0];
    // Reset the input so choosing the SAME file twice still fires onChange.
    if (event?.target) event.target.value = '';
    if (!file) return;

    setFileError('');
    clearResult();

    const verdict = validateAudioFile(file, t);
    if (!verdict.ok) {
      setFileError(verdict.message);
      return;
    }

    try {
      const audioBase64 = await readFileAsBase64(file);
      if (!audioBase64) {
        setFileError(t('chat:sttTest.fileErrors.unreadable'));
        return;
      }
      setClip({
        audioBase64,
        mimeType: file.type || '',
        durationMs: 0,
        fileName: file.name,
        source: 'file',
      });
    } catch {
      setFileError(t('chat:sttTest.fileErrors.unreadable'));
    }
  }, [clearResult, t]);

  /** Send the clip to the engine and render whatever comes back. */
  const handleTranscribe = useCallback(async () => {
    const payload = sttTestAudioPayload(clip);
    if (!payload || isTranscribing) return;

    clearResult();
    setIsTranscribing(true);
    try {
      const response = await testSttTranscription({
        audioBase64: payload.audio_base64,
        mimeType: payload.mime_type,
        // Empty = let the engine use the mapped config; see the service.
        configId: configId || undefined,
      });
      setOutcome(sttTestOutcome(response));
    } catch (transcribeError) {
      // `sttTestError` keeps the provider's sentence intact and only
      // translates the fallback shown beneath it.
      setError(sttTestError(transcribeError, t));
    } finally {
      setIsTranscribing(false);
    }
  }, [clearResult, clip, configId, isTranscribing, t]);

  const controls = useMemo(
    () => sttTestControls({ hasAudio: Boolean(clip?.audioBase64), isRecording, isTranscribing }),
    [clip, isRecording, isTranscribing],
  );

  const configRows = useMemo(
    () => (outcome?.config ? resolvedConfigRows(outcome.config, t) : []),
    [outcome, t],
  );

  const recordLabel = isRecording
    ? t('chat:sttTest.stop', { seconds: Math.max(1, Math.ceil((STT_TEST_RECORD_MS - elapsedMs) / 1000)) })
    : t('chat:sttTest.record', { seconds: STT_TEST_RECORD_MS / 1000 });

  return (
    <section className="stt-test">
      <h3 className="stt-test-title">{t('chat:sttTest.title')}</h3>
      <p className="stt-test-note">{t('chat:sttTest.description')}</p>

      <div className="stt-test-controls">
        <button
          type="button"
          className={`btn-primary stt-test-record${isRecording ? ' is-recording' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!controls.canRecord}
        >
          {recordLabel}
        </button>

        <button
          type="button"
          className="btn-secondary stt-test-upload"
          onClick={() => fileInputRef.current?.click()}
          disabled={!controls.canUpload}
        >
          {t('chat:sttTest.upload')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={AUDIO_FILE_ACCEPT}
          className="hidden"
          onChange={handleFile}
          aria-label={t('chat:sttTest.upload')}
        />

        <label className="stt-test-config">
          <span>{t('chat:sttTest.configLabel')}</span>
          <select
            className="input-field"
            value={configId}
            onChange={(event) => setConfigId(event.target.value)}
            disabled={isRecording || isTranscribing}
          >
            {/* The default is the point: it tests what chat would use. */}
            <option value="">{t('chat:sttTest.configAuto')}</option>
            {configs.map((cfg) => (
              <option key={cfg.id} value={cfg.id}>
                {cfg.provider ? `${cfg.name} (${cfg.provider})` : cfg.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn-primary stt-test-transcribe"
          onClick={handleTranscribe}
          disabled={!controls.canTranscribe}
        >
          {isTranscribing ? t('chat:sttTest.transcribing') : t('chat:sttTest.transcribe')}
        </button>
      </div>

      {clip && (
        <p className="stt-test-clip">
          {audioClipLabel(
            {
              source: clip.source,
              durationMs: clip.durationMs,
              fileName: clip.fileName,
            },
            t,
          )}
          {clip.mimeType ? <span className="stt-test-clip-type"> · {clip.mimeType}</span> : null}
        </p>
      )}

      {controls.transcribeHintKey && (
        <p className="stt-test-hint">{t(`chat:${controls.transcribeHintKey}`)}</p>
      )}

      {fileError && <p className="stt-test-file-error">{fileError}</p>}

      {micIssue && <MicIssuePanel issue={micIssue} />}

      {/* Failure: the provider's message leads, the translated summary follows. */}
      {error && (
        <div className="stt-test-result is-error">
          <p className="stt-test-result-head">{t('chat:sttTest.failedTitle')}</p>
          {/* Verbatim, deliberately untranslated and unquoted — this is the text
              the user will search for or paste into a bug report. */}
          <pre className="stt-test-provider-message">{error.verbatim || error.fallback}</pre>
          {error.verbatim && <p className="stt-test-result-foot">{error.fallback}</p>}
        </div>
      )}

      {outcome?.tone === 'empty' && (
        <div className="stt-test-result is-empty">
          <p className="stt-test-result-head">{t('chat:sttTest.emptyTitle')}</p>
          <p className="stt-test-result-body">{t('chat:sttTest.emptyBody')}</p>
          {outcome.ms !== null && (
            <p className="stt-test-timing">{formatElapsed(outcome.ms)}</p>
          )}
        </div>
      )}

      {outcome?.tone === 'success' && (
        <div className="stt-test-result is-success">
          <p className="stt-test-result-head">{t('chat:sttTest.successTitle')}</p>
          <p className="stt-test-transcript">{outcome.text}</p>
          <div className="stt-test-meta">
            <span>
              {t('chat:sttTest.language')}:{' '}
              <strong>{outcome.language || t('chat:sttTest.languageAuto')}</strong>
            </span>
            <span>
              {t('chat:sttTest.elapsed')}: <strong>{formatElapsed(outcome.ms)}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Step 4: the resolved config, above the result's detail and always
          visible once the engine has answered — including on failure, where it
          is the most useful thing on the screen. */}
      {configRows.length > 0 && (
        <div className="stt-test-resolved">
          <p className="stt-test-resolved-head">{t('chat:sttTest.resolvedTitle')}</p>
          <dl className="stt-test-resolved-grid">
            {configRows.map((row) => (
              <div key={row.key} className="stt-test-resolved-row">
                <dt>{row.label}</dt>
                <dd className={row.missing ? 'is-missing' : ''}>{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="stt-test-resolved-hint">{t('chat:sttTest.resolvedHint')}</p>
        </div>
      )}
    </section>
  );
};

/**
 * Read a file as base64 (no `data:` prefix).
 *
 * Kept local rather than imported from `recorder.js` because that helper is
 * private to the driver and reads a Blob; this one takes a File, and a File IS
 * a Blob, so duplicating four lines is cheaper than widening the recorder's
 * surface for a settings panel.
 */
function readFileAsBase64(file) {
  if (typeof FileReader === 'undefined') return Promise.resolve('');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(new Error('read-failed'));
    reader.readAsDataURL(file);
  });
}

export default SttTestPanel;
