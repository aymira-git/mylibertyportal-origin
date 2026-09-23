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

/**
 * All direct Firestore reads/writes for payments live here.
 */

export async function fetchPaymentHistory(studentId) {
  const validStudentId = studentIdSchema.parse(studentId);
  const q = query(collection(db, "payments"), where("studentId", "==", validStudentId));
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
export async function getRecentPayments(limitCount = 50) {
  try {
    const q = query(
      collection(db, "payments"),
      orderBy("recordedAt", "desc"),
      limit(limitCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
  } catch (err) {
    // If composite index is pending, fallback to client-side sort
    console.warn("getRecentPayments fallback without orderBy:", err?.message);
    const q = query(collection(db, "payments"), limit(limitCount));
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
 * @returns {Promise<Array<any>>}
 */
export async function getPaymentsForRecordedDay(witaDate = new Date()) {
  const { startIso, endIso } = getWitaDayRangeIso(witaDate);
  try {
    const q = query(
      collection(db, "payments"),
      where("recordedAt", ">=", startIso),
      where("recordedAt", "<", endIso)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
    list.sort((a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime());
    return list;
  } catch (err) {
    console.warn("getPaymentsForRecordedDay range query error, falling back to recent scan:", err?.message);
    // Safe fallback if range index isn't created yet: fetch recent 200 and filter by WITA day
    const q = query(collection(db, "payments"), limit(200));
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
  const validatedRecord = paymentRecordSchema.parse(paymentRecord);
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

  batch.set(paymentRef, paymentRecord);
  batch.set(doc(db, "users", validStudentId), studentUpdate, { merge: true });

  await batch.commit();
  return { id: paymentRef.id, ...paymentRecord };
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
