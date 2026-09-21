/**
 * Asynchronously copies text to the system clipboard.
 * Uses navigator.clipboard.writeText with a fallback to document.execCommand("copy")
 * for non-secure contexts or in-app webviews.
 *
 * @param {string} text - The text to copy
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function copyText(text) {
  if (typeof text !== "string" && !text) {
    return { ok: false, error: "No text provided" };
  }

  // Modern Async Clipboard API
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch (err) {
      console.warn("navigator.clipboard.writeText failed, trying fallback:", err);
    }
  }

  // Fallback for older browsers, in-app webviews, or non-secure contexts
  try {
    if (typeof document !== "undefined" && document.createElement && document.body) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "-9999px";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (successful) {
        return { ok: true };
      }
    }
    return { ok: false, error: "Clipboard write was blocked or unsupported" };
  } catch (fallbackErr) {
    return { ok: false, error: fallbackErr?.message || "Clipboard write failed" };
  }
}
