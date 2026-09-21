import { db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";

import { isShiftStale, GRACE_HOURS, EXPECTED_MINUTES } from "./shiftStatus";
export { isShiftStale, GRACE_HOURS, EXPECTED_MINUTES };

// Writes an estimated clock-out to a stale shift and flags it.
// Returns the estimated ISO clock-out time.
export async function autoCloseShift(shift) {
  const minutes = EXPECTED_MINUTES[shift.role] ?? EXPECTED_MINUTES.default;
  const estimatedClockOut = new Date(
    new Date(shift.clockIn).getTime() + minutes * 60000
  ).toISOString();
  await updateDoc(doc(db, "shifts", shift.id), { clockOut: estimatedClockOut, autoClosed: true });
  return estimatedClockOut;
}
