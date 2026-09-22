/**
 * Utility functions for Manager Dashboard Outreach Tracker calculations.
 */

/**
 * Calculates school coverage metrics for active schools only.
 * @param {Array<object>} schools
 * @returns {{ total: number, visited: number, percentage: number }}
 */
export function calculateCoverage(schools = []) {
  const activeSchools = schools.filter((s) => s.active !== false);
  const total = activeSchools.length;
  const visited = activeSchools.filter((s) => s.status === "visited").length;
  const percentage = total > 0 ? Math.round((visited / total) * 100) : 0;
  return { total, visited, percentage };
}

/**
 * Filters visit records by marketing officer ID.
 * @param {Array<object>} visits
 * @param {string} officerId - "all" or specific UID
 * @returns {Array<object>}
 */
export function filterVisitsByOfficer(visits = [], officerId = "all") {
  if (!officerId || officerId === "all") return visits;
  return visits.filter((v) => v.createdBy === officerId);
}

/**
 * Normalizes a visitDate (or date boundary) to a canonical "YYYY-MM-DD" string.
 * Defensively handles ISO strings, Date objects, Timestamps, and epoch numbers.
 * Returns null if the value is missing or cannot be parsed into a valid date.
 *
 * All Date-based extraction uses UTC getters (getUTC*) to match the UTC basis
 * used by getStartOfWeekWita / getEndOfWeekWita, avoiding off-by-one-day errors
 * when the runtime's local timezone is behind UTC.
 *
 * @param {any} dateVal
 * @returns {string|null} Canonical "YYYY-MM-DD" or null
 */
export function normalizeVisitDate(dateVal) {
  if (!dateVal) return null;

  if (typeof dateVal === "string") {
    const trimmed = dateVal.trim();
    if (!trimmed) return null;

    // Direct YYYY-MM-DD or leading YYYY-MM-DD in ISO string
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      const numM = Number(m);
      const numD = Number(d);
      if (numM >= 1 && numM <= 12 && numD >= 1 && numD <= 31) {
        return `${y}-${m}-${d}`;
      }
    }

    // Try parsing as generic date string — use UTC getters to stay consistent
    // with the WITA week boundaries produced by getStartOfWeekWita/getEndOfWeekWita.
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getUTCFullYear();
      const m = String(parsed.getUTCMonth() + 1).padStart(2, "0");
      const d = String(parsed.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return null;
  }

  // Handle Firestore Timestamp object with toDate()
  if (typeof dateVal?.toDate === "function") {
    try {
      dateVal = dateVal.toDate();
    } catch {
      return null;
    }
  }

  // Handle Timestamp-like object with seconds
  if (typeof dateVal?.seconds === "number") {
    dateVal = new Date(dateVal.seconds * 1000);
  }

  // Handle Date instance or numeric milliseconds timestamp — use UTC getters
  // to match the WITA week boundary basis (see comment on string branch above).
  if (dateVal instanceof Date || typeof dateVal === "number") {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    }
  }

  return null;
}

/**
 * Calculates weekly visits and materials handed out within WITA week boundaries.
 * Defensively normalizes dates so non-YYYY-MM-DD strings, ISO timestamps, or
 * Date objects do not silently miscount metrics.
 *
 * @param {Array<object>} visits
 * @param {string|Date} startOfWeek - YYYY-MM-DD or parseable date
 * @param {string|Date} endOfWeek - YYYY-MM-DD or parseable date
 * @returns {{ visitsCount: number, flyersCount: number, leadsCount: number, weeklyVisits: Array<object> }}
 */
export function calculateWeeklyMetrics(visits = [], startOfWeek, endOfWeek) {
  const normStart = normalizeVisitDate(startOfWeek);
  const normEnd = normalizeVisitDate(endOfWeek);

  if (!normStart || !normEnd) {
    return { visitsCount: 0, flyersCount: 0, leadsCount: 0, weeklyVisits: [] };
  }

  const weeklyVisits = visits.filter((v) => {
    const normDate = normalizeVisitDate(v?.visitDate || v?.visitDateMs);
    if (!normDate) return false;
    return normDate >= normStart && normDate <= normEnd;
  });

  const flyersCount = weeklyVisits.reduce((sum, v) => sum + (Number(v.flyersHandedOut) || 0), 0);
  const leadsCount = weeklyVisits.reduce((sum, v) => sum + (Number(v.leadsCollected) || 0), 0);

  return {
    visitsCount: weeklyVisits.length,
    flyersCount,
    leadsCount,
    weeklyVisits,
  };
}

/**
 * Extracts schools requiring follow-up action.
 * @param {Array<object>} schools
 * @returns {Array<object>}
 */
export function getFollowUpSchools(schools = []) {
  return schools.filter(
    (s) => s.active !== false && (s.status === "follow_up" || Boolean(s.nextActionDate))
  );
}
