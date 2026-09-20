import { useState, useEffect, useCallback, useMemo } from "react";
import { auth } from "../../firebase";
import {
  computeMonthlyPunctuality,
  getShiftStatus,
  getTodaysClasses,
  ShiftAdjustmentModal,
  StaffLeaveModal,
} from "../attendance";
import { getBatchAvailability } from "../classes";
import { exportTableCSV, Pagination, usePagination, useToast } from "../shared";
import {
  fetchStaffShifts,
  fetchTodayScansData,
  fetchStudentProgressData,
  fetchAdmissionsReportData,
  fetchInstructorAnalyticsData,
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
  UserCheck,
  Calendar,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Users,
  Edit2,
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

function getStartOfTodayWitaIso() {
  const d = new Date();
  const witaOffsetMs = 480 * 60000;
  const witaTime = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + witaOffsetMs);
  witaTime.setHours(0, 0, 0, 0);
  return new Date(witaTime.getTime() - witaOffsetMs).toISOString();
}

function getTodayWitaString() {
  const d = new Date();
  const witaOffsetMs = 480 * 60000;
  const witaDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60000) + witaOffsetMs);
  return witaDate.toISOString().slice(0, 10);
}

export default function ReportsDashboard({
  isAdminView = false,
  isFrontOffice = false,
}) {
  const toast = useToast();
  const currentUser = auth.currentUser;
  const isActualAdmin = isAdminView && !isFrontOffice;

  // Default initial subTab
  const [subTab, setSubTab] = useState(isFrontOffice || !isAdminView ? "today" : "staff");

  // Shared Horizon Range (0 = all, or days)
  const [rangeDays, setRangeDays] = useState(30);
  const rangeToSince = (days) => (days === 0 ? null : new Date(Date.now() - days * 86400000).toISOString());

  // Branch filter
  const [branchFilter, setBranchFilter] = useState("all");

  // ─── Sub-Tab 1: Today's Check-ins ──────────────────────────────────────────
  const [todayScans, setTodayScans] = useState([]);
  const [todayClasses, setTodayClasses] = useState([]);
  const [allStudentsList, setAllStudentsList] = useState([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayFilter, setTodayFilter] = useState("all"); // "all" | "checked_in" | "missing"
  const [todaySearch, setTodaySearch] = useState("");

  const fetchTodayScans = useCallback(async () => {
    setTodayLoading(true);
    try {
      const startIso = getStartOfTodayWitaIso();
      const data = await fetchTodayScansData(startIso, isAdminView, isFrontOffice);
      setTodayScans(data.scans || []);
      setTodayClasses(uniqueClasses(data.classes || []));
      setAllStudentsList(data.students || []);
    } catch (err) {
      console.error("fetchTodayScans error:", err);
      toast("Error loading today's scans: " + err.message, "error");
    } finally {
      setTodayLoading(false);
    }
  }, [isAdminView, isFrontOffice, toast]);

  // ─── Sub-Tab 2: Staff Duty Logs ────────────────────────────────────────────
  const [shifts, setShifts] = useState([]);
  const [staffMembers, setStaffMembers] = useState([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);
  const [staffSearch, setStaffSearch] = useState("");
  const [editingShift, setEditingShift] = useState(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  const fetchShifts = useCallback(async () => {
    setShiftsLoading(true);
    try {
      const data = await fetchStaffShifts(isAdminView, rangeToSince(rangeDays));
      setShifts(data.shifts || []);
      setStaffMembers(data.staffMembers || []);
    } catch (err) {
      console.error("fetchShifts error:", err);
    } finally {
      setShiftsLoading(false);
    }
  }, [isAdminView, rangeDays]);

  // ─── Sub-Tab 3: Learner Progress & Attendance ──────────────────────────────
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [healthFilter, setHealthFilter] = useState("all"); // "all" | "at_risk" | "regular"
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [studentSearch, setStudentSearch] = useState("");

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

      const fourteenDaysAgo = Date.now() - 14 * 86400000;

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
          const branch = u?.branch || "Cabang Utama";
          const joinedDate = u?.joinedDate ? new Date(u.joinedDate).getTime() : 0;
          const lastCheckInTime = history[0]?.timestamp ? new Date(history[0].timestamp).getTime() : 0;

          // At-Risk determination: Active student, joined > 14 days ago, and no check-in in last 14 days
          const isActive = u && (u.status || "active") === "active";
          const joinedOver14Days = joinedDate > 0 ? joinedDate < fourteenDaysAgo : true;
          const inactiveLast14Days = lastCheckInTime === 0 || lastCheckInTime < fourteenDaysAgo;
          const isAtRisk = isActive && joinedOver14Days && inactiveLast14Days;

          return {
            id,
            displayName,
            branch,
            isArchived: !u,
            status: u?.status || "active",
            isAtRisk,
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

  // ─── Sub-Tab 4: Admissions & Lead Velocity ─────────────────────────────────
  const [admissionsData, setAdmissionsData] = useState({ applications: [], classes: [] });
  const [admissionsLoading, setAdmissionsLoading] = useState(true);
  const [admissionsSearch, setAdmissionsSearch] = useState("");

  const fetchAdmissions = useCallback(async () => {
    setAdmissionsLoading(true);
    try {
      const data = await fetchAdmissionsReportData(rangeToSince(rangeDays));
      setAdmissionsData(data);
    } catch (err) {
      console.error("fetchAdmissions error:", err);
    } finally {
      setAdmissionsLoading(false);
    }
  }, [rangeDays]);

  // ─── Sub-Tab 5: Instructor Punctuality ─────────────────────────────────────
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [analytics, setAnalytics] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

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

  // Trigger fetches on subTab change
  useEffect(() => {
    let active = true;
    (async () => {
      if (subTab === "today" && active) await fetchTodayScans();
      if (subTab === "staff" && active) await fetchShifts();
      if (subTab === "students" && active) await fetchStudentProgress();
      if (subTab === "admissions" && active) await fetchAdmissions();
      if (subTab === "instructors" && active) await fetchInstructorAnalytics();
    })();
    return () => {
      active = false;
    };
  }, [subTab, fetchTodayScans, fetchShifts, fetchStudentProgress, fetchAdmissions, fetchInstructorAnalytics]);

  // ─── Calculations for Today's Check-ins ────────────────────────────────────
  const todayComputed = useMemo(() => {
    // Classes scheduled today
    const scheduledToday = getTodaysClasses(todayClasses);
    const expectedStudentIds = new Set(scheduledToday.flatMap((c) => c.studentIds || []));
    const scannedUserIds = new Set(todayScans.map((s) => s.userId));

    // Active expected students
    const expectedStudents = allStudentsList.filter((s) => {
      if ((s.status || "active") !== "active") return false;
      return expectedStudentIds.has(s.id);
    });

    const checkedInStudents = expectedStudents.filter((s) => scannedUserIds.has(s.id));
    const missingStudents = expectedStudents.filter((s) => !scannedUserIds.has(s.id));

    return {
      scheduledClassesCount: scheduledToday.length,
      expectedCount: expectedStudents.length,
      checkedInCount: checkedInStudents.length,
      missingCount: missingStudents.length,
      expectedStudents,
      checkedInStudents,
      missingStudents,
    };
  }, [todayClasses, todayScans, allStudentsList]);

  // Filtered Today List
  const filteredTodayList = useMemo(() => {
    let list;
    if (todayFilter === "checked_in") {
      list = todayComputed.checkedInStudents;
    } else if (todayFilter === "missing") {
      list = todayComputed.missingStudents;
    } else {
      list = todayComputed.expectedStudents;
    }

    if (branchFilter !== "all") {
      list = list.filter((s) => (s.branch || "Cabang Utama") === branchFilter);
    }

    if (todaySearch.trim()) {
      const q = todaySearch.toLowerCase();
      list = list.filter((s) => (s.displayName || "").toLowerCase().includes(q));
    }

    return list;
  }, [todayComputed, todayFilter, branchFilter, todaySearch]);

  // ─── Filtered Shifts List ──────────────────────────────────────────────────
  const filteredShifts = useMemo(() => {
    let list = shifts;
    if (branchFilter !== "all") {
      list = list.filter((s) => (s.branch || "Cabang Utama") === branchFilter);
    }
    if (staffSearch.trim()) {
      const q = staffSearch.toLowerCase();
      list = list.filter(
        (s) =>
          (s.displayName || "").toLowerCase().includes(q) ||
          (s.role || "").toLowerCase().includes(q) ||
          (s.className || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [shifts, branchFilter, staffSearch]);

  const shiftPage = usePagination(filteredShifts, 20);

  // ─── Filtered Students List ────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    let list = students;
    if (branchFilter !== "all") {
      list = list.filter((s) => s.branch === branchFilter);
    }
    if (healthFilter === "at_risk") {
      list = list.filter((s) => s.isAtRisk);
    } else if (healthFilter === "regular") {
      list = list.filter((s) => !s.isAtRisk && !s.isArchived);
    }
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      list = list.filter(
        (s) =>
          (s.displayName || "").toLowerCase().includes(q) ||
          s.classes.some((c) => c.className.toLowerCase().includes(q))
      );
    }
    return list;
  }, [students, branchFilter, healthFilter, studentSearch]);

  // ─── Admissions Calculations ───────────────────────────────────────────────
  const admissionsCalculated = useMemo(() => {
    const apps = admissionsData.applications || [];
    const cls = admissionsData.classes || [];

    const pending = apps.filter((a) => (a.status || "pending") === "pending").length;
    const approved = apps.filter((a) => a.status === "approved").length;
    const rejected = apps.filter((a) => a.status === "rejected").length;

    // Enrolled: approved applications whose studentId or email is enrolled in any class
    const enrolledIds = new Set(cls.flatMap((c) => c.studentIds || []));
    const enrolled = apps.filter((a) => a.status === "approved" && a.studentId && enrolledIds.has(a.studentId)).length;

    // Total seat capacity & availability
    let totalCapacity = 0;
    let totalAvailableSeats = 0;
    cls.forEach((c) => {
      const avail = getBatchAvailability(c);
      totalCapacity += avail.capacity;
      totalAvailableSeats += avail.seatsAvailable;
    });

    const seatOccupancy = totalCapacity > 0
      ? Math.round(((totalCapacity - totalAvailableSeats) / totalCapacity) * 100)
      : 0;

    return {
      totalInquiries: apps.length,
      pending,
      approved,
      rejected,
      enrolled,
      seatOccupancy,
      totalCapacity,
      totalAvailableSeats,
    };
  }, [admissionsData]);

  // ─── CSV Export Functionality ──────────────────────────────────────────────
  const exportCSV = () => {
    const todayStr = getTodayWitaString();

    if (subTab === "today") {
      const headers = ["Student Name", "Status Today", "Campus Branch", "Scan Timestamp", "Method"];
      const scannedMap = new Map(todayScans.map((s) => [s.userId, s]));
      const rows = filteredTodayList.map((s) => {
        const scan = scannedMap.get(s.id);
        return [
          s.displayName,
          scan ? "Checked In" : "Missing / Not In",
          s.branch || "Cabang Utama",
          scan?.timestamp ? new Date(scan.timestamp).toLocaleTimeString() : "—",
          scan?.method || "—",
        ];
      });
      exportTableCSV(`MYLIBERTY-Todays-Checkins-${todayStr}`, headers, rows);
    } else if (subTab === "staff") {
      const headers = ["Staff Name", "Role", "Campus Branch", "Class", "Clock In", "Clock Out", "Derived Status", "Auto-Closed"];
      const rows = filteredShifts.map((s) => [
        s.displayName,
        s.role,
        s.branch || "Cabang Utama",
        s.className || "",
        s.clockIn ? new Date(s.clockIn).toLocaleString() : "",
        s.clockOut ? new Date(s.clockOut).toLocaleString() : "",
        getShiftStatus(s),
        s.autoClosed ? "YES" : "NO",
      ]);
      exportTableCSV(`MYLIBERTY-Staff-Attendance-${todayStr}`, headers, rows);
    } else if (subTab === "students") {
      const headers = ["Learner Name", "Campus Branch", "Status", "Drop-out Alert", "Classes", "Check-ins", "Last Check-in", "Evaluations"];
      const rows = filteredStudents.map((s) => [
        s.displayName,
        s.branch,
        s.status,
        s.isAtRisk ? "AT RISK (14d+ Inactive)" : "Normal",
        s.classes.map((c) => c.className).join("; "),
        s.attendanceCount,
        s.lastCheckIn ? new Date(s.lastCheckIn).toLocaleDateString() : "Never",
        s.assessments.length,
      ]);
      exportTableCSV(`MYLIBERTY-Learner-Progress-${todayStr}`, headers, rows);
    } else if (subTab === "admissions") {
      const headers = ["Applicant Name", "Program Applied", "Campus Branch", "Status", "Submission Date"];
      const rows = (admissionsData.applications || []).map((a) => [
        a.fullName || a.studentName || "Prospective Student",
        a.program || a.courseType || "General English",
        a.branch || "Cabang Utama",
        a.status || "pending",
        a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "",
      ]);
      exportTableCSV(`MYLIBERTY-Admissions-Analytics-${todayStr}`, headers, rows);
    } else if (subTab === "instructors") {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
      ];
      const headers = [
        "Instructor", "Punctuality %", "Scheduled", "Attended", "Late Arrivals", "Absences", "Avg Tardiness (min)", "Data Quality",
      ];
      const rows = analytics.map((a) => [
        a.instructorName,
        a.punctualityRate === null ? "N/A" : `${a.punctualityRate}%`,
        a.sessionsScheduled,
        a.sessionsAttended,
        a.late,
        a.absent,
        a.avgMinutesLate,
        a.limitedAccuracy ? "Partial (Legacy)" : "Verified",
      ]);
      exportTableCSV(`MYLIBERTY-Instructor-Punctuality-${monthNames[selectedMonth]}-${selectedYear}`, headers, rows);
    }
  };

  return (
    <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 space-y-6 text-sm max-w-6xl mx-auto shadow-sm">
      {/* ── Cockpit Header & Export ── */}
      <div className="space-y-4 border-b border-slate-100 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-slate-900 text-xl tracking-tight">
                Institutional Reports &amp; Analytics
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[#1a3a8f] font-extrabold text-[10px] tracking-wide">
                WITA (UTC+8)
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              MYLIBERTY International English School — Operational audit logs &amp; performance metrics
            </p>
          </div>

          <button
            onClick={exportCSV}
            className="inline-flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-xs transition shrink-0 active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV Dataset</span>
          </button>
        </div>

        {/* Navigation Pills */}
        <div className="flex flex-wrap gap-2 pt-1">
          {/* Sub-Tab: Today's Check-ins */}
          <button
            onClick={() => setSubTab("today")}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 ${
              subTab === "today"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Today&apos;s Check-ins</span>
          </button>

          {/* Sub-Tab: Staff Duty Logs */}
          <button
            onClick={() => setSubTab("staff")}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 ${
              subTab === "staff"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isActualAdmin || isAdminView ? "Staff Duty Logs" : "My Duty Log"}</span>
          </button>

          {/* Sub-Tab: Learner Progress & Attendance */}
          <button
            onClick={() => setSubTab("students")}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 ${
              subTab === "students"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Learner Progress</span>
          </button>

          {/* Sub-Tab: Admissions Velocity (Admin, Manager, Front Office) */}
          {(isAdminView || isFrontOffice) && (
            <button
              onClick={() => setSubTab("admissions")}
              className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center gap-2 ${
                subTab === "admissions"
                  ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Admissions &amp; Leads</span>
            </button>
          )}

          {/* Sub-Tab: Instructor Punctuality (Admin, Manager, Instructor) */}
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
              <span>{isActualAdmin || isAdminView ? "Instructor Punctuality" : "My Punctuality"}</span>
            </button>
          )}
        </div>

        {/* Global Controls & Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          {/* Branch Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Campus Branch
            </label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
            >
              <option value="all">All Campuses</option>
              <option value="Cabang Utama">Cabang Utama</option>
            </select>
          </div>

          {/* Date Horizon Presets (for staff, students, admissions) */}
          {subTab !== "today" && subTab !== "instructors" && (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Historical Horizon
              </label>
              <select
                value={rangeDays}
                onChange={(e) => setRangeDays(Number(e.target.value))}
                className="w-full p-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
              >
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Calendar Days</option>
                <option value={90}>Last 90 Calendar Days</option>
                <option value={365}>Last 12 Months</option>
                <option value={0}>All Recorded History</option>
              </select>
            </div>
          )}

          {/* Cohort filter for students */}
          {subTab === "students" && (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Cohort Filter
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
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

          {/* Health Filter for students */}
          {subTab === "students" && (
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Attendance Health
              </label>
              <select
                value={healthFilter}
                onChange={(e) => setHealthFilter(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
              >
                <option value="all">All Learners</option>
                <option value="at_risk">🚨 At Risk (14+ Days Inactive)</option>
                <option value="regular">Regular Attendees</option>
              </select>
            </div>
          )}

          {/* Monthly / Yearly for Instructors */}
          {subTab === "instructors" && (
            <>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Audit Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
                >
                  {[
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December",
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
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full p-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
                >
                  {[now.getFullYear(), now.getFullYear() - 1].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── SUB-TAB 1: TODAY'S CHECK-INS ─────────────────────────────────────── */}
      {subTab === "today" && (
        <div className="space-y-4">
          {/* Summary Bento */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#1a3a8f]">
                Expected Today
              </p>
              <p className="text-2xl font-black text-slate-900 mt-1">{todayComputed.expectedCount}</p>
              <p className="text-[10px] text-slate-500 font-medium">In {todayComputed.scheduledClassesCount} classes</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                Checked In
              </p>
              <p className="text-2xl font-black text-emerald-950 mt-1">{todayComputed.checkedInCount}</p>
              <p className="text-[10px] text-emerald-700 font-medium">Recorded at kiosk</p>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                Not Yet In
              </p>
              <p className="text-2xl font-black text-rose-950 mt-1">{todayComputed.missingCount}</p>
              <p className="text-[10px] text-rose-700 font-medium">Pending arrival</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Arrival Rate
              </p>
              <p className="text-2xl font-black text-slate-800 mt-1">
                {todayComputed.expectedCount > 0
                  ? `${Math.round((todayComputed.checkedInCount / todayComputed.expectedCount) * 100)}%`
                  : "N/A"}
              </p>
              <p className="text-[10px] text-slate-400 font-medium">Daily attendance</p>
            </div>
          </div>

          {/* Sub-Filters and Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTodayFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  todayFilter === "all" ? "bg-[#1a3a8f] text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Expected ({todayComputed.expectedCount})
              </button>
              <button
                onClick={() => setTodayFilter("checked_in")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  todayFilter === "checked_in" ? "bg-emerald-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Checked In ({todayComputed.checkedInCount})
              </button>
              <button
                onClick={() => setTodayFilter("missing")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  todayFilter === "missing" ? "bg-rose-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Missing ({todayComputed.missingCount})
              </button>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search learner by name..."
                value={todaySearch}
                onChange={(e) => setTodaySearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
              />
            </div>
          </div>

          {/* List of Today's Expected Students */}
          {todayLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs italic flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#1a3a8f]" />
              <span>Checking live attendance records for today...</span>
            </div>
          ) : filteredTodayList.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs italic bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
              No learners match your today filter.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filteredTodayList.map((student) => {
                const scan = todayScans.find((s) => s.userId === student.id);
                const isCheckedIn = Boolean(scan);
                return (
                  <div
                    key={student.id}
                    className="p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 bg-white hover:border-slate-300 transition shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isCheckedIn ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {isCheckedIn ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-slate-900 text-xs truncate">
                          {student.displayName}
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          {student.branch || "Cabang Utama"}
                          {scan && ` · Scanned at ${new Date(scan.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span
                        className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
                          isCheckedIn
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-rose-50 text-rose-800 border-rose-200"
                        }`}
                      >
                        {isCheckedIn ? "Present" : "Not In Yet"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SUB-TAB 2: STAFF DUTY LOGS ───────────────────────────────────────── */}
      {subTab === "staff" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#1a3a8f]" />
                <span>{isActualAdmin || isAdminView ? "Staff Clock-In / Clock-Out Ledger" : "My Clock-In / Out History"}</span>
              </h4>
              <p className="text-[11px] text-slate-400 font-medium">
                {filteredShifts.length} Shift records in selected horizon
              </p>
            </div>

            {/* Admin actions: Log leave & Adjust */}
            {isActualAdmin && (
              <button
                onClick={() => setLeaveModalOpen(true)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Log Staff Leave / Absence</span>
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff, role, or cohort class..."
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
            />
          </div>

          {shiftsLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs italic flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#1a3a8f]" />
              <span>Loading duty records...</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {shiftPage.pageItems.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl hover:bg-indigo-50/30 transition shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-extrabold text-slate-900 text-xs">{s.displayName}</p>
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full capitalize">
                        {s.role}
                      </span>
                      {s.branch && (
                        <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                          {s.branch}
                        </span>
                      )}
                      {s.className && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                          {s.className}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Clock-In: {s.clockIn ? new Date(s.clockIn).toLocaleString() : "N/A"}
                      {s.clockOut && ` · Out: ${new Date(s.clockOut).toLocaleTimeString()}`}
                    </p>
                    {s.autoClosed && (
                      <p className="text-[10px] font-bold text-amber-700 flex items-center gap-1 mt-0.5">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>Auto-closed session exceeded shift window</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
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

                    {/* Admin Shift Adjustment */}
                    {isActualAdmin && (
                      <button
                        onClick={() => setEditingShift(s)}
                        className="p-1.5 text-slate-400 hover:text-[#1a3a8f] rounded-lg hover:bg-slate-200/60 transition"
                        title="Adjust / Audit Shift"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {filteredShifts.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                  No staff clock-in records match the current filter range.
                </div>
              )}
            </div>
          )}

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

      {/* ── SUB-TAB 3: LEARNER PROGRESS & ATTENDANCE ─────────────────────────── */}
      {subTab === "students" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-[#1a3a8f]" />
                <span>Learner Attendance, Health &amp; Evaluation Archives</span>
              </h4>
              <p className="text-[11px] text-slate-400 font-medium">
                {filteredStudents.length} Students in registry
              </p>
            </div>

            <div className="relative max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
              />
            </div>
          </div>

          {studentsLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs italic flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#1a3a8f]" />
              <span>Querying student registry &amp; progress records...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
              No enrolled learners match your filters.
            </div>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {filteredStudents.map((s) => (
                <div
                  key={s.id}
                  className={`p-4 rounded-2xl border transition shadow-2xs space-y-3 ${
                    s.isAtRisk ? "bg-rose-50/40 border-rose-200" : "bg-slate-50/70 border-slate-200/80 hover:bg-white"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-extrabold text-slate-900 text-sm">{s.displayName}</p>
                        {s.isAtRisk && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-rose-600 text-white shadow-2xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            At Risk (14d+ Inactive)
                          </span>
                        )}
                        <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                          {s.branch}
                        </span>
                        {s.isArchived && (
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-200/80 px-2 py-0.5 rounded-full">
                            Archived
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
                    </div>
                  </div>

                  {/* Most Recent Assessment */}
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

      {/* ── SUB-TAB 4: ADMISSIONS & LEAD VELOCITY ─────────────────────────────── */}
      {subTab === "admissions" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#1a3a8f]">Total Inquiries</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{admissionsCalculated.totalInquiries}</p>
              <p className="text-[10px] text-slate-500 font-medium">Registrations</p>
            </div>
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Pending Review</p>
              <p className="text-2xl font-black text-amber-950 mt-1">{admissionsCalculated.pending}</p>
              <p className="text-[10px] text-amber-700 font-medium">Awaiting call</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">Approved</p>
              <p className="text-2xl font-black text-emerald-950 mt-1">{admissionsCalculated.approved}</p>
              <p className="text-[10px] text-emerald-700 font-medium">Admitted students</p>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800">Enrolled</p>
              <p className="text-2xl font-black text-blue-950 mt-1">{admissionsCalculated.enrolled}</p>
              <p className="text-[10px] text-blue-700 font-medium">In cohort batch</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Seat Occupancy</p>
              <p className="text-2xl font-black text-slate-900 mt-1">{admissionsCalculated.seatOccupancy}%</p>
              <p className="text-[10px] text-slate-400 font-medium">{admissionsCalculated.totalAvailableSeats} open seats</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#1a3a8f]" />
              <span>Applicant Pipeline &amp; Conversion Ledger</span>
            </h4>
            <div className="relative max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search applicant name or phone..."
                value={admissionsSearch}
                onChange={(e) => setAdmissionsSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
              />
            </div>
          </div>

          {admissionsLoading ? (
            <div className="p-12 text-center text-slate-400 text-xs italic flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-[#1a3a8f]" />
              <span>Aggregating admissions data...</span>
            </div>
          ) : admissionsData.applications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
              No admissions records found in the selected horizon.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {admissionsData.applications
                .filter((a) => {
                  if (branchFilter !== "all" && (a.branch || "Cabang Utama") !== branchFilter) return false;
                  if (admissionsSearch.trim()) {
                    const q = admissionsSearch.toLowerCase();
                    const matchName = (a.fullName || a.studentName || "").toLowerCase().includes(q);
                    const matchPhone = (a.phone || "").includes(q);
                    if (!matchName && !matchPhone) return false;
                  }
                  return true;
                })
                .map((app) => (
                  <div
                    key={app.id}
                    className="p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 bg-white hover:border-slate-300 transition shadow-2xs"
                  >
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-900 text-xs truncate">
                        {app.fullName || app.studentName || "Prospective Student"}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {app.program || app.courseType || "General English"} · {app.branch || "Cabang Utama"}
                        {app.submittedAt && ` · Applied: ${new Date(app.submittedAt).toLocaleDateString()}`}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border shrink-0 ${
                        app.status === "approved"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : app.status === "rejected"
                          ? "bg-slate-100 text-slate-600 border-slate-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}
                    >
                      {app.status || "Pending"}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ── SUB-TAB 5: INSTRUCTOR PUNCTUALITY & READINESS ─────────────────────── */}
      {subTab === "instructors" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#1a3a8f]" />
              <span>Instructor Punctuality &amp; Attendance Audit</span>
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

      {/* ── Modals for Admin ── */}
      {isActualAdmin && editingShift && (
        <ShiftAdjustmentModal
          shift={editingShift}
          actor={currentUser}
          onClose={() => setEditingShift(null)}
          onSuccess={() => {
            setEditingShift(null);
            fetchShifts();
          }}
        />
      )}

      {isActualAdmin && leaveModalOpen && (
        <StaffLeaveModal
          staff={staffMembers}
          actor={currentUser}
          onClose={() => setLeaveModalOpen(false)}
          onSuccess={() => {
            setLeaveModalOpen(false);
            fetchShifts();
          }}
        />
      )}
    </div>
  );
}
