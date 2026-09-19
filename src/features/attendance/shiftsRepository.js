import { db } from "../../firebase";
import { collection, doc, getDoc, addDoc, getDocs, query, where, updateDoc } from "firebase/firestore";

/**
 * All direct Firestore reads/writes for shifts, plus the lookups the
 * clock-in flows need (a user's role, an instructor's classes) and
 * kiosk-recorded student attendance, live here instead of inside
 * Kiosk.jsx — same pattern as the other domain repositories.
 */

export async function fetchUserById(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchOpenShiftFor(uid) {
  const snap = await getDocs(
    query(collection(db, "shifts"), where("userId", "==", uid), where("clockOut", "==", null))
  );
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function fetchInstructorClasses(uid) {
  const snap = await getDocs(query(collection(db, "classes"), where("instructorId", "==", uid)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function clockIn({ uid, displayName, role, classId, className, clockInAt, punctuality }) {
  return addDoc(collection(db, "shifts"), {
    userId: uid,
    displayName: displayName || "",
    role,
    classId,
    className: className || "",
    clockIn: clockInAt.toISOString(),
    clockOut: null,
    scheduledStart: punctuality.scheduledStart,
    requiredArrival: punctuality.requiredArrival,
    punctualityStatus: punctuality.status,
    minutesEarlyOrLate: punctuality.minutesEarlyOrLate,
  });
}

export function clockOutShift(shiftId, clockOutAt = new Date()) {
  return updateDoc(doc(db, "shifts", shiftId), { clockOut: clockOutAt.toISOString() });
}

export function recordStudentAttendance({ uid, displayName }) {
  return addDoc(collection(db, "attendance"), {
    userId: uid,
    displayName,
    role: "student",
    timestamp: new Date().toISOString(),
    method: "KIOSK",
  });
}
