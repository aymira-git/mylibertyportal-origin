import { db } from "../../firebase";
import { collection, getDocs, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { buildStudentRecord } from "./studentRecord";

/**
 * All direct Firestore reads/writes for student applications live here
 * instead of inside StudentApplications.jsx — same pattern as
 * classesRepository.js and paymentsRepository.js.
 */

export async function fetchApplications() {
  // Only ever pending applications live here — once a human approves or
  // rejects one, the record is deleted immediately rather than archived,
  // since the decision itself is the record that matters, not the raw
  // form submission.
  const snap = await getDocs(collection(db, "applications"));
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  list.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  return list;
}

/**
 * Approving an application both creates the real student record and
 * removes the staging application — as one atomic batch. Before this,
 * these were two separate calls: a dropped connection between them could
 * leave a duplicate-risk half-approved application (student created, but
 * the application still sitting there to possibly be approved again), or
 * the application deleted with no student record ever created.
 */
export function approveApplication(app) {
  const studentRef = doc(collection(db, "users"));
  const batch = writeBatch(db);

  batch.set(studentRef, buildStudentRecord({
    displayName: app.displayName,
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
    joinedDate: new Date().toISOString().split("T")[0],
    fatherName: app.fatherName,
    fatherJob: app.fatherJob,
    fatherPhone: app.fatherPhone,
    motherName: app.motherName,
    motherJob: app.motherJob,
    motherPhone: app.motherPhone,
    photoURL: app.photoURL || "",
  }));
  batch.delete(doc(db, "applications", app.id));

  return batch.commit();
}

export function rejectApplication(appId) {
  return deleteDoc(doc(db, "applications", appId));
}
