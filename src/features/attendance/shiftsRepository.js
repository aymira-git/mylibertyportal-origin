import { db } from "../../firebase";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  addDoc,
  getDocs,
  query,
  where,
  limit,
  updateDoc,
  writeBatch,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { createApprovalEnvelope } from "../shared/approvalGates";
import { submitApprovalRequest } from "../shared/approvalsRepository";
import { branchToId, idToBranch, DEFAULT_BRANCH_ID } from "../../constants/branches";

export const DEFAULT_CASH_DISCREPANCY_THRESHOLD_IDR = 25000;
export const DEFAULT_CASH_DISCREPANCY_PERCENT = 0.01;

/**
 * Computes allowable cash discrepancy threshold (smaller of fixed IDR or % of expected total).
 */
export function calculateCashDiscrepancyThreshold(
  expectedTotal = 0,
  {
    fixedThreshold = DEFAULT_CASH_DISCREPANCY_THRESHOLD_IDR,
    percentThreshold = DEFAULT_CASH_DISCREPANCY_PERCENT,
  } = {}
) {
  if (!expectedTotal || expectedTotal <= 0) return fixedThreshold;
  const calculatedPercent = expectedTotal * percentThreshold;
  return Math.min(fixedThreshold, Math.max(calculatedPercent, 0));
}

/**
 * Public accessor for shift cash reconciliation data (Finance domain boundary safe).
 */
export function getShiftCashReconciliation(shift) {
  if (!shift || typeof shift !== "object") return null;
  return shift.cashReconciliation || null;
}

/**
 * @returns {Promise<any>}
 */
export async function fetchUserById(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * @returns {Promise<any>}
 */
export async function fetchOpenShiftFor(uid) {
  const snap = await getDocs(
    query(collection(db, "shifts"), where("userId", "==", uid), where("clockOut", "==", null))
  );
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

/**
 * Fetches recent shift records for a specific staff member (bounded for free tier & privacy).
 * @param {string} uid
 * @param {number} limitCount
 * @returns {Promise<any[]>}
 */
export async function fetchUserShifts(uid, limitCount = 30) {
  if (!uid) return [];
  const q = query(
    collection(db, "shifts"),
    where("userId", "==", uid),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  items.sort((a, b) => new Date(b.clockIn || 0).getTime() - new Date(a.clockIn || 0).getTime());
  return items;
}

/**
 * @returns {Promise<any[]>}
 */
export async function fetchInstructorClasses(uid) {
  const [primarySnap, subSnap] = await Promise.all([
    getDocs(query(collection(db, "classes"), where("instructorId", "==", uid))),
    getDocs(query(collection(db, "classes"), where("substituteInstructorId", "==", uid))),
  ]);

  const classMap = new Map();
  primarySnap.docs.forEach((d) => classMap.set(d.id, { id: d.id, ...d.data() }));
  subSnap.docs.forEach((d) => classMap.set(d.id, { id: d.id, ...d.data() }));
  return Array.from(classMap.values());
}

export function setClassSubstitute(classId, { substituteId = null, substituteName = null }) {
  return updateDoc(doc(db, "classes", classId), {
    substituteInstructorId: substituteId || null,
    substituteInstructorName: substituteName || null,
    updatedAt: new Date().toISOString(),
  });
}

export function clockIn({
  uid,
  displayName = "",
  role,
  branch = null,
  branchId = null,
  classId = "general",
  className = "",
  clockInAt,
  punctuality = null,
  stationId = "reception-01",
  docId = null,
  shiftType = null,
  eventId = null,
}) {
  const finalBranchId = branchToId(branchId || branch || DEFAULT_BRANCH_ID);
  const finalBranch = idToBranch(finalBranchId);

  const payload = {
    userId: uid,
    displayName: displayName || "",
    role,
    branch: finalBranch,
    branchId: finalBranchId,
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
    ...(shiftType ? { shiftType } : {}),
    ...(eventId ? { eventId } : {}),
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

/**
 * Clocks out a shift and embeds shift-end cash & QRIS reconciliation.
 * If discrepancy exceeds the configurable threshold, automatically attaches
 * a maker-checker approval gate routed to Branch Manager.
 */
export async function clockOutShiftWithCashReconciliation(
  shiftId,
  {
    clockOutAt = new Date(),
    countedCash = 0,
    countedQris = 0,
    expectedCash = 0,
    expectedQris = 0,
    notes = "",
    requester = {},
    customThreshold = null,
  } = {}
) {
  const cCash = Number(countedCash) || 0;
  const cQris = Number(countedQris) || 0;
  const eCash = Number(expectedCash) || 0;
  const eQris = Number(expectedQris) || 0;

  const totalCounted = cCash + cQris;
  const totalExpected = eCash + eQris;
  const discrepancy = totalCounted - totalExpected;

  const threshold =
    customThreshold != null
      ? Number(customThreshold)
      : calculateCashDiscrepancyThreshold(totalExpected);

  const exceedsThreshold = Math.abs(discrepancy) > threshold;

  const reconciliationData = {
    expectedCash: eCash,
    expectedQris: eQris,
    countedCash: cCash,
    countedQris: cQris,
    discrepancy,
    threshold,
    exceedsThreshold,
    notes: (notes || "").trim(),
    reconciledAt: clockOutAt.toISOString(),
  };

  const payload = {
    clockOut: clockOutAt.toISOString(),
    cashReconciliation: reconciliationData,
  };

  if (exceedsThreshold) {
    const envelope = createApprovalEnvelope("CASH_DISCREPANCY", requester, {
      shiftId,
      reason: notes || `Discrepancy of IDR ${discrepancy.toLocaleString("id-ID")} exceeds IDR ${threshold.toLocaleString("id-ID")} threshold.`,
      payload: reconciliationData,
    });
    payload.approval = envelope;
    if (envelope) {
      try {
        await submitApprovalRequest(envelope);
      } catch (err) {
        console.warn("Failed to submit cash discrepancy approval request:", err);
      }
    }
  }

  return updateDoc(doc(db, "shifts", shiftId), payload);
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
  newShiftDocId = null,
  uid,
  displayName = "",
  role,
  classId = "general",
  className = "",
  punctuality = null,
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

/**
 * Records student attendance idempotently. When dateKey is supplied (YYYY-MM-DD in WITA),
 * uses a deterministic document ID `${uid}_${dateKey}` with merge to prevent double-tap
 * duplicates from rapid camera scans.
 */
export function recordStudentAttendance({
  uid,
  displayName,
  dateKey = null,
  eventId = null,
  eventName = null,
}) {
  const payload = {
    userId: uid,
    displayName: displayName || "",
    role: "student",
    timestamp: new Date().toISOString(),
    method: "KIOSK",
    ...(eventId ? { eventId } : {}),
    ...(eventName ? { eventName } : {}),
  };

  if (dateKey) {
    const docId = `${uid}_${dateKey}`;
    return setDoc(doc(db, "attendance", docId), payload, { merge: true });
  }

  return addDoc(collection(db, "attendance"), payload);
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
  note = "",
  actorId,
  actorName = "Administrator",
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
    actorNameSnapshot: actorName,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Staff Leave Operations (Sakit, Izin, Cuti, Dinas Luar)
 */
export async function logStaffLeave({
  userId,
  displayNameSnapshot = "",
  type,
  startDate,
  endDate = null,
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
  const q = sinceDate
    ? query(collection(db, "staffLeave"), where("endDate", ">=", sinceDate))
    : collection(db, "staffLeave");
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function deleteStaffLeave(leaveId) {
  return deleteDoc(doc(db, "staffLeave", leaveId));
}
