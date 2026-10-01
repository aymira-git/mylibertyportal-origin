import { useState, useEffect, useMemo } from "react";
import { auth, db } from "../../firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useToast, useConfirm } from "../shared";
import { buildStudentRecord, isActiveStudent } from "../students";
import { createInvite, deleteInvite, createTodo, deleteTodo, toggleTodoComplete } from "../staff";
import {
  saveStudentRecord,
  updateStaffRecord,
  createStaffAccount,
  deleteUserProfile,
  createParentAccount,
  updateParentRecord,
} from "./usersRepository";
import { markInquiryConverted } from "./frontoffice/deskInquiriesRepository";
import { DEFAULT_BRANCH, normalizeBranch, matchesBranchFilter, branchToId } from "../../constants/branches";
import {
  DEFAULT_DIVISION,
  normalizeStaffDivision,
  divisionOfProgram,
  matchesDivisionFilter,
} from "../../constants/divisions";
import { getProgram, normalizeProgram } from "../../constants/programs";
import { isInstructorRole } from "../shared/roles";
import { useUserProfile } from "../shared/useUserProfile";

const emptyFormData = {
  firstName: "",
  lastName: "",
  nickname: "",
  displayName: "",
  gender: "male",
  email: "",
  password: "",
  role: "instructor",
  phone: "",
  dob: "",
  educationLevel: "SD",
  joinedDate: "",
  parentName: "",
  parentPhone: "",
  currentLevel: "warrior",
  placementTests: [],
  inquiryId: "",
  rating: "1",
  paymentPlan: "monthly",
  status: "active",
  notes: "",
  placeOfBirth: "",
  religion: "",
  address: "",
  branch: DEFAULT_BRANCH,
  division: DEFAULT_DIVISION,
  programId: "",
  program: "",
  batchType: "reguler",
  classType: "",
  schoolOrJob: "",
  classOrSemester: "",
  fatherName: "",
  fatherJob: "",
  fatherPhone: "",
  motherName: "",
  motherJob: "",
  motherPhone: "",
  referralSource: "",
  photoURL: "",
  childStudentIds: [],
};

/**
 * Shared data + handlers used by both AdminDashboard and FrontOfficeDashboard.
 * This is everything that used to live inside one AdminDashboard.jsx guarded
 * by an `isFrontOffice` flag — pulled out so the two dashboards can each be
 * a real, separate component instead of one file with branches everywhere.
 *
 * `restrictedRead: true` (Front Office) narrows the users query to match
 * what Firestore's rules actually allow it to read (student + instructor
 * docs only). This isn't optional styling — Firestore rejects a query
 * outright if it can't prove every possible result satisfies the rule, so
 * without this narrower query Front Office's whole fetch would fail, not
 * just return extra data.
 *
 * `setActiveTab` is passed in (not owned by this hook) because
 * handleEdit/handleSave need to jump the *caller's* tab state to the right
 * screen after an edit/save, and each dashboard has its own tab list.
 */
