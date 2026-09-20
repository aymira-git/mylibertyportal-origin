import { useState, useEffect, useMemo } from "react";
import { db, auth } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import {
  Calendar,
  Search,
  Camera,
  Edit2,
  Trash2,
  UserCheck,
} from "lucide-react";
import Kiosk from "./Kiosk";
import ShiftAdjustmentModal from "./ShiftAdjustmentModal";
import StaffLeaveModal from "./StaffLeaveModal";
import { getShiftStatus, detectMultipleOpenShifts } from "./shiftStatus";
import { deleteStaffLeave } from "./shiftsRepository";
import { usePagination, Pagination, useConfirm, useToast } from "../shared";

export default function AttendanceManager({
  users = [],
}) {
  const confirm = useConfirm();
  const toast = useToast();

  const [shifts, setShifts] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  // Kiosk Standalone View Trigger
  const [kioskOpen, setKioskOpen] = useState(false);

  // Modals state
  const [editingShift, setEditingShift] = useState(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState(""); // YYYY-MM-DD

  // Real-time listener for shifts
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "shifts"),
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        data.sort((a, b) => (b.clockIn || "").localeCompare(a.clockIn || ""));
        setShifts(data);
        setLoading(false);
      },
      (err) => {
        console.error("Shifts listener error:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // Real-time listener for staffLeave (instant synchronization without cascading setState)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "staffLeave"),
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setLeaves(data);
      },
      (err) => {
        console.error("Staff leave listener error:", err);
      }
    );

    return () => unsub();
  }, []);

  // Trackable staff list (excluding students, pure managers, and deactivated staff)
  const staffMembers = useMemo(() => {
    return users.filter(
      (u) =>
        u.role !== "student" &&
        u.role !== "manager" &&
        (u.status || "active") !== "resigned" &&
        (u.status || "active") !== "terminated"
    );
  }, [users]);

  // Multiple open shifts detection
  const multiOpenUserIds = useMemo(() => {
    return detectMultipleOpenShifts(shifts);
  }, [shifts]);

  // Today in WITA (YYYY-MM-DD)
  const todayWita = useMemo(() => {
    const d = new Date();
    // UTC+8 offset in minutes is 480
    const witaDate = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000);
    return witaDate.toISOString().slice(0, 10);
  }, []);

  // Today's leave user set
  const onLeaveToday = useMemo(() => {
    const set = new Set();
    leaves.forEach((l) => {
      if (l.startDate <= todayWita && todayWita <= l.endDate) {
        set.add(l.userId);
      }
    });
    return set;
  }, [leaves, todayWita]);

  // KPI Summary Metrics
  const kpiStats = useMemo(() => {
    const onDutyList = shifts.filter((s) => getShiftStatus(s) === "on_duty");
    const staleList = shifts.filter((s) => getShiftStatus(s) === "stale");
    const autoClosedList = shifts.filter((s) => s.autoClosed && s.reviewStatus !== "reviewed");

    // Late arrivals today
    const lateTodayCount = shifts.filter((s) => {
      if (!s.clockIn) return false;
      const shiftDate = s.clockIn.slice(0, 10);
      return shiftDate === todayWita && (s.punctualityStatus === "Late" || s.punctualityStatus === "LATE");
    }).length;

    return {
      onDutyCount: onDutyList.length,
      staleCount: staleList.length,
      autoClosedCount: autoClosedList.length,
      lateTodayCount,
      onLeaveCount: onLeaveToday.size,
    };
  }, [shifts, todayWita, onLeaveToday]);

  // Filtered shift rows
  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      const derivedStatus = getShiftStatus(s);

      // Status filter
      if (statusFilter === "on_duty" && derivedStatus !== "on_duty") return false;
      if (statusFilter === "stale" && derivedStatus !== "stale") return false;
      if (statusFilter === "auto_closed" && !s.autoClosed) return false;
      if (statusFilter === "needs_review" && derivedStatus !== "stale" && (!s.autoClosed || s.reviewStatus === "reviewed")) return false;
      if (statusFilter === "corrected" && !s.corrected) return false;

      // Role filter
      if (roleFilter !== "all" && s.role !== roleFilter) return false;

      // Date filter
      if (dateFilter && s.clockIn && !s.clockIn.startsWith(dateFilter)) return false;

      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = (s.displayName || "").toLowerCase().includes(q);
        const matchClass = (s.className || "").toLowerCase().includes(q);
        if (!matchName && !matchClass) return false;
      }

      return true;
    });
  }, [shifts, statusFilter, roleFilter, dateFilter, searchQuery]);

  const pagination = usePagination(filteredShifts, 15);

  const handleDeleteLeave = async (leaveId) => {
    if (await confirm("Cancel / delete this staff leave record?")) {
      try {
        await deleteStaffLeave(leaveId);
        toast("Leave record removed.", "info");
      } catch (err) {
        toast("Failed to delete: " + err.message, "error");
      }
    }
  };

  return (
    <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 max-w-6xl mx-auto space-y-6 shadow-sm">
      {/* ── Cockpit Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-slate-900 text-xl tracking-tight">
              Staff Attendance & Duty Radar
            </h3>
            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[#1a3a8f] font-extrabold text-[10px] tracking-wide">
              WITA (UTC+8)
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Live duty radar, schedule punctuality, audited corrections & leave
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Leave logger */}
          <button
            onClick={() => setLeaveModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
            <span>Log Leave / Absence</span>
          </button>

          {/* Launch Kiosk */}
          <button
            onClick={() => setKioskOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Open Kiosk Scanner Station</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900">
            Currently On Duty
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-emerald-950 mt-0.5 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{kpiStats.onDutyCount}</span>
          </p>
        </div>

        <div
          className={`p-3.5 rounded-2xl border ${
            kpiStats.staleCount > 0
              ? "bg-amber-50/80 border-amber-200 text-amber-950"
              : "bg-slate-50 border-slate-200 text-slate-900"
          }`}
        >
          <p
            className={`text-[10px] font-extrabold uppercase tracking-wider ${
              kpiStats.staleCount > 0 ? "text-amber-800" : "text-slate-500"
            }`}
          >
            Stale / Open Overdue
          </p>
          <p className="text-lg sm:text-xl font-extrabold mt-0.5">
            {kpiStats.staleCount}
          </p>
        </div>

        <div
          className={`p-3.5 rounded-2xl border ${
            kpiStats.autoClosedCount > 0
              ? "bg-rose-50/80 border-rose-200 text-rose-950"
              : "bg-slate-50 border-slate-200 text-slate-900"
          }`}
        >
          <p
            className={`text-[10px] font-extrabold uppercase tracking-wider ${
              kpiStats.autoClosedCount > 0 ? "text-rose-800" : "text-slate-500"
            }`}
          >
            Auto-Closed (Review)
          </p>
          <p className="text-lg sm:text-xl font-extrabold mt-0.5">
            {kpiStats.autoClosedCount}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Late Arrivals Today
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
            {kpiStats.lateTodayCount}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100/80">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900">
            On Leave Today
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-indigo-950 mt-0.5">
            {kpiStats.onLeaveCount}
          </p>
        </div>
      </div>

      {/* ── Live Presence Radar (Who is in the building right now) ── */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
              Live Presence Radar ({kpiStats.onDutyCount} Staff Active)
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Live updates via Firestore snapshot
          </span>
        </div>

        {kpiStats.onDutyCount === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">
            No staff members currently clocked in.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {shifts
              .filter((s) => getShiftStatus(s) === "on_duty")
              .map((s) => {
                const isMulti = multiOpenUserIds.has(s.userId);
                return (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-extrabold text-slate-900 text-xs truncate">
                          {s.displayName}
                        </p>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 uppercase">
                          {s.role}
                        </span>
                        {isMulti && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700">
                            Multi-Open
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-indigo-700 font-medium truncate">
                        {s.className || "General Duty"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        In: {s.clockIn ? new Date(s.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "N/A"}
                      </p>
                    </div>

                    <button
                      onClick={() => setEditingShift(s)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
                      title="Audited Adjustment / Force Clock-Out"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* ── Active Leaves Radar (if any) ── */}
      {leaves.length > 0 && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-indigo-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Approved Staff Leaves ({leaves.length})</span>
            </h4>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {leaves.map((l) => (
              <div
                key={l.id}
                className="px-3 py-1.5 rounded-xl bg-white border border-indigo-100 flex items-center gap-2 text-xs shadow-2xs"
              >
                <div>
                  <span className="font-extrabold text-slate-800">{l.displayNameSnapshot}</span>
                  <span className="text-[11px] text-indigo-700 font-bold ml-1.5 uppercase">
                    ({l.type})
                  </span>
                  <p className="text-[10px] text-slate-400">
                    {l.startDate} {l.startDate !== l.endDate ? `to ${l.endDate}` : ""} · {l.dayPortion}
                    {l.note ? ` · ${l.note}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteLeave(l.id)}
                  className="text-slate-300 hover:text-rose-600 transition ml-1"
                  title="Remove leave"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Filter Tabs ── */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { id: "all", label: "All Logs" },
          { id: "on_duty", label: `On Duty (${kpiStats.onDutyCount})` },
          { id: "needs_review", label: `⚠️ Needs Review (${kpiStats.staleCount + kpiStats.autoClosedCount})` },
          { id: "auto_closed", label: `Auto-Closed (${kpiStats.autoClosedCount})` },
          { id: "corrected", label: "Audited / Corrected" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setStatusFilter(t.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              statusFilter === t.id
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by staff name or class..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 outline-none cursor-pointer"
          >
            <option value="all">All Roles</option>
            <option value="instructor">Instructors</option>
            <option value="frontoffice">Front Office</option>
            <option value="marketing">Marketing</option>
            <option value="officeboy">Office Boy</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 outline-none"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="text-[11px] text-indigo-700 font-bold hover:underline"
            >
              Clear Date
            </button>
          )}
        </div>
      </div>

      {/* ── Shift Table ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-500 font-extrabold uppercase text-[11px]">
              <th className="p-3.5">Staff Member</th>
              <th className="p-3.5">Role</th>
              <th className="p-3.5">Duty / Class</th>
              <th className="p-3.5">Clock In (WITA)</th>
              <th className="p-3.5">Clock Out (WITA)</th>
              <th className="p-3.5">Punctuality / Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagination.pageItems.map((s) => {
              const derivedStatus = getShiftStatus(s);
              return (
                <tr key={s.id} className="hover:bg-slate-50 transition">
                  <td className="p-3.5 font-extrabold text-slate-900">
                    <div>{s.displayName}</div>
                    {s.stationId && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        Station: {s.stationId}
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 capitalize font-semibold text-slate-600">
                    {s.role}
                  </td>
                  <td className="p-3.5 font-medium text-slate-800">
                    {s.className || "General Duty"}
                  </td>
                  <td className="p-3.5 text-slate-600">
                    {s.clockIn ? new Date(s.clockIn).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "N/A"}
                  </td>
                  <td className="p-3.5 text-slate-600">
                    {s.clockOut ? (
                      <div>
                        <span>{new Date(s.clockOut).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                        {s.autoClosed && (
                          <span className="text-[10px] text-rose-700 font-bold block">
                            (Auto-Estimated)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-extrabold text-[10px]">
                        Active Now
                      </span>
                    )}
                  </td>
                  <td className="p-3.5">
                    <div className="flex flex-col gap-1">
                      {/* Punctuality Badge */}
                      {s.punctualityStatus && (
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold w-fit ${
                            s.punctualityStatus === "On time" || s.punctualityStatus === "ON_TIME" || s.punctualityStatus === "Present"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {s.punctualityStatus}
                        </span>
                      )}

                      {/* Status Badges */}
                      {derivedStatus === "stale" && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 w-fit">
                          ⚠️ Stale — Review
                        </span>
                      )}
                      {s.autoClosed && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800 w-fit">
                          Auto-Closed
                        </span>
                      )}
                      {s.corrected && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 w-fit">
                          Audited
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={() => setEditingShift(s)}
                      className="px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50 rounded-lg border border-indigo-100 transition cursor-pointer"
                    >
                      Adjust
                    </button>
                  </td>
                </tr>
              );
            })}

            {pagination.pageItems.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400 text-xs font-medium">
                  {loading ? "Loading attendance records..." : "No matching attendance records found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <Pagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        onPageChange={pagination.setCurrentPage}
        totalItems={pagination.totalItems}
        pageSize={pagination.pageSize}
      />

      {/* ── Standalone Kiosk Mode Modal (Triggered by button) ── */}
      {kioskOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
            <div className="p-4 bg-slate-100 flex items-center justify-between border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                  Station Scanner (Admin Reception Mode)
                </span>
              </div>
              <button
                onClick={() => setKioskOpen(false)}
                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Close Station
              </button>
            </div>
            <div className="p-4 max-h-[80vh] overflow-y-auto">
              <Kiosk title="Office Reception Kiosk Station" staffOnly={false} />
            </div>
          </div>
        </div>
      )}

      {/* ── Audited Shift Adjustment Modal ── */}
      {editingShift && (
        <ShiftAdjustmentModal
          shift={editingShift}
          actor={auth.currentUser}
          onClose={() => setEditingShift(null)}
          onSuccess={() => setEditingShift(null)}
        />
      )}

      {/* ── Staff Leave Modal ── */}
      {leaveModalOpen && (
        <StaffLeaveModal
          staff={staffMembers}
          actor={auth.currentUser}
          onClose={() => setLeaveModalOpen(false)}
          onSuccess={() => setLeaveModalOpen(false)}
        />
      )}
    </div>
  );
}
