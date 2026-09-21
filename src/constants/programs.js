/**
 * Company Programs Registry (Single Source of Truth)
 *
 * Defines the 5 company educational programs:
 * 1. English Course (Teens & Adults, CEFR levels)
 * 2. Kids Course (Young learners, Cambridge tracks)
 * 3. Professional School (Vocational, workplace & executive modules)
 * 4. TOEFL Preparation (Target test score bands)
 * 5. Kids School / Kindergarten (Formal early childhood, Monday to Friday daily, Saturday & Sunday OFF)
 *
 * Operational scope note:
 * Kids School (Kindergarten) division is retained in the registry with enabled: false
 * while its dedicated division plan is implemented.
 */

export const DEFAULT_PROGRAM = "english_course";

export const PROGRAMS = {
  english_course: {
    id: "english_course",
    label: "English Course",
    shortLabel: "English",
    category: "course",
    enabled: true,
    badgeTone: "indigo",
    badgeBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
    scheduleType: "modular",
    allowedDays: ["Mon/Wed", "Tue/Thu", "Sat Only", "Sat/Sun", "Everyday"],
    weekendAllowed: true,
    weekendOff: false,
    defaultDay: "Mon/Wed",
    defaultStartTime: "17:00",
    defaultEndTime: "18:30",
    defaultCapacity: 15,
    minQuorum: 4,
    description: "Comprehensive English language proficiency for teens and adults.",
    levels: [
      { id: "warrior", label: "Warrior", stars: 1, order: 1, tier: "beginner" },
      { id: "elite", label: "Elite", stars: 1, order: 2, tier: "beginner" },
      { id: "master", label: "Master", stars: 2, order: 3, tier: "intermediate" },
      { id: "grandmaster", label: "Grandmaster", stars: 2, order: 4, tier: "intermediate" },
      { id: "epic", label: "Epic", stars: 3, order: 5, tier: "fluent" },
    ],
  },
  kids_course: {
    id: "kids_course",
    label: "Kids Course",
    shortLabel: "Kids Course",
    category: "course",
    enabled: true,
    badgeTone: "emerald",
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    scheduleType: "modular",
    allowedDays: ["Mon/Wed", "Tue/Thu", "Sat Only", "Sat/Sun"],
    weekendAllowed: true,
    weekendOff: false,
    defaultDay: "Mon/Wed",
    defaultStartTime: "15:30",
    defaultEndTime: "17:00",
    defaultCapacity: 12,
    minQuorum: 4,
    description: "Engaging English for young learners (ages 5-12) with Cambridge tracks.",
    levels: [
      { id: "phonics", label: "Phonics & Starters", stars: 1, order: 1, tier: "beginner" },
      { id: "starters", label: "Starters (Pre-A1)", stars: 1, order: 2, tier: "beginner" },
      { id: "movers", label: "Movers (A1)", stars: 2, order: 3, tier: "intermediate" },
      { id: "flyers", label: "Flyers (A2)", stars: 3, order: 4, tier: "fluent" },
    ],
  },
  professional_school: {
    id: "professional_school",
    label: "Professional School",
    shortLabel: "Professional",
    category: "vocational",
    enabled: true,
    badgeTone: "purple",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
    scheduleType: "modular",
    allowedDays: ["Mon/Wed", "Tue/Thu", "Sat Only", "Everyday"],
    weekendAllowed: true,
    weekendOff: false,
    defaultDay: "Tue/Thu",
    defaultStartTime: "19:00",
    defaultEndTime: "20:30",
    defaultCapacity: 20,
    minQuorum: 4,
    description: "Career-focused business English, communication, and executive coaching.",
    levels: [
      { id: "prof_foundations", label: "Business Foundations", stars: 1, order: 1, tier: "beginner" },
      { id: "prof_workplace", label: "Workplace Communication", stars: 2, order: 2, tier: "intermediate" },
      { id: "prof_executive", label: "Executive Leadership", stars: 3, order: 3, tier: "fluent" },
    ],
  },
  toefl: {
    id: "toefl",
    label: "TOEFL Preparation",
    shortLabel: "TOEFL",
    category: "test_prep",
    enabled: true,
    badgeTone: "amber",
    badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
    scheduleType: "modular",
    allowedDays: ["Mon/Wed", "Tue/Thu", "Sat Only", "Sat/Sun", "Everyday"],
    weekendAllowed: true,
    weekendOff: false,
    defaultDay: "Mon/Wed",
    defaultStartTime: "19:00",
    defaultEndTime: "20:30",
    defaultCapacity: 15,
    minQuorum: 4,
    description: "Intensive exam preparation targeting academic and institutional score bands.",
    levels: [
      { id: "toefl_foundation", label: "Foundation (400-450)", stars: 1, order: 1, tier: "beginner" },
      { id: "toefl_intermediate", label: "Intermediate (450-500)", stars: 2, order: 2, tier: "intermediate" },
      { id: "toefl_advanced", label: "Advanced (500-550)", stars: 2, order: 3, tier: "intermediate" },
      { id: "toefl_mastery", label: "High Scorer (550+)", stars: 3, order: 4, tier: "fluent" },
    ],
  },
  kids_school: {
    id: "kids_school",
    label: "Kids School (Kindergarten)",
    shortLabel: "Kids School",
    category: "formal_school",
    enabled: true, // Dedicated Kindergarten Division active
    badgeTone: "cyan",
    badgeBg: "bg-cyan-50 text-cyan-700 border-cyan-200",
    scheduleType: "daily_school",
    allowedDays: ["Mon - Fri"],
    weekendAllowed: false,
    weekendOff: true, // Strict business rule: Saturday & Sunday are OFF
    defaultDay: "Mon - Fri",
    defaultStartTime: "08:00",
    defaultEndTime: "11:30",
    defaultCapacity: 12,
    minQuorum: 3,
    description: "Formal early childhood education (Kindergarten/TK) operating Monday to Friday.",
    levels: [
      { id: "nursery", label: "Playgroup / Nursery", stars: 1, order: 1, tier: "beginner" },
      { id: "tk_a", label: "Kindergarten A (TK-A)", stars: 2, order: 2, tier: "intermediate" },
      { id: "tk_b", label: "Kindergarten B (TK-B)", stars: 3, order: 3, tier: "fluent" },
    ],
  },
};

