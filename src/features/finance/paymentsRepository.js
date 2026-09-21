import { db } from "../../firebase";
import { collection, getDocs, query, where, doc, setDoc, writeBatch, deleteField } from "firebase/firestore";
import { todayWita } from "../../utils/dateWita.js";

/**
 * All direct Firestore reads/writes for payments live here instead of
 * inside PaymentModal.jsx — same pattern as classesRepository.js in the
 * classes domain. PaymentModal handles state, the form and the receipt
 * UI; this file handles what actually happens in the database.
 */

export async function fetchPaymentHistory(studentId) {
  const q = query(collection(db, "payments"), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  return list;
}

/**
 * Writes the payment record and updates the student's payment status
 * together, atomically — either both land or neither does.
 */
export async function recordPayment(studentId, paymentRecord) {
  const paymentRef = doc(collection(db, "payments"));
  const batch = writeBatch(db);

  const recordedDate = paymentRecord.recordedAt ? new Date(paymentRecord.recordedAt) : new Date();
  const lastPaymentDate = !isNaN(recordedDate.getTime())
    ? todayWita(recordedDate)
    : (paymentRecord.recordedAt || "").slice(0, 10);

  const studentUpdate = {
    paymentStatus: "paid",
    lastPaymentPeriod: paymentRecord.period,
    lastPaymentDate,
    lastPaymentAmount: paymentRecord.amount,
    lastPaymentMethod: paymentRecord.method,
    paymentPlan: paymentRecord.planId || "monthly",
  };

  if (paymentRecord.coverageEnd) {
    studentUpdate.paidUntil = paymentRecord.coverageEnd;
  }

  batch.set(paymentRef, paymentRecord);
  batch.set(doc(db, "users", studentId), studentUpdate, { merge: true });

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
