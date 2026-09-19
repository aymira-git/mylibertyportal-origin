/**
 * Schedule Conflict Engine for Class Cohort Management.
 *
 * Detects teacher and room double-bookings across active class batches
 * by comparing day-of-week sets and time intervals. Only classes with
 * a status considered "active" (upcoming, open, in_progress, or any
 * unset/unknown value that defaults to open) are checked — completed
 * and cancelled classes are excluded.
 *
 * classDay is one of six fixed values from the BatchModal dropdown:
 *   "Mon/Wed", "Tue/Thu", "Fri Only", "Sat Only", "Sat/Sun", "Everyday"
 *
 * classRoom is free-text, so room names are normalized via
 * .trim().toLowerCase() before comparison.
 */

// ── Weekday Sets ────────────────────────────────────────────────────

const DAY_MAP = {
  "Mon/Wed":  new Set(["mon", "wed"]),
  "Tue/Thu":  new Set(["tue", "thu"]),
  "Fri Only": new Set(["fri"]),
  "Sat Only": new Set(["sat"]),
  "Sat/Sun":  new Set(["sat", "sun"]),
  "Everyday": new Set(["mon", "tue", "wed", "thu", "fri"]),
};

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Convert "HH:MM" to minutes-since-midnight.
 * Returns NaN for empty or malformed input.
 */
export function parseTimeMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return NaN;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return h * 60 + m;
}

/**
 * Do two classDay values share at least one weekday?
 * Falls back to generic "/" splitting for any future values not in DAY_MAP.
 */
export function doDaysOverlap(dayA, dayB) {
  if (!dayA || !dayB) return false;

  const setA = DAY_MAP[dayA] || parseDayString(dayA);
  const setB = DAY_MAP[dayB] || parseDayString(dayB);

  for (const d of setA) {
    if (setB.has(d)) return true;
  }
  return false;
}

/** Fallback parser for unexpected classDay values. */
function parseDayString(str) {
  return new Set(
    str
      .toLowerCase()
      .split("/")
      .map((s) => s.trim().slice(0, 3))
      .filter(Boolean)
  );
}

/**
 * Do two time intervals overlap?
 * [startA, endA) vs [startB, endB) — touching edges (one ends exactly
 * when the other begins) are NOT treated as conflicts.
 */
export function doTimesOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

// ── Statuses considered "active" (eligible for clash checking) ──────

const INACTIVE_STATUSES = new Set(["completed", "cancelled"]);

function isActiveClass(cls) {
  const s = (cls.status || "open").toLowerCase();
  return !INACTIVE_STATUSES.has(s);
}

// ── Room normalization ──────────────────────────────────────────────

function normalizeRoom(room) {
  if (!room || typeof room !== "string") return "";
  return room.trim().toLowerCase();
}

// ── Main Conflict Finder ────────────────────────────────────────────

/**
 * Scan all active classes for teacher and room double-bookings.
 *
 * @param {Array} classes — full list of class documents from Firestore.
 * @returns {{ teacherConflicts: Array, roomConflicts: Array }}
 *
 * Each conflict entry:
 *   { classA: { id, className, schedule, ... },
 *     classB: { id, className, schedule, ... },
 *     type: "teacher" | "room",
 *     detail: string }
 */
export function findScheduleConflicts(classes) {
  const active = (classes || []).filter(isActiveClass);
  const teacherConflicts = [];
  const roomConflicts = [];

  for (let i = 0; i < active.length; i++) {
    const a = active[i];
    const aStart = parseTimeMinutes(a.startTime);
    const aEnd = parseTimeMinutes(a.endTime);
    if (Number.isNaN(aStart) || Number.isNaN(aEnd)) continue;

    for (let j = i + 1; j < active.length; j++) {
      const b = active[j];
      const bStart = parseTimeMinutes(b.startTime);
      const bEnd = parseTimeMinutes(b.endTime);
      if (Number.isNaN(bStart) || Number.isNaN(bEnd)) continue;

      // Must share at least one day AND overlapping time to conflict
      if (!doDaysOverlap(a.classDay, b.classDay)) continue;
      if (!doTimesOverlap(aStart, aEnd, bStart, bEnd)) continue;

      // Teacher conflict
      if (a.instructorId && b.instructorId && a.instructorId === b.instructorId) {
        teacherConflicts.push({
          classA: a,
          classB: b,
          type: "teacher",
          detail: `Instructor is double-booked: "${a.className}" (${a.classDay} ${a.startTime}–${a.endTime}) and "${b.className}" (${b.classDay} ${b.startTime}–${b.endTime})`,
        });
      }

      // Room conflict
      const roomA = normalizeRoom(a.classRoom);
      const roomB = normalizeRoom(b.classRoom);
      if (roomA && roomB && roomA === roomB) {
        roomConflicts.push({
          classA: a,
          classB: b,
          type: "room",
          detail: `Room "${a.classRoom}" is double-booked: "${a.className}" (${a.classDay} ${a.startTime}–${a.endTime}) and "${b.className}" (${b.classDay} ${b.startTime}–${b.endTime})`,
        });
      }
    }
  }

  return { teacherConflicts, roomConflicts };
}

/**
 * Check a single draft batch against existing classes for conflicts.
 * Useful for live validation inside BatchModal before submission.
 *
 * @param {Object} draft — the batch being created/edited (needs classDay,
 *   startTime, endTime, instructorId, classRoom, and optionally id).
 * @param {Array} existingClasses — all other class documents.
 * @returns {{ teacherConflicts: Array, roomConflicts: Array }}
 */
export function checkDraftConflicts(draft, existingClasses) {
  if (!draft) return { teacherConflicts: [], roomConflicts: [] };

  // Build a temporary list with the draft appended, excluding the draft's
  // own existing record (for edits) so it doesn't conflict with itself.
  const others = (existingClasses || []).filter(
    (cls) => cls.id !== draft.id && isActiveClass(cls)
  );

  // Wrap draft as a pseudo-class for the engine
  const draftClass = {
    ...draft,
    id: draft.id || "__draft__",
    status: draft.status || "open",
  };

  return findScheduleConflicts([...others, draftClass]);
}
