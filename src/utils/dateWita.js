/**
 * Centralized Date & Timezone Utilities for WITA (UTC+8 / Asia/Makassar).
 *
 * MY LIBERTY operates exclusively in Manado, North Sulawesi (WITA).
 * WITA has a permanent UTC+8 offset with NO daylight savings time.
 *
 * Using UTC arithmetic with a fixed 8-hour offset ensures these functions
 * produce identical, mathematically exact results regardless of whether
 * the client browser/device is configured in WITA, UTC, or any other timezone.
 */

export const WITA_OFFSET_MS = 8 * 3600 * 1000;

const pad = (n) => String(n).padStart(2, "0");

/**
 * Returns today's date string in WITA formatted as "YYYY-MM-DD".
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function todayWita(date = new Date()) {
  const w = new Date(date.getTime() + WITA_OFFSET_MS);
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}`;
}

/**
 * Returns the current day of the week in WITA (0 = Sunday, 1 = Monday, ..., 6 = Saturday).
 * @param {Date} [date=new Date()]
 * @returns {number}
 */
export function getTodayWitaWeekday(date = new Date()) {
  const w = new Date(date.getTime() + WITA_OFFSET_MS);
  return w.getUTCDay();
}

/**
 * Returns the ISO 8601 UTC timestamp marking the exact start of today (00:00:00.000) in WITA.
 * For example, 2026-09-21 00:00:00 WITA returns "2026-09-20T16:00:00.000Z".
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function startOfTodayWitaIso(date = new Date()) {
  const w = new Date(date.getTime() + WITA_OFFSET_MS);
  const startUtcMs =
    Date.UTC(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate(), 0, 0, 0, 0) - WITA_OFFSET_MS;
  return new Date(startUtcMs).toISOString();
}

/**
 * Formats a stored UTC ISO date string into a wall-clock string suitable for
 * <input type="datetime-local"> in WITA ("YYYY-MM-DDTHH:mm").
 * Prevents UTC shifting in shift adjustment forms.
 * @param {string|Date|null} isoString
 * @returns {string}
 */
export function formatWitaForInput(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return "";
  const w = new Date(d.getTime() + WITA_OFFSET_MS);
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}T${pad(w.getUTCHours())}:${pad(w.getUTCMinutes())}`;
}

/**
 * Parses a "YYYY-MM-DDTHH:mm" value from a datetime-local input back into a valid UTC ISO string,
 * treating the input as WITA local wall-clock time.
 * @param {string} inputStr
 * @returns {string|null}
 */
export function parseWitaInputToUtcIso(inputStr) {
  if (!inputStr) return null;
  const match = inputStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, m, d, h, min] = match.map(Number);
  const utcMs = Date.UTC(y, m - 1, d, h, min, 0, 0) - WITA_OFFSET_MS;
  if (!Number.isFinite(utcMs)) return null;
  return new Date(utcMs).toISOString();
}

/**
 * Validates whether a time string strictly matches the "HH:mm" 24-hour format.
 * Prevents malformed class schedule data from crashing time-calculation helpers.
 * @param {string|null|undefined} timeStr
 * @returns {boolean}
 */
export function validateHHmm(timeStr) {
  if (typeof timeStr !== "string") return false;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}
