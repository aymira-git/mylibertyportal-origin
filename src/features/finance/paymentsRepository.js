import { db } from "../../firebase";
import {
  collection,
  getDocs,
  getDoc,
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
import { normalizeDivision, divisionOfProgram } from "../../constants/divisions";

/**
 * All direct Firestore reads/writes for payments live here.
 */

export async function fetchPaymentHistory(studentId, branchId = null, division = null) {
  const validStudentId = studentIdSchema.parse(studentId);
  const constraints = [where("studentId", "==", validStudentId)];
  if (branchId) {
    constraints.push(where("branchId", "==", branchId));
  }
  if (division && division !== "all") {
    constraints.push(where("division", "==", division));
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
 * @param {string|null} [branchId=null]
 * @param {string|null} [division=null]
 * @returns {Promise<Array<any>>}
 */
export async function getRecentPayments(limitCount = 50, branchId = null, division = null) {
  try {
    const constraints = [];
    if (branchId) {
      constraints.push(where("branchId", "==", branchId));
    }
    if (division && division !== "all") {
      constraints.push(where("division", "==", division));
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
    if (division && division !== "all") {
      fallbackConstraints.push(where("division", "==", division));
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
 * @param {string|null} [division=null]
 * @returns {Promise<Array<any>>}
 */
export async function getPaymentsForRecordedDay(witaDate = new Date(), branchId = null, division = null) {
  const { startIso, endIso } = getWitaDayRangeIso(witaDate);
  try {
    const constraints = [];
    if (branchId) {
      constraints.push(where("branchId", "==", branchId));
    }
    if (division && division !== "all") {
      constraints.push(where("division", "==", division));
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
    if (err?.code === "failed-precondition" && /index/i.test(err.message || "")) {
      throw new Error(
        "Cash reconciliation is blocked because a required payment index is not ready.",
        { cause: err }
      );
    }
    throw err;
  }
}

/**
 * Writes the payment record and updates the student's payment status
 * together, atomically — either both land or neither does.
 *
 * Supports an optional idempotencyKey (or paymentRecord.idempotencyKey)
 * to ensure that network retries or rapid double-submissions return the
 * existing record without creating duplicate payment documents or double-charging.
 */
export async function recordPayment(studentId, paymentRecord, idempotencyKey = null) {
  const validStudentId = studentIdSchema.parse(studentId);
  const rawBranch = paymentRecord.branch || paymentRecord.branchId || DEFAULT_BRANCH_ID;
  const branchId = branchToId(rawBranch);
  const branch = idToBranch(branchId);

  let division = paymentRecord.division || null;
  if (!division) {
    try {
      const studentSnap = await getDoc(doc(db, "users", validStudentId));
      if (studentSnap.exists()) {
        const studentData = studentSnap.data();
        division =
          studentData.division ||
          divisionOfProgram(studentData.programId || studentData.program);
      }
    } catch (err) {
      console.warn("Could not fetch student to derive division for payment:", err);
    }
  }
  const finalDivision = division ? normalizeDivision(division) : "courses";

  const effectiveIdempotencyKey = idempotencyKey || paymentRecord.idempotencyKey || null;

  const enrichedRecord = {
    ...paymentRecord,
    branch,
    branchId,
    division: finalDivision,
    ...(effectiveIdempotencyKey ? { idempotencyKey: effectiveIdempotencyKey } : {}),
  };

  const validatedRecord = paymentRecordSchema.parse(enrichedRecord);
  const paymentRef = effectiveIdempotencyKey
    ? doc(db, "payments", effectiveIdempotencyKey)
    : doc(collection(db, "payments"));

  if (effectiveIdempotencyKey) {
    const existingSnap = await getDoc(paymentRef);
    if (existingSnap.exists()) {
      return { id: existingSnap.id, ...existingSnap.data(), _idempotentReplay: true };
    }
  }

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
