/**
 * outreachNotificationService.js — desktop outreach notification stream.
 *
 * Plan 7-12 §4 (desktop D3): the Wails frontend subscribes to the engine's
 * outreach notification WebSocket (`GET /api/notifications/stream`) and, when an
 * outreach/greeting event arrives while the window is unfocused, raises a native
 * OS notification. When the window is focused it does nothing extra — the
 * existing in-app UI already renders live outreach.
 *
 * Endpoint & auth: the engine registers `/api/notifications/stream` outside
 * header-based auth (WebSocket clients cannot set custom headers) and accepts
 * the desktop admin key as the `apiKey` query param — the same convention the
 * log stream uses (management/routes_logs_ws.go, mirrored here from
 * src/services/management/logService.js#getLogStreamUrl). Base URL / path / key
 * come from the existing engine API client (baseService.js).
 *
 * Wire shape (one JSON object per message):
 *   { type: "outreach"|"greeting", entity_id, entity_name, message_id, title,
 *     body_preview, created_at, eligibility, delivery? }
 * `{ type: "ping", timestamp }` keepalives arrive every 30s and are ignored.
 * `delivery:"live"` marks events delivered into an active session; observer /
 * offline events omit it. The notify decision is the same either way (dedupe by
 * `message_id` prevents any double-notification), so this service notifies on
 * any eligible outreach/greeting event while unfocused — a superset of the
 * doc's `delivery:"live"` phrasing that also covers topology-E desktop engines
 * with no active session.
 */

import { getManagementApiUrl, getApiPath, getApiKey } from '../management/baseService.js';
import { LogDebug, LogInfo, LogWarning } from '../../utils/logger.js';
import { isWindowFocused } from '../../utils/windowFocus.js';
import { isOsNotificationSupported, sendOsNotification } from '../../utils/osNotifications.js';

/** Fallback title when the engine does not pre-render one (defensive). */
const FALLBACK_TITLE = 'Soulbits';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
/** Short-window seen-set so a replayed event never stacks a second banner. */
const DEDUPE_TTL_MS = 5 * 60 * 1000;
const DEDUPE_MAX_ENTRIES = 256;

/**
 * Build the WebSocket URL for the outreach notification stream. The apiKey
 * rides a query param because browsers cannot set WS headers (identical to
 * getLogStreamUrl).
 *
 * @returns {string}
 */
export function getNotificationsStreamUrl() {
    const url = new URL(getManagementApiUrl());
    const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProtocol}//${url.host}${getApiPath()}/notifications/stream?apiKey=${encodeURIComponent(getApiKey())}`;
}

class OutreachNotificationService {
    constructor() {
        this.ws = null;
        /** Subscriber ref-count — keeps the socket alive while ≥1 hook is mounted. */
        this.subscribers = 0;
        /** True when intentionally stopped (gates connect + reconnect). */
        this.stopped = true;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        /** message_id -> seen timestamp (short-window dedupe). */
        this.seen = new Map();
        this.listeners = [];
    }

    /**
     * Start the stream (idempotent, ref-counted). Safe under React StrictMode's
     * mount/unmount/mount double-invocation.
     */
    start() {
        this.subscribers += 1;
        if (!this.stopped) return; // already running
        this.stopped = false;
        this.reconnectAttempts = 0;
        if (!isOsNotificationSupported()) {
            LogDebug('[outreach-notifications] Wails notification runtime unavailable — OS banners disabled (stream still subscribed)');
        }
        this._connect();
    }

    /**
     * Stop the stream once the last subscriber unmounts. Idempotent.
     */
    stop() {
        this.subscribers = Math.max(0, this.subscribers - 1);
        if (this.subscribers > 0) return;
        this.stopped = true;
        this._teardown();
    }

    addListener(callback) {
        if (typeof callback === 'function') this.listeners.push(callback);
    }

    removeListener(callback) {
        this.listeners = this.listeners.filter((l) => l !== callback);
    }

    // ── internals ──────────────────────────────────────────────────────────

