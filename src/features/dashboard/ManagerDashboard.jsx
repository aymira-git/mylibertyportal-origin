import { useState, useEffect, useMemo } from "react";
import { auth, db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { AIAssistant, DashboardShell, LevelBadge, useToast, WelcomeBanner } from "../shared";
import { GraduationCap, BookOpen, UserPlus, Users, ExternalLink } from "lucide-react";
import { ReportsDashboard } from "../reports";
import { TasksPanel, createTodo, deleteTodo } from "../staff";
import { AvailableBatches } from "../classes";

function formatTime(isoString) {
  if (!isoString) return "N/A";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoString;
  }
}

function formatPunctuality(shift) {
  const status = shift.punctualityStatus || "ON_TIME";
  const mins = shift.minutesEarlyOrLate;
  if (status === "LATE") {
    return {
      label: mins ? `${mins}m late` : "Late",
      classes: "bg-rose-100 text-rose-800 border-rose-200",
    };
  }
  if (status === "EARLY") {
    return {
      label: mins ? `${Math.abs(mins)}m early` : "Early",
      classes: "bg-blue-100 text-blue-800 border-blue-200",
    };
  }
  return {
    label: "On Time",
    classes: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
}

function ManagerOverview({
  stats,
  loading,
  pendingApplications,
  unenrolledStudents,
  classesWithIssues,
  activeShifts,
  onNavigate,
  classes = [],
  users = [],
  currentUserId = null,
}) {
  const totalBottlenecks =
    pendingApplications.length +
    unenrolledStudents.length +
    classesWithIssues.length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Executive Command & Welcome Banner */}
      <WelcomeBanner
        portalLabel="Executive Command"
        roleLabel="Operations Manager"
        fallbackName="Manager"
        subtitle="High-level operational overview: student enrollments, scheduled classes, staff allocations, and pending leads."
        extraPills={
          <>
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {activeShifts.length} On Duty
            </span>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                totalBottlenecks > 0
                  ? "text-amber-200 bg-amber-950/40 border-amber-500/30"
                  : "text-emerald-200 bg-emerald-950/40 border-emerald-500/30"
              }`}
            >
              <span>{totalBottlenecks > 0 ? "⚡" : "✓"}</span>
              <span>{totalBottlenecks > 0 ? `${totalBottlenecks} Action Required` : "Zero Bottlenecks"}</span>
            </span>
          </>
        }
        stats={
          loading
            ? []
            : [
                {
                  label: "Active Students",
                  value: stats.students,
                  icon: GraduationCap,
                  onClick: () => onNavigate("classes"),
                },
                {
                  label: "Scheduled Classes",
                  value: stats.classes,
                  icon: BookOpen,
                  onClick: () => onNavigate("classes"),
                },
                {
                  label: "Pending Leads",
                  value: pendingApplications.length,
                  icon: UserPlus,
                  onClick: () => onNavigate("tasks"),
                },
                {
                  label: "Active Staff",
                  value: stats.staff,
                  icon: Users,
                },
              ]
        }
      />

      {/* Operational Bottlenecks / Action Required */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>🚨 Operational Bottlenecks &amp; Action Required</span>
              {totalBottlenecks > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-700">
                  {totalBottlenecks}
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Items currently slowing down student onboarding or daily operations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bottleneck 1: Pending Applications */}
          <div
            className={`p-4 rounded-xl border flex flex-col justify-between ${
              pendingApplications.length > 0
                ? "bg-amber-50/70 border-amber-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  📝 Pending Leads
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    pendingApplications.length > 0
                      ? "bg-amber-200 text-amber-900"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {pendingApplications.length}
                </span>
              </div>
              {pendingApplications.length > 0 ? (
                <div className="space-y-2 mb-3">
                  <p className="text-xs text-amber-900 font-medium">
                    Leads waiting for Front Office / Marketing outreach:
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {pendingApplications.slice(0, 3).map((app) => (
                      <div
                        key={app.id}
                        className="bg-white/90 p-2 rounded-lg text-xs border border-amber-200/80"
                      >
                        <p className="font-bold text-slate-800 truncate">
                          {app.fullName || app.name || "New Applicant"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {app.program || "English Program"} · {app.phone || "No phone"}
                        </p>
                      </div>
                    ))}
                    {pendingApplications.length > 3 && (
                      <p className="text-[10px] text-amber-800 font-semibold text-center">
                        +{pendingApplications.length - 3} more waiting
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-3">
                  ✓ All applicant leads have been contacted and processed.
                </p>
              )}
            </div>
            {pendingApplications.length > 0 && (
              <button
                onClick={() => onNavigate("tasks")}
                className="w-full mt-2 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-sm"
              >
                Delegate Lead Follow-up →
              </button>
            )}
          </div>

          {/* Bottleneck 2: Unassigned Students */}
          <div
            className={`p-4 rounded-xl border flex flex-col justify-between ${
              unenrolledStudents.length > 0
                ? "bg-rose-50/70 border-rose-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  ⚠️ Unassigned Students
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    unenrolledStudents.length > 0
                      ? "bg-rose-200 text-rose-900"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {unenrolledStudents.length}
                </span>
              </div>
              {unenrolledStudents.length > 0 ? (
                <div className="space-y-2 mb-3">
                  <p className="text-xs text-rose-900 font-medium">
                    Active students not yet placed into a class group:
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {unenrolledStudents.slice(0, 3).map((stu) => (
                      <div
                        key={stu.id}
                        className="bg-white/90 p-2 rounded-lg text-xs border border-rose-200/80"
                      >
                        <p className="font-bold text-slate-800 truncate">
                          {stu.displayName || stu.firstName || "Student"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {stu.program || stu.branch || "General"} · Level: {stu.currentLevel || "Unset"}
                        </p>
                      </div>
                    ))}
                    {unenrolledStudents.length > 3 && (
                      <p className="text-[10px] text-rose-800 font-semibold text-center">
                        +{unenrolledStudents.length - 3} more unplaced
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-3">
                  ✓ 100% Student Placement. Every active student is assigned to a class.
                </p>
              )}
            </div>
            {unenrolledStudents.length > 0 && (
              <button
                onClick={() => onNavigate("classes")}
                className="w-full mt-2 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm"
              >
                Assign to Open Classes →
              </button>
            )}
          </div>

          {/* Bottleneck 3: Class Coverage Alerts */}
          <div
            className={`p-4 rounded-xl border flex flex-col justify-between ${
              classesWithIssues.length > 0
                ? "bg-purple-50/70 border-purple-200"
                : "bg-slate-50 border-slate-200"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                  🏫 Coverage Alerts
                </span>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    classesWithIssues.length > 0
                      ? "bg-purple-200 text-purple-900"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {classesWithIssues.length}
                </span>
              </div>
              {classesWithIssues.length > 0 ? (
                <div className="space-y-2 mb-3">
                  <p className="text-xs text-purple-900 font-medium">
                    Classes with missing instructor or room allocation:
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {classesWithIssues.slice(0, 3).map((cls) => (
                      <div
                        key={cls.id}
                        className="bg-white/90 p-2 rounded-lg text-xs border border-purple-200/80"
                      >
                        <p className="font-bold text-slate-800 truncate">
                          {cls.className || "Scheduled Class"}
                        </p>
                        <div className="flex gap-1.5 mt-0.5 flex-wrap">
                          {cls.needsInstructor && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                              Missing Instructor
                            </span>
                          )}
                          {cls.needsRoom && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              Room Needed
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {classesWithIssues.length > 3 && (
                      <p className="text-[10px] text-purple-800 font-semibold text-center">
                        +{classesWithIssues.length - 3} more alerts
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-3">
                  ✓ All active classes have confirmed instructors and room assignments.
                </p>
              )}
            </div>
            {classesWithIssues.length > 0 && (
              <button
                onClick={() => onNavigate("classes")}
                className="w-full mt-2 py-2 px-3 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold transition shadow-sm"
              >
                Resolve Coverage in Classes →
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Today's On-Duty & Shifts Snapshot */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>⏱️ Today's On-Duty &amp; Shifts Snapshot</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#1a3a8f]/10 text-[#1a3a8f]">
                {activeShifts.length} Clocked In
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time attendance recorded at the reception kiosk station.
            </p>
          </div>
          <button
            onClick={() => onNavigate("reports")}
            className="text-xs font-bold text-[#1a3a8f] hover:underline self-start sm:self-auto"
          >
            Open Full Attendance Reports →
          </button>
        </div>

        {activeShifts.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <p className="text-2xl mb-1">🏢</p>
            <p className="text-sm font-bold text-slate-700">No staff currently clocked in.</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              As staff members scan their QR badge at the reception kiosk station, their shift,
              scheduled class, and punctuality status will appear here live.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeShifts.map((shift) => {
              const punctuality = formatPunctuality(shift);
              return (
                <div
                  key={shift.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                        <h4 className="font-bold text-slate-800 text-sm truncate">
                          {shift.displayName || "Staff Member"}
                        </h4>
                      </div>
                      <span className="inline-block mt-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                        {shift.role || "Staff"}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border shrink-0 ${punctuality.classes}`}
                    >
                      {punctuality.label}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 space-y-1 bg-white p-2.5 rounded-lg border border-slate-150">
                    <p className="flex justify-between">
                      <span className="text-slate-400">Clocked In:</span>
                      <span className="font-bold text-slate-700">{formatTime(shift.clockIn)}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-slate-400">Assignment:</span>
                      <span className="font-semibold text-slate-700 truncate max-w-[150px]">
                        {shift.className || "School General Duty"}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Batches & Capacity Openings in Command Center */}
      <AvailableBatches
        classes={classes}
        users={users}
        canEdit={false}
        role="manager"
        isOverviewWidget={true}
        onNavigateToClasses={() => onNavigate("classes")}
        currentUserId={currentUserId}
      />
    </div>
  );
}

function MyTeachingCohortsView({ myClasses, users }) {
  if (myClasses.length === 0) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-[#1a3a8f] flex items-center justify-center mx-auto font-bold">
          <BookOpen className="w-6 h-6" />
        </div>
        <h4 className="font-extrabold text-slate-800 text-base">No Teaching Cohorts Assigned</h4>
        <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
          You are currently not designated as the lead instructor for any active class batches.
          When an administrator assigns you to a batch in batch configuration, it will appear here
          with its student roster, room schedule, and course syllabus.
        </p>
      </div>
    );
  }

  const totalMyStudents = myClasses.reduce((sum, c) => sum + c.studentCount, 0);

  return (
    <div className="space-y-5">
      {/* Overview Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-[#1a3a8f]">My Teaching Cohorts</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-[#1a3a8f] border border-indigo-100">
              {myClasses.length} Active {myClasses.length === 1 ? "Cohort" : "Cohorts"}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Classes and student groups where you lead instruction, progress monitoring, and evaluations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-center min-w-[110px]">
            <p className="text-[10px] font-extrabold uppercase text-slate-400">Enrolled Students</p>
            <p className="text-xl font-black text-slate-800 mt-0.5">{totalMyStudents}</p>
          </div>
        </div>
      </div>

      {/* Cohort Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {myClasses.map((cls) => {
          const studentList = (cls.studentIds || []).map((sId) => {
            const u = users.find((user) => user.id === sId);
            return u || { id: sId, displayName: "Student" };
          });

          return (
            <div
              key={cls.id}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <LevelBadge level={cls.classLevel || "warrior"} />
                  <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full">
                    {cls.studentCount} / {cls.maxCapacity || 15} Enrolled
                  </span>
                </div>

                <div>
                  <h4 className="text-base font-extrabold text-slate-900">{cls.className}</h4>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap font-medium">
                    <span>{cls.schedule || "Schedule unset"}</span>
                    <span>·</span>
                    <span>{cls.classRoom || "Main Campus"}</span>
                  </div>
                </div>

                {/* Enrolled Students Roster preview */}
                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Enrolled Roster ({studentList.length})
                  </p>
                  {studentList.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-2">No students enrolled yet.</p>
                  ) : (
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {studentList.map((stu) => (
                        <div
                          key={stu.id}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                        >
                          <span className="font-bold text-slate-800 truncate">
                            {stu.displayName || stu.name || "Student"}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {stu.currentLevel ? `Level ${stu.currentLevel}` : "Level unset"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {cls.worksheetUrl && (
                <div className="pt-2 border-t border-slate-100">
                  <a
                    href={cls.worksheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-[#1a3a8f] hover:underline inline-flex items-center gap-1"
                  >
                    <span>View Syllabus / Course Worksheet</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClassesAndCoverageTab({ classes, users, currentUserId }) {
  const [viewMode, setViewMode] = useState("batches");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const instructorMap = useMemo(() => {
    const map = new Map();
    users.forEach((u) => {
      if (u.role === "instructor" || u.role === "admin") {
        map.set(u.id, u.displayName || `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email);
      }
    });
    return map;
  }, [users]);

  const augmentedClasses = useMemo(() => {
    return classes.map((c) => {
      const hasInstructor = Boolean(c.instructorId && instructorMap.has(c.instructorId));
      const hasRoom = Boolean(c.classRoom && c.classRoom !== "N/A" && c.classRoom.trim() !== "");
      return {
        ...c,
        instructorName: c.instructorId ? instructorMap.get(c.instructorId) || "Unknown Staff" : null,
        hasInstructor,
        hasRoom,
        studentCount: c.studentIds?.length || 0,
      };
    });
  }, [classes, instructorMap]);

  const myAssignedClasses = useMemo(() => {
    if (!currentUserId) return [];
    return augmentedClasses.filter((c) => c.instructorId === currentUserId);
  }, [augmentedClasses, currentUserId]);

  const filteredClasses = useMemo(() => {
    return augmentedClasses
      .filter((c) => {
        if (filter === "my_classes") return c.instructorId === currentUserId;
        if (filter === "needs_instructor") return !c.hasInstructor;
        if (filter === "needs_room") return !c.hasRoom;
        if (filter === "covered") return c.hasInstructor && c.hasRoom;
        return true;
      })
      .filter((c) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          (c.className || "").toLowerCase().includes(q) ||
          (c.instructorName || "").toLowerCase().includes(q) ||
          (c.schedule || "").toLowerCase().includes(q) ||
          (c.classRoom || "").toLowerCase().includes(q)
        );
      });
  }, [augmentedClasses, filter, search, currentUserId]);

  const totalClasses = augmentedClasses.length;
  const staffedClasses = augmentedClasses.filter((c) => c.hasInstructor).length;
  const roomedClasses = augmentedClasses.filter((c) => c.hasRoom).length;
  const totalEnrolledSeats = augmentedClasses.reduce((sum, c) => sum + c.studentCount, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Subtab Navigation */}
      <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80 w-fit flex-wrap gap-1">
        <button
          onClick={() => setViewMode("batches")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
            viewMode === "batches"
              ? "bg-white text-[#1a3a8f] shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Available Batches ({classes.length})
        </button>
        <button
          onClick={() => setViewMode("coverage")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition ${
            viewMode === "coverage"
              ? "bg-white text-[#1a3a8f] shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          Coverage &amp; Logistics Audit
        </button>
        <button
          onClick={() => setViewMode("my_cohorts")}
          className={`px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
            viewMode === "my_cohorts"
              ? "bg-white text-[#1a3a8f] shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <span>My Teaching Cohorts</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              viewMode === "my_cohorts"
                ? "bg-[#1a3a8f]/10 text-[#1a3a8f]"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            {myAssignedClasses.length}
          </span>
        </button>
      </div>

      {viewMode === "batches" && (
        <AvailableBatches
          classes={classes}
          users={users}
          canEdit={false}
          role="manager"
          currentUserId={currentUserId}
        />
      )}

      {viewMode === "my_cohorts" && (
        <MyTeachingCohortsView myClasses={myAssignedClasses} users={users} />
      )}

      {viewMode === "coverage" && (
        <>
          {/* Header Banner */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-2xl font-black text-[#1a3a8f]">Classes &amp; Coverage Command</h2>
          <p className="text-sm text-slate-500 mt-1">
            Audit instructor assignments, room logistics, and student group capacity across all
            programs.
          </p>
        </div>

        {/* Coverage Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-slate-50 border rounded-xl">
            <p className="text-[10px] font-bold uppercase text-slate-500">Total Classes</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{totalClasses}</p>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
            <p className="text-[10px] font-bold uppercase text-emerald-700">Instructor Coverage</p>
            <p className="text-2xl font-black text-emerald-800 mt-1">
              {totalClasses > 0 ? Math.round((staffedClasses / totalClasses) * 100) : 0}%
            </p>
          </div>
          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
            <p className="text-[10px] font-bold uppercase text-indigo-700">Room Allocated</p>
            <p className="text-2xl font-black text-indigo-800 mt-1">
              {totalClasses > 0 ? Math.round((roomedClasses / totalClasses) * 100) : 0}%
            </p>
          </div>
          <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl">
            <p className="text-[10px] font-bold uppercase text-purple-700">Enrolled Seats</p>
            <p className="text-2xl font-black text-purple-800 mt-1">{totalEnrolledSeats}</p>
          </div>
        </div>

        {/* Filter and Search Controls */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <input
            type="text"
            placeholder="🔍 Search class name, instructor, room, or schedule..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 p-2.5 border rounded-xl text-sm"
          />
          <div className="flex gap-1.5 flex-wrap text-xs font-bold">
            {[
              { id: "all", label: "All Classes" },
              { id: "my_classes", label: `⭐ My Cohorts (${myAssignedClasses.length})` },
              { id: "needs_instructor", label: "⚠️ Needs Instructor" },
              { id: "needs_room", label: "⚠️ Needs Room" },
              { id: "covered", label: "✓ Fully Covered" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-2 rounded-xl transition ${
                  filter === tab.id
                    ? "bg-[#1a3a8f] text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Classes Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredClasses.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            No classes found matching your search and filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-3.5">Class Name</th>
                  <th className="p-3.5">Level</th>
                  <th className="p-3.5">Assigned Instructor</th>
                  <th className="p-3.5">Schedule</th>
                  <th className="p-3.5">Room</th>
                  <th className="p-3.5 text-right">Enrollment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClasses.map((cls) => (
                  <tr key={cls.id} className="hover:bg-slate-50/80 transition">
                    <td className="p-3.5">
                      <p className="font-bold text-slate-800 text-sm">{cls.className}</p>
                      <span className="text-[10px] text-slate-400">ID: {cls.id.slice(0, 8)}...</span>
                    </td>
                    <td className="p-3.5">
                      <LevelBadge level={cls.classLevel || "warrior"} />
                    </td>
                    <td className="p-3.5">
                      {cls.hasInstructor ? (
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                          <span className="font-semibold text-slate-700">{cls.instructorName}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-[10px] uppercase bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                          ⚠️ Unassigned
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      <p className="font-medium text-slate-700">
                        {cls.schedule || `${cls.classDay || "Days unset"} @ ${cls.startTime || "--"} - ${cls.endTime || "--"}`}
                      </p>
                    </td>
                    <td className="p-3.5">
                      {cls.hasRoom ? (
                        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">
                          {cls.classRoom}
                        </span>
                      ) : (
                        <span className="inline-flex items-center font-bold text-[10px] uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                          ⚠️ Room Needed
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <span className="font-black text-slate-800 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs">
                        {cls.studentCount} student{cls.studentCount === 1 ? "" : "s"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

function StaffDirectivesTab({ todos, onAddTodo, onDeleteTodo, todosPermission = true }) {
  const activeCount = todos.filter((t) => !t.completed).length;
  const pinnedCount = todos.filter((t) => t.isPinned || t.type === "deadline").length;
  const deptCounts = useMemo(() => {
    const counts = { all: 0, frontoffice: 0, marketing: 0, instructor: 0, officeboy: 0 };
    todos.forEach((t) => {
      const a = t.assignee || "all";
      if (counts[a] !== undefined) counts[a] += 1;
    });
    return counts;
  }, [todos]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-2xl font-black text-[#1a3a8f]">Staff Directives &amp; Delegation</h2>
        <p className="text-sm text-slate-500">
          Issue actionable directives, target specific departments, and track operational execution
          across the school.
        </p>

        {!todosPermission && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <span className="text-sm">ℹ️</span>
              <span>Firestore Rules Deployment Required for Live Cloud Sync</span>
            </div>
            <p className="leading-relaxed">
              Your live Firebase project currently restricts Manager access on the <code>todos</code> collection.
              To enable cloud-synced directives across all devices, deploy the updated rules with <code>firebase deploy --only firestore:rules</code> or update the <code>/todos</code> rule in your Firebase Console. Local directives work during your current session.
            </p>
          </div>
        )}

        {/* Department Delegation Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 text-center text-xs">
          <div className="p-2.5 rounded-xl border bg-slate-50 font-semibold">
            <p className="text-slate-400 text-[10px] uppercase">Active Tasks</p>
            <p className="text-lg font-black text-slate-800 mt-0.5">{activeCount}</p>
          </div>
          <div className="p-2.5 rounded-xl border bg-red-50 font-semibold border-red-100">
            <p className="text-red-500 text-[10px] uppercase">Pinned / Deadlines</p>
            <p className="text-lg font-black text-red-700 mt-0.5">{pinnedCount}</p>
          </div>
          <div className="p-2.5 rounded-xl border bg-blue-50 font-semibold border-blue-100">
            <p className="text-blue-600 text-[10px] uppercase">Front Office</p>
            <p className="text-lg font-black text-blue-800 mt-0.5">{deptCounts.frontoffice}</p>
          </div>
          <div className="p-2.5 rounded-xl border bg-purple-50 font-semibold border-purple-100">
            <p className="text-purple-600 text-[10px] uppercase">Marketing</p>
            <p className="text-lg font-black text-purple-800 mt-0.5">{deptCounts.marketing}</p>
          </div>
          <div className="p-2.5 rounded-xl border bg-emerald-50 font-semibold border-emerald-100">
            <p className="text-emerald-600 text-[10px] uppercase">Instructors</p>
            <p className="text-lg font-black text-emerald-800 mt-0.5">{deptCounts.instructor}</p>
          </div>
          <div className="p-2.5 rounded-xl border bg-amber-50 font-semibold border-amber-100">
            <p className="text-amber-600 text-[10px] uppercase">Office Boy</p>
            <p className="text-lg font-black text-amber-800 mt-0.5">{deptCounts.officeboy}</p>
          </div>
        </div>
      </div>

      <TasksPanel todos={todos} onAddTodo={onAddTodo} onDeleteTodo={onDeleteTodo} />
    </div>
  );
}

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

  // Derived datasets
  const students = useMemo(() => users.filter((u) => u.role === "student"), [users]);
  const staff = useMemo(() => users.filter((u) => u.role !== "student" && u.role !== "admin"), [users]);
  const pendingApplications = useMemo(
    () => applications.filter((a) => (a.status || "pending") === "pending"),
    [applications]
  );

  const unenrolledStudents = useMemo(() => {
    return students.filter((s) => !classes.some((c) => (c.studentIds || []).includes(s.id)));
  }, [students, classes]);

  const classesWithIssues = useMemo(() => {
    const instructorIds = new Set(users.filter((u) => u.role === "instructor" || u.role === "admin").map((u) => u.id));
    return classes
      .map((c) => {
        const needsInstructor = !c.instructorId || !instructorIds.has(c.instructorId);
        const needsRoom = !c.classRoom || c.classRoom === "N/A" || c.classRoom.trim() === "";
        return { ...c, needsInstructor, needsRoom };
      })
      .filter((c) => c.needsInstructor || c.needsRoom);
  }, [classes, users]);

  const activeShifts = useMemo(() => {
    return shifts.filter((s) => !s.clockOut);
  }, [shifts]);

  const stats = {
    students: students.length,
    classes: classes.length,
    staff: staff.length,
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
      badge: todos.filter(t => !t.completed).length || null,
      component: (
        <StaffDirectivesTab
          todos={todos}
          onAddTodo={handleAddTodo}
          onDeleteTodo={handleDeleteTodo}
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
      component: <ReportsDashboard isAdminView={true} isFrontOffice={false} />,
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
