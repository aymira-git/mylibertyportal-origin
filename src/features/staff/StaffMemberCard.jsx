import {
  Mail,
  Phone,
  MessageCircle,
  Copy,
  Edit2,
  Trash2,
  Printer,
  Users,
  BookOpen,
} from "lucide-react";
import {
  STAFF_ROLE_LABELS,
  STAFF_STATUS_MAP,
  STAFF_STATUS_OPTIONS,
  TRACKED_STAFF_ROLES,
  getInstructorWorkload,
} from "./staffUtils";
import { DIVISION_BADGES, normalizeDivision } from "../../constants/divisions.js";
import { normalizeWhatsAppNumber } from "../finance/receiptMessages";

export function StaffMemberCard({
  u,
  classes,
  currentUserId,
  roleFilter,
  updatingStatusId,
  onCopy,
  onStatusChange,
  onPrintBadge,
  onEditStaff,
  onDeleteStaff,
}) {
  const statusConfig = STAFF_STATUS_MAP[u.status || "active"] || STAFF_STATUS_MAP.active;
  const isAdminRole = u.role === "admin";
  const isInstructor = u.role === "instructor";
  const isSelf = currentUserId && u.id === currentUserId;

  const rawPhone = u.phone || "";
  const normPhone = normalizeWhatsAppNumber(rawPhone);
  const canWhatsApp = normPhone && normPhone.length >= 9;
  const waGreeting = `Halo Kak ${u.displayName || ""}! Kami dari My Liberty English Academy ingin mengonfirmasi terkait jadwal dan operasional sekolah.`;
  const waUrl = canWhatsApp
    ? `https://wa.me/${normPhone}?text=${encodeURIComponent(waGreeting)}`
    : null;

  const workload = isInstructor ? getInstructorWorkload(u.id, classes) : null;

  return (
    <div className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs hover:border-indigo-200 transition space-y-3">
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
                <span className="text-slate-400 font-medium text-xs">({u.nickname})</span>
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
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                  DIVISION_BADGES[normalizeDivision(u.division)].tone
                }`}
              >
                {DIVISION_BADGES[normalizeDivision(u.division)].label}
              </span>

              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${statusConfig.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`} />
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
                    onClick={() => onCopy(u.email, "Email")}
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
                  <span className="text-slate-600 font-semibold">{u.branch}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions Column */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 shrink-0">
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

          <select
            value={u.status || "active"}
            disabled={updatingStatusId === u.id || isSelf}
            onChange={(e) => onStatusChange(u, e.target.value)}
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

          {onDeleteStaff && (
            <button
              type="button"
              onClick={() => onDeleteStaff(u)}
              className="py-1.5 px-2.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition cursor-pointer"
              title="Delete staff account"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

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
}
