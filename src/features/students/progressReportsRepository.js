import { db } from "../../firebase";
import { addDoc, collection, getDocs, query, where } from "firebase/firestore";

/**
 * Firestore read and write operations for progress reports.
 */
export function createProgressReport(report) {
  return addDoc(collection(db, "progressReports"), report);
}

export async function fetchInstructorProgressReports(instructorId) {
  if (!instructorId) return [];
  const q = query(
    collection(db, "progressReports"),
    where("instructorId", "==", instructorId)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => new Date(b.examDate || b.submittedAt || 0) - new Date(a.examDate || a.submittedAt || 0));
}
