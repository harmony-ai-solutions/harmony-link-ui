/**
 * Wait for a DOM element matching the given selector to appear.
 * Uses MutationObserver + 200ms polling fallback.
 *
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeoutMs - Maximum time to wait in milliseconds (default: 5000)
 * @returns {Promise<Element>} The found element
 */
export function waitForElement(selector, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        // Check immediately
        const existing = document.querySelector(selector);
        if (existing) {
            resolve(existing);
            return;
        }

        let observer = null;
        let timeoutId = null;
        let pollIntervalId = null;

        const cleanup = () => {
            if (observer) observer.disconnect();
            if (timeoutId) clearTimeout(timeoutId);
            if (pollIntervalId) clearInterval(pollIntervalId);
        };

        // Timeout
        timeoutId = setTimeout(() => {
            cleanup();
            reject(new Error(`Element "${selector}" not found within ${timeoutMs}ms`));
        }, timeoutMs);

        // MutationObserver
        observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                cleanup();
                resolve(el);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Polling fallback
        pollIntervalId = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                cleanup();
                resolve(el);
            }
        }, 200);
    });
}
