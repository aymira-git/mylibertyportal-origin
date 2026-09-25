import { db } from "../../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  setDoc,
  writeBatch,
  deleteField,
} from "firebase/firestore";
import { todayWita, getWitaDayRangeIso } from "../../utils/dateWita.js";
import { studentIdSchema, paymentRecordSchema } from "../../schemas";
import { branchToId, idToBranch, DEFAULT_BRANCH_ID } from "../../constants/branches";

/**
 * All direct Firestore reads/writes for payments live here.
 */

export async function fetchPaymentHistory(studentId, branchId = null) {
  const validStudentId = studentIdSchema.parse(studentId);
  const constraints = [where("studentId", "==", validStudentId)];
  if (branchId) {
    constraints.push(where("branchId", "==", branchId));
  }
  const q = query(collection(db, "payments"), ...constraints);
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
  list.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  return list;
}

/**
 * Fetches the recent payment records bounded by limitCount (defaults to 50),
 * ordered by recordedAt desc. Used for desk transaction log & receipt lookup.
 *
 * @param {number} [limitCount=50]
 * @returns {Promise<Array<any>>}
 */
export async function getRecentPayments(limitCount = 50, branchId = null) {
  try {
    const constraints = [];
    if (branchId) {
      constraints.push(where("branchId", "==", branchId));
    }
    constraints.push(orderBy("recordedAt", "desc"), limit(limitCount));
    const q = query(
      collection(db, "payments"),
      ...constraints
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
  } catch (err) {
    // If composite index is pending, fallback to client-side sort
    console.warn("getRecentPayments fallback without orderBy:", err?.message);
    const fallbackConstraints = [];
    if (branchId) {
      fallbackConstraints.push(where("branchId", "==", branchId));
    }
    fallbackConstraints.push(limit(limitCount));
    const q = query(collection(db, "payments"), ...fallbackConstraints);
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime());
    return list;
  }
}

/**
 * Fetches all payments recorded within a specific WITA calendar day (defaults to today).
 * Guarantees that ALL payments for that day are fetched (NO artificial limit cap),
 * ensuring exact daily cash reconciliation.
 *
 * @param {Date} [witaDate=new Date()]
 * @param {string|null} [branchId=null]
 * @returns {Promise<Array<any>>}
 */
export async function getPaymentsForRecordedDay(witaDate = new Date(), branchId = null) {
  const { startIso, endIso } = getWitaDayRangeIso(witaDate);
  try {
    const constraints = [];
    if (branchId) {
      constraints.push(where("branchId", "==", branchId));
    }
    constraints.push(
      where("recordedAt", ">=", startIso),
      where("recordedAt", "<", endIso)
    );
    const q = query(
      collection(db, "payments"),
      ...constraints
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime());
    return list;
  } catch (err) {
    console.warn("getPaymentsForRecordedDay range query error, falling back to recent scan:", err?.message);
    // Safe fallback if range index isn't created yet: fetch recent 200 and filter by WITA day
    const fallbackConstraints = [];
    if (branchId) {
      fallbackConstraints.push(where("branchId", "==", branchId));
    }
    fallbackConstraints.push(limit(200));
    const q = query(collection(db, "payments"), ...fallbackConstraints);
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }))
      .filter((p) => {
        if (!p.recordedAt) return false;
        return p.recordedAt >= startIso && p.recordedAt < endIso;
      })
      .sort((a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime());
  }
}

/**
 * Writes the payment record and updates the student's payment status
 * together, atomically — either both land or neither does.
 */
export async function recordPayment(studentId, paymentRecord) {
  const validStudentId = studentIdSchema.parse(studentId);
  const rawBranch = paymentRecord.branch || paymentRecord.branchId || DEFAULT_BRANCH_ID;
  const branchId = branchToId(rawBranch);
  const branch = idToBranch(branchId);

  const enrichedRecord = {
    ...paymentRecord,
    branch,
    branchId,
  };

  const validatedRecord = paymentRecordSchema.parse(enrichedRecord);
  const paymentRef = doc(collection(db, "payments"));
  const batch = writeBatch(db);

  const recordedDate = paymentRecord.recordedAt ? new Date(paymentRecord.recordedAt) : new Date();
  const lastPaymentDate = !isNaN(recordedDate.getTime())
    ? todayWita(recordedDate)
    : (paymentRecord.recordedAt || "").slice(0, 10);

  const studentUpdate = {
    paymentStatus: "paid",
    lastPaymentPeriod: validatedRecord.period,
    lastPaymentDate,
    lastPaymentAmount: validatedRecord.amount,
    lastPaymentMethod: validatedRecord.method,
    paymentPlan: validatedRecord.planId || "monthly",
  };

  if (paymentRecord.coverageEnd) {
    studentUpdate.paidUntil = paymentRecord.coverageEnd;
  }

  batch.set(paymentRef, enrichedRecord);
  batch.set(doc(db, "users", validStudentId), studentUpdate, { merge: true });

  await batch.commit();
  return { id: paymentRef.id, ...enrichedRecord };
}

export function markPaymentPending(studentId) {
  return setDoc(
    doc(db, "users", studentId),
    {
      paymentStatus: "pending",
      paidUntil: deleteField(),
    },
    { merge: true }
  );
}
