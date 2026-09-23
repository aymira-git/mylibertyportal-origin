import { useState, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from "react";
import { fetchStudentProgressData } from "../reportsRepository";
import { getTodayWitaString, rangeToSince, uniqueClasses } from "../reportsUtils";
import { isStudentAtRisk, AT_RISK_LABEL } from "../atRisk";
import { exportTableCSV } from "../../shared";
import { normalizeBranch, matchesBranchFilter } from "../../../constants/branches";
import {
  GraduationCap,
  Search,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { LearnerCard } from "./LearnerCard";

const LearnerProgressTab = forwardRef(
  /**
   * @param {{ branchFilter?: string; rangeDays?: number; isAdminView?: boolean; isFrontOffice?: boolean }} props
   * @param {any} ref
   */
  function LearnerProgressTab(
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
              .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const assessments = progress
              .filter((report) => report.studentId === id)
              .filter((report) => selectedClassId === "all" || report.classId === selectedClassId)
              .sort(
                (a, b) =>
                  new Date(b.examDate || b.submittedAt).getTime() -
                  new Date(a.examDate || a.submittedAt).getTime()
              );

            const capturedName =
              history[0]?.displayName || assessments[0]?.studentName || "Former Student";
            const displayName = u ? u.displayName : `${capturedName} (Archived)`;
            const branch = normalizeBranch(u?.branch);

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
      const branchStudents =
        branchFilter === "all"
          ? students
          : students.filter((s) => matchesBranchFilter(s.branch, branchFilter));

      const totalEnrolled = branchStudents.filter((s) => !s.isArchived).length;
      const atRiskCount = branchStudents.filter((s) => s.isAtRisk).length;
      const highAttendanceCount = branchStudents.filter((s) => s.attendanceCount >= 8).length;
      const evaluatedCount = branchStudents.filter((s) => s.assessments.length > 0).length;

      return {
        totalEnrolled,
        atRiskCount,
        highAttendanceCount,
        evaluatedCount,
      };
    }, [students, branchFilter]);

    // Filtered Students List
    const filteredStudents = useMemo(() => {
      let list = students;
      if (branchFilter !== "all") {
        list = list.filter((s) => matchesBranchFilter(s.branch, branchFilter));
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
              {filteredStudents.map((s) => (
                <LearnerCard
                  key={s.id}
                  s={s}
                  isExpanded={expandedId === s.id}
                  onToggleExpand={() => setExpandedId(expandedId === s.id ? null : s.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default LearnerProgressTab;