export const PROGRAM_KEYS = Object.keys(PROGRAMS);
export const PROGRAM_LIST = Object.values(PROGRAMS);

// Exact alias lookup table for legacy / free-text strings
const PROGRAM_ALIASES = {
  // English course aliases
  english: "english_course",
  "general english": "english_course",
  "english course": "english_course",
  "english for teens": "english_course",
  "english_course": "english_course",
  cambridge: "english_course",
  general: "english_course",

  // Kids course aliases
  kids: "kids_course",
  "kids course": "kids_course",
  "kids_course": "kids_course",
  "young learners": "kids_course",
  "cambridge kids": "kids_course",
  "english for kids": "kids_course",

  // Professional school aliases
  professional: "professional_school",
  "professional school": "professional_school",
  "professional_school": "professional_school",
  vocational: "professional_school",
  "business english": "professional_school",
  business: "professional_school",
  executive: "professional_school",

  // TOEFL / Test prep aliases (including IELTS per audit decision Q2)
  toefl: "toefl",
  "toefl preparation": "toefl",
  "toefl prep": "toefl",
  "toefl ibt": "toefl",
  "toefl itp": "toefl",
  ielts: "toefl",
  "test prep": "toefl",
  test_prep: "toefl",

  // Kids school / Kindergarten aliases
  "kids school": "kids_school",
  "kids_school": "kids_school",
  kindergarten: "kids_school",
  tk: "kids_school",
  "tk-a": "kids_school",
  "tk-b": "kids_school",
  paud: "kids_school",
  playgroup: "kids_school",
  nursery: "kids_school",
};

/**
 * Normalizes any freeform or legacy program string to canonical program id.
 * Uses exact alias lookup first, then targeted regex boundary matching.
 * Falls back safely to DEFAULT_PROGRAM ("english_course").
 */
export function normalizeProgram(val) {
  if (!val || typeof val !== "string") return DEFAULT_PROGRAM;
  const clean = val.trim().toLowerCase();
  if (!clean) return DEFAULT_PROGRAM;

  // 1. Exact alias dictionary match
  if (PROGRAM_ALIASES[clean]) {
    return PROGRAM_ALIASES[clean];
  }

  // 2. Direct program key match
  if (PROGRAMS[clean]) {
    return clean;
  }

  // 3. Safe word-boundary keyword checks (prevents false matches like "network" matching "tk")
  if (/\b(kindergarten|playgroup|nursery|paud)\b/i.test(clean) || /\btk(\s*-\s*[ab])?\b/i.test(clean) || /\bkids\s+school\b/i.test(clean)) {
    return "kids_school";
  }

  if (/\b(toefl|ielts|test\s*prep)\b/i.test(clean)) {
    return "toefl";
  }

  if (/\b(professional|vocational|business\s*english)\b/i.test(clean)) {
    return "professional_school";
  }

  if (/\b(young\s*learners|kids\s*course)\b/i.test(clean) || (/\bkid(s)?\b/i.test(clean) && !/\bschool\b/i.test(clean))) {
    return "kids_course";
  }

  if (/\b(english|cambridge|general)\b/i.test(clean)) {
    return "english_course";
  }

  return DEFAULT_PROGRAM;
}

