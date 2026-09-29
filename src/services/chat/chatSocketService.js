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
 * backoff is 2s, 5s, 10s, 20s, 30s (then 30s thereafter).
 *
 * Design note: for the local desktop client the engine owns all storage, so a
 * single connection per partner entity is enough (the phone app needs one
 * connection per participant only because it keeps a local DB copy). Sending a
 * message as the persona is done by setting entity_id on the utterance.
 */

const DEFAULT_WS_URL = 'ws://localhost';
const DEFAULT_WS_PORT = '28080';

/** Reconnect backoff ladder (ms), matching the phone app. */
export const RECONNECT_DELAYS = [2000, 5000, 10000, 20000, 30000];

const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 10000;

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
 * Manages one WebSocket connection to the engine for a single chat partner.
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
        /** The last INIT_ENTITY payload, replayed verbatim on reconnect. */
        this.initParams = null;
        /** Interaction id resolved from the INIT_ENTITY response. */
        this.interactionId = null;
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
            this.ws = ws;

            ws.onopen = () => {
                this.connected = true;
                this.reconnectAttempts = 0;
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

            ws.onmessage = (event) => this.handleMessage(event);

            ws.onerror = (error) => {
                this.emit('error', error);
                if (!settled) {
                    settled = true;
                    reject(error);
                }
            };

            ws.onclose = () => {
                this.connected = false;
                this.stopHeartbeat();
                this.emit('disconnected');
                if (!this.manuallyClosed) {
                    this.scheduleReconnect();
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
            this.ws.send(JSON.stringify({
                event_id: generateEventId(),
                event_type: eventType,
                status,
                payload,
            }));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Send a text message as the given entity (the persona / "own" entity).
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
     * @param {'instant'|'realistic'} mode
     */
    setReplyMode(mode) {
        if (this.initParams) this.initParams.reply_mode = mode;
        return this.sendEvent('SET_REPLY_MODE', { reply_mode: mode });
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            this.sendEvent('CONNECTION_PING', {});
            this.heartbeatTimeoutTimer = setTimeout(() => {
                this.emit('error', { message: 'Connection heartbeat timeout', code: 'HEARTBEAT_TIMEOUT' });
                this.scheduleReconnect();
            }, HEARTBEAT_TIMEOUT_MS);
        }, HEARTBEAT_INTERVAL_MS);
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
        if (this.manuallyClosed || this.reconnectTimer) return;
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
