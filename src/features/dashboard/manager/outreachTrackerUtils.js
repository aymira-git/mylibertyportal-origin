/**
 * Utility functions for Manager Dashboard Outreach Tracker calculations.
 */
import { WITA_OFFSET_MS } from "../../../utils/dateWita.js";

/**
 * Calculates school coverage metrics for active schools only.
 * @param {Array<any>} schools
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
 * @param {Array<any>} visits
 * @param {string} officerId - "all" or specific UID
 * @returns {Array<any>}
 */
export function filterVisitsByOfficer(visits = [], officerId = "all") {
  if (!officerId || officerId === "all") return visits;
  return visits.filter((v) => v.createdBy === officerId);
}

/**
 * Filters schools by officer attribution.
 *
 * Attribution is visit-based: a school belongs to an officer if they have
 * logged at least one visit to that school. This is more accurate than
 * `school.createdBy` (who added the master record) because field officers
 * may visit schools they did not originally register.
 *
 * When `officerId` is "all" the full list is returned unchanged.
 *
 * @param {Array<any>} schools - All active school records.
 * @param {string} officerId - "all" or a specific officer UID.
 * @param {Map<string, Array<any>>} visitsBySchoolId - Map of schoolId → visits[],
 *   built from the 90-day visit window so recently worked schools are included.
 * @returns {Array<any>} Filtered school list.
 */
export function filterSchoolsByOfficer(schools = [], officerId = "all", visitsBySchoolId = new Map()) {
  if (!officerId || officerId === "all") return schools;
  return schools.filter((s) => {
    const schoolVisits = visitsBySchoolId.get(s.id) || [];
    return schoolVisits.some((v) => v.createdBy === officerId);
  });
}

/**
 * Normalizes a visitDate (or date boundary) to a canonical "YYYY-MM-DD" string
 * expressed in **WITA (UTC+8)**, matching the timezone basis used by
 * `getStartOfWeekWita` / `getEndOfWeekWita`.
 *
 * - Strings that already start with YYYY-MM-DD are returned as-is (no parsing needed).
 *   This is the normal path because `schoolVisitSchema` enforces YYYY-MM-DD on every write.
 * - Other string formats, Date objects, Firestore Timestamps, and epoch numbers are
 *   shifted by +WITA_OFFSET_MS before `getUTC*` extraction so the resulting date
 *   reflects local WITA time rather than UTC, preventing off-by-one-day miscounts
 *   for visits logged near midnight.
 *
 * Returns null if the value is missing or cannot be parsed.
 *
 * @param {any} dateVal
 * @returns {string|null} Canonical "YYYY-MM-DD" in WITA, or null
 */
export function normalizeVisitDate(dateVal) {
  if (!dateVal) return null;

  if (typeof dateVal === "string") {
    const trimmed = dateVal.trim();
    if (!trimmed) return null;

    // Fast path: YYYY-MM-DD prefix already encodes the local (WITA) date as stored
    // by the schema — extract directly without any Date construction or timezone shift.
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      const numM = Number(m);
      const numD = Number(d);
      if (numM >= 1 && numM <= 12 && numD >= 1 && numD <= 31) {
        return `${y}-${m}-${d}`;
      }
    }

    // Slow path: generic date string (e.g. "Mon Sep 22 2026 23:00:00 GMT+0000").
    // Parse to a Date, then apply the WITA offset so the extracted date reflects
    // local WITA time rather than the raw UTC date.
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const w = new Date(parsed.getTime() + WITA_OFFSET_MS);
      const y = w.getUTCFullYear();
      const m = String(w.getUTCMonth() + 1).padStart(2, "0");
      const d = String(w.getUTCDate()).padStart(2, "0");
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

  // Handle Date instance or numeric milliseconds — shift by WITA offset before
  // extracting date parts so the result matches the WITA-local calendar date,
  // consistent with how getStartOfWeekWita / getEndOfWeekWita compute boundaries.
  if (dateVal instanceof Date || typeof dateVal === "number") {
    const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
    if (!isNaN(d.getTime())) {
      const w = new Date(d.getTime() + WITA_OFFSET_MS);
      const y = w.getUTCFullYear();
      const m = String(w.getUTCMonth() + 1).padStart(2, "0");
      const day = String(w.getUTCDate()).padStart(2, "0");
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
 * @param {Array<any>} visits
 * @param {string|Date} startOfWeek - YYYY-MM-DD or parseable date
 * @param {string|Date} endOfWeek - YYYY-MM-DD or parseable date
 * @returns {{ visitsCount: number, flyersCount: number, leadsCount: number, weeklyVisits: Array<any> }}
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
 * @param {Array<any>} schools
 * @returns {Array<any>}
 */
export function getFollowUpSchools(schools = []) {
  return schools.filter(
    (s) => s.active !== false && (s.status === "follow_up" || Boolean(s.nextActionDate))
  );
}
