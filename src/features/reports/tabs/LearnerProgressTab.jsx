import { useState, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from "react";
import { fetchStudentProgressData } from "../reportsRepository";
import { getTodayWitaString, rangeToSince, uniqueClasses } from "../reportsUtils";
import { isStudentAtRisk, AT_RISK_LABEL } from "../atRisk";
import { exportTableCSV } from "../../shared";
import {
  GraduationCap,
  Search,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

const LearnerProgressTab = forwardRef(function LearnerProgressTab(
  { branchFilter = "all", rangeDays = 30, isAdminView = false, isFrontOffice = false },
  ref
) {
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
      const {
        users,
        classes: rawClasses,
        attendance,
        progress,
      } = await fetchStudentProgressData(isAdminView, isFrontOffice, rangeToSince(rangeDays));

      const usersById = {};
      users.forEach((u) => {
        usersById[u.id] = u;
      });

      const fetchedClasses = uniqueClasses(rawClasses);
      setClasses(fetchedClasses);

      const allStudentIds = new Set([
        ...Object.keys(usersById).filter((id) => usersById[id].role === "student"),
        ...fetchedClasses.flatMap((c) => c.studentIds || []),
        ...progress.map((p) => p.studentId),
      ]);

      const relevantStudentIds =
        isAdminView || isFrontOffice
          ? null
          : new Set(fetchedClasses.flatMap((c) => c.studentIds || []));

      const studentList = Array.from(allStudentIds)
        .filter((id) => {
          if (usersById[id]) {
            return (
              usersById[id].role === "student" &&
              (isAdminView || isFrontOffice || relevantStudentIds.has(id))
            );
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
            .sort(
              (a, b) =>
                new Date(b.examDate || b.submittedAt) - new Date(a.examDate || a.submittedAt)
            );

          const capturedName =
            history[0]?.displayName || assessments[0]?.studentName || "Former Student";
          const displayName = u ? u.displayName : `${capturedName} (Archived)`;
          const branch = u?.branch || "Cabang Utama";

          // Provisional (v1) At-Risk determination via modular helper
          const isAtRisk = isStudentAtRisk({
            status: u?.status || "active",
            isArchived: !u,
            joinedDate: u?.joinedDate,
            lastCheckIn: history[0]?.timestamp,
            history,
          });

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
        .filter(
          (student) =>
            selectedClassId === "all" ||
            student.classes.some((cls) => cls.classId === selectedClassId)
        )
        .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

      setStudents(studentList);
    } catch (err) {
      console.error(err);
    } finally {
      setStudentsLoading(false);
    }
  }, [isAdminView, isFrontOffice, selectedClassId, rangeDays]);

  useEffect(() => {
    fetchStudentProgress();
  }, [fetchStudentProgress]);

  // Student KPI Summary Metrics
  const studentKpiStats = useMemo(() => {
    const totalEnrolled = students.filter((s) => !s.isArchived).length;
    const atRiskCount = students.filter((s) => s.isAtRisk).length;
    const highAttendanceCount = students.filter((s) => s.attendanceCount >= 8).length;
    const evaluatedCount = students.filter((s) => s.assessments.length > 0).length;

    return {
      totalEnrolled,
      atRiskCount,
      highAttendanceCount,
      evaluatedCount,
    };
  }, [students]);

  // Filtered Students List
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
          s.classes.some((c) => (c.className || "").toLowerCase().includes(q))
      );
    }
    return list;
  }, [students, branchFilter, healthFilter, studentSearch]);

  // Expose exportCSV to parent
  useImperativeHandle(ref, () => ({
    exportCSV: () => {
      const todayStr = getTodayWitaString();
      const headers = [
        "Learner Name",
        "Campus Branch",
        "Status",
        "Drop-out Alert",
        "Classes",
        "Check-ins",
        "Last Check-in",
        "Evaluations",
      ];
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
    },
  }));

  return (
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
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#1a3a8f]">
                Active Students
              </p>
              <p className="text-2xl font-black text-[#1a3a8f] mt-1">
                {studentKpiStats.totalEnrolled}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
                At-Risk Drop-Outs
              </p>
              <p className="text-2xl font-black text-rose-900 mt-1">
                {studentKpiStats.atRiskCount}
              </p>
              <p className="text-[10px] text-rose-600 font-medium">{AT_RISK_LABEL}</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                High Attendance
              </p>
              <p className="text-2xl font-black text-emerald-900 mt-1">
                {studentKpiStats.highAttendanceCount}
              </p>
              <p className="text-[10px] text-emerald-600 font-medium">8+ Scans in period</p>
            </div>
            <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                CEFR Evaluated
              </p>
              <p className="text-2xl font-black text-blue-900 mt-1">
                {studentKpiStats.evaluatedCount}
              </p>
              <p className="text-[10px] text-blue-600 font-medium">With exam band score</p>
            </div>
          </div>

          {/* Health Filter Chips & Cohort Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setHealthFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  healthFilter === "all"
                    ? "bg-[#1a3a8f] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Learners ({students.length})
              </button>
              <button
                onClick={() => setHealthFilter("at_risk")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  healthFilter === "at_risk"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/60"
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>At Risk ({studentKpiStats.atRiskCount})</span>
              </button>
              <button
                onClick={() => setHealthFilter("regular")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  healthFilter === "regular"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Regular Attendance
              </button>
            </div>

            {/* Cohort filter */}
            {classes.length > 0 && (
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="p-1.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
              >
                <option value="all">All Cohorts ({classes.length})</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.className}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Student Rows */}
          <div className="space-y-2.5 pt-2">
            {filteredStudents.map((s) => {
              const isExpanded = expandedId === s.id;
              return (
                <div
                  key={s.id}
                  className={`p-4 rounded-2xl border transition shadow-2xs space-y-3 ${
                    s.isAtRisk
                      ? "bg-rose-50/40 border-rose-200"
                      : "bg-slate-50/70 border-slate-200/80 hover:bg-white"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-extrabold text-slate-900 text-sm">{s.displayName}</p>
                        {s.isAtRisk && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-rose-600 text-white shadow-2xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {AT_RISK_LABEL}
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
                        <p className="text-[11px] text-slate-400 italic">
                          No current cohort assignment
                        </p>
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
                        Last:{" "}
                        {s.lastCheckIn ? new Date(s.lastCheckIn).toLocaleDateString() : "Never"}
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
                          <p className="font-bold text-slate-800">
                            {s.assessments[0].examDate || "N/A"}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium">CEFR Level</span>
                          <p className="font-bold text-slate-800 capitalize">
                            {s.assessments[0].level || "N/A"}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium">Class</span>
                          <p className="font-bold text-slate-800 truncate">
                            {s.assessments[0].className || "N/A"}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium">Evaluator</span>
                          <p className="font-bold text-slate-800 truncate">
                            {s.assessments[0].instructorName || "Teacher"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expand Detailed Attendance Logs */}
                  {s.history.length > 0 && (
                    <div className="pt-1">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : s.id)}
                        className="text-xs font-bold text-[#1a3a8f] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {isExpanded ? "Hide" : "View"} {s.history.length} Attendance Records
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 p-3 bg-white rounded-xl border border-slate-200/80 space-y-1.5 max-h-48 overflow-y-auto">
                          {s.history.map((record, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0"
                            >
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="font-medium text-slate-700">
                                  {new Date(record.timestamp).toLocaleDateString([], {
                                    weekday: "short",
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                                <span>
                                  {new Date(record.timestamp).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600 uppercase">
                                  {record.method || "KIOSK"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export default LearnerProgressTab;
