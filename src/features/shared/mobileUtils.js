/**
 * mobileUtils.js
 * Native mobile device helpers (haptic feedback, hardware detection).
 * All functions safely degrade to no-ops on desktop or unsupported hardware.
 */

/**
 * Trigger subtle haptic vibration on supported mobile devices (Android / PWA).
 * @param {"success" | "error" | "light"} type
 */
export function triggerHaptic(type = "success") {
  try {
    if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;

    if (type === "success" || type === "light") {
      navigator.vibrate(15);
    } else if (type === "error") {
      navigator.vibrate([30, 50, 30]);
    }
  } catch {
    // Safely ignore permission or device errors
  }
}
