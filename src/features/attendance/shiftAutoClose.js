import { db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";

// How long a shift can sit "Active" before we assume the person
// forgot to clock out. Instructors get a short window since classes
// only run ~90 minutes; everyone else gets a full-workday window.
export const GRACE_HOURS = { instructor: 3, default: 14 };
// Estimated clock-out time recorded when auto-closing — not a real
// clock-out, which is why every auto-closed shift is flagged.
export const EXPECTED_MINUTES = { instructor: 90, default: 8 * 60 };

// True if this open shift has been active longer than its role's grace period.
export function isShiftStale(shift) {
  if (shift.clockOut || !shift.clockIn) return false;
  const hoursOpen = (new Date() - new Date(shift.clockIn)) / (1000 * 60 * 60);
  const grace = GRACE_HOURS[shift.role] ?? GRACE_HOURS.default;
  return hoursOpen > grace;
}

// Writes an estimated clock-out to a stale shift and flags it.
// Returns the estimated ISO clock-out time.
export async function autoCloseShift(shift) {
  const minutes = EXPECTED_MINUTES[shift.role] ?? EXPECTED_MINUTES.default;
  const estimatedClockOut = new Date(new Date(shift.clockIn).getTime() + minutes * 60000).toISOString();
  await updateDoc(doc(db, "shifts", shift.id), { clockOut: estimatedClockOut, autoClosed: true });
  return estimatedClockOut;
}
