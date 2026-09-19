import { db } from "../../firebase";
import { doc, deleteDoc, setDoc } from "firebase/firestore";

/**
 * All direct Firestore writes for invites live here instead of inside
 * useDashboardData.js — same pattern as classesRepository.js,
 * paymentsRepository.js, and applicationsRepository.js.
 */

export function createInvite(email, role) {
  const token = crypto.randomUUID();
  return setDoc(doc(db, "invites", token), {
    email: email.toLowerCase(),
    role,
    createdAt: new Date().toISOString(),
    used: false,
    token,
  });
}

export function deleteInvite(id) {
  return deleteDoc(doc(db, "invites", id));
}
