import { auth, db, getSecondaryAuth } from "../../firebase";
import {
  collection,
  doc,
  setDoc,
  addDoc,
  writeBatch,
  query,
  where,
  limit,
  getDocs,
} from "firebase/firestore";
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

export function updateStaffStatus(uid, status, updatedBy = auth.currentUser?.uid || null) {
  return setDoc(
    doc(db, "users", uid),
    {
      status,
      statusUpdatedAt: new Date().toISOString(),
      statusUpdatedBy: updatedBy,
    },
    { merge: true }
  );
}

export function updateStudentStatus(uid, status, updatedBy = auth.currentUser?.uid || null) {
  return setDoc(
    doc(db, "users", uid),
    {
      status,
      statusUpdatedAt: new Date().toISOString(),
      statusUpdatedBy: updatedBy,
    },
    { merge: true }
  );
}

/**
 * Checks whether a staff member has recorded attendance shift or leave documents.
 * Used as an async guardrail before hard-deleting a profile to prevent orphaned history.
 * Fails closed on query errors to prevent accidental data loss.
 */
export async function checkStaffHasAttendanceHistory(uid) {
  if (!uid) return { hasShifts: false, hasLeave: false, error: null };
  try {
    const shiftsQuery = query(collection(db, "shifts"), where("userId", "==", uid), limit(1));
    const leaveQuery = query(collection(db, "staffLeave"), where("userId", "==", uid), limit(1));
    const [shiftsSnap, leaveSnap] = await Promise.all([getDocs(shiftsQuery), getDocs(leaveQuery)]);
    return {
      hasShifts: !shiftsSnap.empty,
      hasLeave: !leaveSnap.empty,
      error: null,
    };
  } catch (err) {
    console.warn("Failed checking staff attendance history:", err);
    return { hasShifts: false, hasLeave: false, error: err.message };
  }
}

/**
 * Checks whether a student has historical payment, attendance, or academic report records.
 * Used as an async guardrail before hard-deleting a student profile.
 * Fails closed on query errors to prevent accidental data loss.
 */
export async function checkStudentHasHistory(uid) {
  if (!uid) return { hasPayments: false, hasAttendance: false, hasReports: false, error: null };
  try {
    const paymentsQuery = query(
      collection(db, "payments"),
      where("studentId", "==", uid),
      limit(1)
    );
    const attendanceQuery = query(
      collection(db, "attendance"),
      where("userId", "==", uid),
      limit(1)
    );
    const reportsQuery = query(
      collection(db, "progressReports"),
      where("studentId", "==", uid),
      limit(1)
    );
    const [paymentsSnap, attendanceSnap, reportsSnap] = await Promise.all([
      getDocs(paymentsQuery),
      getDocs(attendanceQuery),
      getDocs(reportsQuery),
    ]);
    return {
      hasPayments: !paymentsSnap.empty,
      hasAttendance: !attendanceSnap.empty,
      hasReports: !reportsSnap.empty,
      error: null,
    };
  } catch (err) {
    console.warn("Failed checking student history:", err);
    return { hasPayments: false, hasAttendance: false, hasReports: false, error: err.message };
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

/**
 * Deletes a user profile and scrubs any active enrollment references from
 * the /classes collection in an atomic batch to avoid leaving orphaned
 * student IDs in class rosters.
 */
export async function deleteUserProfile(uid) {
  if (!uid) return;

  // Find all classes where this student is currently enrolled
  const classesQuery = query(collection(db, "classes"), where("studentIds", "array-contains", uid));
  const classesSnap = await getDocs(classesQuery);

  const batch = writeBatch(db);
  batch.delete(doc(db, "users", uid));

  const now = new Date().toISOString();
  for (const classDoc of classesSnap.docs) {
    const classData = classDoc.data();
    const updatedStudentIds = (classData.studentIds || []).filter((id) => id !== uid);
    const updatedEnrollments = (classData.enrollments || []).filter((e) => e.studentId !== uid);
    batch.update(classDoc.ref, {
      studentIds: updatedStudentIds,
      enrollments: updatedEnrollments,
      updatedAt: now,
    });
  }

  return batch.commit();
}
