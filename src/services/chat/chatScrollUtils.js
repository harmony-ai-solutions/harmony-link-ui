/**
 * Chat timeline scroll-stickiness (desktop parity with the phone app).
 *
 * The phone's ChatDetailScreen keeps an `isNearBottom` ref updated on every
 * scroll and only auto-scrolls for new messages while it is true. The desktop
 * timeline used to scroll unconditionally, which yanked a reader who had
 * scrolled back through history down to the newest message (and did it again
 * on every reconnect/tail refresh).
 *
 * The threshold is deliberately a shared constant: the scroll handler and the
 * auto-scroll effect must agree on what "at the bottom" means, or the reader
 * sits in a dead band where neither path fires.
 */

/** Distance from the bottom (px) that still counts as "following the tail". */
export const NEAR_BOTTOM_THRESHOLD_PX = 150;

/**
 * Pixels between the viewport's bottom edge and the content's bottom edge.
 *
 * Clamped at 0 so an over-scrolled container (elastic scrolling, or content
 * shorter than the viewport) reads as 0 rather than a negative distance.
 * Non-finite input (a ref before layout, a detached node) reports Infinity:
 * "unknown geometry" must never be mistaken for "at the bottom".
 *
 * @param {{ scrollHeight?: number, scrollTop?: number, clientHeight?: number }} metrics
 * @returns {number}
 */
export function distanceFromBottom({ scrollHeight, scrollTop, clientHeight } = {}) {
    const height = Number(scrollHeight);
    const top = Number(scrollTop);
    const client = Number(clientHeight);
    if (!Number.isFinite(height) || !Number.isFinite(top) || !Number.isFinite(client)) {
        return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, height - top - client);
}

/**
 * True while the reader is within {@link NEAR_BOTTOM_THRESHOLD_PX} of the tail.
 *
 * @param {{ scrollHeight?: number, scrollTop?: number, clientHeight?: number }} metrics
 * @param {number} [threshold]
 * @returns {boolean}
 */
export function isNearBottom(metrics, threshold = NEAR_BOTTOM_THRESHOLD_PX) {
    const limit = Number.isFinite(threshold) ? threshold : NEAR_BOTTOM_THRESHOLD_PX;
    return distanceFromBottom(metrics) < limit;
}