/**
 * Get program configuration object by ID.
 */
export function getProgram(programId) {
  const canonical = normalizeProgram(programId);
  return PROGRAMS[canonical] || PROGRAMS[DEFAULT_PROGRAM];
}

/**
 * Extract canonical program ID from a batch object (handling legacy unmigrated records).
 */
export function getBatchProgram(batch) {
  if (!batch) return DEFAULT_PROGRAM;
  return normalizeProgram(batch.programId || batch.program);
}

/**
 * Extract canonical program ID from a student or applicant object.
 */
export function getStudentProgram(student) {
  if (!student) return DEFAULT_PROGRAM;
  return normalizeProgram(student.programId || student.program);
}

/**
 * Get all programs that are active and enabled in the current portal UI.
 */
export function getEnabledPrograms() {
  return PROGRAM_LIST.filter((p) => p.enabled !== false);
}

/**
 * Get keys of all enabled programs.
 */
export function getEnabledProgramKeys() {
  return getEnabledPrograms().map((p) => p.id);
}

/**
 * Get enabled programs filtered by division ("courses" vs "kindergarten").
 * Defaults to all enabled programs when division is "all" or undefined.
 *
 * @param {string} [division]
 * @returns {Array<typeof PROGRAMS[keyof typeof PROGRAMS]>}
 */
export function getProgramsByDivision(division) {
  if (!division || division === "all") {
    return getEnabledPrograms();
  }
  const clean = String(division).trim().toLowerCase();
  if (clean === "kindergarten" || clean === "kids_school") {
    return [PROGRAMS.kids_school];
  }
  return [
    PROGRAMS.english_course,
    PROGRAMS.kids_course,
    PROGRAMS.professional_school,
    PROGRAMS.toefl,
  ];
}

/**
 * Get the list of levels for a specific program.
 */
export function getProgramLevels(programId) {
  const prog = getProgram(programId);
  return prog.levels || PROGRAMS[DEFAULT_PROGRAM].levels;
}

/**
 * Look up a level definition by program ID and level ID.
 */
export function getProgramLevel(programId, levelId) {
  if (!levelId) return null;
  const levels = getProgramLevels(programId);
  const cleanId = String(levelId).trim().toLowerCase();
  return levels.find((l) => l.id.toLowerCase() === cleanId) || null;
}

/**
 * Returns human-readable label for a level within a program.
 */
export function getProgramLevelLabel(programId, levelId) {
  const lvl = getProgramLevel(programId, levelId);
  if (lvl) return lvl.label;
  if (!levelId) return "Unassigned";
  return String(levelId).charAt(0).toUpperCase() + String(levelId).slice(1);
}

/**
 * Returns true if the program has strict weekend off (e.g. Kids School).
 */
export function isProgramWeekendOff(programId) {
  const prog = getProgram(programId);
  return Boolean(prog.weekendOff);
}

// Known legacy days that should be tolerated when editing old records
const TOLERATED_LEGACY_DAYS = new Set(["fri only"]);

/**
 * Validates whether a given class day frequency is allowed for the specified program.
 * Checks allowedDays for all programs, while tolerating legacy frequencies for backward compatibility.
 */
export function isValidScheduleForProgram(programId, classDay) {
  const prog = getProgram(programId);
  if (!classDay) return false;

  const dayStr = String(classDay).trim();
  const lower = dayStr.toLowerCase();

  // Tolerate legacy batches
  if (TOLERATED_LEGACY_DAYS.has(lower)) {
    return true;
  }

  if (prog.weekendOff) {
    // Weekend schedules are strictly forbidden for weekendOff programs
    if (lower.includes("sat") || lower.includes("sun") || lower === "everyday") {
      return false;
    }
    return prog.allowedDays.some(
      (d) => d.toLowerCase() === lower || lower.includes("mon - fri") || lower.includes("mon-fri")
    );
  }

  // For modular course programs, verify against allowedDays
  return prog.allowedDays.some(
    (d) => d.toLowerCase() === lower || d.toLowerCase().replace(/\s+/g, "") === lower.replace(/\s+/g, "")
  );
}
