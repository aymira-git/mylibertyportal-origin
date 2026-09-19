import { db } from "../../firebase";
import { collection, addDoc, deleteDoc, doc, updateDoc, arrayUnion } from "firebase/firestore";

/**
 * All direct Firestore writes for the `classes` collection — and the
 * student-level side effects that come with them — live here instead of
 * inside ClassManager.jsx. ClassManager handles state, forms and toasts;
 * this file handles "what actually happens in the database." Nothing here
 * knows about React — it only takes plain data in and returns promises.
 *
 * This is the first domain pulled out this way. The other components that
 * still call Firestore directly (PaymentModal, StudentApplications, etc.)
 * are unchanged for now — same pattern, applied one domain at a time.
 */

// Single source of truth for "these students just got assigned this
// level" — used by class creation, adding a student to an existing class,
// and bulk group-level changes below. Errors are swallowed per-student
// (same behavior as before this was pulled out of ClassManager) so one
// failed write doesn't block the class-side change that already succeeded.
export function syncStudentsCurrentLevel(studentIds, level) {
  return Promise.all(
    studentIds.map(id =>
      updateDoc(doc(db, "users", id), { currentLevel: level }).catch(() => {})
    )
  );
}

export function createClass(classData) {
  return addDoc(collection(db, "classes"), classData);
}

export function updateClass(classId, updateData) {
  return updateDoc(doc(db, "classes", classId), updateData);
}

export function deleteClass(classId) {
  return deleteDoc(doc(db, "classes", classId));
}

export function addStudentToClass(classId, { studentId, dateJoined, level }) {
  return updateDoc(doc(db, "classes", classId), {
    studentIds: arrayUnion(studentId),
    enrollments: arrayUnion({ studentId, dateJoined, level }),
  });
}

export function removeStudentFromClass(cls, studentId) {
  return updateDoc(doc(db, "classes", cls.id), {
    studentIds: (cls.studentIds || []).filter(id => id !== studentId),
    enrollments: (cls.enrollments || []).filter(e => e.studentId !== studentId),
  });
}

export function setClassGroupLevel(classItems, level) {
  return Promise.all(classItems.map(cls =>
    updateDoc(doc(db, "classes", cls.id), {
      classLevel: level,
      enrollments: (cls.enrollments || []).map(en => ({ ...en, level })),
    })
  ));
}
