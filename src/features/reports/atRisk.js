/**
 * atRisk.js
 *
 * Provisional (v1) evaluation helper for learner attendance risk.
 *
 * Rule definition:
 * An active, non-archived student who joined more than 14 days ago,
 * and has recorded no check-in scans within the last 14 WITA days (336 hours).
 */

export const AT_RISK_THRESHOLD_DAYS = 14;
export const AT_RISK_LABEL = "No check-in in 14+ days";

/**
 * Checks if an enrolled student meets the provisional At-Risk criteria.
 *
 * @param {Object} student - Student user record or aggregated learner object
 * @param {string|number|Date} [referenceTime] - Optional reference timestamp (defaults to Date.now())
 * @returns {boolean}
 */
export function isStudentAtRisk(student, referenceTime = Date.now()) {
  if (!student) return false;

  // Archived or non-active students are excluded from attendance risk
  const isActive = (student.status || "active") === "active" && !student.isArchived;
  if (!isActive) return false;

  const nowMs = typeof referenceTime === "number" ? referenceTime : new Date(referenceTime).getTime();
  const thresholdMs = nowMs - AT_RISK_THRESHOLD_DAYS * 86400000;

  // Must have joined over 14 days ago (if joinedDate is known)
  const joinedMs = student.joinedDate ? new Date(student.joinedDate).getTime() : 0;
  if (joinedMs > 0 && joinedMs > thresholdMs) {
    return false; // Newly joined student (< 14 days)
  }

  // Check last check-in date
  const lastCheckInMs = student.lastCheckIn ? new Date(student.lastCheckIn).getTime() : 0;
  if (lastCheckInMs > 0 && lastCheckInMs >= thresholdMs) {
    return false; // Checked in within the last 14 days
  }

  // Also check if attendance history is present with recent records
  if (Array.isArray(student.history) && student.history.length > 0) {
    const mostRecentMs = new Date(student.history[0].timestamp).getTime();
    if (mostRecentMs >= thresholdMs) {
      return false;
    }
  }

  return true;
}
