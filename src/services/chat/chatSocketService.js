/**
 * Desktop Chat — WebSocket client (Phase 2-1).
 *
 * Rewrites the phone app's session/connection design (EntitySessionService +
 * ConnectionManager + BaseWebSocketConnection) in plain JavaScript for the
 * desktop UI. It talks to the engine's inline event server over `ws://localhost`
 * and drives the live chat:
 *
 *   - connect()      → opens the socket and sends INIT_ENTITY (device_type "web")
 *   - sendText()     → sends an ENTITY_UTTERANCE (text)
 *   - sendAudio()    → sends an ENTITY_UTTERANCE (audio) / STT_INPUT_AUDIO
 *   - sendEdit()     → sends an ENTITY_UTTERANCE_EDIT
 *   - setReplyMode() → sends SET_REPLY_MODE (instant / realistic)
 *
 * Incoming events (AI_UTTERANCE / ENTITY_UTTERANCE / TYPING_INDICATOR /
 * RECORDING_INDICATOR / STT_OUTPUT_TEXT / CONNECTION_PONG) are re-emitted to
 * registered listeners; the chat store is the single consumer.
 *
 * Keep-alive mirrors the phone app: CONNECTION_PING every 30s, and a dead
 * connection is declared when no CONNECTION_PONG arrives within 10s. Reconnect
 * backoff is 2s, 5s, 10s, 20s, 30s (then 30s thereafter) — but attempts that
 * never OPENED are capped at MAX_HANDSHAKE_FAILURES before the service gives
 * up terminally (app parity: no endless retry loop against a dead engine).
 * Each participant session owns its own ladder and heartbeat: this class is
 * deliberately ONE session, and the store creates one instance per participant.
 *
 * ── ONE SESSION PER PARTICIPANT (the N+1 model) ─────────────────────────
 *
 * Every Entity — including a user-type persona — perceives an interaction
 * subjectively and owns its own copy of it, from its own perspective. Copies
 * may be identical (chat) or differ greatly (game environments); perception
 * and memory are never mixed between entities. The engine therefore authors a
 * POV copy per participant, and it can only do that for a session that is
 * actually OPEN:
 *
 *   - a cognition-bearing partner session authors the partner-POV copy while
 *     it answers (modules/cognition.go);
 *   - a persona session has no cognition, so the engine's Session Utterance
 *     Recorder (eventserver/session_utterance_recorder.go) authors the
 *     persona-POV copy when the utterance is delivered to that session.
 *
 * The persona session is NOT optional: with only a partner session open the
 * persona-POV copy is never written, so messages vanish from the
 * persona-pivoted timeline on the next read. `chatStore.connectSocket` opens
 * persona + partner (N+1, phone D-18/D-21), keyed per chat so two
 * conversations never share a persona socket.
 *
 * A session never receives its OWN utterance back: that no-echo invariant is
 * what makes the client's optimistic append the only copy of a sent message
 * until the next REST read (see chatStore's send path).
 */

const DEFAULT_WS_URL = 'ws://localhost';
const DEFAULT_WS_PORT = '28080';

/** Reconnect backoff ladder (ms), matching the phone app. */
export const RECONNECT_DELAYS = [2000, 5000, 10000, 20000, 30000];

const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 10_000;

/**
 * Give up auto-reconnecting after this many consecutive attempts that never
 * OPENED (handshake failures — engine stopped, or it refused this page's
 * origin). App parity: the phone app treats a failed session as terminal
 * (`sessionFailed` + a Retry card) and never loops; an endless ladder
 * against a refusing engine only filled the error modal with one
 * indistinguishable row per attempt (owner incident 2026-10-31).
 * A successful open resets the count; a user-triggered Retry (connect())
 * starts a fresh ladder.
 */
export const MAX_HANDSHAKE_FAILURES = 5;

/**
 * Browser WS errors carry no reason (no status, no body), so a handshake
 * failure gets this canonical text instead of a useless raw Event.
 */
const WS_OPEN_FAILED_MESSAGE = 'WebSocket connection failed — the engine is unreachable, or it refused this page\'s origin';

