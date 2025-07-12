const runtime = window.runtime ?? {};

const fallbackMap = {
    LogPrint: "log",
    LogTrace: "trace",
    LogDebug: "debug",
    LogInfo: "info",
    LogWarning: "warn",
    LogError: "error",
    LogFatal: "error",
};

function wrap(fallback) {
    return (msg) => {
        if (typeof runtime[fallback] === "function") {
            return runtime[fallback](msg);
        }
        const consoleMethod = fallbackMap[fallback] || "log";
        if (typeof console[consoleMethod] === "function") {
            return console[consoleMethod](msg);
        }
        // fallback to console.log if method not found
        return console.log(msg);
    };
}

export const LogPrint   = wrap("LogPrint");
export const LogTrace   = wrap("LogTrace");
export const LogDebug   = wrap("LogDebug");
export const LogInfo    = wrap("LogInfo");
export const LogWarning = wrap("LogWarning");
export const LogError   = wrap("LogError");
export const LogFatal   = wrap("LogFatal");
