import { db, auth } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

// In-memory deduplication cache to prevent error storms from spamming the database
const recentErrors = new Map();
const COOLDOWN_MS = 10000; // 10 seconds per unique error key

/**
 * Strips or safely stringifies error message
 * @param {any} error
 * @returns {string}
 */
function cleanErrorMessage(error) {
  if (error instanceof Error) {
    return error.message || "Unknown Error";
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Centralized error reporting utility.
 * Logs error telemetry with context tags and triggers safe console diagnostics.
 * Persists error records to the Firestore 'errorLogs' collection with deduplication.
 *
 * @param {Error|unknown} error
 * @param {string} [context="app"]
 */
export async function reportError(error, context = "app") {
  const timestamp = new Date().toISOString();
  const message = cleanErrorMessage(error);
  const stack = error instanceof Error ? error.stack || null : null;

  // 1. Immediate local console output
  console.error(`[${timestamp}] [${context.toUpperCase()}]`, message, stack || error);

  // 2. In-memory deduplication
  const errorKey = `${context}:${message}`;
  const lastLogged = recentErrors.get(errorKey);
  const now = Date.now();
  if (lastLogged && now - lastLogged < COOLDOWN_MS) {
    return;
  }
  recentErrors.set(errorKey, now);

  // Prune map if it grows large
  if (recentErrors.size > 100) {
    for (const [k, time] of recentErrors.entries()) {
      if (now - time > COOLDOWN_MS) recentErrors.delete(k);
    }
  }

  // 3. Persist to Firestore errorLogs collection (fail-safe)
  try {
    const currentUser = auth?.currentUser;
    const url = typeof window !== "undefined" ? window.location?.href || "" : "";
    const userAgent = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";

    const logEntry = {
      message: message.slice(0, 1000),
      stack: stack ? stack.slice(0, 4000) : null,
      context: String(context).slice(0, 100),
      url: url.slice(0, 500),
      userAgent: userAgent.slice(0, 300),
      userId: currentUser?.uid || null,
      userEmail: currentUser?.email || null,
      timestamp,
      createdAt: serverTimestamp(),
    };

    if (db) {
      await addDoc(collection(db, "errorLogs"), logEntry);
    }
  } catch (persistErr) {
    // Fail-safe: NEVER throw or recursively report from inside reportError
    console.warn(
      "[REPORT_ERROR_PERSIST_FAILED]",
      persistErr instanceof Error ? persistErr.message : persistErr
    );
  }
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
