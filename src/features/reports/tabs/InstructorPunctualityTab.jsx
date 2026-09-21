import { useState, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from "react";
import { auth } from "../../../firebase";
import { fetchInstructorAnalyticsData } from "../reportsRepository";
import { computeMonthlyPunctuality } from "../../attendance";
import { uniqueClasses } from "../reportsUtils";
import { exportTableCSV } from "../../shared";
import { UserCheck, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { matchesBranchFilter, normalizeBranch } from "../../../constants/branches";

const InstructorPunctualityTab = forwardRef(
  /**
   * @param {{ isAdminView?: boolean; branchFilter?: string }} props
   * @param {any} ref
   */
  function InstructorPunctualityTab({ isAdminView = false, branchFilter = "all" }, ref) {
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [analytics, setAnalytics] = useState([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);

    const fetchInstructorAnalytics = useCallback(async () => {
      setAnalyticsLoading(true);
      try {
        const uid = auth.currentUser?.uid;
        const {
          classes: rawClasses,
          shifts: rawShifts,
          instructors,
        } = await fetchInstructorAnalyticsData(isAdminView, uid);

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
        setAnalytics(
          results.sort((a, b) => (a.instructorName || "").localeCompare(b.instructorName || ""))
        );
      } catch (err) {
        console.error(err);
      } finally {
        setAnalyticsLoading(false);
      }
    }, [isAdminView, selectedYear, selectedMonth]);

    useEffect(() => {
      fetchInstructorAnalytics();
    }, [fetchInstructorAnalytics]);

    const monthNames = useMemo(
      () => [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ],
      []
    );

    const filteredAnalytics = useMemo(() => {
      if (branchFilter === "all") return analytics;
      return analytics.filter((a) => matchesBranchFilter(a.branch, branchFilter));
    }, [analytics, branchFilter]);

    // Expose exportCSV to parent
    useImperativeHandle(ref, () => ({
      exportCSV: () => {
        const headers = [
          "Instructor",
          "Campus Branch",
          "Punctuality %",
          "Scheduled",
          "Attended",
          "Late Arrivals",
          "Absences",
          "Avg Tardiness (min)",
          "Data Quality",
        ];
        const rows = filteredAnalytics.map((a) => [
          a.instructorName,
          normalizeBranch(a.branch),
          a.punctualityRate === null ? "N/A" : `${a.punctualityRate}%`,
          a.sessionsScheduled,
          a.sessionsAttended,
          a.late,
          a.absent,
          a.avgMinutesLate,
          a.limitedAccuracy ? "Partial (Legacy)" : "Verified",
        ]);
        exportTableCSV(
          `MYLIBERTY-Instructor-Punctuality-${monthNames[selectedMonth]}-${selectedYear}`,
          headers,
          rows
        );
      },
    }));

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-[#1a3a8f]" />
              <span>Instructor 15-Minute Readiness Audit Scorecard</span>
            </h4>
            <p className="text-[11px] text-slate-400 font-medium">
              Readiness policy compliance based on required 15m pre-class clock-in
            </p>
          </div>

          {/* Month & Year Selectors */}
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="p-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
            >
              {monthNames.map((name, idx) => (
                <option key={idx} value={idx}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="p-2 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
            >
              {[selectedYear - 1, selectedYear, selectedYear + 1].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>

            <button
              onClick={fetchInstructorAnalytics}
              disabled={analyticsLoading}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
              title="Refresh Audit"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {analyticsLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs italic flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#1a3a8f]" />
            <span>
              Computing readiness audit compliance for {monthNames[selectedMonth]} {selectedYear}...
            </span>
          </div>
        ) : analytics.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
            No scheduled classes found for this month.
          </div>
        ) : (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-2xl border border-slate-200/90 shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider">
                    <th className="p-3.5">Instructor</th>
                    <th className="p-3.5">Campus</th>
                    <th className="p-3.5 text-center">Scheduled</th>
                    <th className="p-3.5 text-center">Attended</th>
                    <th className="p-3.5 text-center">Late</th>
                    <th className="p-3.5 text-center">Absent</th>
                    <th className="p-3.5 text-center">Avg Late (Min)</th>
                    <th className="p-3.5 text-center">Readiness Rate</th>
                    <th className="p-3.5 text-right">Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredAnalytics.map((a) => {
                    const rate = a.punctualityRate;
                    const isExemplary = rate !== null && rate >= 90;
                    const isSatisfactory = rate !== null && rate >= 75 && rate < 90;

                    return (
                      <tr key={a.instructorId} className="hover:bg-slate-50/70 transition">
                        <td className="p-3.5 font-extrabold text-slate-900">
                          {a.instructorName}
                          {a.limitedAccuracy && (
                            <span className="block text-[10px] text-amber-600 font-medium">
                              * Partial historical scan data
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-semibold text-slate-500 text-xs">
                          {normalizeBranch(a.branch)}
                        </td>
                        <td className="p-3.5 text-center font-semibold text-slate-700">
                          {a.sessionsScheduled}
                        </td>
                        <td className="p-3.5 text-center font-semibold text-slate-700">
                          {a.sessionsAttended}
                        </td>
                        <td className="p-3.5 text-center font-bold text-rose-600">{a.late}</td>
                        <td className="p-3.5 text-center font-bold text-slate-400">{a.absent}</td>
                        <td className="p-3.5 text-center font-semibold text-slate-700">
                          {a.avgMinutesLate}m
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="font-black text-slate-900">
                            {rate === null ? "—" : `${rate}%`}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase tracking-wider ${
                              rate === null
                                ? "bg-slate-100 text-slate-500"
                                : isExemplary
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : isSatisfactory
                                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                                    : "bg-rose-100 text-rose-800 border border-rose-200"
                            }`}
                          >
                            {isExemplary ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                            )}
                            <span>
                              {rate === null
                                ? "No Data"
                                : isExemplary
                                  ? "Exemplary"
                                  : isSatisfactory
                                    ? "Satisfactory"
                                    : "Needs Review"}
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default InstructorPunctualityTab;
