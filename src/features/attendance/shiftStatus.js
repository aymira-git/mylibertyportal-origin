/**
 * shiftStatus.js
 *
 * Single Source of Truth for evaluating staff shift lifecycle status
 * across My Liberty English School (WITA / Asia/Makassar timezone).
 *
 * Shift statuses:
 * - "on_duty": Currently active, open, and within normal grace hours.
 * - "stale": Open, but exceeded role grace period (needs admin review).
 * - "auto_closed": System closed due to missing clock-out (needs review unless reviewed).
 * - "corrected": Manually adjusted/audited by an administrator.
 * - "completed": Normal shift with both clockIn and clockOut recorded.
 */

export const WITA_TIMEZONE = "Asia/Makassar";

export const GRACE_HOURS = {
  instructor: 3,
  default: 14,
};

export const EXPECTED_MINUTES = {
  instructor: 90,
  default: 8 * 60,
};

/**
 * Returns true if an open shift has exceeded its allowed grace period.
 */
export function isShiftStale(shift) {
  if (!shift || shift.clockOut || !shift.clockIn) return false;
  const hoursOpen = (new Date() - new Date(shift.clockIn)) / (1000 * 60 * 60);
  const grace = GRACE_HOURS[shift.role] ?? GRACE_HOURS.default;
  return hoursOpen > grace;
}

/**
 * Derives canonical operational status of a shift document.
 */
export function getShiftStatus(shift) {
  if (!shift) return "completed";

  if (shift.corrected) {
    return "corrected";
  }

  if (shift.autoClosed) {
    return "auto_closed";
  }

  if (!shift.clockOut) {
    return isShiftStale(shift) ? "stale" : "on_duty";
  }

  return "completed";
}

/**
 * Detects staff members with more than one open shift concurrently.
 * Returns a map of userId -> count of open shifts.
 */
export function detectMultipleOpenShifts(shifts = []) {
  const openCounts = new Map();
  shifts.forEach((s) => {
    if (!s.clockOut && s.userId) {
      openCounts.set(s.userId, (openCounts.get(s.userId) || 0) + 1);
    }
  });

  const duplicates = new Set();
  openCounts.forEach((count, uid) => {
    if (count > 1) duplicates.add(uid);
  });
  return duplicates;
}
