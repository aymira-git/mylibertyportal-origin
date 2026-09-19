import { db } from "../../firebase";
import { collection, getDocs, query, where, doc, setDoc, writeBatch } from "firebase/firestore";

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
 * together, atomically — either both land or neither does (see the
 * PaymentModal history for why this matters: it used to be two separate
 * calls, which left room for a dropped connection to record a payment
 * with no status update, or the reverse).
 */
export async function recordPayment(studentId, paymentRecord) {
  const paymentRef = doc(collection(db, "payments"));
  const batch = writeBatch(db);

  batch.set(paymentRef, paymentRecord);
  batch.set(doc(db, "users", studentId), {
    paymentStatus: "paid",
    lastPaymentPeriod: paymentRecord.period,
    lastPaymentDate: paymentRecord.recordedAt.slice(0, 10),
    lastPaymentAmount: paymentRecord.amount,
    lastPaymentMethod: paymentRecord.method,
  }, { merge: true });

  await batch.commit();
  return { id: paymentRef.id, ...paymentRecord };
}

export function markPaymentPending(studentId) {
  return setDoc(doc(db, "users", studentId), { paymentStatus: "pending" }, { merge: true });
}
