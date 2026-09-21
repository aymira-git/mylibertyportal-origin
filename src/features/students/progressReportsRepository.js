import { db } from "../../firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { getStars } from "../shared/levels";

/**
 * Firestore read and write operations for progress reports.
 */
export function createProgressReport(report) {
  return addDoc(collection(db, "progressReports"), report);
}

export async function fetchInstructorProgressReports(instructorId) {
  if (!instructorId) return [];
  const q = query(collection(db, "progressReports"), where("instructorId", "==", instructorId));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort(
      (a, b) =>
        new Date(b.examDate || b.submittedAt || 0) - new Date(a.examDate || a.submittedAt || 0)
    );
}

export async function fetchPendingPromotions() {
  const q = query(collection(db, "progressReports"), where("eligibleForPromotion", "==", true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function clearPromotionEligibility(reportId) {
  if (!reportId) return;
  const reportRef = doc(db, "progressReports", reportId);
  await updateDoc(reportRef, {
    eligibleForPromotion: false,
    promotedAt: serverTimestamp(),
  });
}

export async function promoteStudentLevel(studentId, nextLevel, reportId = null) {
  if (!studentId || !nextLevel) return;
  const studentRef = doc(db, "users", studentId);
  const stars = getStars(nextLevel);
  await updateDoc(studentRef, {
    currentLevel: nextLevel,
    rating: String(stars || 1),
    updatedAt: serverTimestamp(),
  });

  if (reportId) {
    await clearPromotionEligibility(reportId);
  }
}
