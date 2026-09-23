import { db } from "../../firebase";
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  arrayUnion,
  writeBatch,
  runTransaction,
} from "firebase/firestore";
import { getBatchAvailability } from "./batchAvailability";
import { todayWita } from "../../utils/dateWita.js";
import { batchSchema } from "../../schemas";
import { normalizeBatchType } from "../../constants/batchTypes.js";

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
    studentIds.map((id) => updateDoc(doc(db, "users", id), { currentLevel: level }).catch(() => {}))
  );
}

export async function createClass(classData) {
  const validated = batchSchema.parse(classData);
  return addDoc(collection(db, "classes"), validated);
}

export function updateClass(classId, updateData) {
  const normalized = {
    ...updateData,
    ...(Object.prototype.hasOwnProperty.call(updateData, "batchType")
      ? { batchType: normalizeBatchType(updateData.batchType) }
      : {}),
  };
  return updateDoc(doc(db, "classes", classId), normalized);
}

export function deleteClass(classId) {
  return deleteDoc(doc(db, "classes", classId));
}

export function addStudentToClass(classId, { studentId, dateJoined, level }) {
  return runTransaction(db, async (tx) => {
    const classRef = doc(db, "classes", classId);
    const classSnap = await tx.get(classRef);
    if (!classSnap.exists()) {
      throw new Error("Class not found.");
    }

    const classData = classSnap.data();
    const availability = getBatchAvailability(classData);
    if (!availability.canEnroll) {
      throw new Error("Class is full or unavailable for enrollment.");
    }

    const currentStudentIds = classData.studentIds || [];
    if (currentStudentIds.includes(studentId)) {
      // Already enrolled, no-op
      return;
    }

    tx.update(classRef, {
      studentIds: arrayUnion(studentId),
      enrollments: arrayUnion({ studentId, dateJoined, level }),
      updatedAt: new Date().toISOString(),
    });
  });
}

export function removeStudentFromClass(cls, studentId) {
  return updateDoc(doc(db, "classes", cls.id), {
    studentIds: (cls.studentIds || []).filter((id) => id !== studentId),
    enrollments: (cls.enrollments || []).filter((e) => e.studentId !== studentId),
    updatedAt: new Date().toISOString(),
  });
}

export function setClassGroupLevel(classItems, level) {
  return Promise.all(
    classItems.map((cls) =>
      updateDoc(doc(db, "classes", cls.id), {
        classLevel: level,
        enrollments: (cls.enrollments || []).map((en) => ({ ...en, level })),
      })
    )
  );
}

/**
 * Atomically transfers a student from a source class to a target class.
 * Updates both class documents in a single writeBatch, updating studentIds,
 * enrollments, and updatedAt so it adheres strictly to Firestore security rules.
 */
export async function transferStudentBetweenClasses({
  sourceClass,
  targetClassId,
  targetClass,
  studentId,
  dateTransferred = todayWita(),
  newLevel = null,
  transferReason = "",
}) {
  if (sourceClass && sourceClass.id === targetClassId) {
    throw new Error("Cannot transfer a student to the same class.");
  }

  if (
    sourceClass &&
    Array.isArray(sourceClass.studentIds) &&
    !sourceClass.studentIds.includes(studentId)
  ) {
    throw new Error("Student is not enrolled in the source class.");
  }

  if (targetClass && !getBatchAvailability(targetClass).canEnroll) {
    throw new Error("Target class is full or unavailable for enrollment.");
  }

  const batch = writeBatch(db);
  const now = new Date().toISOString();

  // 1. Remove student from source class
  const sourceRef = doc(db, "classes", sourceClass.id);
  const updatedSourceStudentIds = (sourceClass.studentIds || []).filter((id) => id !== studentId);
  const updatedSourceEnrollments = (sourceClass.enrollments || []).filter(
    (e) => e.studentId !== studentId
  );
  batch.update(sourceRef, {
    studentIds: updatedSourceStudentIds,
    enrollments: updatedSourceEnrollments,
    updatedAt: now,
  });

  // 2. Add student to target class
  const targetRef = doc(db, "classes", targetClassId);
  const targetLevel = newLevel || targetClass?.classLevel || sourceClass?.classLevel || "warrior";
  const enrollmentRecord = {
    studentId,
    dateJoined: dateTransferred,
    level: targetLevel,
    transferredFrom: sourceClass.className || sourceClass.id,
  };
  if (transferReason && transferReason.trim()) {
    enrollmentRecord.transferReason = transferReason.trim();
  }

  batch.update(targetRef, {
    studentIds: arrayUnion(studentId),
    enrollments: arrayUnion(enrollmentRecord),
    updatedAt: now,
  });

  // Commit atomic transfer
  await batch.commit();

  // 3. Sync student user currentLevel if target class level is defined
  if (targetLevel) {
    syncStudentsCurrentLevel([studentId], targetLevel).catch(() => {});
  }
}
