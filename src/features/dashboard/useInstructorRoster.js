import { useState, useEffect, useRef } from "react";
import { auth, db } from "../../firebase";
import { collection, query, where, onSnapshot, doc, documentId } from "firebase/firestore";

/**
 * Extracts a unique list of enrolled student IDs from class documents,
 * safely handling both modern cls.studentIds and legacy cls.enrollments.
 * @param {Array} classList
 * @returns {string[]}
 */
export function extractEnrolledStudentIds(classList = []) {
  const ids = new Set();
  classList.forEach((cls) => {
    if (Array.isArray(cls.studentIds)) {
      cls.studentIds.forEach((id) => id && typeof id === "string" && ids.add(id));
    }
    if (Array.isArray(cls.enrollments)) {
      cls.enrollments.forEach((e) => e?.studentId && ids.add(e.studentId));
    }
  });
  return Array.from(ids);
}

/**
 * Live classes + enrolled students for the signed-in instructor.
 *
 * Spark Plan Optimization:
 * Instead of subscribing to the entire 'users' collection (which downloads
 * all 1,000+ students across the school), this hook derives enrolled student
 * IDs from the instructor's assigned classes and only queries those specific
 * documents in chunks of 30.
 */
export function useInstructorRoster() {
  const [uid] = useState(() => auth.currentUser?.uid || null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [instructorName, setInstructorName] = useState("");
  const [instructorRole, setInstructorRole] = useState("");
  const [instructorBranch, setInstructorBranch] = useState("");
  const [loading, setLoading] = useState(() => Boolean(uid));
  const [error, setError] = useState(() =>
    uid ? "" : "You appear to be signed out. Please log in again."
  );

  const studentUnsubsRef = useRef([]);
  const studentChunksDataRef = useRef(new Map()); // chunkIndex -> array of students
  const activeStudentIdsKeyRef = useRef("");

  useEffect(() => {
    if (!uid) return;

    let primaryClasses = [];
    let subClasses = [];

    const cleanupStudentListeners = () => {
      studentUnsubsRef.current.forEach((unsub) => {
        try {
          unsub();
        } catch (unsubErr) {
          console.warn("Error unsubscribing student listener:", unsubErr);
        }
      });
      studentUnsubsRef.current = [];
      studentChunksDataRef.current.clear();
      activeStudentIdsKeyRef.current = "";
    };

    const syncEnrolledStudents = (allAssignedClasses) => {
      const enrolledIds = extractEnrolledStudentIds(allAssignedClasses);
      const enrolledKey = enrolledIds.slice().sort().join(",");

      // Skip resubscribing if the enrolled student IDs have not changed
      if (enrolledKey === activeStudentIdsKeyRef.current) return;
      activeStudentIdsKeyRef.current = enrolledKey;

      // Clean up previous listeners
      studentUnsubsRef.current.forEach((unsub) => {
        try {
          unsub();
        } catch (unsubErr) {
          console.warn("Error unsubscribing student listener:", unsubErr);
        }
      });
      studentUnsubsRef.current = [];
      studentChunksDataRef.current.clear();

      if (enrolledIds.length === 0) {
        setStudents([]);
        return;
      }

      // Firestore 'in' query allows up to 30 items per query
      const CHUNK_SIZE = 30;
      const chunks = [];
      for (let i = 0; i < enrolledIds.length; i += CHUNK_SIZE) {
        chunks.push(enrolledIds.slice(i, i + CHUNK_SIZE));
      }

      chunks.forEach((chunk, chunkIndex) => {
        const unsub = onSnapshot(
          query(collection(db, "users"), where(documentId(), "in", chunk)),
          (snap) => {
            const chunkDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            studentChunksDataRef.current.set(chunkIndex, chunkDocs);

            // Merge all chunks into single student list
            const combined = [];
            for (const docs of studentChunksDataRef.current.values()) {
              combined.push(...docs);
            }
            setStudents(combined);
          },
          (err) => {
            console.error("instructor enrolled students listener error:", err);
          }
        );
        studentUnsubsRef.current.push(unsub);
      });
    };

    const mergeClasses = () => {
      const map = new Map();
      primaryClasses.forEach((cls) => map.set(cls.id, cls));
      subClasses.forEach((cls) => map.set(cls.id, cls));
      const merged = Array.from(map.values());
      setClasses(merged);
      setLoading(false);
      syncEnrolledStudents(merged);
    };

    const unsubClasses = onSnapshot(
      query(collection(db, "classes"), where("instructorId", "==", uid)),
      (snap) => {
        primaryClasses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        mergeClasses();
      },
      (err) => {
        console.error("instructor classes listener:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    const unsubSubClasses = onSnapshot(
      query(collection(db, "classes"), where("substituteInstructorId", "==", uid)),
      (snap) => {
        subClasses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        mergeClasses();
      },
      (err) => {
        console.error("instructor substitute classes listener:", err);
      }
    );

    const unsubMe = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setInstructorName(data.displayName || "");
          setInstructorRole(data.role || "");
          setInstructorBranch(data.branch || data.branchId || "");
        } else {
          setInstructorName("");
          setInstructorRole("");
          setInstructorBranch("");
        }
      },
      (err) => console.error("instructor profile listener:", err)
    );

    return () => {
      unsubClasses();
      unsubSubClasses();
      cleanupStudentListeners();
      unsubMe();
    };
  }, [uid]);

  return {
    uid,
    classes,
    students,
    instructorName,
    instructorRole,
    instructorBranch,
    loading,
    error,
  };
}
