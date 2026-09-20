import { auth, db } from "../../firebase";
import { collection, getDocs, getDoc, doc, query, where } from "firebase/firestore";

/**
 * All direct Firestore reads for the Reports domain live here.
 */

export async function fetchStaffShifts(isAdminView, since = null) {
  const shiftsRef = collection(db, "shifts");
  const filters = [];
  if (!isAdminView) filters.push(where("userId", "==", auth.currentUser?.uid));
  if (since) filters.push(where("clockIn", ">=", since));

  const openFilters = [where("clockOut", "==", null)];
  if (!isAdminView) openFilters.push(where("userId", "==", auth.currentUser?.uid));

  const [shiftsSnap, openSnap] = await Promise.all([
    getDocs(filters.length ? query(shiftsRef, ...filters) : shiftsRef),
    getDocs(query(shiftsRef, ...openFilters)),
  ]);

  const byId = new Map();
  [...shiftsSnap.docs, ...openSnap.docs].forEach(d => byId.set(d.id, d));
  const shiftDocs = [...byId.values()];

  const existingUsersMap = new Map();

  if (isAdminView) {
    const usersSnap = await getDocs(collection(db, "users"));
    usersSnap.docs.forEach(u => existingUsersMap.set(u.id, { id: u.id, ...u.data() }));
  } else if (auth.currentUser?.uid) {
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    if (userDoc.exists()) existingUsersMap.set(userDoc.id, { id: userDoc.id, ...userDoc.data() });
  }

  // Fetch leaves if admin or user
  let leaves = [];
  try {
    const leaveQuery = isAdminView
      ? collection(db, "staffLeave")
      : query(collection(db, "staffLeave"), where("userId", "==", auth.currentUser?.uid));
    const leaveSnap = await getDocs(leaveQuery);
    leaves = leaveSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn("staffLeave query error (ignored):", err);
  }

  const raw = shiftDocs
    .map(d => {
      const data = d.data();
      const user = existingUsersMap.get(data.userId);
      return {
        id: d.id,
        ...data,
        branch: user?.branch || data.branch || "Cabang Utama",
      };
    })
    .filter(shift => existingUsersMap.has(shift.userId))
    .sort((a, b) => (b.clockIn || "").localeCompare(a.clockIn || ""));

  const staffMembers = Array.from(existingUsersMap.values()).filter(
    u => u.role && u.role !== "student"
  );

  return { shifts: raw, staffMembers, leaves };
}

export async function fetchTodayScansData(sinceWitaIso, isAdminView, isFrontOffice) {
  const attendanceQuery = query(
    collection(db, "attendance"),
    where("timestamp", ">=", sinceWitaIso)
  );

  const classesQuery = isAdminView || isFrontOffice
    ? collection(db, "classes")
    : query(collection(db, "classes"), where("instructorId", "==", auth.currentUser?.uid));

  const usersQuery = isAdminView
    ? collection(db, "users")
    : query(collection(db, "users"), where("role", "in", isFrontOffice ? ["student", "instructor"] : ["student"]));

  const [attendanceSnap, classesSnap, usersSnap] = await Promise.all([
    getDocs(attendanceQuery),
    getDocs(classesQuery),
    getDocs(usersQuery),
  ]);

  return {
    scans: attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    classes: classesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    students: usersSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.role === "student"),
  };
}

export async function fetchStudentProgressData(isAdminView, isFrontOffice, since = null) {
  const classesQuery = isAdminView || isFrontOffice
    ? collection(db, "classes")
    : query(collection(db, "classes"), where("instructorId", "==", auth.currentUser?.uid));
  const progressQuery = isAdminView || isFrontOffice
    ? collection(db, "progressReports")
    : query(collection(db, "progressReports"), where("instructorId", "==", auth.currentUser?.uid));
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

export async function fetchAdmissionsReportData(since = null) {
  const appQuery = since
    ? query(collection(db, "applications"), where("submittedAt", ">=", since))
    : collection(db, "applications");

  const [appsSnap, classesSnap] = await Promise.all([
    getDocs(appQuery),
    getDocs(collection(db, "classes")),
  ]);

  return {
    applications: appsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    classes: classesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
  };
}

export async function fetchInstructorAnalyticsData(isAdminView, uid) {
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
    const selfDoc = await getDoc(doc(db, "users", uid));
    instructors = selfDoc.exists() ? [{ id: selfDoc.id, ...selfDoc.data() }] : [];
  }

  return {
    classes: classesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    shifts: shiftsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    instructors,
  };
}
