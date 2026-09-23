import { WelcomeBanner } from "../../shared";
import { GraduationCap, BookOpen, UserPlus, Users, MapPin } from "lucide-react";
import { AvailableBatches } from "../../classes";
import { TuitionDueWidget } from "../frontoffice";
import { formatTime, formatPunctuality } from "./managerUtils";
import {
  calculateCoverage,
  calculateWeeklyMetrics,
  getFollowUpSchools,
} from "./outreachTrackerUtils";
import {
  getStartOfWeekWita,
  getEndOfWeekWita,
} from "../marketing/schoolOutreachRepository.js";

/**
 * @param {any} props
 */
export function ManagerOverview({
  stats,
  loading,
  outreachLoading = false,
  outreachError = null,
  onRetryOutreach = null,
  pendingApplications,
  unenrolledStudents,
  classesWithIssues,
  activeShifts,
  onNavigate = () => {},
  classes = [],
  users = [],
  currentUserId = null,
  schools = [],
  visits = [],
  students = [],
}) {
  const totalBottlenecks =
    pendingApplications.length + unenrolledStudents.length + classesWithIssues.length;

  const coverage = calculateCoverage(schools);
  const followUpCount = getFollowUpSchools(schools).length;
  const startOfWeek = getStartOfWeekWita();
  const endOfWeek = getEndOfWeekWita();
  const { visitsCount: weeklyVisitsCount } = calculateWeeklyMetrics(visits, startOfWeek, endOfWeek);

  return (
    <div className="w-full space-y-6">
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
              <span>
                {totalBottlenecks > 0 ? `${totalBottlenecks} Action Required` : "Zero Bottlenecks"}
              </span>
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

      {/* Tuition Due / Expiry Alerts */}
      <TuitionDueWidget
        students={students.length > 0 ? students : users.filter((u) => u.role === "student")}
        onNavigateToStudents={() => onNavigate("classes")}
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
                          {stu.program || stu.branch || "General"} · Level:{" "}
                          {stu.currentLevel || "Unset"}
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
                          {cls.instructorInactive && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              Instructor Inactive
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

      {/* ── Marketing Outreach Operational Summary Card ── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#1a3a8f]" />
              <span>Marketing Outreach &amp; School Admissions</span>
              {followUpCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-700">
                  {followUpCount} Follow-ups
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live school coverage, admissions campaign progress, and weekly field visits.
            </p>
          </div>
          <button
            onClick={() => onNavigate("marketing-outreach")}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1a3a8f] font-extrabold text-xs transition self-start sm:self-auto"
          >
            View Outreach Tracker &rarr;
          </button>
        </div>

        {outreachError && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-between gap-2">
            <span className="font-semibold">Unable to stream live outreach updates: {outreachError}</span>
            {onRetryOutreach && (
              <button
                onClick={onRetryOutreach}
                className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg font-bold text-[11px] shrink-0"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500">School Coverage</span>
            {outreachLoading ? (
              <div className="h-7 w-24 mt-1 rounded-lg bg-slate-200 animate-pulse" />
            ) : (
              <div className="text-xl font-black text-slate-800 mt-0.5">
                {coverage.visited} / {coverage.total}{" "}
                <span className="text-xs text-emerald-600 font-bold">({coverage.percentage}%)</span>
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-0.5">Target schools visited</p>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200">
            <span className="text-[11px] font-bold text-purple-700">Follow-ups Due</span>
            {outreachLoading ? (
              <div className="h-7 w-12 mt-1 rounded-lg bg-purple-200 animate-pulse" />
            ) : (
              <div className="text-xl font-black text-purple-900 mt-0.5">{followUpCount}</div>
            )}
            <p className="text-[10px] text-purple-600 mt-0.5">Schools awaiting next action</p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-700">Visits This Week</span>
            {outreachLoading ? (
              <div className="h-7 w-12 mt-1 rounded-lg bg-emerald-200 animate-pulse" />
            ) : (
              <div className="text-xl font-black text-emerald-900 mt-0.5">{weeklyVisitsCount}</div>
            )}
            <p className="text-[10px] text-emerald-600 mt-0.5">Field visits completed (WITA)</p>
          </div>
        </div>
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
