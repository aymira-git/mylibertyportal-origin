/**
 * applicationsRepository.js
 * Write-only Firestore operations for student applications and admissions.
 *
 * Applications are retained in Firestore across their lifecycle (pending,
 * approved, rejected) to maintain audit trails and recovery capability.
 * Reads are handled via real-time listeners in the dashboard data layer.
 */

import { db } from "../../firebase";
import {
  runTransaction,
  doc,
  collection,
  updateDoc,
  deleteDoc,
  deleteField,
  arrayUnion,
} from "firebase/firestore";
import { buildStudentRecord } from "./studentRecord";
import { getBatchAvailability } from "../classes/batchAvailability";
import { todayWita } from "../../utils/dateWita.js";

/**
 * Atomically approves an application, creates the canonical student record,
 * updates the application document status, and optionally enrolls the student
 * into an available class batch within a single transaction.
 */
export async function approveApplication({
  app,
  level = "warrior",
  paymentPlan = "monthly",
  classId = null,
  actorEmail = "",
}) {
  return runTransaction(db, async (transaction) => {
    // 1. Verify application exists and is pending
    const appRef = doc(db, "applications", app.id);
    const appSnap = await transaction.get(appRef);
    if (!appSnap.exists() || (appSnap.data().status || "pending") !== "pending") {
      throw new Error("This application was already processed by someone else.");
    }

    // 2. If classId is specified, read and verify class capacity
    let classData = null;
    let classRef = null;
    if (classId) {
      classRef = doc(db, "classes", classId);
      const classSnap = await transaction.get(classRef);
      if (!classSnap.exists()) {
        throw new Error("This batch is full or no longer open.");
      }
      classData = { id: classSnap.id, ...classSnap.data() };
      const { canEnroll } = getBatchAvailability(classData);
      if (!canEnroll) {
        throw new Error("This batch is full or no longer open.");
      }
    }

    // 3. Determine final academic level (batch level wins if class chosen)
    const finalLevel = classId && classData?.classLevel ? classData.classLevel : level || "warrior";
    const today = todayWita();
    const now = new Date().toISOString();

    // 4. Build canonical student record
    const studentRef = doc(collection(db, "users"));
    const studentData = buildStudentRecord({
      displayName: app.displayName,
      nickname: app.nickname,
      phone: app.phone,
      dob: app.dob,
      gender: app.gender,
      placeOfBirth: app.placeOfBirth,
      religion: app.religion,
      address: app.address,
      branch: app.branch,
      program: app.program,
      classType: app.classType,
      schoolOrJob: app.schoolOrJob,
      classOrSemester: app.classOrSemester,
      referralSource: app.referralSource,
      joinedDate: today,
      fatherName: app.fatherName,
      fatherJob: app.fatherJob,
      fatherPhone: app.fatherPhone,
      motherName: app.motherName,
      motherJob: app.motherJob,
      motherPhone: app.motherPhone,
      photoURL: app.photoURL || "",
      currentLevel: finalLevel,
      paymentPlan: paymentPlan || "monthly",
      status: "active",
    });

    // 5. Atomic writes
    transaction.set(studentRef, studentData);

    transaction.update(appRef, {
      status: "approved",
      approvedAt: now,
      approvedBy: actorEmail || "system",
      studentId: studentRef.id,
    });

    if (classId && classRef) {
      const dateJoined = classData.classStartDate || today;
      transaction.update(classRef, {
        studentIds: arrayUnion(studentRef.id),
        enrollments: arrayUnion({
          studentId: studentRef.id,
          dateJoined,
          level: finalLevel,
        }),
        updatedAt: now,
      });
    }

    return {
      id: studentRef.id,
      ...studentData,
    };
  });
}

/**
 * Soft-rejects an application, recording reason, note, and actor identity.
 */
export function archiveApplication(appId, { reason = "", note = "", actorEmail = "" } = {}) {
  return runTransaction(db, async (transaction) => {
    const appRef = doc(db, "applications", appId);
    const snap = await transaction.get(appRef);
    if (!snap.exists() || (snap.data().status || "pending") !== "pending") {
      throw new Error("This application was already processed by someone else.");
    }
    const now = new Date().toISOString();
    transaction.update(appRef, {
      status: "rejected",
      rejectedAt: now,
      rejectedBy: actorEmail || "system",
      rejectedReason: reason || "",
      rejectedNote: note || "",
    });
  });
}

/**
 * Restores a rejected application back to pending status.
 */
export function restoreApplication(appId) {
  const appRef = doc(db, "applications", appId);
  return updateDoc(appRef, {
    status: "pending",
    rejectedAt: deleteField(),
    rejectedBy: deleteField(),
    rejectedReason: deleteField(),
    rejectedNote: deleteField(),
  });
}

/**
 * Permanently deletes an application document (used only on the Rejected tab).
 */
export function deleteApplicationPermanently(appId) {
  return deleteDoc(doc(db, "applications", appId));
}
