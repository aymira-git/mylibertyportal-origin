import { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import { collection, query, where, onSnapshot, doc } from "firebase/firestore";

/**
 * Live classes + students for the signed-in instructor.
 *
 * Both tabs of InstructorDashboard ("My Classes" and "Student Progress")
 * used to run the same two queries separately, as one-time fetches. That
 * meant the same data was downloaded twice per visit, and an instructor
 * had to reload the page to see a student an admin had just enrolled.
 * One hook, three listeners, shared by both tabs.
 *
 * Returns the raw classes and the full student list — each tab narrows
 * them differently, so the filtering stays with the component that needs
 * it rather than being baked in here.
 */
export function useInstructorRoster() {
  // Read once, at mount, via a lazy initializer — same signed-in user for
  // the lifetime of this screen, so there's nothing to resubscribe to if
  // it changed mid-visit. Deriving `loading`/`error`'s initial value from
  // it means the "signed out" case doesn't need to setState inside the
  // effect below at all.
  const [uid] = useState(() => auth.currentUser?.uid || null);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [instructorName, setInstructorName] = useState("");
  const [loading, setLoading] = useState(() => Boolean(uid));
  const [error, setError] = useState(() =>
    uid ? "" : "You appear to be signed out. Please log in again."
  );

  useEffect(() => {
    if (!uid) return;

    // Classes drive the loading state — they're what the UI blocks on, and
    // what the "no classes assigned yet" message is decided from.
    const unsubClasses = onSnapshot(
      query(collection(db, "classes"), where("instructorId", "==", uid)),
      snap => {
        setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      err => {
        console.error("instructor classes listener:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    const unsubStudents = onSnapshot(
      query(collection(db, "users"), where("role", "==", "student")),
      snap => setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => {
        console.error("instructor students listener:", err);
        setError(err.message);
      }
    );

    const unsubMe = onSnapshot(
      doc(db, "users", uid),
      snap => setInstructorName(snap.exists() ? (snap.data().displayName || "") : ""),
      err => console.error("instructor profile listener:", err)
    );

    return () => { unsubClasses(); unsubStudents(); unsubMe(); };
  }, [uid]);

  return { uid, classes, students, instructorName, loading, error };
}
