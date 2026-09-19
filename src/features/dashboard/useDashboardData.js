import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useToast, useConfirm } from "../shared";
import { buildStudentRecord } from "../students";
import { createInvite, deleteInvite, createTodo, deleteTodo } from "../staff";
import { saveStudentRecord, updateStaffRecord, createStaffAccount, deleteUserProfile } from "./usersRepository";

const emptyFormData = {
  firstName: "", lastName: "", nickname: "", displayName: "", gender: "male",
  email: "", password: "", role: "instructor", phone: "", dob: "",
  educationLevel: "SD", joinedDate: "", parentName: "", parentPhone: "",
  currentLevel: "warrior", rating: "1", paymentPlan: "monthly", notes: "",
  placeOfBirth: "", religion: "", address: "", branch: "", program: "",
  classType: "", schoolOrJob: "", classOrSemester: "",
  fatherName: "", fatherJob: "", fatherPhone: "",
  motherName: "", motherJob: "", motherPhone: "",
  referralSource: "", photoURL: ""
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
export function useDashboardData({ restrictedRead = false, setActiveTab } = {}) {
  const toast = useToast();
  const confirm = useConfirm(); // 👈 shadows native window.confirm on purpose — same call shape, styled modal, just needs "await"

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
    const usersQuery = restrictedRead
      ? query(collection(db, "users"), where("role", "in", ["student", "instructor"]))
      : collection(db, "users");

    const handleListenerError = (name) => (err) => {
      if (err?.code === "permission-denied" || err?.message?.includes("insufficient permissions")) {
        console.warn(`${name} listener: permission denied by Firestore rules`, err.message);
      } else {
        console.error(`${name} listener:`, err);
      }
    };

    const unsubUsers = onSnapshot(
      usersQuery,
      snap => setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      handleListenerError("users")
    );
    const unsubClasses = onSnapshot(
      collection(db, "classes"),
      snap => setClasses(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      handleListenerError("classes")
    );
    const unsubApplications = onSnapshot(
      collection(db, "applications"),
      snap => setApplications(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      handleListenerError("applications")
    );
    const unsubTodos = onSnapshot(
      collection(db, "todos"),
      snap => setTodos(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      handleListenerError("todos")
    );
    // firestore.rules allows `list` on invites for admin OR front office,
    // so both dashboards that use this hook can read them. An older comment
    // here claimed Front Office had no access and swallowed every error into
    // an empty array — which meant a genuine rules or network failure looked
    // exactly like "there are no invites". Errors are surfaced like every
    // other listener now.
    const unsubInvites = onSnapshot(
      collection(db, "invites"),
      snap => setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      handleListenerError("invites")
    );

    return () => {
      unsubUsers();
      unsubClasses();
      unsubApplications();
      unsubTodos();
      unsubInvites();
    };
  }, [restrictedRead]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (formData.role === "student") {
        const studentDisplayName = formData.displayName?.trim() || `${formData.firstName} ${formData.lastName}`.trim();
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
          program: formData.program,
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
          rating: formData.rating,
          paymentPlan: formData.paymentPlan || "monthly",
          notes: formData.notes,
        });

        await saveStudentRecord(editId, studentData);
      } else {
        const staffDisplayName = `${formData.firstName} ${formData.lastName}`.trim() || formData.displayName?.trim() || "";
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
          email: formData.email
        };

        if (editId) {
          await updateStaffRecord(editId, staffData);
        } else {
          await createStaffAccount(formData.email, formData.password, staffData);
        }
      }

      toast(editId ? "Profile updated!" : (formData.role === "student" ? "Student added to roster!" : "Account created!"));
      setEditId(null);
      setFormData(emptyFormData);
      setActiveTab?.(formData.role === "student" ? "students" : "directory");
    } catch (err) { toast(err.message, "error"); }
  };

  const handleAddStaff = () => {
    setEditId(null);
    setFormData(emptyFormData);
    setActiveTab?.("addUser");
  };

  const handleAddStudent = () => {
    setEditId(null);
    setFormData({
      ...emptyFormData,
      role: "student",
      currentLevel: "warrior",
      paymentPlan: "monthly",
    });
    setActiveTab?.("addUser");
  };

  const handleEdit = (user) => {
    setEditId(user.id);
    setFormData({
      firstName: user.firstName || user.displayName?.split(" ")[0] || "",
      lastName: user.lastName || user.displayName?.split(" ").slice(1).join(" ") || "",
      displayName: user.displayName || "",
      nickname: user.nickname || "",
      gender: user.gender || "male",
      email: user.email || "", password: "PREFILLED_PASSWORD", role: user.role || "student", phone: user.phone || "", dob: user.dob || "",
      educationLevel: user.educationLevel || "SD", joinedDate: user.joinedDate || "",
      parentName: user.parentName || user.fatherName || user.motherName || "",
      parentPhone: user.parentPhone || user.fatherPhone || user.motherPhone || "",
      currentLevel: user.currentLevel || "warrior",
      paymentPlan: user.paymentPlan || "monthly",
      rating: user.rating || "1", notes: user.notes || "",
      placeOfBirth: user.placeOfBirth || "",
      religion: user.religion || "",
      address: user.address || "",
      branch: user.branch || "",
      program: user.program || "",
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
      photoURL: user.photoURL || ""
    });
    setActiveTab?.("addUser");
  };

  const handleDelete = async (uid) => {
    const user = users.find(profile => profile.id === uid);
    if (!user || !(await confirm(`Are you sure you want to delete ${user.displayName || "this profile"}?`))) return;

    try {
      await deleteUserProfile(uid);
      if (user.role === "student") {
        toast("Student roster profile deleted.");
      } else {
        toast("Staff profile deleted from Firestore. The Firebase Auth account still exists and must be deleted separately in Firebase Console before this email can be registered again.");
      }
    } catch (err) { toast("Unable to delete profile: " + err.message, "error"); }
  };

  const handleAddTodo = async ({ text, type, isPinned, assignee }) => {
    try {
      await createTodo({ text, type, isPinned, assignee });
    } catch (err) { toast(err.message, "error"); }
  };

  const handleDeleteTodo = async (todoId) => {
    if (!(await confirm("Delete this task or reminder?"))) return;
    try {
      await deleteTodo(todoId);
      setTodos(current => current.filter(t => t.id !== todoId));
    } catch (err) { toast("Error deleting task: " + err.message, "error"); }
  };

  const handleCreateInvite = async (email, role) => {
    try {
      await createInvite(email, role);
      toast("Invitation generated!");
    } catch (err) { toast(err.message, "error"); }
  };

  const handleDeleteInvite = async (id) => {
    if (!(await confirm("Cancel this invitation?"))) return;
    try {
      await deleteInvite(id);
    } catch (err) { toast(err.message, "error"); }
  };

  const getStudentClasses = (studentId) => {
    return classes
      .filter(c => (c.studentIds || []).includes(studentId))
      .map(c => ({
        className: c.className,
        instructorName: users.find(u => u.id === c.instructorId)?.displayName || "Unassigned",
        dateJoined: (c.enrollments || []).find(e => e.studentId === studentId)?.dateJoined || "",
      }));
  };

  const instructors = users.filter(u => u.role === "instructor");
  const students = users.filter(u => u.role === "student");
  const enrolledStudentIds = classes.flatMap(cls => cls.studentIds || []);
  const unenrolledStudents = students.filter(s => !enrolledStudentIds.includes(s.id));
  const pendingApplications = applications.filter(application => (application.status || "pending") === "pending").length;

  return {
    users, classes, applications, invites, todos,
    editId, setEditId, selectedStudent, setSelectedStudent,
    formData, setFormData,
    handleSave, handleEdit, handleAddStaff, handleAddStudent, handleDelete,
    handleAddTodo, handleDeleteTodo,
    handleCreateInvite, handleDeleteInvite,
    getStudentClasses, instructors, students, unenrolledStudents, pendingApplications,
  };
}
