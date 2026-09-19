// Company policy: an instructor must clock in at least this many minutes
// BEFORE the scheduled start time to count as "on time." Arriving after
// that cutoff — even if technically before class starts — counts as late.
// This is a pre-start cutoff, not a post-start grace period.
const EARLY_CUTOFF_MINUTES = 15;

// Maps common day names and abbreviations to JS Date.getDay() numbers.
const DAY_NAME_TO_NUM = {
  "mon": 1, "monday": 1,
  "tue": 2, "tuesday": 2,
  "wed": 3, "wednesday": 3,
  "thu": 4, "thursday": 4,
  "fri": 5, "friday": 5,
  "sat": 6, "saturday": 6,
  "sun": 0, "sunday": 0,
};

/**
 * Parses a classDay string into a list of JS weekday numbers (0-6).
 * Supports patterns like "Mon/Wed", "Mon, Wed, Fri", "Saturday", etc.
 * Returns null for "Private" or untracked formats.
 */
function parseClassDays(dayString) {
  if (!dayString || dayString.toLowerCase().includes("private")) return null;
  
  // Split by common delimiters: /, ,, or spaces
  const parts = dayString.split(/[/,]/);
  const nums = parts
    .map(p => p.trim().toLowerCase())
    .map(p => DAY_NAME_TO_NUM[p])
    .filter(n => n !== undefined);
    
  return nums.length > 0 ? nums : null;
}

// Which of an instructor's classes fall on today's weekday.
export function getTodaysClasses(classes) {
  const todayWeekday = new Date().getDay();
  return classes.filter(cls => {
    const activeDays = parseClassDays(cls.classDay);
    // If it's a Private class, we always show it in the Kiosk so the
    // instructor can select it regardless of the weekday.
    if (!activeDays) return cls.classDay?.toLowerCase().includes("private");
    return activeDays.includes(todayWeekday);
  });
}

// Computes on-time/late status for a clock-in happening RIGHT NOW.
export function getInstantPunctuality(classRecord, clockInDate) {
  if (!classRecord?.startTime) {
    return { status: "Unscheduled", scheduledStart: null, requiredArrival: null, minutesEarlyOrLate: null };
  }
  const [hours, minutes] = classRecord.startTime.split(":").map(Number);
  const scheduledStart = new Date(clockInDate);
  scheduledStart.setHours(hours, minutes, 0, 0);
  const requiredArrival = new Date(scheduledStart.getTime() - EARLY_CUTOFF_MINUTES * 60000);
  const minutesEarlyOrLate = Math.round((scheduledStart - clockInDate) / 60000);
  return {
    status: clockInDate <= requiredArrival ? "On time" : "Late",
    scheduledStart: scheduledStart.toISOString(),
    requiredArrival: requiredArrival.toISOString(),
    minutesEarlyOrLate,
  };
}

function getDatesInMonthForWeekdays(year, month, weekdays) {
  const dates = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    if (weekdays.includes(d.getDay())) dates.push(d);
  }
  return dates;
}

function sameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function findClosestShift(shifts, classId, sessionDate, scheduledStart, usedShiftIds, allowLegacyFallback) {
  const taggedSameDay = shifts.filter(s => s.classId === classId
    && s.clockIn
    && sameCalendarDay(new Date(s.clockIn), sessionDate)
    && !usedShiftIds.has(s.id));
  const legacySameDay = allowLegacyFallback ? shifts.filter(s => !s.classId
    && s.clockIn
    && sameCalendarDay(new Date(s.clockIn), sessionDate)
    && !usedShiftIds.has(s.id)) : [];

  const candidates = taggedSameDay.length > 0 ? taggedSameDay : legacySameDay;
  if (candidates.length === 0) return null;

  const closest = candidates.reduce((closestShift, s) =>
    Math.abs(new Date(s.clockIn) - scheduledStart) < Math.abs(new Date(closestShift.clockIn) - scheduledStart) ? s : closestShift
  );
  usedShiftIds.add(closest.id);
  return closest;
}

/**
 * Computes monthly punctuality stats per instructor.
 */
