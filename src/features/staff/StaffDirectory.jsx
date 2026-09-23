/**
 * StaffDirectory.jsx
 * Staff Operations Cockpit for Academy Administrators.
 * Handles staff roster, role filtering, instructor workload telemetry,
 * 1-click WhatsApp outreach, safe deactivation, and badge issuance.
 */

import { useState, useMemo } from "react";
import { useToast, useConfirm, Pagination, usePagination } from "../shared";
import { updateStaffStatus, checkStaffHasAttendanceHistory } from "../dashboard/usersRepository";
import { copyText } from "../../utils/copyText";
import {
  STAFF_ROLES,
  STAFF_ROLE_LABELS,
  STAFF_STATUS_MAP,
  STAFF_STATUS_OPTIONS,
  getInstructorWorkload,
  canDeleteStaff,
  filterStaffMembers,
  getDistinctStaffBranches,
} from "./staffUtils";
import { StaffMemberCard } from "./StaffMemberCard";
import {
  Search,
  UserPlus,
  Mail,
  Users,
  GraduationCap,
  ShieldCheck,
  Briefcase,
} from "lucide-react";

export default function StaffDirectory({
  users = [],
  classes = [],
  invites = [],
  currentUserId = null,
  onAddStaff = null,
  onEditStaff = null,
  onPrintBadge = null,
  onDeleteStaff = null,
  onNavigateToInvites = null,
}) {
  const toast = useToast();
  const confirm = useConfirm();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [divisionFilter, setDivisionFilter] = useState("all");
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Overall KPIs (Counting active staff to prevent metric inflation)
  const totalStaffCount = useMemo(
    () => users.filter((u) => u.role !== "student" && (u.status || "active") === "active").length,
    [users]
  );
  const instructorCount = useMemo(
    () =>
      users.filter((u) => u.role === "instructor" && (u.status || "active") === "active").length,
    [users]
  );
  const opsCount = useMemo(
    () =>
      users.filter(
        (u) =>
          ["frontoffice", "manager", "marketing", "officeboy"].includes(u.role) &&
          (u.status || "active") === "active"
      ).length,
    [users]
  );
  const pendingInvitesCount = useMemo(() => invites.filter((i) => !i.used).length, [invites]);

  // Dynamic branch list
  const branchOptions = useMemo(() => getDistinctStaffBranches(users), [users]);

  // Filtered staff members
  const filteredStaff = useMemo(() => {
    return filterStaffMembers({
      users,
      search,
      roleFilter,
      statusFilter,
      branchFilter,
      divisionFilter,
    });
  }, [users, search, roleFilter, statusFilter, branchFilter, divisionFilter]);

  // Pagination (20 staff per page)
  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(
    filteredStaff,
    20
  );

  // Copy helper
  const handleCopy = async (text, label = "Email") => {
    if (!text) return;
    const res = await copyText(text);
    if (res.ok) {
      toast(`Copied ${label} to clipboard!`, "success");
    } else {
      toast(`Failed to copy ${label}`, "error");
    }
  };

  // 1-Click Status Change with Guards
  const handleStatusChange = async (user, newStatus) => {
    if (user.status === newStatus) return;

    // Guard: Prevent deactivating the last active administrator
    if (user.role === "admin" && (newStatus === "resigned" || newStatus === "terminated")) {
      const activeAdmins = users.filter(
        (u) => u.role === "admin" && (u.status || "active") === "active"
      );
      if (activeAdmins.length <= 1) {
        toast("Cannot deactivate the sole remaining active administrator.", "error");
        return;
      }
    }

    // Guard R8: Warning if deactivating an instructor with live active classes
    if ((newStatus === "resigned" || newStatus === "terminated") && user.role === "instructor") {
      const workload = getInstructorWorkload(user.id, classes);
      if (workload.batchCount > 0) {
        const classNames = workload.assignedClasses.map((c) => c.className || "Class").join(", ");
        const ok = await confirm(
          `Warning: ${user.displayName || "This instructor"} is currently assigned to ${workload.batchCount} active batch(es): ${classNames}. Changing status to "${STAFF_STATUS_MAP[newStatus]?.label || newStatus}" will leave these batches without an active instructor. Please reassign them in the Classes tab. Proceed?`
        );
        if (!ok) return;
      }
    }

    setUpdatingStatusId(user.id);
    try {
      await updateStaffStatus(user.id, newStatus);
      toast(
        `Updated ${user.displayName || "Staff"}'s status to ${
          STAFF_STATUS_MAP[newStatus]?.label || newStatus
        }.`
      );
    } catch (err) {
      toast("Error updating status: " + err.message, "error");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Safe Delete Guardrail (R2: single confirm, R5: shift history check)
  const handleDeleteClick = async (user) => {
    // 1. Synchronous class guard
    const { canDelete, reason } = canDeleteStaff(user, classes, currentUserId);
    if (!canDelete) {
      toast(reason, "error");
      return;
    }

    // 2. Asynchronous shift & leave history guard (fail-closed)
    try {
      const { hasShifts, hasLeave, error } = await checkStaffHasAttendanceHistory(user.id);
      if (error) {
        toast(
          `Could not verify attendance history (${error}). Deletion cancelled for data safety.`,
          "error"
        );
        return;
      }
      if (hasShifts) {
        toast(
          `Cannot delete: ${user.displayName} has recorded attendance shift history. Deleting this account would corrupt shift records. Please mark their status as "Resigned" or "Terminated" instead.`,
          "error"
        );
        return;
      }
      if (hasLeave) {
        toast(
          `Cannot delete: ${user.displayName} has recorded leave requests. Deleting this account would corrupt leave records. Please mark their status as "Resigned" or "Terminated" instead.`,
          "error"
        );
        return;
      }
    } catch (err) {
      toast(
        `Failed to verify account history: ${err.message}. Deletion cancelled for safety.`,
        "error"
      );
      return;
    }

    // 3. Single explicit confirmation modal (R2)
    const ok = await confirm(
      `Delete ${user.displayName}'s profile? Note: The Firestore record will be permanently removed. If this user needs to re-register with the same email, their Firebase Auth account must also be deleted from the Firebase Console.`
    );
    if (!ok) return;

    try {
      await onDeleteStaff(user.id, { skipConfirm: true });
      toast(`Deleted ${user.displayName}'s profile.`);
    } catch (err) {
      toast("Error deleting staff: " + err.message, "error");
    }
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm w-full text-xs space-y-6">
      {/* Cockpit Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1a3a8f] bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Staff Administration
            </span>
            {pendingInvitesCount > 0 && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                {pendingInvitesCount} Pending Invites
              </span>
            )}
          </div>
          <h3 className="mt-1.5 font-extrabold text-slate-900 text-lg">
            Staff Directory &amp; Operations
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Manage academy personnel, teaching assignments, and staff credentials
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {onNavigateToInvites && (
            <button
              type="button"
              onClick={onNavigateToInvites}
              className="py-2 px-3.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>Invite Staff</span>
            </button>
          )}

          {onAddStaff && (
            <button
              type="button"
              onClick={onAddStaff}
              className="py-2 px-4 rounded-xl font-extrabold text-xs bg-[#1a3a8f] hover:bg-[#152e72] text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Staff Account</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            Total Staff
          </p>
          <p className="text-xl font-black text-slate-900 mt-1">{totalStaffCount}</p>
        </div>
        <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl">
          <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
            <GraduationCap className="w-3 h-3" />
            Instructors
          </p>
          <p className="text-xl font-black text-indigo-950 mt-1">{instructorCount}</p>
        </div>
        <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-2xl">
          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <Briefcase className="w-3 h-3" />
            Operations &amp; FO
          </p>
          <p className="text-xl font-black text-emerald-950 mt-1">{opsCount}</p>
        </div>
        <div className="p-3.5 bg-amber-50/60 border border-amber-100 rounded-2xl">
          <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
            <Mail className="w-3 h-3" />
            Pending Invites
          </p>
          <p className="text-xl font-black text-amber-950 mt-1">{pendingInvitesCount}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by name, nickname, email, or phone..."
              className="w-full pl-9 pr-3 py-2 border rounded-xl bg-white text-xs font-medium focus:border-[#1a3a8f] outline-none"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 border rounded-xl bg-white text-xs font-medium focus:border-[#1a3a8f] outline-none capitalize"
            >
              <option value="all">All Employment Statuses</option>
              {STAFF_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 border rounded-xl bg-white text-xs font-medium focus:border-[#1a3a8f] outline-none"
            >
              <option value="all">All Branches</option>
              {branchOptions.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Division Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold pt-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-1">Division:</span>
          <button
            type="button"
            onClick={() => {
              setDivisionFilter("all");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              divisionFilter === "all"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Divisions
          </button>
          <button
            type="button"
            onClick={() => {
              setDivisionFilter("courses");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              divisionFilter === "courses"
                ? "bg-indigo-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Course Academy
          </button>
          <button
            type="button"
            onClick={() => {
              setDivisionFilter("kindergarten");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              divisionFilter === "kindergarten"
                ? "bg-cyan-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Kids School (Kindergarten)
          </button>
        </div>

        {/* Role Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold pt-1">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 mr-1">Role:</span>
          <button
            type="button"
            onClick={() => {
              setRoleFilter("all");
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              roleFilter === "all"
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Roles ({users.filter((u) => u.role !== "student").length})
          </button>

          {STAFF_ROLES.map((r) => {
            const count = users.filter((u) => u.role === r).length;
            const isSelected = roleFilter === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRoleFilter(r);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#1a3a8f] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{STAFF_ROLE_LABELS[r] || r}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Staff Cards List */}
      {pageItems.length === 0 ? (
        <div className="p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1">
          <Users className="w-8 h-8 text-slate-300 mx-auto mb-1" />
          <p className="text-sm font-bold text-slate-700">No staff members found</p>
          <p className="text-xs text-slate-400">
            No matching profiles found for the selected role, status, or search query.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {pageItems.map((u) => (
            <StaffMemberCard
              key={u.id}
              u={u}
              classes={classes}
              currentUserId={currentUserId}
              roleFilter={roleFilter}
              updatingStatusId={updatingStatusId}
              onCopy={handleCopy}
              onStatusChange={handleStatusChange}
              onPrintBadge={onPrintBadge}
              onEditStaff={onEditStaff}
              onDeleteStaff={onDeleteStaff ? handleDeleteClick : null}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <Pagination
        page={page}
        totalPages={totalPages}
        setPage={setPage}
        from={from}
        to={to}
        total={total}
        label="staff members"
      />
    </div>
  );
}