/** Resolve the engine's inline WS URL from env (falls back to localhost). */
export function resolveWebSocketUrl() {
    const url = import.meta?.env?.VITE_HL_WS_URL || DEFAULT_WS_URL;
    const port = import.meta?.env?.VITE_HL_WS_PORT || DEFAULT_WS_PORT;
    return `${url}:${port}`;
}

/** Generate a unique event id (mirrors the phone app's event_id format). */
export function generateEventId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** Device id for this desktop install, persisted so sessions are stable. */
export function getDeviceId() {
    const KEY = 'hl.chat.deviceId';
    try {
        let id = localStorage.getItem(KEY);
        if (!id) {
            id = generateEventId();
            localStorage.setItem(KEY, id);
        }
        return id;
    } catch {
        return 'web-desktop';
    }
}

/**
 * Manages ONE engine session (WebSocket) for ONE participant of a chat.
 *
 * The chat store instantiates this class once per participant — persona and
 * partner alike — and keys those instances by chat. A message enters the
 * conversation through the participant sessions of that chat; this class
 * itself has no notion of "the other side", it only speaks for its own entity.
 */
export class ChatSocketService {
    /**
     * @param {{ url?: string, WebSocketImpl?: typeof WebSocket }} [options]
     */
    constructor({ url, WebSocketImpl } = {}) {
        this.url = url || resolveWebSocketUrl();
        this.WebSocketImpl = WebSocketImpl || (typeof WebSocket !== 'undefined' ? WebSocket : null);
        this.ws = null;
        this.connected = false;
        this.listeners = new Set();
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.heartbeatTimeoutTimer = null;
        this.manuallyClosed = false;
        /** Consecutive openSocket attempts that never opened (see MAX_HANDSHAKE_FAILURES). */
        this.handshakeFailures = 0;
        /** Latched once the ladder gives up; cleared by an explicit connect() (Retry). */
        this.gaveUp = false;
        /** The last INIT_ENTITY payload, replayed verbatim on reconnect. */
        this.initParams = null;
        /** Interaction id resolved from the INIT_ENTITY response. */
        this.interactionId = null;
        /** Engine-advertised capabilities of this session (INIT_ENTITY SUCCESS). */
        this.capabilities = [];
    }

