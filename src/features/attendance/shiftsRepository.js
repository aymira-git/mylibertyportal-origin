import { db } from "../../firebase";
import {
  collection,
  doc,
  getDoc,
  addDoc,
  getDocs,
  query,
  where,
  updateDoc,
  writeBatch,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

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
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function clockIn({
  uid,
  displayName,
  role,
  classId,
  className,
  clockInAt,
  punctuality,
  stationId = "reception-01",
  docId = null,
}) {
  const payload = {
    userId: uid,
    displayName: displayName || "",
    role,
    classId: classId || "general",
    className: className || "",
    clockIn: clockInAt.toISOString(),
    clockOut: null,
    scheduledStart: punctuality?.scheduledStart || null,
    requiredArrival: punctuality?.requiredArrival || null,
    punctualityStatus: punctuality?.status || "Present",
    minutesEarlyOrLate: punctuality?.minutesEarlyOrLate ?? 0,
    stationId,
    clockInSource: "kiosk",
    createdAt: serverTimestamp(),
  };

  if (docId) {
    const batch = writeBatch(db);
    batch.set(doc(db, "shifts", docId), payload);
    return batch.commit();
  }

  return addDoc(collection(db, "shifts"), payload);
}

export function clockOutShift(shiftId, clockOutAt = new Date()) {
  return updateDoc(doc(db, "shifts", shiftId), { clockOut: clockOutAt.toISOString() });
}

export function markShiftReviewed(shiftId) {
  return updateDoc(doc(db, "shifts", shiftId), { reviewStatus: "reviewed" });
}

/**
 * Executes a class transition atomically: clocks out previous shift
 * and creates new shift in a single Firestore writeBatch.
 */
export function switchClassAtomic({
  previousShiftId,
  clockOutAt = new Date(),
  newShiftDocId,
  uid,
  displayName,
  role,
  classId,
  className,
  punctuality,
  stationId = "reception-01",
}) {
  const batch = writeBatch(db);
  const prevRef = doc(db, "shifts", previousShiftId);
  batch.update(prevRef, { clockOut: clockOutAt.toISOString() });

  const newRef = newShiftDocId ? doc(db, "shifts", newShiftDocId) : doc(collection(db, "shifts"));
  batch.set(newRef, {
    userId: uid,
    displayName: displayName || "",
    role,
    classId: classId || "general",
    className: className || "",
    clockIn: clockOutAt.toISOString(),
    clockOut: null,
    scheduledStart: punctuality?.scheduledStart || null,
    requiredArrival: punctuality?.requiredArrival || null,
    punctualityStatus: punctuality?.status || "Present",
    minutesEarlyOrLate: punctuality?.minutesEarlyOrLate ?? 0,
    stationId,
    clockInSource: "kiosk",
    createdAt: serverTimestamp(),
  });

  return batch.commit();
}

export function recordStudentAttendance({ uid, displayName }) {
  return addDoc(collection(db, "attendance"), {
    userId: uid,
    displayName: displayName || "",
    role: "student",
    timestamp: new Date().toISOString(),
    method: "KIOSK",
  });
}

/**
 * Performs an audited shift adjustment using an atomic batch write:
 * Updates the shift doc and creates an immutable audit event record.
 */
export async function adjustShiftWithAudit({
  shiftId,
  beforeShift,
  afterData,
  reasonCode,
  note,
  actorId,
  actorName,
}) {
  const batch = writeBatch(db);
  const shiftRef = doc(db, "shifts", shiftId);

  batch.update(shiftRef, {
    ...afterData,
    corrected: true,
    reviewStatus: "reviewed",
  });

  const auditRef = doc(collection(db, "shiftAuditEvents"));
  batch.set(auditRef, {
    shiftId,
    action: "manual_adjustment",
    before: {
      clockIn: beforeShift.clockIn || null,
      clockOut: beforeShift.clockOut || null,
      autoClosed: beforeShift.autoClosed || false,
    },
    after: {
      clockIn: afterData.clockIn || null,
      clockOut: afterData.clockOut || null,
    },
    reasonCode,
    note: note || "",
    actorId,
    actorNameSnapshot: actorName || "Administrator",
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Staff Leave Operations (Sakit, Izin, Cuti, Dinas Luar)
 */
export async function logStaffLeave({
  userId,
  displayNameSnapshot,
  type,
  startDate,
  endDate,
  dayPortion = "full",
  note = "",
  createdBy,
}) {
  return addDoc(collection(db, "staffLeave"), {
    userId,
    displayNameSnapshot: displayNameSnapshot || "",
    type,
    startDate,
    endDate: endDate || startDate,
    dayPortion,
    note,
    status: "approved",
    createdBy,
    createdAt: serverTimestamp(),
  });
}

export async function fetchStaffLeaves(sinceDate = null) {
  let q = collection(db, "staffLeave");
  if (sinceDate) {
    q = query(q, where("endDate", ">=", sinceDate));
  }
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function deleteStaffLeave(leaveId) {
  return deleteDoc(doc(db, "staffLeave", leaveId));
}
