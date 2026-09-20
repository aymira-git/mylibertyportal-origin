/**
 * StaffDirectory.jsx
 * Staff Operations Cockpit for Academy Administrators.
 * Handles staff roster, role filtering, instructor workload telemetry,
 * 1-click WhatsApp outreach, safe deactivation, and badge issuance.
 */

import { useState, useMemo } from "react";
import { useToast, useConfirm, Pagination, usePagination } from "../shared";
import { updateStaffStatus, checkStaffHasAttendanceHistory } from "../dashboard/usersRepository";
import { normalizeWhatsAppNumber } from "../finance/receiptMessages";
import {
  STAFF_ROLES,
  STAFF_ROLE_LABELS,
  STAFF_STATUS_MAP,
  STAFF_STATUS_OPTIONS,
  TRACKED_STAFF_ROLES,
  getInstructorWorkload,
  canDeleteStaff,
  filterStaffMembers,
  getDistinctStaffBranches,
} from "./staffUtils";
import {
  Search,
  UserPlus,
  Mail,
  Phone,
  MessageCircle,
  Copy,
  Edit2,
  Trash2,
  Printer,
  Users,
  BookOpen,
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
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Overall KPIs (Counting active staff to prevent metric inflation)
  const totalStaffCount = useMemo(
    () => users.filter((u) => u.role !== "student" && (u.status || "active") === "active").length,
    [users]
  );
  const instructorCount = useMemo(
    () => users.filter((u) => u.role === "instructor" && (u.status || "active") === "active").length,
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
  const pendingInvitesCount = useMemo(
    () => invites.filter((i) => !i.used).length,
    [invites]
  );

  // Dynamic branch list
  const branchOptions = useMemo(
    () => getDistinctStaffBranches(users),
    [users]
  );

  // Filtered staff members
  const filteredStaff = useMemo(() => {
    return filterStaffMembers({
      users,
      search,
      roleFilter,
      statusFilter,
      branchFilter,
    });
  }, [users, search, roleFilter, statusFilter, branchFilter]);

  // Pagination (20 staff per page)
  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(
    filteredStaff,
    20
  );

  // Copy helper
  const handleCopy = (text, label = "Email") => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast(`Copied ${label} to clipboard!`);
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
    if (
      (newStatus === "resigned" || newStatus === "terminated") &&
      user.role === "instructor"
    ) {
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

        {/* Role Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold pt-1">
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
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-slate-200 text-slate-700"
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
          {pageItems.map((u) => {
            const statusConfig =
              STAFF_STATUS_MAP[u.status || "active"] || STAFF_STATUS_MAP.active;
            const isAdminRole = u.role === "admin";
            const isInstructor = u.role === "instructor";
            const isSelf = currentUserId && u.id === currentUserId;

            // Normalized WhatsApp
            const rawPhone = u.phone || "";
            const normPhone = normalizeWhatsAppNumber(rawPhone);
            const canWhatsApp = normPhone && normPhone.length >= 9;
            const waGreeting = `Halo Kak ${u.displayName || ""}! Kami dari My Liberty English Academy ingin mengonfirmasi terkait jadwal dan operasional sekolah.`;
            const waUrl = canWhatsApp
              ? `https://wa.me/${normPhone}?text=${encodeURIComponent(waGreeting)}`
              : null;

            // Workload telemetry: Computed for instructors
            const workload = isInstructor
              ? getInstructorWorkload(u.id, classes)
              : null;

            return (
              <div
                key={u.id}
                className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs hover:border-indigo-200 transition space-y-3"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Avatar & Core Bio */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    {u.photoURL ? (
                      <img
                        src={u.photoURL}
                        alt={u.displayName}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div
                        className={`w-12 h-12 rounded-2xl text-white font-black text-sm flex items-center justify-center shrink-0 shadow-2xs uppercase ${
                          isAdminRole
                            ? "bg-gradient-to-br from-purple-700 to-indigo-800"
                            : isInstructor
                            ? "bg-gradient-to-br from-[#1a3a8f] to-indigo-600"
                            : "bg-gradient-to-br from-slate-700 to-slate-900"
                        }`}
                      >
                        {u.displayName ? u.displayName.slice(0, 2) : "??"}
                      </div>
                    )}

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-slate-900 text-base">
                          {u.displayName || "Staff Member"}
                        </span>
                        {u.nickname && (
                          <span className="text-slate-400 font-medium text-xs">
                            ({u.nickname})
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase ${
                            isAdminRole
                              ? "bg-purple-50 text-purple-800 border-purple-200"
                              : isInstructor
                              ? "bg-indigo-50 text-[#1a3a8f] border-indigo-100"
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {STAFF_ROLE_LABELS[u.role] || u.role}
                        </span>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${statusConfig.badgeClass}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`}
                          />
                          <span>{statusConfig.label}</span>
                        </span>

                        {isSelf && (
                          <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                            You (Active Session)
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 text-[11px] font-medium">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>{u.email || "No email"}</span>
                          {u.email && (
                            <button
                              type="button"
                              onClick={() => handleCopy(u.email, "Email")}
                              className="text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
                              title="Copy email"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{u.phone || "No phone"}</span>
                        </span>
                        {u.branch && (
                          <>
                            <span>·</span>
                            <span className="text-slate-600 font-semibold">
                              {u.branch}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 shrink-0">
                    {/* Print Badge: Rendered ONLY for trackable attendance staff (R4) */}
                    {TRACKED_STAFF_ROLES.includes(u.role) && onPrintBadge && (
                      <button
                        type="button"
                        onClick={() => onPrintBadge(u)}
                        className="py-1.5 px-3 rounded-xl font-bold text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition flex items-center gap-1 cursor-pointer"
                        title="Print QR credential badge for kiosk attendance"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Print Badge</span>
                      </button>
                    )}

                    {/* 1-Click WhatsApp */}
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 shadow-2xs"
                        title="Chat with staff on WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>WA</span>
                      </a>
                    )}

                    {/* Edit Profile */}
                    {onEditStaff && (
                      <button
                        type="button"
                        onClick={() => onEditStaff(u)}
                        className="py-1.5 px-3 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                        title="Edit staff profile"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>
                    )}

                    {/* Status Toggle Dropdown: Guarded against self-deactivation (R3) */}
                    <select
                      value={u.status || "active"}
                      disabled={updatingStatusId === u.id || isSelf}
                      onChange={(e) => handleStatusChange(u, e.target.value)}
                      className={`py-1.5 px-2 rounded-xl font-bold text-[11px] border text-slate-700 outline-none ${
                        isSelf
                          ? "bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed"
                          : "bg-slate-50 border-slate-200 focus:border-[#1a3a8f] cursor-pointer"
                      }`}
                      title={
                        isSelf
                          ? "You cannot modify your own administrative status while logged in"
                          : "Change employment status"
                      }
                    >
                      {STAFF_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {/* Delete with Guardrail */}
                    {onDeleteStaff && (
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(u)}
                        className="py-1.5 px-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition cursor-pointer"
                        title="Delete staff account"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Instructor Workload Telemetry: Rendered STRICTLY on instructor sub-tab per user decision */}
                {roleFilter === "instructor" && isInstructor && workload && (
                  <div className="pt-2.5 pb-1 border-t border-slate-100 text-xs">
                    <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[#1a3a8f] font-extrabold">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{workload.batchCount} Active Batches</span>
                        </div>
                        <span className="text-slate-300">|</span>
                        <div className="flex items-center gap-1 text-slate-700 font-bold">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          <span>{workload.studentCount} Students Taught</span>
                        </div>
                      </div>

                      {workload.assignedClasses.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {workload.assignedClasses.map((cls) => (
                            <span
                              key={cls.id}
                              className="text-[10px] font-bold bg-white text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-md shadow-2xs"
                              title={`${cls.className} (${cls.classSchedule || "Schedule TBA"})`}
                            >
                              {cls.className}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-amber-700 font-medium italic">
                          No active teaching batches assigned
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
