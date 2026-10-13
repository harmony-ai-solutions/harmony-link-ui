import { useEffect } from 'react';
import { outreachNotificationService } from '../services/notifications/outreachNotificationService.js';

/**
 * useOutreachNotifications — mounts the desktop outreach-notification stream
 * (plan 7-12 §4, desktop D3).
 *
 * Subscribes to the engine's outreach WebSocket while mounted and raises an OS
 * notification for outreach/greeting events that arrive while the window is
 * unfocused. Tears the socket down cleanly on unmount. The service is
 * ref-counted, so React StrictMode's mount → unmount → mount cycle is safe.
 *
 * @param {boolean} [enabled=true] - Set false to keep the stream closed.
 */
export default function useOutreachNotifications(enabled = true) {
    useEffect(() => {
        if (!enabled) return undefined;
        outreachNotificationService.start();
        return () => outreachNotificationService.stop();
    }, [enabled]);
}
