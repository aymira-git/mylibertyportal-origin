/**
 * Canonical Class Schedule Days & Frequencies (Single Source of Truth)
 *
 * Unifies day-of-week parsing, timetable conflict detection, and staff
 * attendance punctuality calculation across MYLIBERTY Portal.
 *
 * Company operational week:
 * - Regular courses & offices: Saturday to Thursday (Friday is company off day)
 * - Kindergarten / Kids School: Monday to Friday (Saturday & Sunday are off days)
 */

export const DAY_NAME_TO_NUM = {
  sun: 0,
  sunday: 0,
  mon: 1,
  monday: 1,
  tue: 2,
  tuesday: 2,
  wed: 3,
  wednesday: 3,
  thu: 4,
  thursday: 4,
  fri: 5,
  friday: 5,
  sat: 6,
  saturday: 6,
};

export const NUM_TO_DAY_CODE = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export const CANONICAL_SCHEDULE_DAYS = {
  "mon/wed": {
    canonical: "Mon/Wed",
    codes: ["mon", "wed"],
    numbers: [1, 3],
  },
  "tue/thu": {
    canonical: "Tue/Thu",
    codes: ["tue", "thu"],
    numbers: [2, 4],
  },
  "mon - fri": {
    canonical: "Mon - Fri",
    codes: ["mon", "tue", "wed", "thu", "fri"],
    numbers: [1, 2, 3, 4, 5],
  },
  "sat only": {
    canonical: "Sat Only",
    codes: ["sat"],
    numbers: [6],
  },
  "sun only": {
    canonical: "Sun Only",
    codes: ["sun"],
    numbers: [0],
  },
  "sat/sun": {
    canonical: "Sat/Sun",
    codes: ["sat", "sun"],
    numbers: [6, 0],
  },
  everyday: {
    canonical: "Everyday",
    codes: ["sat", "sun", "mon", "tue", "wed", "thu"], // Sat to Thu (Friday off for course academy)
    numbers: [6, 0, 1, 2, 3, 4],
  },
  "fri only": {
    canonical: "Fri Only",
    codes: ["fri"],
    numbers: [5],
  },
};

/**
 * Normalizes day frequency string key for lookup in CANONICAL_SCHEDULE_DAYS.
 */
function normalizeFrequencyKey(str) {
  if (!str || typeof str !== "string") return "";
  let clean = str.trim().toLowerCase();
  clean = clean.replace(/\s*-\s*/g, " - ");
  clean = clean.replace(/\s*\/\s*/g, "/");
  return clean;
}

/**
 * Parse a schedule day string into a Set of 3-letter lowercase day codes:
 * e.g. "Mon/Wed" -> Set(["mon", "wed"]), "Mon - Fri" -> Set(["mon", "tue", "wed", "thu", "fri"]).
 *
 * @param {string} dayStr
 * @returns {Set<string>}
 */
export function parseScheduleDayCodes(dayStr) {
  if (!dayStr || typeof dayStr !== "string") return new Set();
  const clean = dayStr.trim().toLowerCase();

  // 1. Direct canonical lookup
  const normKey = normalizeFrequencyKey(clean);
  if (CANONICAL_SCHEDULE_DAYS[normKey]) {
    return new Set(CANONICAL_SCHEDULE_DAYS[normKey].codes);
  }

  // 2. Pattern recognition for weekdays / mon - fri variations
  if (
    clean.includes("mon - fri") ||
    clean.includes("mon-fri") ||
    clean.includes("monday to friday") ||
    clean.includes("weekdays")
  ) {
    return new Set(["mon", "tue", "wed", "thu", "fri"]);
  }

  if (clean.includes("everyday")) {
    return new Set(["sat", "sun", "mon", "tue", "wed", "thu"]);
  }

  // 3. Fallback: split by commas or slashes or whitespace
  const tokens = clean
    .split(/[/,]/)
    .map((s) => s.trim().replace(/\s+only$/i, "").slice(0, 3))
    .filter((s) => Boolean(s) && DAY_NAME_TO_NUM[s] !== undefined);

  if (tokens.length > 0) {
    return new Set(tokens);
  }

  return new Set();
}

/**
 * Parse a schedule day string into an array of JS Date day numbers (0-6):
 * 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 * Returns null if string represents "private" or untracked format.
 *
 * @param {string} dayStr
 * @returns {number[] | null}
 */
export function parseClassDayNumbers(dayStr) {
  if (!dayStr || typeof dayStr !== "string") return null;
  const clean = dayStr.trim().toLowerCase();
  if (clean.includes("private")) return null;

  // 1. Direct canonical lookup
  const normKey = normalizeFrequencyKey(clean);
  if (CANONICAL_SCHEDULE_DAYS[normKey]) {
    return [...CANONICAL_SCHEDULE_DAYS[normKey].numbers];
  }

  // 2. Pattern recognition
  if (
    clean.includes("mon - fri") ||
    clean.includes("mon-fri") ||
    clean.includes("monday to friday") ||
    clean.includes("weekdays")
  ) {
    return [1, 2, 3, 4, 5];
  }

  if (clean.includes("everyday")) {
    return [6, 0, 1, 2, 3, 4];
  }

  // 3. Single day name (with or without "only")
  const withoutOnly = clean.replace(/\s+only$/i, "").trim();
  if (DAY_NAME_TO_NUM[withoutOnly] !== undefined) {
    return [DAY_NAME_TO_NUM[withoutOnly]];
  }

  // 4. Split fallback
  const codes = parseScheduleDayCodes(dayStr);
  if (codes.size === 0) return null;

  const numbers = [];
  for (const c of codes) {
    if (DAY_NAME_TO_NUM[c] !== undefined) {
      numbers.push(DAY_NAME_TO_NUM[c]);
    }
  }

  return numbers.length > 0 ? numbers : null;
}

/**
 * Check if two classDay values share at least one weekday.
 *
 * @param {string} dayA
 * @param {string} dayB
 * @returns {boolean}
 */
export function doDaysOverlap(dayA, dayB) {
  if (!dayA || !dayB) return false;
  const setA = parseScheduleDayCodes(dayA);
  const setB = parseScheduleDayCodes(dayB);

  for (const d of setA) {
    if (setB.has(d)) return true;
  }
  return false;
}
