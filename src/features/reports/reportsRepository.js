import { auth, db } from "../../firebase";
import { collection, getDocs, getDoc, doc, query, where } from "firebase/firestore";
import { isShiftStale, autoCloseShift } from "../attendance";

/**
 * All direct Firestore reads for the Reports dashboard live here instead
 * of inside ReportsDashboard.jsx. This domain is read-only from the
 * dashboard's point of view — the one exception is auto-closing stale
 * shifts while loading them, which reuses the same autoCloseShift write
 * the attendance Kiosk already uses, not a new write path.
 *
 * These functions return raw arrays of plain data. All the filtering,
 * grouping, and shaping of what the dashboard actually displays stays in
 * ReportsDashboard.jsx — same boundary as every other repository in this
 * app: this file only owns "what's in the database," not "how it's
 * presented."
 */

async function autoCloseStaleShifts(shifts) {
  const updated = [];
  for (const s of shifts) {
    if (isShiftStale(s)) {
      try {
        const estimatedClockOut = await autoCloseShift(s);
        updated.push({ ...s, clockOut: estimatedClockOut, autoClosed: true });
      } catch (err) {
        console.error("Failed to auto-close shift", s.id, err);
        updated.push(s);
      }
    } else {
      updated.push(s);
    }
  }
  return updated;
}

/**
 * `shifts` and `attendance` are the only two collections in this app that
 * grow without limit — one document per clock-in, per person, per day,
 * forever. Everything else is bounded by the size of the school. Reading
 * them whole was fine in month one and gets steadily more expensive every
 * month after, so both are now read through a date window.
 *
 * `since` is an ISO date string (or null for "everything"). It compares
 * against `clockIn` / `timestamp`, which are stored as ISO strings —
 * lexicographic order matches chronological order for that format, so a
 * plain >= works without touching the schema.
 */

export async function fetchStaffShifts(isAdminView, since = null) {
  const shiftsRef = collection(db, "shifts");
  const filters = [];
  if (!isAdminView) filters.push(where("userId", "==", auth.currentUser?.uid));
  if (since) filters.push(where("clockIn", ">=", since));

  // Still-open shifts are fetched separately and WITHOUT the date window.
  // An unclosed shift from before the window would otherwise never be seen
  // by the auto-close pass below and would stay open forever. There are
  // only ever a handful of these, so it's a cheap extra query.
  const openFilters = [where("clockOut", "==", null)];
  if (!isAdminView) openFilters.push(where("userId", "==", auth.currentUser?.uid));

  const [shiftsSnap, openSnap] = await Promise.all([
    getDocs(filters.length ? query(shiftsRef, ...filters) : shiftsRef),
    getDocs(query(shiftsRef, ...openFilters)),
  ]);

  const byId = new Map();
  [...shiftsSnap.docs, ...openSnap.docs].forEach(d => byId.set(d.id, d));
  const shiftDocs = [...byId.values()];

  const existingUserIds = new Set();

  if (isAdminView) {
    const usersSnap = await getDocs(collection(db, "users"));
    usersSnap.docs.forEach(userDoc => existingUserIds.add(userDoc.id));
  } else if (auth.currentUser?.uid) {
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (userDoc.exists()) existingUserIds.add(userDoc.id);
  }

  const raw = shiftDocs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(shift => existingUserIds.has(shift.userId))
    .sort((a, b) => (b.clockIn || "").localeCompare(a.clockIn || ""));
  return autoCloseStaleShifts(raw);
}

export async function fetchStudentProgressData(isAdminView, isFrontOffice, since = null) {
  const classesQuery = isAdminView || isFrontOffice
    ? collection(db, "classes")
    : query(collection(db, "classes"), where("instructorId", "==", auth.currentUser?.uid));
  const progressQuery = isAdminView || isFrontOffice
    ? collection(db, "progressReports")
    : query(collection(db, "progressReports"), where("instructorId", "==", auth.currentUser?.uid));
  // Admin can read the full users collection unfiltered (their role
  // grants that outright). An instructor can only read documents where
  // role == "student" — but Firestore requires the QUERY itself to carry
  // that same filter, or it rejects the whole request rather than
  // silently returning a partial result.
  const usersQuery = isAdminView
    ? collection(db, "users")
    : query(collection(db, "users"), where("role", "in", isFrontOffice ? ["student", "instructor"] : ["student"]));

  const [usersSnap, classesSnap, attendanceSnap, progressSnap] = await Promise.all([
    getDocs(usersQuery),
    getDocs(classesQuery),
    getDocs(since
      ? query(collection(db, "attendance"), where("timestamp", ">=", since))
      : collection(db, "attendance")),
    getDocs(progressQuery),
  ]);

  return {
    users: usersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    classes: classesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    attendance: attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    progress: progressSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };
}

export async function fetchInstructorAnalyticsData(isAdminView, uid) {
  // Admin sees every instructor's classes and shifts. An instructor
  // viewing their own analytics only ever fetches their own — there's no
  // reason (or permission) for them to see colleagues'.
  const classesQuery = isAdminView
    ? collection(db, "classes")
    : query(collection(db, "classes"), where("instructorId", "==", uid));
  const shiftsQuery = isAdminView
    ? collection(db, "shifts")
    : query(collection(db, "shifts"), where("userId", "==", uid));

  const [classesSnap, shiftsSnap] = await Promise.all([
    getDocs(classesQuery),
    getDocs(shiftsQuery),
  ]);

  let instructors;
  if (isAdminView) {
    const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "instructor")));
    instructors = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } else {
    // Non-admins can't query for OTHER instructors' profiles at all —
    // only their own doc is readable. That's all this view needs anyway.
    const selfDoc = await getDoc(doc(db, "users", uid));
    instructors = selfDoc.exists() ? [{ id: selfDoc.id, ...selfDoc.data() }] : [];
  }

  return {
    classes: classesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    shifts: shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    instructors,
  };
}
