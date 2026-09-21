import { useState, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from "react";
import { fetchTodayScansData } from "../reportsRepository";
import { getStartOfTodayWitaIso, getTodayWitaString, uniqueClasses } from "../reportsUtils";
import { getTodaysClasses } from "../../attendance";
import { exportTableCSV, useToast } from "../../shared";
import { Clock, CheckCircle2, XCircle, Search, RefreshCw } from "lucide-react";
import { normalizeBranch, matchesBranchFilter } from "../../../constants/branches";

const TodayTab = forwardRef(
  /**
   * @param {{ branchFilter?: string; isAdminView?: boolean; isFrontOffice?: boolean }} props
   * @param {any} ref
   */
  function TodayTab({ branchFilter = "all", isAdminView = false, isFrontOffice = false }, ref) {
    const toast = useToast();
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

    useEffect(() => {
      fetchTodayScans();
    }, [fetchTodayScans]);

    // Today's Computed Metrics
    const todayComputed = useMemo(() => {
      const scheduledClasses = getTodaysClasses(todayClasses);
      const scheduledStudentIds = new Set(scheduledClasses.flatMap((cls) => cls.studentIds || []));

      const expectedStudents = allStudentsList.filter((s) => scheduledStudentIds.has(s.id));
      const scannedUserIds = new Set(todayScans.map((s) => s.userId));

      const checkedInStudents = expectedStudents.filter((s) => scannedUserIds.has(s.id));
      const missingStudents = expectedStudents.filter((s) => !scannedUserIds.has(s.id));

      return {
        scheduledClassesCount: scheduledClasses.length,
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
        list = list.filter((s) => matchesBranchFilter(s.branch, branchFilter));
      }

      if (todaySearch.trim()) {
        const q = todaySearch.toLowerCase();
        list = list.filter((s) => (s.displayName || "").toLowerCase().includes(q));
      }

      return list;
    }, [todayComputed, todayFilter, branchFilter, todaySearch]);

    // Expose exportCSV to parent
    useImperativeHandle(ref, () => ({
      exportCSV: () => {
        const todayStr = getTodayWitaString();
        const headers = [
          "Student Name",
          "Status Today",
          "Campus Branch",
          "Scan Timestamp",
          "Method",
        ];
        const scannedMap = new Map(todayScans.map((s) => [s.userId, s]));
        const rows = filteredTodayList.map((s) => {
          const scan = scannedMap.get(s.id);
          return [
            s.displayName,
            scan ? "Checked In" : "Missing / Not In",
            normalizeBranch(s.branch),
            scan?.timestamp ? new Date(scan.timestamp).toLocaleTimeString() : "—",
            scan?.method || "—",
          ];
        });
        exportTableCSV(`MYLIBERTY-Todays-Checkins-${todayStr}`, headers, rows);
      },
    }));

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#1a3a8f]" />
              <span>Today&apos;s Expected Students vs Live Check-Ins</span>
            </h4>
            <p className="text-[11px] text-slate-400 font-medium">
              Based on active class rosters scheduled for today (WITA)
            </p>
          </div>

          <button
            onClick={fetchTodayScans}
            disabled={todayLoading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${todayLoading ? "animate-spin" : ""}`} />
            <span>Refresh Scans</span>
          </button>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#1a3a8f]">
              Expected Today
            </p>
            <p className="text-2xl font-black text-[#1a3a8f] mt-1">{todayComputed.expectedCount}</p>
            <p className="text-[10px] text-slate-500 font-medium">
              In {todayComputed.scheduledClassesCount} classes
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Checked In
            </p>
            <p className="text-2xl font-black text-emerald-950 mt-1">
              {todayComputed.checkedInCount}
            </p>
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
                todayFilter === "all"
                  ? "bg-[#1a3a8f] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Expected ({todayComputed.expectedCount})
            </button>
            <button
              onClick={() => setTodayFilter("checked_in")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                todayFilter === "checked_in"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Checked In ({todayComputed.checkedInCount})
            </button>
            <button
              onClick={() => setTodayFilter("missing")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                todayFilter === "missing"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
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
                        isCheckedIn
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {isCheckedIn ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-slate-900 text-xs truncate">
                        {student.displayName}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        {normalizeBranch(student.branch)}
                        {scan &&
                          ` · Scanned at ${new Date(scan.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
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
    );
  }
);

export default TodayTab;
