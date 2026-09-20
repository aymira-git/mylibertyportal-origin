import { useState, useEffect, useMemo } from "react";
import { auth, db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { AIAssistant, DashboardShell, useToast } from "../shared";
import { ReportsDashboard } from "../reports";
import { createTodo, deleteTodo, toggleTodoComplete } from "../staff";
import { getShiftStatus } from "../attendance";
import {
  ManagerOverview,
  ClassesAndCoverageTab,
  StaffDirectivesTab,
} from "./manager";

export default function ManagerDashboard() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [applications, setApplications] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [todos, setTodos] = useState([]);
  const [todosPermission, setTodosPermission] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snap) => {
        setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.warn("users listener:", err);
        setLoading(false);
      }
    );

    const unsubClasses = onSnapshot(
      collection(db, "classes"),
      (snap) => setClasses(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn("classes listener:", err)
    );

    const unsubApplications = onSnapshot(
      collection(db, "applications"),
      (snap) => setApplications(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn("applications listener:", err)
    );

    const unsubShifts = onSnapshot(
      collection(db, "shifts"),
      (snap) => setShifts(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.warn("shifts listener:", err)
    );

    const unsubTodos = onSnapshot(
      collection(db, "todos"),
      (snap) => {
        setTodos(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setTodosPermission(true);
      },
      (err) => {
        if (err?.code === "permission-denied" || err?.message?.includes("insufficient permissions")) {
          // Handled gracefully: live database rules must be deployed
          setTodosPermission(false);
          console.warn("todos listener: Manager read permission denied by Firestore rules. Update rules in Firebase Console.", err);
        } else {
          console.warn("todos listener:", err);
        }
      }
    );

    return () => {
      unsubUsers();
      unsubClasses();
      unsubApplications();
      unsubShifts();
      unsubTodos();
    };
  }, []);

  const handleAddTodo = async (todoData) => {
    try {
      await createTodo(todoData);
      toast("Staff directive issued successfully.", "success");
    } catch (err) {
      if (err?.code === "permission-denied" || err?.message?.includes("insufficient permissions")) {
        const localTodo = {
          id: "local-" + Date.now(),
          ...todoData,
          createdAt: new Date().toISOString(),
          isLocal: true,
        };
        setTodos((prev) => [localTodo, ...prev]);
        toast("Directive stored locally. Deploy firestore.rules to persist to Firebase.", "warning");
      } else {
        toast("Error creating directive: " + err.message, "error");
      }
    }
  };

  const handleDeleteTodo = async (todoId) => {
    try {
      if (todoId.startsWith("local-")) {
        setTodos((prev) => prev.filter((t) => t.id !== todoId));
        toast("Directive removed.", "info");
        return;
      }
      await deleteTodo(todoId);
      toast("Directive removed.", "info");
    } catch (err) {
      if (err?.code === "permission-denied" || err?.message?.includes("insufficient permissions")) {
        setTodos((prev) => prev.filter((t) => t.id !== todoId));
        toast("Directive removed locally.", "info");
      } else {
        toast("Error deleting directive: " + err.message, "error");
      }
    }
  };

  const handleToggleTodo = async (todoId, completed) => {
    try {
      if (todoId.startsWith("local-")) {
        setTodos((prev) =>
          prev.map((t) =>
            t.id === todoId
              ? {
                  ...t,
                  completed,
                  completedAt: completed ? new Date().toISOString() : null,
                  completedByName: completed ? (auth.currentUser?.displayName || "Manager") : null,
                }
              : t
          )
        );
        return;
      }
      await toggleTodoComplete(todoId, completed, auth.currentUser);
    } catch (err) {
      toast("Error updating directive: " + err.message, "error");
    }
  };

  // Derived datasets
  const students = useMemo(() => users.filter((u) => u.role === "student"), [users]);
  const activeStudents = useMemo(() => students.filter((s) => (s.status || "active") === "active"), [students]);
  const staff = useMemo(() => users.filter((u) => u.role !== "student" && u.role !== "admin"), [users]);
  const activeStaff = useMemo(() => staff.filter((u) => (u.status || "active") === "active"), [staff]);
  const pendingApplications = useMemo(
    () => applications.filter((a) => (a.status || "pending") === "pending"),
    [applications]
  );

  const unenrolledStudents = useMemo(() => {
    return activeStudents.filter((s) => !classes.some((c) => (c.studentIds || []).includes(s.id)));
  }, [activeStudents, classes]);

  const classesWithIssues = useMemo(() => {
    const activeInstructorIds = new Set(
      users
        .filter((u) => (u.role === "instructor" || u.role === "admin") && (u.status || "active") === "active")
        .map((u) => u.id)
    );
    return classes
      .map((c) => {
        const assignedUser = c.instructorId ? users.find((u) => u.id === c.instructorId) : null;
        const needsInstructor = !c.instructorId || !assignedUser;
        const instructorInactive = !!c.instructorId && assignedUser && !activeInstructorIds.has(c.instructorId);
        const needsRoom = !c.classRoom || c.classRoom === "N/A" || c.classRoom.trim() === "";
        return { ...c, needsInstructor, instructorInactive, needsRoom };
      })
      .filter((c) => c.needsInstructor || c.instructorInactive || c.needsRoom);
  }, [classes, users]);

  const activeShifts = useMemo(() => {
    return shifts.filter((s) => getShiftStatus(s) === "on_duty");
  }, [shifts]);

  const stats = {
    students: activeStudents.length,
    classes: classes.length,
    staff: activeStaff.length,
  };

  const tabs = [
    {
      id: "overview",
      label: "Command Center",
      component: (
        <ManagerOverview
          stats={stats}
          loading={loading}
          pendingApplications={pendingApplications}
          unenrolledStudents={unenrolledStudents}
          classesWithIssues={classesWithIssues}
          activeShifts={activeShifts}
          onNavigate={(tab) => setActiveTab(tab)}
          classes={classes}
          users={users}
          currentUserId={auth.currentUser?.uid}
        />
      ),
    },
    {
      id: "tasks",
      label: "Staff Directives",
      badge: todos.filter((t) => !t.completed).length || null,
      component: (
        <StaffDirectivesTab
          todos={todos}
          users={users}
          currentUser={auth.currentUser}
          onAddTodo={handleAddTodo}
          onDeleteTodo={handleDeleteTodo}
          onToggleTodo={handleToggleTodo}
          todosPermission={todosPermission}
        />
      ),
    },
    {
      id: "classes",
      label: "Classes & Coverage",
      badgeDot: classesWithIssues.length > 0,
      component: (
        <ClassesAndCoverageTab
          classes={classes}
          users={users}
          currentUserId={auth.currentUser?.uid}
        />
      ),
    },
    {
      id: "reports",
      label: "Reports & Analytics",
      component: <ReportsDashboard isAdminView={true} isFrontOffice={false} canEdit={false} />,
    },
    {
      id: "ai",
      label: "AI Assistant",
      component: <AIAssistant />,
    },
  ];

  return (
    <DashboardShell
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      title="Manager Portal"
    />
  );
}
