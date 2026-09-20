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
  const d = new Date();
  const witaOffsetMs = 480 * 60000;
  const witaTime = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + witaOffsetMs);
  witaTime.setHours(0, 0, 0, 0);
  return new Date(witaTime.getTime() - witaOffsetMs).toISOString();
}

export function getTodayWitaString() {
  const d = new Date();
  const witaOffsetMs = 480 * 60000;
  const witaDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + witaOffsetMs);
  return witaDate.toISOString().slice(0, 10);
}

export function rangeToSince(days) {
  return days === 0 ? null : new Date(Date.now() - days * 86400000).toISOString();
}