    /** Register an event listener. Returns an unsubscribe function. */
    onEvent(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    emit(type, payload) {
        for (const listener of this.listeners) {
            try {
                listener(type, payload);
            } catch {
                /* a misbehaving listener must never break the socket loop */
            }
        }
    }

    /**
     * Register a raw-frame observer for the Developer wire inspector (D7).
     * Unlike {@link onEvent} it receives EVERY frame verbatim, including the
     * heartbeat PONGs the normal event path swallows. Returns an unsubscribe.
     */
    onFrame(listener) {
        if (!this.frameListeners) this.frameListeners = new Set();
        this.frameListeners.add(listener);
        return () => this.frameListeners.delete(listener);
    }

    /** Notify raw-frame observers (never throws into the socket loop). */
    emitFrame(direction, frame) {
        if (!this.frameListeners) return;
        for (const listener of this.frameListeners) {
            try {
                listener(direction, frame);
            } catch {
                /* ignore observer errors */
            }
        }
    }

    /**
     * Open the connection and send INIT_ENTITY.
     *
     * @param {{ entityId: string, participantIds: string[], replyMode?: string,
     *   ttsOutputType?: string, deviceId?: string }} params
     * @returns {Promise<void>} resolves once the socket is open
     */
    async connect(params) {
        this.initParams = {
            entity_id: params.entityId,
            participant_ids: params.participantIds,
            device_type: 'web',
            device_id: params.deviceId || getDeviceId(),
            capabilities: ['chat'],
            tts_output_type: params.ttsOutputType || 'binary',
            reply_mode: params.replyMode || 'realistic',
        };
        this.manuallyClosed = false;
        // A user-triggered (re)connect starts a fresh ladder — the previous
        // conversation's failures must not count against this attempt.
        this.handshakeFailures = 0;
        this.gaveUp = false;
        await this.openSocket();
    }

    openSocket() {
        if (!this.WebSocketImpl) {
            return Promise.reject(new Error('WebSocket is not available in this environment'));
        }
        return new Promise((resolve, reject) => {
            let settled = false;
            let ws;
            try {
                ws = new this.WebSocketImpl(this.url);
            } catch (err) {
                reject(err);
                return;
            }
            const previous = this.ws;
            this.ws = ws;
            // A socket is superseded, not layered: close the one this attempt
            // replaces so its handlers cannot stay live in the background. Its
            // `close` is ignored by the stale guard below.
            if (previous && previous !== ws) {
                try { previous.close(); } catch { /* already closing */ }
            }

            /**
             * A handler only speaks for the socket that is CURRENT.
             *
             * A reconnect opens a new socket while the old one may still be
             * closing (or may never have fired `close` — a black-holed
             * connection does not). Without this check the old socket's late
             * `close` flips the shared `connected` flag off and emits
             * `disconnected` while the new socket is happily open, which is
             * exactly the header flashing "Reconnecting…" forever. Frames from
             * a stale socket are ignored for the same reason: they would be
             * applied twice (once per leaked connection).
             */
            const isCurrent = () => this.ws === ws;

            ws.onopen = () => {
                if (!isCurrent()) {
                    // The service already moved on. Close this one quietly so a
                    // superseded attempt cannot stay open in the background.
                    try { ws.close(); } catch { /* already closing */ }
                    if (!settled) {
                        settled = true;
                        reject(new Error('Connection superseded'));
                    }
                    return;
                }
                this.connected = true;
                this.reconnectAttempts = 0;
                this.handshakeFailures = 0;
                this.emit('connected');
                // (Re)send INIT_ENTITY — the engine resumes or creates the session.
                if (this.initParams) {
                    this.sendEvent('INIT_ENTITY', this.initParams);
                }
                if (!settled) {
                    settled = true;
                    resolve();
                }
            };

            ws.onmessage = (event) => {
                if (!isCurrent()) return;
                this.handleMessage(event);
            };

            ws.onerror = () => {
                if (!isCurrent()) return;
                /**
                 * A browser WS `error` event carries NO reason — no status, no
                 * body, no message — so re-emitting the raw event produced
                 * modal rows reading literally "Connection error"/"Unknown
                 * error" (owner incident 2026-10-31). Reject with the
                 * canonical handshake text instead; the store records THAT.
                 * Post-open socket deaths are owned by `onclose` below.
                 */
                if (!settled) {
                    settled = true;
                    this.handshakeFailures += 1;
                    reject(new Error(WS_OPEN_FAILED_MESSAGE));
                }
            };

            ws.onclose = () => {
                if (!isCurrent()) return;
                this.connected = false;
                this.stopHeartbeat();
                this.ws = null;
                /**
                 * A MANUAL close is not a drop. Emitting `disconnected` here is
                 * what made the detail header say "Reconnecting…" after leaving
                 * or switching a thread: the caller had already set `idle`, and
                 * this stale event overwrote it with a retry state even though
                 * no reconnect was scheduled.
                 */
                if (!this.manuallyClosed) {
                    this.emit('disconnected');
                    this.scheduleReconnect();
                }
                // A close before `open` never resolved the connect() promise;
                // reject so the store's `connectSocket` cannot hang in
                // `connecting` forever (browsers may skip `error`).
                if (!settled) {
                    settled = true;
                    this.handshakeFailures += 1;
                    reject(new Error(WS_OPEN_FAILED_MESSAGE));
                }
            };
        });
    }

    /** Parse an inbound frame and re-emit it (PONG is heartbeat bookkeeping). */
    handleMessage(event) {
        let message;
        try {
            message = JSON.parse(event.data);
        } catch {
            return;
        }
        if (!message || typeof message !== 'object') return;

        // Raw-frame tap for the Developer wire inspector (D7) — captured before
        // the PONG early-return so heartbeats are visible too.
        this.emitFrame('in', message);

        if (message.event_type === 'CONNECTION_PONG') {
            this.clearHeartbeatTimeout();
            return;
        }

        // Start the keep-alive only after the application protocol is live.
        if (!this.heartbeatTimer) {
            this.startHeartbeat();
        }

        if (message.event_type === 'INIT_ENTITY' && message.status === 'SUCCESS') {
            const interactionId = message.payload?.interaction_id;
            if (interactionId) {
                this.interactionId = interactionId;
            }
            // The engine advertises what THIS session can do (modules that
            // initialised). The chat store uses `cognition` as the relay
            // direction signal: only a POV-authoring session's utterances are
            // mirrored onto the other local participant sessions (phone
            // ChatroomPolicy.routeIncoming).
            if (Array.isArray(message.payload?.capabilities)) {
                this.capabilities = message.payload.capabilities;
            }
        }

        this.emit('event', message);

        if (message.status === 'ERROR') {
            this.emit('error', message.payload || message);
        }
    }

    /** Send a raw HarmonyLinkEvent. Returns false when the socket is not open. */
    sendEvent(eventType, payload, status = 'NEW') {
        if (!this.ws || !this.connected) return false;
        try {
            const frame = {
                event_id: generateEventId(),
                event_type: eventType,
                status,
                payload,
            };
            this.ws.send(JSON.stringify(frame));
            // Raw-frame tap for the Developer wire inspector (D7).
            this.emitFrame('out', frame);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Send a text message on THIS participant session as the given entity (the
     * speaker — the persona for the desktop's user).
     * @param {{ entityId: string, content: string, messageId?: string,
     *   replyToMessageId?: string, additionalEffects?: object }} params
     */
    sendText({ entityId, content, messageId, replyToMessageId, additionalEffects }) {
        const utterance = {
            message_id: messageId || generateEventId(),
            entity_id: entityId,
            type: 'UTTERANCE_VERBAL',
            content,
        };
        if (replyToMessageId) utterance.reply_to_message_id = replyToMessageId;
        if (additionalEffects) utterance.additional_effects = additionalEffects;
        return this.sendEvent('ENTITY_UTTERANCE', utterance);
    }

    /**
     * Send a voice note. The audio is base64 (no data-URL prefix).
     * @param {{ entityId: string, audioBase64: string, mimeType: string,
     *   duration?: number, messageId?: string }} params
     */
    sendAudio({ entityId, audioBase64, mimeType, duration, messageId }) {
        const utterance = {
            message_id: messageId || generateEventId(),
            entity_id: entityId,
            type: 'UTTERANCE_VERBAL',
            content: '',
            audio: audioBase64,
            audio_type: mimeType,
            audio_duration: duration || 0,
        };
        return this.sendEvent('ENTITY_UTTERANCE', utterance);
    }

    /**
     * Send an image message (base64, no data-URL prefix).
     * @param {{ entityId: string, imageBase64: string, mimeType: string,
     *   caption?: string, messageId?: string }} params
     */
    sendImage({ entityId, imageBase64, mimeType, caption, messageId }) {
        const utterance = {
            message_id: messageId || generateEventId(),
            entity_id: entityId,
            type: 'UTTERANCE_COMBINED',
            content: caption || '',
            image_data: imageBase64,
            image_mime_type: mimeType,
        };
        return this.sendEvent('ENTITY_UTTERANCE', utterance);
    }

    /**
     * Request transcription of an already-sent audio message.
     * @param {{ messageId: string, audioBase64: string }} params
     */
    requestTranscription({ messageId, audioBase64 }) {
        return this.sendEvent('STT_INPUT_AUDIO', {
            message_id: messageId,
            audio: audioBase64,
        });
    }

    /**
     * Edit a previously sent message (recon edit).
     * @param {{ messageId: string, entityId: string, content: string }} params
     */
    sendEdit({ messageId, entityId, content }) {
        return this.sendEvent('ENTITY_UTTERANCE_EDIT', {
            message_id: messageId,
            entity_id: entityId,
            content,
        });
    }

    /**
     * Change the conversation's reply mode (F10).
     *
     * Updates the INIT payload FIRST so a reconnect replays the new mode
     * (phone parity: the session's `replyMode` field is load-bearing), then
     * pushes SET_REPLY_MODE on this session.
     *
     * @param {'instant'|'realistic'} mode
     */
    setReplyMode(mode) {
        this.applyReplyMode(mode);
        return this.sendEvent('SET_REPLY_MODE', { reply_mode: mode });
    }

    /**
     * Remember the reply mode for the next INIT_ENTITY replay WITHOUT sending
     * anything. The store uses this for the persona's session: the phone only
     * pushes SET_REPLY_MODE to the partner connections (the persona has no
     * reply pacing), but a reconnect must still reopen with the current mode.
     *
     * @param {'instant'|'realistic'} mode
     */
    applyReplyMode(mode) {
        if (this.initParams) this.initParams.reply_mode = mode;
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            // A reconnect is in flight: there is no socket to ping, and sending
            // on a closed one would only arm a timeout against a connection
            // that is already being replaced.
            if (!this.connected) return;
            this.sendEvent('CONNECTION_PING', {});
            this.clearHeartbeatTimeout();
            this.heartbeatTimeoutTimer = setTimeout(() => {
                this.heartbeatTimeoutTimer = null;
                this.emit('error', { message: 'Connection heartbeat timeout', code: 'HEARTBEAT_TIMEOUT' });
                this.handleHeartbeatTimeout();
            }, HEARTBEAT_TIMEOUT_MS);
        }, HEARTBEAT_INTERVAL_MS);
    }

    /**
     * The heartbeat proved the socket is dead even though the browser has not
     * told us (a half-open TCP connection).
     *
     * CLOSE the socket and let the ONE `onclose` path own the reconnect.
     * Scheduling a reconnect here while leaving the socket open used to create
     * a SECOND live socket per timeout: the leaked first socket kept its
     * handlers, its late `close` then set the shared `connected` flag false and
     * emitted `disconnected` under the new connection, which scheduled yet
     * another reconnect. That is the reconnect storm the chat header showed as
     * a permanent "Reconnecting…".
     */
    handleHeartbeatTimeout() {
        this.connected = false;
        this.stopHeartbeat();
        const ws = this.ws;
        if (ws) {
            try { ws.close(); } catch { /* already closing */ }
        }
        // `scheduleReconnect` is idempotent (it returns while a timer exists),
        // so calling it here guarantees progress even if a pathological
        // implementation never fires `onclose`.
        this.scheduleReconnect();
    }

    clearHeartbeatTimeout() {
        if (this.heartbeatTimeoutTimer) {
            clearTimeout(this.heartbeatTimeoutTimer);
            this.heartbeatTimeoutTimer = null;
        }
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        this.clearHeartbeatTimeout();
    }

    /** Schedule a reconnect using the 2s→30s backoff ladder. */
    scheduleReconnect() {
        if (this.manuallyClosed || this.reconnectTimer || this.gaveUp) return;
        /**
         * Terminal give-up (app parity): once MAX_HANDSHAKE_FAILURES
         * consecutive attempts never even opened, another lap against a
         * stopped/refusing engine adds nothing but duplicate error rows.
         * Emit one honest terminal error — the store shows Degraded + the
         * bubble — and let the user's Retry start a fresh ladder.
         */
        if (this.handshakeFailures >= MAX_HANDSHAKE_FAILURES) {
            this.reconnectAttempts = 0;
            this.gaveUp = true;
            this.emit('error', {
                message: `Gave up reconnecting after ${this.handshakeFailures} failed attempts — the engine may be stopped, or it refused this page's origin. Retry once it is back.`,
                code: 'RECONNECT_GAVE_UP',
            });
            return;
        }
        const delay = RECONNECT_DELAYS[Math.min(this.reconnectAttempts, RECONNECT_DELAYS.length - 1)];
        this.reconnectAttempts += 1;
        this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.openSocket().catch(() => this.scheduleReconnect());
        }, delay);
    }

    /** Close the connection and stop reconnecting. */
    disconnect() {
        this.manuallyClosed = true;
        this.stopHeartbeat();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            try {
                this.ws.close();
            } catch {
                /* already closing */
            }
            this.ws = null;
        }
        this.connected = false;
        this.reconnectAttempts = 0;
        this.interactionId = null;
    }
}

export default ChatSocketService;