export function useDashboardData({
  restrictedRead = false,
  setActiveTab = null,
  division = null,
  branch = null,
} = {}) {
  const toast = useToast();
  const confirm = useConfirm(); // 👈 shadows native window.confirm on purpose — same call shape, styled modal, just needs "await"
  const { branch: profileBranch, loading: profileLoading } = useUserProfile();

  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [applications, setApplications] = useState([]);
  const [invites, setInvites] = useState([]);
  const [todos, setTodos] = useState([]);
  const [editId, setEditId] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [formData, setFormData] = useState(emptyFormData);

  // Each collection gets its own live listener instead of a one-time
  // fetch. Previously, staff had to manually trigger a refetch (or reload
  // the page) to see a change someone else just made — now Firestore pushes
  // updates to every open dashboard as they happen. Listening separately
  // per collection also means one collection's error (see invites below)
  // can't block the others from loading, unlike the old single try/catch.
  useEffect(() => {
    // If restrictedRead is active and no explicit branch was provided, wait until
    // profile loading finishes so we have the staff user's branch for branch isolation.
    if (restrictedRead && !branch && profileLoading) {
      return () => {};
    }

    const effectiveTargetBranch = branch || (restrictedRead ? profileBranch : null);
    const targetBranchId =
      effectiveTargetBranch && effectiveTargetBranch !== "all"
        ? branchToId(effectiveTargetBranch)
        : null;

    const handleListenerError = (name) => (err) => {
      if (err?.code === "permission-denied" || err?.message?.includes("insufficient permissions")) {
        console.warn(`${name} listener: permission denied by Firestore rules`, err.message);
      } else {
        console.error(`${name} listener:`, err);
      }
    };

    const isKindergarten = division === "kindergarten";

    let unsubUsers;
    if (isKindergarten) {
      // Split user queries to satisfy Firestore rule proof for division isolation:
      // (1) Students query: explicitly filtered by division == "kindergarten"
      // (2) Instructors query: filtered by role, branch, and kindergarten division
      // (3) Parents query: filtered by role and branch; parent docs are exempt from division checks
      const studentConstraints = [
        where("role", "==", "student"),
        where("division", "==", "kindergarten"),
      ];
      if (targetBranchId) {
        studentConstraints.push(where("branchId", "==", targetBranchId));
      }
      const studentQuery = query(collection(db, "users"), ...studentConstraints);

      const instructorConstraints = [
        where("role", "in", ["instructor", "instructorleader", "instructor_leader"]),
        where("division", "==", "kindergarten"),
      ];
      if (targetBranchId) {
        instructorConstraints.push(where("branchId", "==", targetBranchId));
      }
      const instructorQuery = query(collection(db, "users"), ...instructorConstraints);

      const parentConstraints = [where("role", "==", "parent")];
      if (targetBranchId) {
        parentConstraints.push(where("branchId", "==", targetBranchId));
      }
      const parentQuery = query(collection(db, "users"), ...parentConstraints);

      let studentsMap = new Map();
      let instructorsMap = new Map();
      let parentsMap = new Map();

      const syncMergedUsers = () => {
        const merged = new Map([...parentsMap, ...instructorsMap, ...studentsMap]);
        setUsers(Array.from(merged.values()));
      };

      const unsubStudents = onSnapshot(
        studentQuery,
        (snap) => {
          studentsMap = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
          syncMergedUsers();
        },
        handleListenerError("users-students")
      );

      const unsubInstructors = onSnapshot(
        instructorQuery,
        (snap) => {
          instructorsMap = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
          syncMergedUsers();
        },
        handleListenerError("users-instructors")
      );

      const unsubParents = onSnapshot(
        parentQuery,
        (snap) => {
          parentsMap = new Map(snap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]));
          syncMergedUsers();
        },
        handleListenerError("users-parents")
      );

      unsubUsers = () => {
        unsubStudents();
        unsubInstructors();
        unsubParents();
      };
    } else {
      const usersConstraints = [];
      if (restrictedRead) {
        // In firestore.rules, staff can list 'student', 'instructor', 'instructorleader', and 'parent'.
        // Front Office needs parents loaded to display linked parent accounts on the student roster.
        usersConstraints.push(where("role", "in", ["student", "instructor", "parent"]));
      }
      if (targetBranchId) {
        usersConstraints.push(where("branchId", "==", targetBranchId));
      }
      // Courses Front Office: do not add division server filter until backfill (R5) is done
      const usersQuery = usersConstraints.length
        ? query(collection(db, "users"), ...usersConstraints)
        : collection(db, "users");

      unsubUsers = onSnapshot(
        usersQuery,
        (snap) => setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
        handleListenerError("users")
      );
    }
    const classConstraints = [];
    if (targetBranchId) {
      classConstraints.push(where("branchId", "==", targetBranchId));
    }
    if (isKindergarten) {
      classConstraints.push(where("division", "==", "kindergarten"));
    }
    // Courses Front Office: do not add server filter until backfill (R5) is done
    const classesQuery = classConstraints.length
      ? query(collection(db, "classes"), ...classConstraints)
      : collection(db, "classes");

    const unsubClasses = onSnapshot(
      classesQuery,
      (snap) => setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      handleListenerError("classes")
    );

    const appConstraints = [];
    if (targetBranchId) {
      appConstraints.push(where("branchId", "==", targetBranchId));
    }
    if (isKindergarten) {
      appConstraints.push(where("division", "==", "kindergarten"));
    }
    // Courses Front Office: do not add server filter until backfill (R5) is done
    const applicationsQuery = appConstraints.length
      ? query(collection(db, "applications"), ...appConstraints)
      : collection(db, "applications");

    const unsubApplications = onSnapshot(
      applicationsQuery,
      (snap) => setApplications(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      handleListenerError("applications")
    );

    const todoConstraints = [];
    if (targetBranchId) {
      todoConstraints.push(where("branchId", "in", [targetBranchId, "all"]));
    }
    const todosQuery = todoConstraints.length
      ? query(collection(db, "todos"), ...todoConstraints)
      : collection(db, "todos");

    const unsubTodos = onSnapshot(
      todosQuery,
      (snap) => {
        const list = snap.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() }));
        if (division === "kindergarten") {
          setTodos(list.filter((t) => !t.division || t.division === "all" || t.division === "kindergarten"));
        } else {
          setTodos(list);
        }
      },
      handleListenerError("todos")
    );
    const inviteConstraints = [];
    if (targetBranchId) {
      inviteConstraints.push(where("branchId", "==", targetBranchId));
    }
    const invitesQuery = inviteConstraints.length
      ? query(collection(db, "invites"), ...inviteConstraints)
      : collection(db, "invites");

    const unsubInvites = onSnapshot(
      invitesQuery,
      (snap) => setInvites(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      handleListenerError("invites")
    );

    return () => {
      unsubUsers();
      unsubClasses();
      unsubApplications();
      unsubTodos();
      unsubInvites();
    };
  }, [restrictedRead, branch, profileBranch, profileLoading, division]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      let savedRecord = null;
      if (formData.role === "student") {
        const studentDisplayName =
          formData.displayName?.trim() || `${formData.firstName} ${formData.lastName}`.trim();
        const studentData = buildStudentRecord({
          displayName: studentDisplayName,
          nickname: formData.nickname,
          gender: formData.gender,
          phone: formData.phone,
          dob: formData.dob,
          placeOfBirth: formData.placeOfBirth,
          religion: formData.religion,
          address: formData.address,
          branch: formData.branch,
          division: formData.division,
          programId: formData.programId,
          program: formData.program,
          batchType: formData.batchType || formData.classType || "reguler",
          classType: formData.classType,
          schoolOrJob: formData.schoolOrJob,
          classOrSemester: formData.classOrSemester,
          joinedDate: formData.joinedDate,
          fatherName: formData.fatherName,
          fatherJob: formData.fatherJob,
          fatherPhone: formData.fatherPhone,
          motherName: formData.motherName,
          motherJob: formData.motherJob,
          motherPhone: formData.motherPhone,
          parentName: formData.parentName,
          parentPhone: formData.parentPhone,
          referralSource: formData.referralSource,
          photoURL: formData.photoURL,
          currentLevel: formData.currentLevel || "warrior",
          placementTests: Array.isArray(formData.placementTests) ? formData.placementTests : [],
          inquiryId: formData.inquiryId || "",
          rating: formData.rating,
          paymentPlan: formData.paymentPlan || "monthly",
          status: formData.status || "active",
          notes: formData.notes,
        });

        const savedResult = await saveStudentRecord(editId, studentData);
        const studentId =
          editId ||
          (savedResult && typeof savedResult === "object" && "id" in savedResult
            ? String(savedResult.id)
            : null);
        if (formData.inquiryId && studentId) {
          try {
            await markInquiryConverted(formData.inquiryId, studentId);
          } catch (convErr) {
            console.error("Failed linking inquiry to new student:", convErr);
            toast("Student registered, but linking the inquiry record failed: " + convErr.message, "warning");
          }
        }
        savedRecord = { id: studentId, ...studentData };
      } else if (formData.role === "parent") {
        const parentDisplayName =
          formData.displayName?.trim() ||
          `${formData.firstName || ""} ${formData.lastName || ""}`.trim() ||
          "";
        const parentData = {
          displayName: parentDisplayName,
          phone: formData.phone || "",
          branch: formData.branch,
          branchId: formData.branchId || branchToId(formData.branch),
          status: formData.status || "active",
        };

        if (editId) {
          await updateParentRecord(editId, parentData);
          savedRecord = { id: editId, ...parentData, role: "parent" };
        } else {
          const createData = { ...parentData, email: formData.email };
          const newParentUid = await createParentAccount(formData.email, formData.password, createData);
          savedRecord = { id: newParentUid, ...createData, role: "parent" };
        }
      } else {
        const staffDisplayName =
          `${formData.firstName} ${formData.lastName}`.trim() || formData.displayName?.trim() || "";
        const staffData = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          nickname: formData.nickname,
          gender: formData.gender,
          displayName: staffDisplayName,
          role: formData.role,
          phone: formData.phone,
          dob: formData.dob,
          educationLevel: formData.educationLevel,
          email: formData.email,
          branch: normalizeBranch(formData.branch),
          division: normalizeStaffDivision(formData.division, formData.role),
          status: formData.status || "active",
          photoURL: formData.photoURL || "",
        };

        if (editId) {
          await updateStaffRecord(editId, staffData);
          savedRecord = { id: editId, ...staffData };
        } else {
          const newStaffUid = await createStaffAccount(formData.email, formData.password, staffData);
          savedRecord = { id: newStaffUid, ...staffData };
        }
      }

      toast(
        editId
          ? "Profile updated!"
          : formData.role === "student"
            ? "Student added to roster!"
            : formData.role === "parent"
              ? "Parent account created!"
              : "Account created!"
      );
      setEditId(null);
      setFormData(emptyFormData);
      setActiveTab?.(
        formData.role === "student" || formData.role === "parent" ? "students" : "directory"
      );
      return savedRecord;
    } catch (err) {
      toast(err.message, "error");
      return null;
    }
  };

  const handleAddStaff = () => {
    setEditId(null);
    setFormData({
      ...emptyFormData,
      division: division || DEFAULT_DIVISION,
    });
    setActiveTab?.("addUser");
  };

  const handleAddStudent = (prefill = {}) => {
    setEditId(null);
    const effectiveDivision = prefill.division || division;
    const isKindergarten = effectiveDivision === "kindergarten";
    const defaultProgramId = isKindergarten ? "kids_school" : "english_course";
    const defaultProg = getProgram(prefill.programId || defaultProgramId);
    setFormData({
      ...emptyFormData,
      role: "student",
      division: isKindergarten ? "kindergarten" : "courses",
      programId: defaultProg?.id || defaultProgramId,
      program:
        defaultProg?.label ||
        (isKindergarten ? "Kids School (Kindergarten)" : "English Course"),
      currentLevel: isKindergarten ? "nursery" : "warrior",
      paymentPlan: "monthly",
      status: "active",
      ...prefill,
    });
    setActiveTab?.("addUser");
  };

  const handleEdit = (user) => {
    setEditId(user.id);
    const canonicalProg = user.programId
      ? getProgram(user.programId)
      : user.program
        ? getProgram(normalizeProgram(user.program))
        : null;

    setFormData({
      firstName: user.firstName || user.displayName?.split(" ")[0] || "",
      lastName: user.lastName || user.displayName?.split(" ").slice(1).join(" ") || "",
      displayName: user.displayName || "",
      nickname: user.nickname || "",
      gender: user.gender || "male",
      email: user.email || "",
      password: "PREFILLED_PASSWORD",
      role: user.role || "student",
      phone: user.phone || "",
      dob: user.dob || "",
      educationLevel: user.educationLevel || "SD",
      joinedDate: user.joinedDate || "",
      parentName: user.parentName || user.fatherName || user.motherName || "",
      parentPhone: user.parentPhone || user.fatherPhone || user.motherPhone || "",
      currentLevel: user.currentLevel || "warrior",
      placementTests: Array.isArray(user.placementTests) ? user.placementTests : [],
      inquiryId: user.inquiryId || "",
      paymentPlan: user.paymentPlan || "monthly",
      status: user.status || "active",
      rating: user.rating || "1",
      notes: user.notes || "",
      placeOfBirth: user.placeOfBirth || "",
      religion: user.religion || "",
      address: user.address || "",
      branch: normalizeBranch(user.branch),
      division: normalizeStaffDivision(
        user.division || (user.role === "student" ? divisionOfProgram(canonicalProg?.id || user.programId || user.program) : "courses"),
        user.role
      ),
      programId: canonicalProg?.id || user.programId || "",
      program: canonicalProg?.label || user.program || "",
      batchType: user.batchType || user.classType || "reguler",
      classType: user.classType || "",
      schoolOrJob: user.schoolOrJob || "",
      classOrSemester: user.classOrSemester || "",
      fatherName: user.fatherName || "",
      fatherJob: user.fatherJob || "",
      fatherPhone: user.fatherPhone || "",
      motherName: user.motherName || "",
      motherJob: user.motherJob || "",
      motherPhone: user.motherPhone || "",
      referralSource: user.referralSource || "",
      photoURL: user.photoURL || "",
      childStudentIds: Array.isArray(user.childStudentIds) ? [...user.childStudentIds] : [],
    });
    setActiveTab?.("addUser");
  };

  const handleDelete = async (uid, { skipConfirm = false } = {}) => {
    const user = users.find((profile) => profile.id === uid);
    if (!user) return;
    if (
      !skipConfirm &&
      !(await confirm(`Are you sure you want to delete ${user.displayName || "this profile"}?`))
    )
      return;

    try {
      const targetBranchId = user.branchId || (user.branch ? branchToId(user.branch) : null);
      await deleteUserProfile(uid, targetBranchId);
      if (!skipConfirm) {
        if (user.role === "student") {
          toast("Student roster profile deleted.");
        } else {
          toast(
            "Staff profile deleted from Firestore. The Firebase Auth account still exists and must be deleted separately in Firebase Console before this email can be registered again."
          );
        }
      }
    } catch (err) {
      toast("Unable to delete profile: " + err.message, "error");
      throw err;
    }
  };

  const handleAddTodo = async (todoData) => {
    const isDirective = todoData?.type === "directive";
    try {
      await createTodo({
        ...todoData,
        division: division && division !== "all" ? division : "all",
      });
      toast(
        isDirective ? "Directive issued successfully." : "Task created successfully.",
        "success"
      );
      return true;
    } catch (err) {
      toast(
        `Failed to create ${isDirective ? "directive" : "task"}: ` + err.message,
        "error"
      );
      return false;
    }
  };

  const handleToggleTodo = async (todoId, completed) => {
    try {
      await toggleTodoComplete(todoId, completed, auth.currentUser);
    } catch (err) {
      toast("Error updating task: " + err.message, "error");
    }
  };

  const handleDeleteTodo = async (todoId) => {
    try {
      await deleteTodo(todoId);
      toast("Task deleted.", "info");
    } catch (err) {
      toast("Error deleting task: " + err.message, "error");
    }
  };

  const handleCreateInvite = async (
    email,
    role,
    branch = DEFAULT_BRANCH,
    division = DEFAULT_DIVISION
  ) => {
    try {
      await createInvite(email, role, branch, division);
      toast("Invitation link generated successfully!", "success");
      return true;
    } catch (err) {
      toast("Failed to generate invitation: " + err.message, "error");
      return false;
    }
  };

  const handleDeleteInvite = async (id, email = "") => {
    const message = email
      ? `Cancel and revoke invitation for ${email}?`
      : "Cancel and revoke this invitation?";
    if (!(await confirm(message))) return;
    try {
      await deleteInvite(id);
      toast("Invitation revoked.", "info");
    } catch (err) {
      toast("Error revoking invitation: " + err.message, "error");
    }
  };

  const getStudentClasses = (studentId) => {
    return classes
      .filter((c) => (c.studentIds || []).includes(studentId))
      .map((c) => ({
        className: c.className,
        instructorName: users.find((u) => u.id === c.instructorId)?.displayName || "Unassigned",
        dateJoined: (c.enrollments || []).find((e) => e.studentId === studentId)?.dateJoined || "",
      }));
  };

  const currentStaffProfile = useMemo(
    () => users.find((u) => u.id === auth.currentUser?.uid),
    [users]
  );
  const effectiveBranch = branch || profileBranch || normalizeBranch(currentStaffProfile?.branch);

  const scopedClasses = useMemo(() => {
    let list = classes;
    if (division && division !== "all") {
      list = list.filter((c) =>
        matchesDivisionFilter(c.division || divisionOfProgram(c.programId || c.program), division)
      );
    }
    if (effectiveBranch && effectiveBranch !== "all") {
      list = list.filter((c) => matchesBranchFilter(c.branch, effectiveBranch));
    }
    return list;
  }, [classes, division, effectiveBranch]);

  const scopedApplications = useMemo(() => {
    let list = applications;
    if (division && division !== "all") {
      list = list.filter((a) =>
        matchesDivisionFilter(a.division || divisionOfProgram(a.programId || a.program), division)
      );
    }
    if (effectiveBranch && effectiveBranch !== "all") {
      list = list.filter((a) => matchesBranchFilter(a.branch, effectiveBranch));
    }
    return list;
  }, [applications, division, effectiveBranch]);

  const scopedStudents = useMemo(() => {
    let list = users.filter((u) => u.role === "student");
    if (division && division !== "all") {
      list = list.filter((s) =>
        matchesDivisionFilter(s.division || divisionOfProgram(s.programId || s.program), division)
      );
    }
    if (effectiveBranch && effectiveBranch !== "all") {
      list = list.filter((s) => matchesBranchFilter(s.branch, effectiveBranch));
    }
    return list;
  }, [users, division, effectiveBranch]);

  const instructors = useMemo(() => {
    let list = users.filter((u) => isInstructorRole(u.role));
    if (division && division !== "all") {
      list = list.filter((u) => matchesDivisionFilter(u.division, division));
    }
    if (effectiveBranch && effectiveBranch !== "all") {
      list = list.filter((u) => matchesBranchFilter(u.branch, effectiveBranch));
    }
    return list;
  }, [users, division, effectiveBranch]);

  const activeInstructors = useMemo(() => {
    return instructors.filter((u) => (u.status || "active") === "active");
  }, [instructors]);

  const enrolledStudentIds = useMemo(() => {
    return scopedClasses.flatMap((cls) => cls.studentIds || []);
  }, [scopedClasses]);

  const unenrolledStudents = useMemo(() => {
    return scopedStudents.filter(
      (s) => isActiveStudent(s) && !enrolledStudentIds.includes(s.id)
    );
  }, [scopedStudents, enrolledStudentIds]);

  const pendingApplications = useMemo(() => {
    return scopedApplications.filter(
      (application) => (application.status || "pending") === "pending"
    ).length;
  }, [scopedApplications]);

  return {
    users,
    classes: scopedClasses,
    applications: scopedApplications,
    invites,
    todos,
    editId,
    setEditId,
    selectedStudent,
    setSelectedStudent,
    formData,
    setFormData,
    handleSave,
    handleEdit,
    handleAddStaff,
    handleAddStudent,
    handleDelete,
    handleAddTodo,
    handleDeleteTodo,
    handleToggleTodo,
    handleCreateInvite,
    handleDeleteInvite,
    getStudentClasses,
    instructors,
    activeInstructors,
    students: scopedStudents,
    unenrolledStudents,
    pendingApplications,
    myBranch: effectiveBranch,
    currentStaffProfile,
    allClasses: classes,
    allUsers: users,
  };
}
