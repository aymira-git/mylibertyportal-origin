import { useState, useEffect, useMemo, useCallback } from "react";
import { auth, db } from "../../firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { AIAssistant, DashboardShell, useToast, ApprovalInbox } from "../shared";
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
import { reportError } from "../../utils/reportError";
import { WalkInInquiryTab } from "./frontoffice";
import { DEFAULT_BRANCH, normalizeBranch, matchesBranchFilter } from "../../constants/branches";
import { getPaymentsForRecordedDay } from "../finance/paymentsRepository";

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
  const [outreachError, setOutreachError] = useState(null);
  const [outreachRetryKey, setOutreachRetryKey] = useState(0);

  // Daily cash drawer state for manager's branch
  const [dailyPayments, setDailyPayments] = useState([]);
  const [dailyPaymentsLoading, setDailyPaymentsLoading] = useState(true);
  const [isScopedToBranch, setIsScopedToBranch] = useState(true);

  const outreachLoading = schoolsLoading || visitsLoading || weekVisitsLoading;

  const handleRetryOutreach = () => {
    setSchoolsLoading(true);
    setVisitsLoading(true);
    setWeekVisitsLoading(true);
    setOutreachError(null);
    setOutreachRetryKey((k) => k + 1);
  };

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

    return () => {
      unsubUsers();
      unsubClasses();
      unsubApplications();
      unsubShifts();
      unsubTodos();
    };
  }, []);

  // Isolated subscription lifecycle for outreach collections with retryability,
  // error logging to telemetry, and toast notifications.
  useEffect(() => {
    const unsubSchools = listenToSchools(
      (data) => {
        setSchools(data);
        setSchoolsLoading(false);
      },
      (err) => {
        reportError(err, "manager_schools_listener");
        setSchoolsLoading(false);
        setOutreachError((prev) => prev || err.message || "Failed to load schools");
        toast("Failed to load school outreach data: " + (err.message || "Unknown error"), "error");
      }
    );

    // Bound the visit stream to a rolling 90-day window so the manager
    // dashboard never streams the full unbounded visits collection group.
    // getStartOfWeekWita anchors to Monday; subtract 12 full weeks (~90 days)
    // to cover a meaningful quarter of outreach history.
    const todayMonday = getStartOfWeekWita();
    // Subtract 90 days via milliseconds from the Monday Date object to avoid
    // day-of-month underflow (e.g. day - 90 would produce a nonsensical day component
    // that only works by accident via Date normalization, and drifts across months).
    const mondayDate = new Date(todayMonday + "T00:00:00Z");
    const windowStart = new Date(mondayDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    const startDate = `${windowStart.getUTCFullYear()}-${pad(windowStart.getUTCMonth() + 1)}-${pad(windowStart.getUTCDate())}`;

    const unsubVisits = listenToOutreachVisits(
      { startDate, orderDirection: "desc", limitCount: 200 },
      (data) => {
        setVisits(data);
        setVisitsLoading(false);
      },
      (err) => {
        reportError(err, "manager_visits_listener");
        setVisitsLoading(false);
        setOutreachError((prev) => prev || err.message || "Failed to load visits");
        toast("Failed to load outreach visits: " + (err.message || "Unknown error"), "error");
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
        reportError(err, "manager_week_visits_listener");
        setWeekVisitsLoading(false);
        setOutreachError((prev) => prev || err.message || "Failed to load weekly visits");
      }
    );

    return () => {
      unsubSchools();
      unsubVisits();
      unsubWeekVisits();
    };
  }, [outreachRetryKey, toast]);

  // Load today's payments for daily cash drawer summary (WITA)
  const fetchTodayPayments = useCallback(async () => {
    setDailyPaymentsLoading(true);
    try {
      const list = await getPaymentsForRecordedDay(new Date());
      setDailyPayments(list);
    } catch (err) {
      console.warn("fetchTodayPayments error:", err);
      toast("Could not load today's payment totals.", "error");
    } finally {
      setDailyPaymentsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await getPaymentsForRecordedDay(new Date());
        if (active) {
          setDailyPayments(list);
          setDailyPaymentsLoading(false);
        }
      } catch (err) {
        console.warn("fetchTodayPayments error:", err);
        if (active) {
          toast("Could not load today's payment totals.", "error");
          setDailyPaymentsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [toast]);

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

  // Derived branch for the logged-in manager
  const currentStaffProfile = useMemo(
    () => users.find((u) => u.id === auth.currentUser?.uid),
    [users]
  );
  const myBranch = normalizeBranch(currentStaffProfile?.branch || DEFAULT_BRANCH);

  // Fast O(1) studentId -> branch lookup map for payment join
  const studentBranchMap = useMemo(() => {
    const map = new Map();
    for (const u of users) {
      if (u.id) {
        map.set(u.id, normalizeBranch(u.branch));
      }
    }
    return map;
  }, [users]);

  // Branch-filtered daily payments (client-side join with zero additional reads)
  const branchDailyPayments = useMemo(() => {
    if (!isScopedToBranch) return dailyPayments;
    return dailyPayments.filter((p) => {
      const studentBranch = studentBranchMap.get(p.studentId);
      return matchesBranchFilter(studentBranch, myBranch);
    });
  }, [dailyPayments, isScopedToBranch, studentBranchMap, myBranch]);

  // Branch-scoped vs company-wide datasets
  const scopedUsers = useMemo(() => {
    if (!isScopedToBranch) return users;
    return users.filter((u) => matchesBranchFilter(u.branch, myBranch));
  }, [users, isScopedToBranch, myBranch]);

  const scopedClasses = useMemo(() => {
    if (!isScopedToBranch) return classes;
    return classes.filter((c) => matchesBranchFilter(c.branch, myBranch));
  }, [classes, isScopedToBranch, myBranch]);

  const scopedApplications = useMemo(() => {
    if (!isScopedToBranch) return applications;
    return applications.filter((a) => matchesBranchFilter(a.branch, myBranch));
  }, [applications, isScopedToBranch, myBranch]);

  // Derived datasets
  const students = useMemo(() => scopedUsers.filter((u) => u.role === "student"), [scopedUsers]);
  const activeStudents = useMemo(
    () => students.filter((s) => (s.status || "active") === "active"),
    [students]
  );
  const staff = useMemo(
    () => scopedUsers.filter((u) => u.role !== "student" && u.role !== "admin"),
    [scopedUsers]
  );
  const activeStaff = useMemo(
    () => staff.filter((u) => (u.status || "active") === "active"),
    [staff]
  );
  const pendingApplications = useMemo(
    () => scopedApplications.filter((a) => (a.status || "pending") === "pending"),
    [scopedApplications]
  );

  const unenrolledStudents = useMemo(() => {
    return activeStudents.filter((s) => !scopedClasses.some((c) => (c.studentIds || []).includes(s.id)));
  }, [activeStudents, scopedClasses]);

  const classesWithIssues = useMemo(() => {
    const activeInstructorIds = new Set(
      users
        .filter(
          (u) =>
            (u.role === "instructor" || u.role === "admin") && (u.status || "active") === "active"
        )
        .map((u) => u.id)
    );
    return scopedClasses
      .map((c) => {
        const assignedUser = c.instructorId ? users.find((u) => u.id === c.instructorId) : null;
        const needsInstructor = !c.instructorId || !assignedUser;
        const instructorInactive =
          !!c.instructorId && assignedUser && !activeInstructorIds.has(c.instructorId);
        const needsRoom = !c.classRoom || c.classRoom === "N/A" || c.classRoom.trim() === "";
        return { ...c, needsInstructor, instructorInactive, needsRoom };
      })
      .filter((c) => c.needsInstructor || c.instructorInactive || c.needsRoom);
  }, [scopedClasses, users]);

  const activeShifts = useMemo(() => {
    const raw = shifts.filter((s) => getShiftStatus(s) === "on_duty");
    if (!isScopedToBranch) return raw;
    return raw.filter((s) => matchesBranchFilter(s.branch, myBranch));
  }, [shifts, isScopedToBranch, myBranch]);

  const stats = {
    students: activeStudents.length,
    classes: scopedClasses.length,
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
          students={students}
          currentUserId={auth.currentUser?.uid}
          schools={schools}
          visits={weekVisits}
          outreachLoading={outreachLoading}
          outreachError={outreachError}
          onRetryOutreach={handleRetryOutreach}
          myBranch={myBranch}
          branchPayments={branchDailyPayments}
          paymentsLoading={dailyPaymentsLoading}
          onRefreshPayments={fetchTodayPayments}
          isScopedToBranch={isScopedToBranch}
          onToggleBranchScope={() => setIsScopedToBranch((prev) => !prev)}
        />
      ),
    },
    {
      id: "inquiries",
      label: "Guestbook & Inquiries",
      component: (
        <WalkInInquiryTab
          division="courses"
          branchLabel={myBranch}
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
          error={outreachError}
          onRetry={handleRetryOutreach}
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
      id: "approvals",
      label: "Branch Approvals",
      component: (
        <ApprovalInbox
          userRole="manager"
          branchId={myBranch}
          title={`Dual-Control Approvals (${myBranch})`}
          subtitle="Review and authorize branch fee exceptions, cash reconciliations, schedule overrides, and shift self-corrections."
        />
      ),
    },
    {
      id: "classes",
      label: "Classes & Coverage",
      badgeDot: classesWithIssues.length > 0,
      component: (
        <ClassesAndCoverageTab
          classes={scopedClasses}
          users={scopedUsers}
          currentUserId={auth.currentUser?.uid}
        />
      ),
    },
    {
      id: "reports",
      label: "Reports & Analytics",
      component: (
        <ReportsDashboard
          isAdminView={false}
          isFrontOffice={false}
          canEdit={false}
          userBranch={myBranch}
        />
      ),
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
