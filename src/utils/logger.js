const fallbackMap = {
    LogPrint: "log",
    LogTrace: "trace",
    LogDebug: "debug",
    LogInfo: "info",
    LogWarning: "warn",
    LogError: "error",
    LogFatal: "error",
};

function wrap(methodName) {
    return (...args) => {
        // Try runtime first, but never let it block console output
        try {
            const rt = (typeof window !== "undefined" && window.runtime) ? window.runtime : undefined;
            const rtFn = rt && typeof rt[methodName] === "function" ? rt[methodName] : null;
            if (rtFn) {
                try {
                    rtFn(...args);
                } catch { /* ignore, still console.log below */
                }
            }
        } catch { /* ignore, still console.log below */
        }

        // Always log to console as well
        const consoleMethod = fallbackMap[methodName] || "log";
        const fn = (console && typeof console[consoleMethod] === "function")
            ? console[consoleMethod].bind(console)
            : console.log.bind(console);
        fn(...args);
    };
}

export const LogPrint = wrap("LogPrint");
export const LogTrace = wrap("LogTrace");
export const LogDebug = wrap("LogDebug");
export const LogInfo = wrap("LogInfo");
export const LogWarning = wrap("LogWarning");
export const LogError = wrap("LogError");
export const LogFatal = wrap("LogFatal");
