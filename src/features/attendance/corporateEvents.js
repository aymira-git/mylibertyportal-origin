/**
 * corporateEvents.js
 * Pure matching and validation helpers for Corporate Event Attendance.
 */

import { matchesBranchFilter } from "../../constants/branches.js";
import { matchesDivisionFilter, divisionOfProgram } from "../../constants/divisions.js";

/**
 * Determines whether a user (student, manager, or staff) is eligible for a specific corporate event.
 *
 * Eligibility rules:
 * - Event must be active (not cancelled).
 * - Event date must match target dateStr (YYYY-MM-DD WITA calendar date).
 * - "all": matches everyone (students, every staff role, and managers).
 * - "branch": matches anyone in that canonical branch.
 * - "division": matches anyone in that canonical division (derives division from program for students).
 * - "role": matches staff/manager by exact role. Students are never matched by role dimension.
 *
 * @param {any} event
 * @param {any} user
 * @param {string} [dateStr] - YYYY-MM-DD
 * @returns {boolean}
 */
export function isEventEligible(event, user, dateStr) {
  if (!event || event.status !== "active") {
    return false;
  }

  if (dateStr && event.eventDate !== dateStr) {
    return false;
  }

  if (!user) {
    return false;
  }

  const { audienceType, audienceValue } = event;

  switch (audienceType) {
    case "all":
      return true;

    case "branch":
      return matchesBranchFilter(user.branch, audienceValue);

    case "division": {
      const userDivision =
        user.division ||
        (user.role === "student"
          ? divisionOfProgram(user.programId || user.program)
          : "courses");
      return matchesDivisionFilter(userDivision, audienceValue);
    }

    case "role": {
      if (user.role === "student") {
        return false;
      }
      return user.role === (audienceValue || "").toLowerCase();
    }

    default:
      return false;
  }
}

/**
 * Finds matching corporate events for a user on a given date.
 *
 * Resolution logic:
 * - Exactly 1 match -> { match: event, count: 1, ambiguous: false }
 * - More than 1 match -> { match: null, count: N, ambiguous: true, matchedEvents }
 * - 0 matches -> { match: null, count: 0, ambiguous: false }
 *
 * @param {Array<any>} events
 * @param {any} user
 * @param {string} [dateStr]
 * @returns {{ match: any|null, count: number, ambiguous: boolean, matchedEvents?: Array<any> }}
 */
export function findMatchingCorporateEvents(events, user, dateStr) {
  if (!Array.isArray(events) || events.length === 0 || !user) {
    return { match: null, count: 0, ambiguous: false };
  }

  const matches = events.filter((evt) => isEventEligible(evt, user, dateStr));

  if (matches.length === 1) {
    return { match: matches[0], count: 1, ambiguous: false };
  }

  if (matches.length > 1) {
    return { match: null, count: matches.length, ambiguous: true, matchedEvents: matches };
  }

  return { match: null, count: 0, ambiguous: false };
}
