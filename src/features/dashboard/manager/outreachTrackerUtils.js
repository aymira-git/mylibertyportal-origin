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
 * Calculates weekly visits and materials handed out within WITA week boundaries.
 * @param {Array<object>} visits
 * @param {string} startOfWeek - YYYY-MM-DD
 * @param {string} endOfWeek - YYYY-MM-DD
 * @returns {{ visitsCount: number, flyersCount: number, leadsCount: number, weeklyVisits: Array<object> }}
 */
export function calculateWeeklyMetrics(visits = [], startOfWeek, endOfWeek) {
  if (!startOfWeek || !endOfWeek) {
    return { visitsCount: 0, flyersCount: 0, leadsCount: 0, weeklyVisits: [] };
  }

  const weeklyVisits = visits.filter((v) => {
    if (!v.visitDate) return false;
    return v.visitDate >= startOfWeek && v.visitDate <= endOfWeek;
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
