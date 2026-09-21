import { useState, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from "react";
import { auth } from "../../../firebase";
import { fetchStaffShifts } from "../reportsRepository";
import { getTodayWitaString, rangeToSince } from "../reportsUtils";
import {
  getShiftStatus,
  detectMultipleOpenShifts,
  deleteStaffLeave,
  markShiftReviewed,
  ShiftAdjustmentModal,
  StaffLeaveModal,
} from "../../attendance";
import { exportTableCSV, Pagination, usePagination, useToast, useConfirm } from "../../shared";
import {
  Clock,
  Calendar,
  Search,
  RefreshCw,
  AlertTriangle,
  Edit2,
  CheckCheck,
  Trash2,
} from "lucide-react";

const StaffDutyTab = forwardRef(
  /**
   * @param {{ branchFilter?: string; rangeDays?: number; isAdminView?: boolean; isActualAdmin?: boolean; canPerformAdminActions?: boolean }} props
   * @param {any} ref
   */
  function StaffDutyTab(
    {
      branchFilter = "all",
      rangeDays = 30,
      isAdminView = false,
      isActualAdmin = false,
      canPerformAdminActions = false,
    },
    ref
  ) {
    const toast = useToast();
    const confirm = useConfirm();

    const [shifts, setShifts] = useState([]);
    const [staffMembers, setStaffMembers] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [shiftsLoading, setShiftsLoading] = useState(true);
    const [staffSearch, setStaffSearch] = useState("");
    const [shiftStatusFilter, setShiftStatusFilter] = useState("all");
    const [shiftRoleFilter, setShiftRoleFilter] = useState("all");
    const [shiftDateFilter, setShiftDateFilter] = useState("");
    const [editingShift, setEditingShift] = useState(null);
    const [leaveModalOpen, setLeaveModalOpen] = useState(false);

    const fetchShifts = useCallback(async () => {
      setShiftsLoading(true);
      try {
        const data = await fetchStaffShifts(isAdminView, rangeToSince(rangeDays));
        setShifts(data.shifts || []);
        setStaffMembers(data.staffMembers || []);
        setLeaves(data.leaves || []);
      } catch (err) {
        console.error("fetchShifts error:", err);
      } finally {
        setShiftsLoading(false);
      }
    }, [isAdminView, rangeDays]);

    useEffect(() => {
      fetchShifts();
    }, [fetchShifts]);

    const handleMarkReviewed = async (shiftId) => {
      try {
        await markShiftReviewed(shiftId);
        toast("Shift marked as reviewed", "success");
        setShifts((prev) =>
          prev.map((s) => (s.id === shiftId ? { ...s, reviewStatus: "reviewed" } : s))
        );
      } catch (err) {
        toast("Failed to mark reviewed: " + err.message, "error");
      }
    };

    const handleDeleteLeave = async (leaveId) => {
      if (await confirm("Cancel / delete this staff leave record?")) {
        try {
          await deleteStaffLeave(leaveId);
          toast("Leave record removed.", "info");
          setLeaves((prev) => prev.filter((l) => l.id !== leaveId));
        } catch (err) {
          toast("Failed to delete: " + err.message, "error");
        }
      }
    };

    // Multiple Open Shifts & KPI Radar
    const multiOpenUserIds = useMemo(() => {
      return detectMultipleOpenShifts(shifts);
    }, [shifts]);

    const todayWita = useMemo(() => getTodayWitaString(), []);

    const staffKpiStats = useMemo(() => {
      const onDutyList = shifts.filter((s) => getShiftStatus(s) === "on_duty");
      const staleList = shifts.filter((s) => getShiftStatus(s) === "stale");
      const autoClosedList = shifts.filter((s) => s.autoClosed && s.reviewStatus !== "reviewed");

      const lateTodayCount = shifts.filter((s) => {
        if (!s.clockIn) return false;
        const shiftDate = s.clockIn.slice(0, 10);
        return (
          shiftDate === todayWita &&
          (s.punctualityStatus === "Late" || s.punctualityStatus === "LATE")
        );
      }).length;

      const onLeaveCount = leaves.filter((l) => {
        const end = l.endDate || l.startDate;
        return l.startDate <= todayWita && todayWita <= end;
      }).length;

      return {
        onDutyCount: onDutyList.length,
        staleCount: staleList.length,
        autoClosedCount: autoClosedList.length,
        lateTodayCount,
        onLeaveCount,
      };
    }, [shifts, leaves, todayWita]);

    const filteredShifts = useMemo(() => {
      let list = shifts;
      if (branchFilter !== "all") {
        list = list.filter((s) => (s.branch || "Cabang Utama") === branchFilter);
      }
      if (shiftRoleFilter !== "all") {
        list = list.filter((s) => s.role === shiftRoleFilter);
      }
      if (shiftStatusFilter !== "all") {
        list = list.filter((s) => {
          const derived = getShiftStatus(s);
          if (shiftStatusFilter === "on_duty") return derived === "on_duty";
          if (shiftStatusFilter === "stale") return derived === "stale";
          if (shiftStatusFilter === "auto_closed") return Boolean(s.autoClosed);
          if (shiftStatusFilter === "needs_review")
            return derived === "stale" || (s.autoClosed && s.reviewStatus !== "reviewed");
          if (shiftStatusFilter === "corrected") return Boolean(s.corrected);
          return true;
        });
      }
      if (shiftDateFilter) {
        list = list.filter((s) => s.clockIn && s.clockIn.startsWith(shiftDateFilter));
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
    }, [shifts, branchFilter, shiftRoleFilter, shiftStatusFilter, shiftDateFilter, staffSearch]);

    const shiftPage = usePagination(filteredShifts, 20);

    // Expose exportCSV to parent
    useImperativeHandle(ref, () => ({
      exportCSV: () => {
        const todayStr = getTodayWitaString();
        const headers = [
          "Staff Name",
          "Role",
          "Campus Branch",
          "Class",
          "Clock In",
          "Clock Out",
          "Derived Status",
          "Auto-Closed",
        ];
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
      },
    }));

    return (
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#1a3a8f]" />
              <span>
                {isActualAdmin || isAdminView
                  ? "Staff Clock-In / Clock-Out Ledger"
                  : "My Clock-In / Out History"}
              </span>
            </h4>
            <p className="text-[11px] text-slate-400 font-medium">
              {filteredShifts.length} Shift records in selected horizon
            </p>
          </div>

          {/* Admin actions: Log leave */}
          {canPerformAdminActions && (
            <button
              onClick={() => setLeaveModalOpen(true)}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Log Staff Leave / Absence</span>
            </button>
          )}
        </div>

        {/* At-a-Glance KPI Summary Radar (Admin & Manager) */}
        {(isActualAdmin || isAdminView) && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900">
                Currently On Duty
              </p>
              <p className="text-2xl font-black text-emerald-950 mt-1">
                {staffKpiStats.onDutyCount}
              </p>
              <p className="text-[10px] text-emerald-700 font-medium">Open active shifts</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-100">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
                Stale Shifts
              </p>
              <p className="text-2xl font-black text-amber-950 mt-1">{staffKpiStats.staleCount}</p>
              <p className="text-[10px] text-amber-700 font-medium">&gt;10h open duration</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-100">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-rose-900">
                Auto-Closed
              </p>
              <p className="text-2xl font-black text-rose-950 mt-1">
                {staffKpiStats.autoClosedCount}
              </p>
              <p className="text-[10px] text-rose-700 font-medium">Awaiting admin review</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900">
                Late Today
              </p>
              <p className="text-2xl font-black text-indigo-950 mt-1">
                {staffKpiStats.lateTodayCount}
              </p>
              <p className="text-[10px] text-indigo-700 font-medium">WITA arrival breaches</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                On Leave Today
              </p>
              <p className="text-2xl font-black text-slate-800 mt-1">
                {staffKpiStats.onLeaveCount}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">Approved absence</p>
            </div>
          </div>
        )}

        {/* Sub-Filters: Status, Role, Date, Search */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {/* Status Filter */}
          <select
            value={shiftStatusFilter}
            onChange={(e) => setShiftStatusFilter(e.target.value)}
            className="p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="on_duty">Active On Duty</option>
            <option value="stale">Stale (&gt;10h)</option>
            <option value="auto_closed">Auto-Closed</option>
            <option value="needs_review">Needs Review</option>
            <option value="corrected">Audited / Corrected</option>
          </select>

          {/* Role Filter (Admin & Manager) */}
          {(isActualAdmin || isAdminView) && (
            <select
              value={shiftRoleFilter}
              onChange={(e) => setShiftRoleFilter(e.target.value)}
              className="p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 outline-none"
            >
              <option value="all">All Roles</option>
              <option value="instructor">Instructors</option>
              <option value="frontoffice">Front Office</option>
              <option value="marketing">Marketing</option>
              <option value="officeboy">Office Boy</option>
            </select>
          )}

          {/* Date Filter */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={shiftDateFilter}
              onChange={(e) => setShiftDateFilter(e.target.value)}
              className="p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 outline-none"
            />
            {shiftDateFilter && (
              <button
                onClick={() => setShiftDateFilter("")}
                className="text-[11px] text-[#1a3a8f] font-bold hover:underline px-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-xs ml-auto">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search staff, role, class..."
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold focus:border-[#1a3a8f] outline-none"
            />
          </div>
        </div>

        {shiftsLoading ? (
          <div className="p-12 text-center text-slate-400 text-xs italic flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#1a3a8f]" />
            <span>Loading duty records...</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {shiftPage.pageItems.map((s) => {
              const derivedStatus = getShiftStatus(s);
              const isMultiOpen = multiOpenUserIds.has(s.userId);

              return (
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
                      {/* Multiple Open Alert */}
                      {isMultiOpen && (
                        <span className="text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full">
                          ⚠️ Multiple Open Shifts
                        </span>
                      )}
                      {/* Stale Warning */}
                      {derivedStatus === "stale" && (
                        <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                          ⚠️ Stale (&gt;10h)
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
                        <span>
                          Auto-closed shift{" "}
                          {s.reviewStatus === "reviewed" ? "(Reviewed)" : "(Pending Review)"}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                        s.autoClosed
                          ? s.reviewStatus === "reviewed"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-amber-100 text-amber-900 border border-amber-200"
                          : s.clockOut
                            ? "bg-slate-200 text-slate-800"
                            : "bg-emerald-100 text-emerald-900 border border-emerald-200 animate-pulse"
                      }`}
                    >
                      {s.autoClosed
                        ? s.reviewStatus === "reviewed"
                          ? "Auto-Closed (Reviewed)"
                          : "Auto-Closed"
                        : s.clockOut
                          ? "Completed"
                          : "Active On Duty"}
                    </span>

                    {/* Admin Mark Reviewed Button */}
                    {canPerformAdminActions && s.autoClosed && s.reviewStatus !== "reviewed" && (
                      <button
                        onClick={() => handleMarkReviewed(s.id)}
                        className="px-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 transition"
                        title="Mark Auto-Closed Shift as Reviewed"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Mark Reviewed</span>
                      </button>
                    )}

                    {/* Admin Shift Adjustment */}
                    {canPerformAdminActions && (
                      <button
                        onClick={() => setEditingShift(s)}
                        className="p-1.5 text-slate-400 hover:text-[#1a3a8f] rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
                        title="Adjust / Audit Shift"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

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

        {/* ── Scheduled Staff Leaves Ledger (Admin & Manager) ── */}
        {(isActualAdmin || isAdminView) && leaves.length > 0 && (
          <div className="pt-4 border-t border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Scheduled Staff Leaves &amp; Absences ({leaves.length})</span>
              </h5>
              <span className="text-[10px] text-slate-400 font-semibold">
                Active calendar records
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {leaves.map((l) => (
                <div
                  key={l.id}
                  className="p-3 bg-white border border-slate-200/90 rounded-2xl shadow-2xs flex items-center justify-between gap-2.5"
                >
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-extrabold text-slate-900 text-xs truncate">
                      {l.displayNameSnapshot || "Staff Member"}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 capitalize">
                        {l.type || "Izin"}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {l.startDate}{" "}
                        {l.endDate && l.endDate !== l.startDate ? `– ${l.endDate}` : ""}
                      </span>
                    </div>
                    {l.note && (
                      <p className="text-[10px] text-slate-500 truncate italic">
                        &quot;{l.note}&quot;
                      </p>
                    )}
                  </div>

                  {canPerformAdminActions && (
                    <button
                      onClick={() => handleDeleteLeave(l.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition shrink-0 cursor-pointer"
                      title="Cancel / Delete Leave Record"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Shift Adjustment Modal ── */}
        {editingShift && (
          <ShiftAdjustmentModal
            shift={editingShift}
            actor={auth.currentUser}
            onClose={() => setEditingShift(null)}
            onSuccess={() => {
              setEditingShift(null);
              fetchShifts();
            }}
          />
        )}

        {/* ── Staff Leave Modal ── */}
        {leaveModalOpen && (
          <StaffLeaveModal
            staff={staffMembers}
            actor={auth.currentUser}
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
);

export default StaffDutyTab;
