import { useState, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from "react";
import { fetchAdmissionsReportData } from "../reportsRepository";
import { getTodayWitaString, rangeToSince } from "../reportsUtils";
import { getBatchAvailability } from "../../classes";
import { exportTableCSV } from "../../shared";
import { TrendingUp, School, RefreshCw, Search, Users } from "lucide-react";

const AdmissionsTab = forwardRef(
  /**
   * @param {{ branchFilter?: string; rangeDays?: number }} props
   * @param {any} ref
   */
  function AdmissionsTab({ branchFilter = "all", rangeDays = 30 }, ref) {
    const [admissionsData, setAdmissionsData] = useState({ applications: [], classes: [] });
    const [admissionsLoading, setAdmissionsLoading] = useState(true);
    const [admissionsSearch, setAdmissionsSearch] = useState("");

    const fetchAdmissions = useCallback(async () => {
      setAdmissionsLoading(true);
      try {
        const data = await fetchAdmissionsReportData(rangeToSince(rangeDays));
        setAdmissionsData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setAdmissionsLoading(false);
      }
    }, [rangeDays]);

    useEffect(() => {
      fetchAdmissions();
    }, [fetchAdmissions]);

    // Admissions Metrics & Funnel
    const admissionsCalculated = useMemo(() => {
      let apps = admissionsData.applications || [];
      let cls = admissionsData.classes || [];

      if (branchFilter !== "all") {
        apps = apps.filter((a) => (a.branch || "Cabang Utama") === branchFilter);
      }

      const pending = apps.filter((a) => (a.status || "pending") === "pending").length;
      const approved = apps.filter((a) => a.status === "approved").length;
      const rejected = apps.filter((a) => a.status === "rejected").length;

      // Enrolled: approved applications whose studentId is enrolled in any class
      const enrolledIds = new Set(cls.flatMap((c) => c.studentIds || []));
      const enrolled = apps.filter(
        (a) => a.status === "approved" && a.studentId && enrolledIds.has(a.studentId)
      ).length;

      let totalCapacity = 0;
      let totalAvailableSeats = 0;
      cls.forEach((c) => {
        const avail = getBatchAvailability(c);
        totalCapacity += avail.capacity;
        totalAvailableSeats += avail.seatsAvailable;
      });

      const seatOccupancy =
        totalCapacity > 0
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
        filteredApps: apps,
        classes: cls,
      };
    }, [admissionsData, branchFilter]);

    // Expose exportCSV to parent
    useImperativeHandle(ref, () => ({
      exportCSV: () => {
        const todayStr = getTodayWitaString();
        const headers = [
          "Applicant Name",
          "Program Applied",
          "Campus Branch",
          "Status",
          "Submission Date",
        ];
        const rows = (admissionsCalculated.filteredApps || []).map((a) => [
          a.fullName || a.studentName || "Prospective Student",
          a.program || a.courseType || "General English",
          a.branch || "Cabang Utama",
          a.status || "pending",
          a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "",
        ]);
        exportTableCSV(`MYLIBERTY-Admissions-Analytics-${todayStr}`, headers, rows);
      },
    }));

    const displayedApps = useMemo(() => {
      let list = admissionsCalculated.filteredApps || [];
      if (admissionsSearch.trim()) {
        const q = admissionsSearch.toLowerCase();
        list = list.filter(
          (a) =>
            (a.fullName || a.studentName || "").toLowerCase().includes(q) ||
            (a.phone || "").includes(q) ||
            (a.program || "").toLowerCase().includes(q)
        );
      }
      return list;
    }, [admissionsCalculated, admissionsSearch]);

    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#1a3a8f]" />
              <span>Admissions Funnel &amp; Batch Capacity Intelligence</span>
            </h4>
            <p className="text-[11px] text-slate-400 font-medium">
              Student acquisition conversion and class seat saturation
            </p>
          </div>

          <button
            onClick={fetchAdmissions}
            disabled={admissionsLoading}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${admissionsLoading ? "animate-spin" : ""}`} />
            <span>Refresh Funnel</span>
          </button>
        </div>

        {admissionsLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs italic flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#1a3a8f]" />
            <span>Aggregating admissions funnel &amp; batch availability...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Funnel KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1a3a8f]">
                  Total Inquiries
                </p>
                <p className="text-2xl font-black text-[#1a3a8f] mt-1">
                  {admissionsCalculated.totalInquiries}
                </p>
                <p className="text-[10px] text-slate-500 font-medium">In selected horizon</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                  Pending Review
                </p>
                <p className="text-2xl font-black text-amber-950 mt-1">
                  {admissionsCalculated.pending}
                </p>
                <p className="text-[10px] text-amber-700 font-medium">Under admissions review</p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Approved
                </p>
                <p className="text-2xl font-black text-emerald-950 mt-1">
                  {admissionsCalculated.approved}
                </p>
                <p className="text-[10px] text-emerald-700 font-medium">Ready for placement</p>
              </div>
              <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-800">
                  Active Enrolled
                </p>
                <p className="text-2xl font-black text-blue-950 mt-1">
                  {admissionsCalculated.enrolled}
                </p>
                <p className="text-[10px] text-blue-700 font-medium">Placed in cohorts</p>
              </div>
              <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                  Rejected / Drop
                </p>
                <p className="text-2xl font-black text-rose-950 mt-1">
                  {admissionsCalculated.rejected}
                </p>
                <p className="text-[10px] text-rose-700 font-medium">Unsuitable / cancelled</p>
              </div>
            </div>

            {/* Academy Seat Utilization */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <School className="w-4 h-4 text-[#1a3a8f]" />
                  <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                    Academy Class Seat Saturation
                  </h5>
                </div>
                <span className="text-xs font-black text-indigo-700">
                  {admissionsCalculated.seatOccupancy}% Capacity Booked
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#1a3a8f] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(admissionsCalculated.seatOccupancy, 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">
                    Total Class Seats
                  </span>
                  <span className="font-extrabold text-slate-800">
                    {admissionsCalculated.totalCapacity} Seats
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">
                    Available Open Seats
                  </span>
                  <span className="font-extrabold text-emerald-700">
                    {admissionsCalculated.totalAvailableSeats} Available
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block">
                    Active Teaching Batches
                  </span>
                  <span className="font-extrabold text-slate-800">
                    {admissionsCalculated.classes.length} Batches
                  </span>
                </div>
              </div>
            </div>

            {/* Applications Search & List */}
            <div className="space-y-2 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span>Recent Prospective Student Applications ({displayedApps.length})</span>
                </h5>
                <div className="relative max-w-xs w-full">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter inquiries by name or phone..."
                    value={admissionsSearch}
                    onChange={(e) => setAdmissionsSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {displayedApps.map((a) => (
                  <div
                    key={a.id}
                    className="p-3 bg-slate-50/70 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-extrabold text-slate-900 truncate">
                        {a.fullName || a.studentName || "Prospective Student"}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-slate-400 text-[11px]">
                        <span>{a.phone || "No Phone"}</span>
                        <span>·</span>
                        <span className="text-indigo-700 font-medium">
                          {a.program || a.courseType || "General English"}
                        </span>
                        <span>·</span>
                        <span>
                          {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : "Recent"}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          a.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : a.status === "rejected"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {a.status || "pending"}
                      </span>
                    </div>
                  </div>
                ))}

                {displayedApps.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs italic bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
                    No admission applications match your query.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

export default AdmissionsTab;
