/**
 * divisions.js
 * Canonical definitions and normalization for organizational divisions in MY LIBERTY:
 * - "courses" (English Course, Kids Course, Professional School, TOEFL)
 * - "kindergarten" (Kids School / TK / PAUD early childhood education)
 */

import { normalizeProgram } from "./programs.js";

export const DIVISIONS = ["courses", "kindergarten"];

export const DEFAULT_DIVISION = "courses";

export const DIVISION_LABELS = {
  courses: "Course Academy",
  kindergarten: "Kids School (Kindergarten)",
};

export const DIVISION_BADGES = {
  courses: {
    label: "Courses",
    shortLabel: "Courses",
    tone: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  kindergarten: {
    label: "Kindergarten",
    shortLabel: "Kids School",
    tone: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
};

const DIVISION_ALIASES = {
  // Courses aliases
  courses: "courses",
  course: "courses",
  academy: "courses",
  english: "courses",
  "general courses": "courses",

  // Kindergarten aliases
  kindergarten: "kindergarten",
  "kids school": "kindergarten",
  kids_school: "kindergarten",
  tk: "kindergarten",
  "tk-a": "kindergarten",
  "tk-b": "kindergarten",
  paud: "kindergarten",
  playgroup: "kindergarten",
  nursery: "kindergarten",
};

/**
 * Normalizes any freeform or legacy division string to canonical division id.
 * Defaults safely to DEFAULT_DIVISION ("courses") for missing/legacy records.
 *
 * @param {any} [raw]
 * @returns {"courses" | "kindergarten"}
 */
export function normalizeDivision(raw) {
  if (!raw || typeof raw !== "string") {
    return DEFAULT_DIVISION;
  }
  const clean = raw.trim().toLowerCase();
  if (!clean) {
    return DEFAULT_DIVISION;
  }

  if (DIVISION_ALIASES[clean]) {
    return DIVISION_ALIASES[clean];
  }

  if (clean.includes("kindergarten") || clean.includes("kids school") || clean.includes("paud")) {
    return "kindergarten";
  }

  return DEFAULT_DIVISION;
}

/**
 * Derives the organizational division from an educational program ID.
 * - "kids_school" -> "kindergarten"
 * - All other programs -> "courses"
 *
 * @param {string | null | undefined} programId
 * @returns {"courses" | "kindergarten"}
 */
export function divisionOfProgram(programId) {
  const prog = normalizeProgram(programId);
  return prog === "kids_school" ? "kindergarten" : "courses";
}

/**
 * Checks whether an item's division matches a division filter.
 * Supports "all", canonical normalization, and legacy fallback.
 *
 * @param {string | null | undefined} itemDivision
 * @param {string | null | undefined} filterDivision
 * @returns {boolean}
 */
export function matchesDivisionFilter(itemDivision, filterDivision) {
  if (!filterDivision || filterDivision === "all") return true;
  const canonicalItem = normalizeDivision(itemDivision);
  const canonicalFilter = normalizeDivision(filterDivision);
  return canonicalItem === canonicalFilter;
}

/**
 * Checks if a given division is Kindergarten.
 *
 * @param {string | null | undefined} division
 * @returns {boolean}
 */
export function isKindergartenDivision(division) {
  return normalizeDivision(division) === "kindergarten";
}

/**
 * Checks if a given division is Courses.
 *
 * @param {string | null | undefined} division
 * @returns {boolean}
 */
export function isCoursesDivision(division) {
  return normalizeDivision(division) === "courses";
}

/**
 * Returns true if the division has weekends (Sat/Sun) strictly OFF.
 * Kindergarten runs Mon-Fri (Sat & Sun off).
 * Courses run Sat-Thu (Friday off).
 *
 * @param {string | null | undefined} division
 * @returns {boolean}
 */
export function isDivisionWeekendOff(division) {
  return normalizeDivision(division) === "kindergarten";
}

/**
 * Checks whether a given calendar weekday is a working day for a division.
 * JS getDay(): 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat.
 *
 * - Kindergarten: Mon(1) to Fri(5) are active working days. Sat(6) and Sun(0) are OFF.
 * - Courses: Sat(6) to Thu(4) are active working days. Fri(5) is regular rest day (unless special sessions).
 *
 * @param {string | null | undefined} division
 * @param {number | Date} dayOrDate - JS weekday number (0-6) or Date object
 * @returns {boolean}
 */
export function isWorkDayForDivision(division, dayOrDate) {
  const weekday = typeof dayOrDate === "number" ? dayOrDate : (dayOrDate instanceof Date ? dayOrDate.getDay() : 0);
  const div = normalizeDivision(division);

  if (div === "kindergarten") {
    // Mon (1) to Fri (5)
    return weekday >= 1 && weekday <= 5;
  }

  // Courses: Sat (6), Sun (0), Mon (1), Tue (2), Wed (3), Thu (4). Friday (5) is rest day.
  return weekday !== 5;
}
