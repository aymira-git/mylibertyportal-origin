import { startOfTodayWitaIso as centralizedStartOfTodayWitaIso, todayWita } from "../../utils/dateWita.js";

/**
 * Pure date & utility helpers for Reports & Attendance.
 * Ensures consistent WITA (UTC+8 / Asia/Makassar) day boundary calculations.
 */

export function uniqueClasses(classes = []) {
  const seen = new Set();
  return classes.filter((cls) => {
    const signature = [cls.className, cls.instructorId, cls.schedule, cls.classRoom].join("|");
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export function getStartOfTodayWitaIso() {
  return centralizedStartOfTodayWitaIso();
}

export function getTodayWitaString() {
  return todayWita();
}

export function rangeToSince(days) {
  return days === 0 ? null : new Date(Date.now() - days * 86400000).toISOString();
}
