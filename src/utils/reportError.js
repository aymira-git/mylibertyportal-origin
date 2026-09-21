/**
 * Centralized error reporting utility.
 * Logs error telemetry with context tags and triggers safe console diagnostics.
 * Provides a single hook to attach external APM/telemetry (e.g. Sentry/LogRocket) in the future.
 *
 * @param {Error|unknown} error
 * @param {string} [context="app"]
 */
export function reportError(error, context = "app") {
  const timestamp = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : null;

  console.error(`[${timestamp}] [${context.toUpperCase()}]`, message, stack || error);
}

/**
 * Attaches window-level unhandled rejection and runtime error listeners
 * to ensure uncaught async errors are captured and logged with context.
 */
export function initGlobalErrorListeners() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    reportError(event.error || event.message, "uncaught_window_error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    reportError(event.reason, "unhandled_promise_rejection");
  });
}