    _connect() {
        if (this.stopped) return;
        if (typeof WebSocket === 'undefined') {
            LogWarning('[outreach-notifications] WebSocket unavailable in this environment');
            return;
        }

        let ws;
        try {
            ws = new WebSocket(getNotificationsStreamUrl());
        } catch (err) {
            LogWarning('[outreach-notifications] WebSocket construction failed', err);
            this._scheduleReconnect();
            return;
        }
        this.ws = ws;

        ws.onopen = () => {
            this.reconnectAttempts = 0;
            LogInfo('[outreach-notifications] stream connected');
            this._notifyListeners('open');
        };

        ws.onmessage = (event) => this._handleMessage(event);

        ws.onerror = () => {
            // Browsers do not expose the error detail; onclose drives the retry.
            LogDebug('[outreach-notifications] stream error');
        };

        ws.onclose = () => {
            if (this.ws === ws) this.ws = null;
            this._notifyListeners('close');
            if (!this.stopped) this._scheduleReconnect();
        };
    }

    _handleMessage(event) {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch {
            return; // non-JSON frame — ignore
        }
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'ping') return; // 30s keepalive
        if (msg.type !== 'outreach' && msg.type !== 'greeting') return;

        // Defensive: the engine gates (mute/decay) are authoritative. Never
        // notify on a non-eligible verdict even if one reaches us.
        if (msg.eligibility && msg.eligibility !== 'eligible') return;

        const messageId = msg.message_id != null ? String(msg.message_id) : '';
        if (messageId) {
            if (this.seen.has(messageId)) return; // replay — drop
            this._remember(messageId);
        }

        this._notifyListeners('event', msg);

        // Focused → the in-app UI already renders live outreach; do nothing.
        if (isWindowFocused()) return;

        const title = (msg.title && String(msg.title)) || (msg.entity_name && String(msg.entity_name)) || FALLBACK_TITLE;
        const body = msg.body_preview != null ? String(msg.body_preview) : '';

        sendOsNotification({
            // message_id doubles as the notification id so the OS also collapses
            // duplicates; a timestamped fallback covers the (should-not-happen)
            // event without an id.
            id: messageId || `outreach-${msg.entity_id || 'entity'}-${Date.now()}`,
            title,
            body,
        }).then((sent) => {
            if (sent) LogDebug(`[outreach-notifications] OS notification raised for entity '${msg.entity_id}' (${msg.type})`);
        });
    }

    _remember(messageId) {
        this.seen.set(messageId, Date.now());
        if (this.seen.size > DEDUPE_MAX_ENTRIES) this._pruneSeen();
    }

    _pruneSeen() {
        const now = Date.now();
        for (const [id, ts] of this.seen) {
            if (now - ts > DEDUPE_TTL_MS) this.seen.delete(id);
        }
        // Map preserves insertion order — drop the oldest entries if still over.
        if (this.seen.size > DEDUPE_MAX_ENTRIES) {
            const excess = this.seen.size - DEDUPE_MAX_ENTRIES;
            let i = 0;
            for (const id of this.seen.keys()) {
                if (i++ >= excess) break;
                this.seen.delete(id);
            }
        }
    }

    _scheduleReconnect() {
        if (this.stopped || this.reconnectTimer) return;
        const attempt = this.reconnectAttempts++;
        const base = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
        const delay = Math.round(base * (0.8 + Math.random() * 0.4)); // ±20% jitter
        LogDebug(`[outreach-notifications] reconnecting in ${delay}ms (attempt ${attempt + 1})`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this._connect();
        }, delay);
    }

    _teardown() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectAttempts = 0;
        const ws = this.ws;
        this.ws = null;
        if (ws) {
            try {
                // Detach handlers first so the close does not trigger a retry.
                ws.onopen = null;
                ws.onmessage = null;
                ws.onerror = null;
                ws.onclose = null;
                ws.close();
            } catch {
                /* already closed — ignore */
            }
        }
        this._notifyListeners('close');
    }

    _notifyListeners(type, payload) {
        this.listeners.forEach((listener) => {
            try {
                listener({ type, payload });
            } catch {
                /* isolate listener errors from the stream */
            }
        });
    }
}

/** Process-wide singleton (mirrors deviceApprovalWatcher). */
export const outreachNotificationService = new OutreachNotificationService();

export default outreachNotificationService;