export function computeMonthlyPunctuality(classes, shifts, instructorsById, year, month) {
  const statsByInstructor = {};
  const now = new Date();
  const usedShiftIds = new Set();

  // Support for both recurring scheduled classes and "Private" lessons.
  const allTrackableClasses = classes.filter(c => c.startTime);

  for (const cls of allTrackableClasses) {
    const weekdays = parseClassDays(cls.classDay);
    const instructorShifts = shifts.filter(s => s.userId === cls.instructorId);
    
    // For Private classes, we don't generate "Scheduled" sessions because 
    // their dates are random. We only count the sessions they actually 
    // attended (the shifts they logged).
    if (!weekdays) {
      if (!statsByInstructor[cls.instructorId]) {
        statsByInstructor[cls.instructorId] = initInstructorStats(cls.instructorId, instructorsById);
      }
      const stats = statsByInstructor[cls.instructorId];
      
      const privateShifts = instructorShifts.filter(s => s.classId === cls.id && s.clockIn);
      for (const shift of privateShifts) {
        const d = new Date(shift.clockIn);
        if (d.getFullYear() !== year || d.getMonth() !== month) continue;
        
        stats.sessionsScheduled += 1;
        stats.sessionsAttended += 1;
        
        // Punctuality for Private is tricky; we assume if they clocked in, 
        // they were "On Time" unless you start adding scheduled dates for private.
        // For now, we flag it as Limited Accuracy.
        stats.onTime += 1;
        stats.limitedAccuracy = true;
      }
      continue;
    }

    const hasAmbiguousLegacyDay = allTrackableClasses.some(otherClass => otherClass !== cls
      && otherClass.instructorId === cls.instructorId
      && parseClassDays(otherClass.classDay)?.some(weekday => weekdays.includes(weekday)));

    const taggedShifts = instructorShifts.filter(s => s.classId === cls.id && s.clockIn);
    const legacyShiftsOnPattern = instructorShifts.filter(s => !s.classId && s.clockIn && weekdays.includes(new Date(s.clockIn).getDay()));
    const earliestKnownShift = [...taggedShifts, ...legacyShiftsOnPattern]
      .map(shift => new Date(shift.clockIn))
      .sort((a, b) => a - b)[0];
      
    const classStart = cls.classStartDate
      ? new Date(`${cls.classStartDate}T00:00:00`)
      : earliestKnownShift || null;
      
    const sessionDates = getDatesInMonthForWeekdays(year, month, weekdays)
      .filter(sessionDate => !classStart || sessionDate >= new Date(classStart.getFullYear(), classStart.getMonth(), classStart.getDate()));
    const [hours, minutes] = cls.startTime.split(":").map(Number);

    if (!statsByInstructor[cls.instructorId]) {
      statsByInstructor[cls.instructorId] = initInstructorStats(cls.instructorId, instructorsById);
    }
    const stats = statsByInstructor[cls.instructorId];
    if (!cls.classStartDate) stats.limitedAccuracy = true;

    for (const sessionDate of sessionDates) {
      const scheduledStart = new Date(sessionDate);
      scheduledStart.setHours(hours, minutes, 0, 0);
      if (scheduledStart > now) continue;

      stats.sessionsScheduled += 1;
      const matchedShift = findClosestShift(instructorShifts, cls.id, sessionDate, scheduledStart, usedShiftIds, !hasAmbiguousLegacyDay);

      if (!matchedShift) {
        stats.absent += 1;
        continue;
      }

      stats.sessionsAttended += 1;
      if (!matchedShift.classId) stats.limitedAccuracy = true;
      const cutoff = new Date(scheduledStart.getTime() - EARLY_CUTOFF_MINUTES * 60000);
      const minutesLate = (new Date(matchedShift.clockIn) - cutoff) / 60000;

      if (minutesLate <= 0) {
        stats.onTime += 1;
      } else {
        stats.late += 1;
        stats.totalMinutesLate += minutesLate;
        stats.lateSessionCount += 1;
      }
    }
  }

  // Tally auto-closed shifts
  for (const shift of shifts) {
    if (!shift.autoClosed || !shift.clockIn) continue;
    const d = new Date(shift.clockIn);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    if (statsByInstructor[shift.userId]) {
      statsByInstructor[shift.userId].autoClosedCount += 1;
    }
  }

  return Object.values(statsByInstructor).map(s => ({
    ...s,
    punctualityRate: s.sessionsScheduled > 0 ? Math.round((s.onTime / s.sessionsScheduled) * 100) : null,
    avgMinutesLate: s.lateSessionCount > 0 ? Math.round(s.totalMinutesLate / s.lateSessionCount) : 0,
  }));
}

function initInstructorStats(instructorId, instructorsById) {
  return {
    instructorId,
    instructorName: instructorsById[instructorId]?.displayName || "Unknown",
    sessionsScheduled: 0,
    sessionsAttended: 0,
    onTime: 0,
    late: 0,
    absent: 0,
    totalMinutesLate: 0,
    lateSessionCount: 0,
    autoClosedCount: 0,
    limitedAccuracy: false,
  };
}
