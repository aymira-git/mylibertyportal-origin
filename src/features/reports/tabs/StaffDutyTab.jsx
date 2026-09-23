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
import { normalizeBranch, matchesBranchFilter } from "../../../constants/branches";
import {
  Clock,
  Calendar,
  Search,
  RefreshCw,
} from "lucide-react";
import { ShiftRow } from "./ShiftRow";
import { ScheduledLeavesList } from "./ScheduledLeavesList";

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
      const branchShifts =
        branchFilter === "all"
          ? shifts
          : shifts.filter((s) => matchesBranchFilter(s.branch, branchFilter));
      return detectMultipleOpenShifts(branchShifts);
    }, [shifts, branchFilter]);

    const todayWita = useMemo(() => getTodayWitaString(), []);

    const staffKpiStats = useMemo(() => {
      const branchShifts =
        branchFilter === "all"
          ? shifts
          : shifts.filter((s) => matchesBranchFilter(s.branch, branchFilter));

      const staffMap = new Map(staffMembers.map((m) => [m.id, m]));
      const branchLeaves =
        branchFilter === "all"
          ? leaves
          : leaves.filter((l) => {
              const m = staffMap.get(l.userId);
              return matchesBranchFilter(m?.branch, branchFilter);
            });

      const onDutyList = branchShifts.filter((s) => getShiftStatus(s) === "on_duty");
      const staleList = branchShifts.filter((s) => getShiftStatus(s) === "stale");
      const autoClosedList = branchShifts.filter(
        (s) => s.autoClosed && s.reviewStatus !== "reviewed"
      );

      const lateTodayCount = branchShifts.filter((s) => {
        if (!s.clockIn) return false;
        const shiftDate = s.clockIn.slice(0, 10);
        return (
          shiftDate === todayWita &&
          (s.punctualityStatus === "Late" || s.punctualityStatus === "LATE")
        );
      }).length;

      const onLeaveCount = branchLeaves.filter((l) => {
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
    }, [shifts, leaves, staffMembers, todayWita, branchFilter]);

    const filteredShifts = useMemo(() => {
      let list = shifts;
      if (branchFilter !== "all") {
        list = list.filter((s) => matchesBranchFilter(s.branch, branchFilter));
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
          normalizeBranch(s.branch),
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

          {(isActualAdmin || isAdminView) && (
            <select
              value={shiftRoleFilter}
              onChange={(e) => setShiftRoleFilter(e.target.value)}
              className="p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 outline-none"
            >
              <option value="all">All Roles</option>
              <option value="instructor">Instructors</option>
              <option value="frontoffice">Front Office</option>
              <option value="manager">Manager</option>
              <option value="marketing">Marketing</option>
              <option value="officeboy">Office Boy</option>
            </select>
          )}

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
                className="text-[11px] text-[#1a3a8f] font-bold hover:underline px-1 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

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
            {shiftPage.pageItems.map((s) => (
              <ShiftRow
                key={s.id}
                s={s}
                isMultiOpen={multiOpenUserIds.has(s.userId)}
                canPerformAdminActions={canPerformAdminActions}
                onMarkReviewed={handleMarkReviewed}
                onEditShift={setEditingShift}
              />
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

        {/* Scheduled Staff Leaves Ledger (Admin & Manager) */}
        {(isActualAdmin || isAdminView) && (
          <ScheduledLeavesList
            leaves={leaves}
            canPerformAdminActions={canPerformAdminActions}
            onDeleteLeave={handleDeleteLeave}
          />
        )}

        {/* Shift Adjustment Modal */}
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

        {/* Staff Leave Modal */}
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
