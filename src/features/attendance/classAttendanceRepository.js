import { db } from "../../firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { classAttendanceSchema } from "../../schemas/classAttendanceSchema.js";

/**
 * Returns deterministic document ID for a class attendance record.
 * Scheme: {classId}_{studentId}_{attendanceDate}
 *
 * @param {string} classId
 * @param {string} studentId
 * @param {string} attendanceDate - YYYY-MM-DD
 * @returns {string}
 */
export function getClassAttendanceDocId(classId, studentId, attendanceDate) {
  return `${classId}_${studentId}_${attendanceDate}`;
}

/**
 * Fetches all attendance records for a specific class on a date.
 *
 * @param {string} classId
 * @param {string} attendanceDate - YYYY-MM-DD
 * @returns {Promise<Array<any>>}
 */
export async function fetchClassAttendance(classId, attendanceDate) {
  if (!classId || !attendanceDate) return [];
  const q = query(
    collection(db, "classAttendance"),
    where("classId", "==", classId),
    where("attendanceDate", "==", attendanceDate)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Subscribes to real-time attendance records for a class on a date.
 * Bounded query: scoped to one class and one date (typically 5–30 students).
 *
 * @param {string} classId
 * @param {string} attendanceDate - YYYY-MM-DD
 * @param {(records: Array<object>) => void} onData
 * @param {(err: Error) => void} [onError]
 * @returns {() => void} Unsubscribe function
 */
export function subscribeClassAttendance(classId, attendanceDate, onData, onError) {
  if (!classId || !attendanceDate) {
    onData([]);
    return () => {};
  }
  const q = query(
    collection(db, "classAttendance"),
    where("classId", "==", classId),
    where("attendanceDate", "==", attendanceDate)
  );
  return onSnapshot(
    q,
    (snap) => {
      const records = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      onData(records);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

/**
 * Fetches attendance history for a single student within a date window.
 *
 * @param {string} studentId
 * @param {string} dateFrom - YYYY-MM-DD
 * @param {string} [dateTo] - YYYY-MM-DD
 * @returns {Promise<Array<any>>}
 */
export async function fetchClassAttendanceForStudent(studentId, dateFrom, dateTo) {
  if (!studentId) return [];
  const constraints = [
    where("studentId", "==", studentId),
  ];
  if (dateFrom) {
    constraints.push(where("attendanceDate", ">=", dateFrom));
  }
  if (dateTo) {
    constraints.push(where("attendanceDate", "<=", dateTo));
  }
  const q = query(collection(db, "classAttendance"), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Records student attendance via QR scan.
 * Idempotent & non-destructive:
 * - If record already exists: returns `{ status: "exists", record }` and does NOT overwrite.
 * - If no record exists: creates PRESENT / SCAN record.
 *
 * @param {object} params
 * @param {string} params.classId
 * @param {string} params.studentId
 * @param {string} params.attendanceDate
 * @param {string} params.markedBy
 * @param {string} [params.markedByName]
 * @param {string} [params.studentName]
 * @param {string} [params.className]
 * @param {string} [params.branchId]
 * @returns {Promise<{ status: "created" | "exists", record: any }>}
 */
export async function recordClassAttendanceScan({
  classId,
  studentId,
  attendanceDate,
  markedBy,
  markedByName = "",
  studentName = "",
  className = "",
  branchId = "",
}) {
  const docId = getClassAttendanceDocId(classId, studentId, attendanceDate);
  const docRef = doc(db, "classAttendance", docId);
  const existingSnap = await getDoc(docRef);

  if (existingSnap.exists()) {
    return {
      status: "exists",
      record: { id: docId, ...existingSnap.data() },
    };
  }

  const nowIso = new Date().toISOString();
  const rawData = {
    classId,
    studentId,
    attendanceDate,
    status: "PRESENT",
    method: "SCAN",
    markedBy,
    markedByName,
    markedAt: nowIso,
    studentName,
    className,
    branchId,
    note: "",
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const validatedData = classAttendanceSchema.parse(rawData);
  await setDoc(docRef, validatedData);

  return {
    status: "created",
    record: { id: docId, ...validatedData },
  };
}

/**
 * Applies a manual attendance correction or manual entry.
 * Sets method to "MANUAL" and updates markedBy/markedAt/updatedAt.
 * Manual corrections take precedence over scans.
 *
 * @param {object} params
 * @param {string} params.classId
 * @param {string} params.studentId
 * @param {string} params.attendanceDate
 * @param {"PRESENT" | "ABSENT" | "LATE" | "EXCUSED"} params.status
 * @param {string} [params.note]
 * @param {string} params.markedBy
 * @param {string} [params.markedByName]
 * @param {string} [params.studentName]
 * @param {string} [params.className]
 * @param {string} [params.branchId]
 * @returns {Promise<{ status: "updated" | "created", record: any }>}
 */
export async function updateClassAttendanceManual({
  classId,
  studentId,
  attendanceDate,
  status,
  note = "",
  markedBy,
  markedByName = "",
  studentName = "",
  className = "",
  branchId = "",
}) {
  const docId = getClassAttendanceDocId(classId, studentId, attendanceDate);
  const docRef = doc(db, "classAttendance", docId);
  const existingSnap = await getDoc(docRef);
  const nowIso = new Date().toISOString();

  if (existingSnap.exists()) {
    const updates = {
      status,
      note,
      method: "MANUAL",
      markedBy,
      markedByName,
      markedAt: nowIso,
      updatedAt: nowIso,
    };
    await updateDoc(docRef, updates);
    return {
      status: "updated",
      record: { id: docId, ...existingSnap.data(), ...updates },
    };
  }

  const rawData = {
    classId,
    studentId,
    attendanceDate,
    status,
    method: "MANUAL",
    markedBy,
    markedByName,
    markedAt: nowIso,
    studentName,
    className,
    branchId,
    note,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const validatedData = classAttendanceSchema.parse(rawData);
  await setDoc(docRef, validatedData);

  return {
    status: "created",
    record: { id: docId, ...validatedData },
  };
}

/**
 * Closes out attendance for a class session.
 * Creates ABSENT / CLOSE_OUT records only for enrolled students who have no record.
 * Existing records (SCAN or MANUAL) are left completely untouched.
 * Operation is idempotent.
 *
 * @param {object} params
 * @param {string} params.classId
 * @param {string} params.attendanceDate
 * @param {Array<string>} params.rosterStudentIds
 * @param {Record<string, { displayName?: string, name?: string }>} [params.studentsMap]
 * @param {string} params.markedBy
 * @param {string} [params.markedByName]
 * @param {string} [params.className]
 * @param {string} [params.branchId]
 * @returns {Promise<{ createdCount: number, missingCount: number, alreadyClosed: boolean }>}
 */
export async function closeOutClassAttendance({
  classId,
  attendanceDate,
  rosterStudentIds = [],
  studentsMap = {},
  markedBy,
  markedByName = "",
  className = "",
  branchId = "",
}) {
  if (!classId || !attendanceDate || rosterStudentIds.length === 0) {
    return { createdCount: 0, missingCount: 0, alreadyClosed: true };
  }

  const existing = await fetchClassAttendance(classId, attendanceDate);
  const existingIds = new Set(existing.map((r) => /** @type {any} */(r).studentId));

  const missingStudentIds = rosterStudentIds.filter((id) => id && !existingIds.has(id));

  if (missingStudentIds.length === 0) {
    return {
      createdCount: 0,
      missingCount: 0,
      alreadyClosed: true,
    };
  }

  const nowIso = new Date().toISOString();
  const BATCH_SIZE = 400; // Safe below Firestore's 500 limit

  for (let i = 0; i < missingStudentIds.length; i += BATCH_SIZE) {
    const chunk = missingStudentIds.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    for (const sId of chunk) {
      const docId = getClassAttendanceDocId(classId, sId, attendanceDate);
      const studentObj = studentsMap[sId] || {};
      const studentName = studentObj.displayName || studentObj.name || "";

      const raw = {
        classId,
        studentId: sId,
        attendanceDate,
        status: "ABSENT",
        method: "CLOSE_OUT",
        markedBy,
        markedByName,
        markedAt: nowIso,
        studentName,
        className,
        branchId,
        note: "Session closed out",
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      const validated = classAttendanceSchema.parse(raw);
      batch.set(doc(db, "classAttendance", docId), validated);
    }

    await batch.commit();
  }

  return {
    createdCount: missingStudentIds.length,
    missingCount: missingStudentIds.length,
    alreadyClosed: false,
  };
}
