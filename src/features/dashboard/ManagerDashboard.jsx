import { useState, useEffect, useMemo } from "react";
import { auth, db } from "../../firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { AIAssistant, DashboardShell, useToast } from "../shared";
import { ReportsDashboard } from "../reports";
import { createTodo, deleteTodo, toggleTodoComplete } from "../staff";
import { getShiftStatus } from "../attendance";
import {
  ManagerOverview,
  ClassesAndCoverageTab,
  StaffDirectivesTab,
  MarketingOutreachTracker,
  getFollowUpSchools,
} from "./manager";
import { listenToSchools, listenToOutreachVisits, getStartOfWeekWita, getEndOfWeekWita } from "./marketing";

export default function ManagerDashboard() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("overview");

  const [users, setUsers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [applications, setApplications] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [todos, setTodos] = useState([]);
  const [todosPermission, setTodosPermission] = useState(true);
  const [schools, setSchools] = useState([]);
  const [visits, setVisits] = useState([]);
  const [weekVisits, setWeekVisits] = useState([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [weekVisitsLoading, setWeekVisitsLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  const outreachLoading = schoolsLoading || visitsLoading || weekVisitsLoading;

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

    // Only subscribe to still-open shifts (clockOut == null) to prevent downloading
    // the entire unbounded shifts collection on the manager portal
    const unsubShifts = onSnapshot(
      query(collection(db, "shifts"), where("clockOut", "==", null)),
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
        if (
          err?.code === "permission-denied" ||
          err?.message?.includes("insufficient permissions")
        ) {
          // Handled gracefully: live database rules must be deployed
          setTodosPermission(false);
          console.warn(
            "todos listener: Manager read permission denied by Firestore rules. Update rules in Firebase Console.",
            err
          );
        } else {
          console.warn("todos listener:", err);
        }
      }
    );

    const unsubSchools = listenToSchools(
      (data) => {
        setSchools(data);
        setSchoolsLoading(false);
      },
      (err) => {
        console.warn("manager schools listener:", err);
        setSchoolsLoading(false);
      }
    );

    // Bound the visit stream to a rolling 90-day window so the manager
    // dashboard never streams the full unbounded visits collection group.
    // getStartOfWeekWita anchors to Monday; subtract 12 full weeks (~90 days)
    // to cover a meaningful quarter of outreach history.
    const todayMonday = getStartOfWeekWita();
    const [year, month, day] = todayMonday.split("-").map(Number);
    const windowStart = new Date(Date.UTC(year, month - 1, day - 90));
    const pad = (n) => String(n).padStart(2, "0");
    const startDate = `${windowStart.getUTCFullYear()}-${pad(windowStart.getUTCMonth() + 1)}-${pad(windowStart.getUTCDate())}`;

    const unsubVisits = listenToOutreachVisits(
      { startDate, orderDirection: "desc", limitCount: 200 },
      (data) => {
        setVisits(data);
        setVisitsLoading(false);
      },
      (err) => {
        console.warn("manager visits listener:", err);
        setVisitsLoading(false);
      }
    );

    // Second subscription scoped to the current WITA week only.
    // Weekly KPI metrics (visits count, flyers, leads) are computed from this
    // array so they are never truncated by the 90-day log limit above.
    // limitCount: 500 is generous enough for any realistic weekly outreach volume.
    const weekStart = getStartOfWeekWita();
    const weekEnd = getEndOfWeekWita();
    const unsubWeekVisits = listenToOutreachVisits(
      { startDate: weekStart, endDate: weekEnd, orderDirection: "desc", limitCount: 500 },
      (data) => {
        setWeekVisits(data);
        setWeekVisitsLoading(false);
      },
      (err) => {
        console.warn("manager week-visits listener:", err);
        setWeekVisitsLoading(false);
      }
    );

    return () => {
      unsubUsers();
      unsubClasses();
      unsubApplications();
      unsubShifts();
      unsubTodos();
      unsubSchools();
      unsubVisits();
      unsubWeekVisits();
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
        toast(
          "Directive stored locally. Deploy firestore.rules to persist to Firebase.",
          "warning"
        );
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
                  completedByName: completed ? auth.currentUser?.displayName || "Manager" : null,
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
  const activeStudents = useMemo(
    () => students.filter((s) => (s.status || "active") === "active"),
    [students]
  );
  const staff = useMemo(
    () => users.filter((u) => u.role !== "student" && u.role !== "admin"),
    [users]
  );
  const activeStaff = useMemo(
    () => staff.filter((u) => (u.status || "active") === "active"),
    [staff]
  );
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
        .filter(
          (u) =>
            (u.role === "instructor" || u.role === "admin") && (u.status || "active") === "active"
        )
        .map((u) => u.id)
    );
    return classes
      .map((c) => {
        const assignedUser = c.instructorId ? users.find((u) => u.id === c.instructorId) : null;
        const needsInstructor = !c.instructorId || !assignedUser;
        const instructorInactive =
          !!c.instructorId && assignedUser && !activeInstructorIds.has(c.instructorId);
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

  const followUpSchoolsCount = useMemo(() => {
    return getFollowUpSchools(schools).length;
  }, [schools]);

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
          schools={schools}
          visits={weekVisits}
          outreachLoading={outreachLoading}
        />
      ),
    },
    {
      id: "marketing-outreach",
      label: "Marketing Outreach",
      badge: followUpSchoolsCount > 0 ? `${followUpSchoolsCount} follow-up` : null,
      component: (
        <MarketingOutreachTracker
          schools={schools}
          visits={visits}
          weekVisits={weekVisits}
          loading={outreachLoading}
          users={users}
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
