import { useState, useEffect, useCallback, useMemo } from "react";
import { auth } from "../../firebase";
import { computeMonthlyPunctuality, getShiftStatus } from "../attendance";
import { exportTableCSV, Pagination, usePagination } from "../shared";
import {
  fetchStaffShifts,
  fetchStudentProgressData,
  fetchInstructorAnalyticsData
} from "./reportsRepository";
import {
  GraduationCap,
  Clock,
  Download,
  Search,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  UserCheck
} from "lucide-react";

function uniqueClasses(classes) {
  const seen = new Set();
  return classes.filter((cls) => {
    const signature = [cls.className, cls.instructorId, cls.schedule, cls.classRoom].join("|");
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export default function ReportsDashboard({ isAdminView = false, isFrontOffice = false }) {
  const [subTab, setSubTab] = useState(isFrontOffice ? "students" : "staff");
  const [shifts, setShifts] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [analytics, setAnalytics] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [rangeDays, setRangeDays] = useState(90);

  const [studentSearch, setStudentSearch] = useState("");
  const [staffSearch, setStaffSearch] = useState("");

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const rangeToSince = (days) => (days === 0 ? null : new Date(Date.now() - days * 86400000).toISOString());

  const fetchShifts = useCallback(async () => {
    try {
      setShifts(await fetchStaffShifts(isAdminView, rangeToSince(rangeDays)));
    } catch (err) {
      console.error(err);
    }
  }, [isAdminView, rangeDays]);

  const fetchStudentProgress = useCallback(async () => {
    setStudentsLoading(true);
    try {
      const { users, classes: rawClasses, attendance, progress } =
        await fetchStudentProgressData(isAdminView, isFrontOffice, rangeToSince(rangeDays));

      const usersById = {};
      users.forEach((u) => {
        usersById[u.id] = u;
      });

      const fetchedClasses = uniqueClasses(rawClasses);
      setClasses(fetchedClasses);

      const allStudentIds = new Set([
        ...Object.keys(usersById).filter((id) => usersById[id].role === "student"),
        ...attendance.map((a) => a.userId),
        ...progress.map((p) => p.studentId),
      ]);

      const relevantStudentIds = isAdminView
        ? null
        : new Set(fetchedClasses.flatMap((c) => c.studentIds || []));

      const studentList = Array.from(allStudentIds)
        .filter((id) => {
          if (usersById[id]) {
            return usersById[id].role === "student" && (isAdminView || relevantStudentIds.has(id));
          }
          return isAdminView || isFrontOffice;
        })
        .map((id) => {
          const u = usersById[id];

          const enrolledClasses = fetchedClasses
            .filter((c) => (c.studentIds || []).includes(id))
            .map((c) => ({
              classId: c.id,
              className: c.className,
              schedule: c.schedule,
              instructorName: usersById[c.instructorId]?.displayName || "Unassigned",
            }));

          const history = attendance
            .filter((a) => a.userId === id)
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

          const assessments = progress
            .filter((report) => report.studentId === id)
            .filter((report) => selectedClassId === "all" || report.classId === selectedClassId)
            .sort((a, b) => new Date(b.examDate || b.submittedAt) - new Date(a.examDate || a.submittedAt));

          const capturedName = history[0]?.displayName || assessments[0]?.studentName || "Former Student";
          const displayName = u ? u.displayName : `${capturedName} (Archived)`;

          return {
            id,
            displayName,
            isArchived: !u,
            classes: enrolledClasses,
            attendanceCount: history.length,
            lastCheckIn: history[0]?.timestamp || null,
            history,
            assessments,
          };
        })
        .filter((student) => selectedClassId === "all" || student.classes.some((cls) => cls.classId === selectedClassId))
        .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

      setStudents(studentList);
    } catch (err) {
      console.error(err);
    } finally {
      setStudentsLoading(false);
    }
  }, [isAdminView, isFrontOffice, selectedClassId, rangeDays]);

  const fetchInstructorAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const uid = auth.currentUser?.uid;
      const { classes: rawClasses, shifts: rawShifts, instructors } =
        await fetchInstructorAnalyticsData(isAdminView, uid);

      const fetchedClasses = uniqueClasses(rawClasses);
      const fetchedShifts = rawShifts;

      const instructorsById = {};
      instructors.forEach((inst) => {
        instructorsById[inst.id] = inst;
      });

      const results = computeMonthlyPunctuality(
        fetchedClasses,
        fetchedShifts,
        instructorsById,
        selectedYear,
        selectedMonth
      );
      setAnalytics(results.sort((a, b) => (a.instructorName || "").localeCompare(b.instructorName || "")));
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [isAdminView, selectedYear, selectedMonth]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (subTab === "staff" && active) await fetchShifts();
      if (subTab === "students" && active) await fetchStudentProgress();
      if (subTab === "instructors" && active) await fetchInstructorAnalytics();
    })();
    return () => {
      active = false;
    };
  }, [subTab, fetchShifts, fetchStudentProgress, fetchInstructorAnalytics]);

  // Filtered lists for search
  const filteredShifts = useMemo(() => {
    if (!staffSearch.trim()) return shifts;
    const q = staffSearch.toLowerCase();
    return shifts.filter(
      (s) =>
        (s.displayName || "").toLowerCase().includes(q) ||
        (s.role || "").toLowerCase().includes(q) ||
        (s.className || "").toLowerCase().includes(q)
    );
  }, [shifts, staffSearch]);

  const shiftPage = usePagination(filteredShifts, 20);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const q = studentSearch.toLowerCase();
    return students.filter(
      (s) =>
        (s.displayName || "").toLowerCase().includes(q) ||
        s.classes.some((c) => c.className.toLowerCase().includes(q))
    );
  }, [students, studentSearch]);

  // Aggregate KPI summary metrics
  const kpiData = useMemo(() => {
    if (subTab === "staff") {
      const activeCount = shifts.filter((s) => getShiftStatus(s) === "on_duty").length;
      const autoClosedCount = shifts.filter((s) => s.autoClosed).length;
      return {
        metric1: { label: "Total Shift Logs", value: shifts.length, sub: "In selected period" },
        metric2: { label: "Currently On Duty", value: activeCount, sub: "Live clocked-in staff" },
        metric3: { label: "Auto-Closed Logs", value: autoClosedCount, sub: "System auto-terminations" },
      };
    }
    if (subTab === "students") {
      const totalCheckIns = students.reduce((sum, s) => sum + s.attendanceCount, 0);
      const totalAssessments = students.reduce((sum, s) => sum + s.assessments.length, 0);
      return {
        metric1: { label: "Tracked Learners", value: students.length, sub: "All statuses / records" },
        metric2: { label: "Session Check-Ins", value: totalCheckIns, sub: "Cumulative attendances" },
        metric3: { label: "Official Reports", value: totalAssessments, sub: "Graded evaluations" },
      };
    }
    if (subTab === "instructors") {
      const validRates = analytics.filter((a) => a.punctualityRate !== null);
      const avgRate = validRates.length > 0
        ? Math.round(validRates.reduce((acc, a) => acc + a.punctualityRate, 0) / validRates.length)
        : null;
      const totalAttended = analytics.reduce((acc, a) => acc + a.sessionsAttended, 0);
      return {
        metric1: { label: "Teaching Staff", value: analytics.length, sub: "Active instructors" },
        metric2: { label: "Avg Punctuality", value: avgRate !== null ? `${avgRate}%` : "N/A", sub: "15-min policy benchmark" },
        metric3: { label: "Delivered Sessions", value: totalAttended, sub: "Verified teaching shifts" },
      };
    }
    return {
      metric1: { label: "Records", value: 0, sub: "" },
      metric2: { label: "Rate", value: "-", sub: "" },
      metric3: { label: "Verified", value: 0, sub: "" },
    };
  }, [subTab, shifts, students, analytics]);

  const exportCSV = () => {
    const today = new Date().toISOString().slice(0, 10);
    if (subTab === "staff") {
      const headers = ["Name", "Role", "Class", "Clock In", "Clock Out", "Status"];
      const rows = shifts.map((s) => [
        s.displayName,
        s.role,
        s.className || "",
        s.clockIn ? new Date(s.clockIn).toLocaleString() : "",
        s.clockOut ? new Date(s.clockOut).toLocaleString() : "",
        s.autoClosed ? "Auto-Closed" : s.clockOut ? "Clocked Out" : "Active",
      ]);
      exportTableCSV(`staff-attendance-${today}`, headers, rows);
    } else if (subTab === "students") {
      const headers = ["Name", "Classes", "Check-ins", "Last Check-in", "Assessments"];
      const rows = students.map((s) => [
        s.displayName,
        s.classes.map((c) => c.className).join("; "),
        s.attendanceCount,
        s.lastCheckIn ? new Date(s.lastCheckIn).toLocaleDateString() : "",
        s.assessments.length,
      ]);
      exportTableCSV(`student-progress-${today}`, headers, rows);
    } else if (subTab === "instructors") {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const headers = [
        "Instructor", "Punctuality %", "Scheduled", "Attended", "Late", "Absent", "Avg Min Late", "Auto-Closed", "Data Quality"
      ];
      const rows = analytics.map((a) => [
        a.instructorName,
        a.punctualityRate === null ? "N/A" : a.punctualityRate,
        a.sessionsScheduled,
        a.sessionsAttended,
        a.late,
        a.absent,
        a.avgMinutesLate,
        a.autoClosedCount,
        a.limitedAccuracy ? "Limited accuracy" : "Measured",
      ]);
      exportTableCSV(`instructor-analytics-${monthNames[selectedMonth]}-${selectedYear}`, headers, rows);
    }
  };

  return (
    <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 space-y-6 text-sm max-w-5xl mx-auto shadow-sm">
      {/* ── Sub-Tab Switcher & Action Controls ── */}
      <div className="space-y-4 border-b border-slate-100 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900 text-xl tracking-tight">Institutional Reports & Analytics</h3>
            <p className="text-xs text-slate-500 font-medium">Audit logs, attendance metrics, and instructional punctuality records</p>
          </div>

          <button
            onClick={exportCSV}
            className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV Dataset</span>
          </button>
        </div>

        {/* Pill Nav */}
        <div className="flex flex-wrap gap-2">
          {!isFrontOffice && (
            <button
              onClick={() => setSubTab("staff")}
              className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 ${
                subTab === "staff"
                  ? "bg-[#1a3a8f] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Staff Duty Logs</span>
            </button>
          )}

          <button
            onClick={() => setSubTab("students")}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 ${
              subTab === "students"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Learner Progress & Attendance</span>
          </button>

          {!isFrontOffice && (
            <button
              onClick={() => setSubTab("instructors")}
              className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 ${
                subTab === "instructors"
                  ? "bg-[#1a3a8f] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Instructor Punctuality</span>
            </button>
          )}
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {subTab === "students" && (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Cohort Filter
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
              >
                <option value="all">All Academic Cohorts</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.className}
                  </option>
                ))}
              </select>
            </div>
          )}

          {subTab !== "instructors" && (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Historical Horizon
              </label>
              <select
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
              >
                <option value={30}>Last 30 Calendar Days</option>
                <option value={90}>Last 90 Calendar Days</option>
                <option value={365}>Last 12 Months</option>
                <option value={0}>All Recorded History</option>
              </select>
            </div>
          )}

          {subTab === "instructors" && (
            <>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Reporting Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
                >
                  {[
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                  ].map((m, i) => (
                    <option key={i} value={i}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Academic Year
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="flex-1 p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
                  >
                    {[now.getFullYear(), now.getFullYear() - 1].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={fetchInstructorAnalytics}
                    disabled={analyticsLoading}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
                    title="Refresh data"
                  >
                    <RefreshCw className={`w-4 h-4 ${analyticsLoading ? "animate-spin text-[#1a3a8f]" : ""}`} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Search box for Staff / Student */}
          {subTab === "staff" && (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Filter Staff
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search name, role, class..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
                />
              </div>
            </div>
          )}

          {subTab === "students" && (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Filter Students
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by student name..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Metric Summary Bento Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{kpiData.metric1.label}</p>
          <p className="text-2xl font-black text-[#1a3a8f]">{kpiData.metric1.value}</p>
          <p className="text-[10px] text-slate-500 font-medium">{kpiData.metric1.sub}</p>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{kpiData.metric2.label}</p>
          <p className="text-2xl font-black text-slate-900">{kpiData.metric2.value}</p>
          <p className="text-[10px] text-slate-500 font-medium">{kpiData.metric2.sub}</p>
        </div>
        <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{kpiData.metric3.label}</p>
          <p className="text-2xl font-black text-slate-900">{kpiData.metric3.value}</p>
          <p className="text-[10px] text-slate-500 font-medium">{kpiData.metric3.sub}</p>
        </div>
      </div>

      {/* ── SubTab 1: Staff Shifts ── */}
      {subTab === "staff" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#1a3a8f]" />
              <span>Staff Clock-In / Clock-Out Ledger</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-medium">{filteredShifts.length} Shift records</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {shiftPage.pageItems.map((s) => (
              <div
                key={s.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl hover:bg-indigo-50/30 transition shadow-2xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-slate-900 text-xs">{s.displayName}</p>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full capitalize">
                      {s.role}
                    </span>
                    {s.className && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {s.className}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">
                    Clock-In: {s.clockIn ? new Date(s.clockIn).toLocaleString() : "N/A"}
                    {s.clockOut && ` · Out: ${new Date(s.clockOut).toLocaleTimeString()}`}
                  </p>
                  {s.autoClosed && (
                    <p className="text-[10px] font-bold text-amber-700 flex items-center gap-1 mt-0.5">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>Auto-closed — session exceeded shift window without check-out</span>
                    </p>
                  )}
                </div>

                <div className="self-start sm:self-auto shrink-0">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                      s.autoClosed
                        ? "bg-amber-100 text-amber-900 border border-amber-200"
                        : s.clockOut
                        ? "bg-slate-200 text-slate-800"
                        : "bg-emerald-100 text-emerald-900 border border-emerald-200 animate-pulse"
                    }`}
                  >
                    {s.autoClosed ? "Auto-Closed" : s.clockOut ? "Completed" : "Active On Duty"}
                  </span>
                </div>
              </div>
            ))}

            {filteredShifts.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                No staff clock-in records match the current filter range.
              </div>
            )}
          </div>

          <Pagination
            page={shiftPage.page}
            totalPages={shiftPage.totalPages}
            setPage={shiftPage.setPage}
            from={shiftPage.from}
            to={shiftPage.to}
            total={shiftPage.total}
            label="shifts"
          />
        </div>
      )}

      {/* ── SubTab 2: Student Progress & Attendance ── */}
      {subTab === "students" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-[#1a3a8f]" />
              <span>Learner Attendance & Evaluation Archives</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-medium">{filteredStudents.length} Students</span>
          </div>

          {studentsLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs italic flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#1a3a8f]" />
              <span>Querying student registry & progress records...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
              No enrolled learners found for the selected criteria.
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {filteredStudents.map((s) => (
                <div
                  key={s.id}
                  className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl hover:bg-white hover:border-indigo-200 transition shadow-2xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-extrabold text-slate-900 text-sm">{s.displayName}</p>
                        {s.isArchived && (
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-200/80 px-2 py-0.5 rounded-full">
                            Archived Student
                          </span>
                        )}
                      </div>

                      {s.classes.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">No current cohort assignment</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {s.classes.map((c, i) => (
                            <span
                              key={i}
                              className="text-[10px] font-bold bg-white border border-slate-200/80 text-slate-700 px-2 py-0.5 rounded-lg"
                            >
                              📚 {c.className} ({c.schedule}) · {c.instructorName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center sm:flex-col sm:items-end gap-3 sm:gap-1 text-xs shrink-0">
                      <span className="font-extrabold text-slate-900 bg-white border border-slate-200 px-2.5 py-0.5 rounded-xl">
                        {s.attendanceCount} check-in{s.attendanceCount === 1 ? "" : "s"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Last: {s.lastCheckIn ? new Date(s.lastCheckIn).toLocaleDateString() : "Never"}
                      </span>
                      <span className="text-[11px] font-bold text-indigo-700">
                        {s.assessments.length} evaluation{s.assessments.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>

                  {/* Latest Assessment Highlights */}
                  {s.assessments.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200/80 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Most Recent Assessment
                        </p>
                        <span className="text-xs font-black text-[#1a3a8f]">
                          Band: {s.assessments[0].overallScore || "—"} / 100
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium">Date</span>
                          <p className="font-bold text-slate-800">{s.assessments[0].examDate || "N/A"}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium">CEFR Level</span>
                          <p className="font-bold text-slate-800 capitalize">{s.assessments[0].level || "N/A"}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium">Evaluator</span>
                          <p className="font-bold text-slate-800 truncate">{s.assessments[0].instructorName || "N/A"}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium">Feedback</span>
                          <p className="font-medium text-slate-700 truncate">{s.assessments[0].notes || "No notes logged"}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expand History Dropdown */}
                  {s.history.length > 0 && (
                    <div className="pt-1">
                      <button
                        onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                        className="text-xs font-bold text-[#1a3a8f] hover:underline flex items-center gap-1"
                      >
                        {expandedId === s.id ? (
                          <>
                            <span>Hide Check-In History</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <span>View All {s.history.length} Check-Ins</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>

                      {expandedId === s.id && (
                        <div className="mt-2.5 p-3 rounded-xl bg-white border border-slate-200/80 max-h-36 overflow-y-auto space-y-1">
                          {s.history.map((h) => (
                            <div key={h.id} className="flex justify-between items-center text-[11px] text-slate-500 py-0.5 border-b border-slate-50 last:border-0">
                              <span>{new Date(h.timestamp).toLocaleDateString()} at {new Date(h.timestamp).toLocaleTimeString()}</span>
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded">Present</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SubTab 3: Instructor Analytics & Punctuality ── */}
      {subTab === "instructors" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#1a3a8f]" />
              <span>Instructor Punctuality & Attendance Audit</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-medium">15-Minute Readiness Policy</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50/40 border border-indigo-100 text-xs text-slate-600 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#1a3a8f] shrink-0 mt-0.5" />
            <p>
              <strong>Academic Integrity Policy:</strong> Instructors must record attendance at least 15 minutes before the scheduled session start time to ensure classroom readiness. Clock-ins occurring inside the 15-minute preparation window are flagged as late.
            </p>
          </div>

          {analyticsLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs italic flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#1a3a8f]" />
              <span>Compiling monthly punctuality metrics...</span>
            </div>
          ) : analytics.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
              No scheduled teaching sessions recorded for this reporting period.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px]">
                      <th className="p-3">Instructor</th>
                      <th className="p-3">Punctuality Score</th>
                      <th className="p-3">Scheduled</th>
                      <th className="p-3">Attended</th>
                      <th className="p-3 text-amber-800">Late Arrivals</th>
                      <th className="p-3 text-rose-800">Absences</th>
                      <th className="p-3">Avg Tardiness</th>
                      <th className="p-3">Audit Quality</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {analytics.map((a) => (
                      <tr key={a.instructorId} className="hover:bg-indigo-50/30 transition">
                        <td className="p-3 font-extrabold text-slate-900">{a.instructorName}</td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-1 rounded-full font-extrabold text-[10px] ${
                              a.punctualityRate === null
                                ? "bg-slate-100 text-slate-500"
                                : a.punctualityRate >= 90
                                ? "bg-emerald-100 text-emerald-800"
                                : a.punctualityRate >= 75
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {a.punctualityRate === null ? "No Data" : `${a.punctualityRate}% On Time`}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-slate-700">{a.sessionsScheduled}</td>
                        <td className="p-3 font-bold text-slate-700">{a.sessionsAttended}</td>
                        <td className="p-3 font-bold text-amber-700">{a.late}</td>
                        <td className="p-3 font-bold text-rose-700">{a.absent}</td>
                        <td className="p-3 font-medium text-slate-600">
                          {a.avgMinutesLate > 0 ? `${a.avgMinutesLate} mins` : "—"}
                        </td>
                        <td className="p-3">
                          {a.limitedAccuracy ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 font-bold text-[9px]">
                              Partial (Legacy)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold text-[9px]">
                              Fully Verified
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
