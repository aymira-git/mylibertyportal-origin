import { db, auth } from "../../firebase";
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
import { getOrCreateKioskKey, signKioskChallenge } from "./kioskDeviceCrypto";

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
  /** @type {any[]} */
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

/**
 * Hardened kiosk clock-in backed by server-authoritative Cloudflare Worker,
 * Web Crypto non-exportable P-256 signatures, single-use challenges, and
 * server-side employee identity resolution.
 */
export async function kioskClockInWithProof({
  badgeToken,
  role = "instructor",
  stationId = "reception-01",
  classId = "general",
  className = "",
  shiftType = null,
  eventId = null,
  punctuality = null,
}) {
  const workerBase =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_AI_WORKER_URL
      ? import.meta.env.VITE_AI_WORKER_URL
      : "";

  // If worker base is not available or non-browser environment, fall back to direct clockIn
  if (!workerBase || typeof window === "undefined" || !window.crypto?.subtle) {
    return clockIn({
      uid: badgeToken,
      role,
      classId,
      className,
      shiftType,
      eventId,
      punctuality,
      stationId,
      clockInAt: new Date(),
    });
  }

  const { deviceId } = await getOrCreateKioskKey();
  const currentUser = auth.currentUser;
  const idToken = currentUser ? await currentUser.getIdToken() : "";

  // 1. Request single-use challenge nonce from Worker
  const challengeRes = await fetch(`${workerBase}/api/v1/kiosk/challenge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({ deviceId }),
  });

  if (!challengeRes.ok) {
    const errData = await challengeRes.json().catch(() => ({}));
    throw new Error(errData?.error || "Failed to obtain kiosk challenge.");
  }

  const { nonce } = await challengeRes.json();

  // 2. Sign challenge using non-exportable P-256 private key
  const signature = await signKioskChallenge(deviceId, nonce, badgeToken);

  // 3. Submit clock-in to Worker for server verification
  const clockInRes = await fetch(`${workerBase}/api/v1/shift/clock-in`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: JSON.stringify({
      deviceId,
      badgeToken,
      nonce,
      signature,
      stationId,
      classId,
      className,
      shiftType,
      eventId,
      punctuality,
    }),
  });

  if (!clockInRes.ok) {
    const errData = await clockInRes.json().catch(() => ({}));
    throw new Error(errData?.error || "Kiosk verified clock-in failed.");
  }

  return clockInRes.json();
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
    if (envelope) {
      try {
        await submitApprovalRequest(envelope);
      } catch (err) {
        console.error("Failed to submit cash discrepancy approval request:", err);
        throw new Error(
          "Shift not closed: the cash discrepancy escalation could not be submitted. Please retry or contact an administrator.",
          { cause: err }
        );
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
 *
 * When appliedFromApproval is provided (maker-checker self-correction flow),
 * both writes reference the approved approval doc so Firestore rules can
 * verify dual-control authorization.
 */
export async function adjustShiftWithAudit({
  shiftId,
  beforeShift,
  afterData,
  reasonCode,
  note = "",
  actorId,
  actorName = "Administrator",
  appliedFromApproval = null,
}) {
  const batch = writeBatch(db);
  const shiftRef = doc(db, "shifts", shiftId);

  batch.update(shiftRef, {
    ...afterData,
    corrected: true,
    reviewStatus: "reviewed",
    ...(appliedFromApproval ? { appliedFromApproval } : {}),
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
    ...(appliedFromApproval ? { appliedFromApproval } : {}),
    createdAt: serverTimestamp(),
  });

  await batch.commit();
}

/**
 * Applies an already-approved STAFF_SHIFT_SELF_CORRECTION approval envelope
 * to its target shift, recording an immutable audit event. Firestore rules
 * reject the write unless the referenced approval doc is approved, so this
 * can safely be invoked by Front Office / Manager approvers.
 */
export async function applyApprovedShiftCorrection({ approval, actor = null }) {
  const shiftId = approval?.payload?.shiftId || approval?.payload?.beforeShift?.id;
  const afterData = approval?.payload?.afterData;
  if (!approval?.id || !shiftId || !afterData?.clockIn) {
    throw new Error("Approved correction is missing its shift payload.");
  }
  const currentUser = actor || auth.currentUser;
  await adjustShiftWithAudit({
    shiftId,
    beforeShift: approval.payload.beforeShift || {},
    afterData,
    reasonCode: approval.payload.reasonCode || "other",
    note: `Approved staff self-correction (ref ${approval.id})`,
    actorId: currentUser?.uid || "approver",
    actorName: currentUser?.displayName || currentUser?.email || "Approver",
    appliedFromApproval: approval.id,
  });
}

/**
 * Staff Leave Operations (Sakit, Izin, Cuti, Dinas Luar)
 */
export async function logStaffLeave({
  userId,
  displayNameSnapshot = "",
  branchId = null,
  type,
  startDate,
  endDate = null,
  dayPortion = "full",
  note = "",
  createdBy,
}) {
  const finalBranchId = branchId ? branchToId(branchId) : null;
  return addDoc(collection(db, "staffLeave"), {
    userId,
    displayNameSnapshot: displayNameSnapshot || "",
    ...(finalBranchId ? { branchId: finalBranchId } : {}),
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
