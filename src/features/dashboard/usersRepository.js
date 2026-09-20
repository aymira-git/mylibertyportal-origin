import { db, getSecondaryAuth } from "../../firebase";
import { collection, doc, setDoc, addDoc, deleteDoc, query, where, limit, getDocs } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";

/**
 * All direct Firestore writes (and the one Firebase Auth call) for
 * managing user records — both students and staff — live here instead of
 * inside useDashboardData.js. Same pattern as every other domain
 * repository in this app.
 */

export function saveStudentRecord(editId, studentData) {
  return editId
    ? setDoc(doc(db, "users", editId), studentData, { merge: true })
    : addDoc(collection(db, "users"), studentData);
}

export function updateStaffRecord(uid, staffData) {
  return setDoc(doc(db, "users", uid), staffData, { merge: true });
}

export function updateStaffStatus(uid, status) {
  return setDoc(doc(db, "users", uid), { status }, { merge: true });
}

export function updateStudentStatus(uid, status) {
  return setDoc(doc(db, "users", uid), { status }, { merge: true });
}

/**
 * Checks whether a staff member has recorded attendance shift or leave documents.
 * Used as an async guardrail before hard-deleting a profile to prevent orphaned history.
 */
export async function checkStaffHasAttendanceHistory(uid) {
  if (!uid) return { hasShifts: false, hasLeave: false };
  try {
    const shiftsQuery = query(collection(db, "shifts"), where("userId", "==", uid), limit(1));
    const leaveQuery = query(collection(db, "staffLeave"), where("userId", "==", uid), limit(1));
    const [shiftsSnap, leaveSnap] = await Promise.all([
      getDocs(shiftsQuery),
      getDocs(leaveQuery),
    ]);
    return {
      hasShifts: !shiftsSnap.empty,
      hasLeave: !leaveSnap.empty,
    };
  } catch (err) {
    console.warn("Failed checking staff attendance history:", err);
    return { hasShifts: false, hasLeave: false };
  }
}

/**
 * Creating a new staff account means creating the Firebase Auth account
 * FIRST (via the secondary auth instance, so the admin doing this stays
 * signed in), then separately writing the Firestore profile. Auth and
 * Firestore are different systems with no shared transaction between
 * them — same irreducible gap as staff self-signup. If the Firestore
 * write fails after the Auth account already exists, that's surfaced
 * clearly rather than as a generic error, since simply retrying would
 * hit "email already in use" and look like the whole thing failed when
 * actually there's a half-created account sitting there.
 */
export async function createStaffAccount(email, password, staffData) {
  const secAuth = getSecondaryAuth();
  const cred = await createUserWithEmailAndPassword(secAuth, email, password);

  try {
    await setDoc(doc(db, "users", cred.user.uid), staffData, { merge: true });
  } catch (err) {
    throw new Error(
      `Account was created in Firebase Auth, but saving the profile failed: ${err.message}. ` +
      `An admin must finish this manually in the Firebase Console, or delete the Auth account and try again.`,
      { cause: err }
    );
  }

  return cred.user.uid;
}

export function deleteUserProfile(uid) {
  return deleteDoc(doc(db, "users", uid));
}
