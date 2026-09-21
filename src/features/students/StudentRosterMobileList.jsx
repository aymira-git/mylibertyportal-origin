import {
  MessageCircle,
  Sparkles,
  UserPlus,
  ArrowRightLeft,
  QrCode,
  Edit2,
  Trash2,
} from "lucide-react";
import { getNextLevel } from "../shared";
import { isActiveStudent, STUDENT_STATUS_OPTIONS } from "./studentRecord";
import {
  getInitials,
  getStudentPlanLabel,
  getHealthBadgeClasses,
  getHealthBadgeReadOnlyClasses,
  getStatusBadge,
  openWhatsAppParentChat,
} from "./studentRosterBadges";

export default function StudentRosterMobileList({
  pageItems = [],
  readOnly = false,
  canEditStatus = true,
  updatingStatusId = null,
  pendingPromotionsMap = {},
  onStatusChange,
  onPaymentClick,
  onSendRenewalReminder,
  onPromote,
  onAssignBatch,
  onTransferBatch,
  onBadgeClick,
  onEdit,
  onDeleteStudent,
}) {
  return (
    <div className="space-y-3.5 md:hidden">
      {pageItems.map((s) => {
        const studentClasses = s.studentClasses || [];
        const statusBadge = getStatusBadge(s.effectiveStatus);
        const health = s.paymentHealth;
        const planLabel = getStudentPlanLabel(s);
        const canRemind =
          !readOnly &&
          isActiveStudent(s) &&
          (health.status === "due_soon" || health.status === "expired") &&
          (s.parentPhone || s.phone);
        const pendingPromotion = pendingPromotionsMap[s.id];
        const nextLevel = pendingPromotion ? getNextLevel(s.currentLevel || "warrior") : null;

        return (
          <article
            key={s.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 hover:border-indigo-200 transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {s.photoURL ? (
                  <img
                    src={s.photoURL}
                    alt={s.displayName}
                    className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1a3a8f] to-indigo-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                    {getInitials(s.displayName)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h4 className="truncate text-sm font-extrabold text-slate-900">
                      {s.displayName || "Unnamed student"}
                    </h4>
                    {!readOnly && canEditStatus ? (
                      <select
                        value={s.effectiveStatus}
                        disabled={updatingStatusId === s.id}
                        onChange={(e) => onStatusChange && onStatusChange(s, e.target.value)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border outline-none cursor-pointer ${statusBadge.tone}`}
                        title="Change student lifecycle status"
                      >
                        {STUDENT_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.tone}`}
                      >
                        {statusBadge.label}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-[11px] font-mono text-slate-400">ID: {s.id.slice(0, 10)}</p>
                    {s.currentLevel && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 uppercase">
                        {s.currentLevel}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {readOnly ? (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${getHealthBadgeReadOnlyClasses(health.tone)}`}
                    >
                      {health.label}
                    </span>
                  ) : (
                    <button
                      onClick={() => onPaymentClick && onPaymentClick(s)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition shadow-2xs cursor-pointer ${getHealthBadgeClasses(health.tone)}`}
                    >
                      {health.label}
                    </button>
                  )}

                  {planLabel && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-[#1a3a8f] border border-indigo-100">
                      {planLabel}
                    </span>
                  )}

                  {canRemind && (
                    <button
                      type="button"
                      onClick={(e) => onSendRenewalReminder && onSendRenewalReminder(e, s, health)}
                      title="Send WhatsApp renewal reminder"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition shadow-2xs cursor-pointer"
                    >
                      <MessageCircle className="w-3 h-3" />
                      <span>Remind</span>
                    </button>
                  )}
                </div>

                {s.paidUntil ? (
                  <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                    Until {s.paidUntil}
                    {health.remainingDays !== null && health.status === "due_soon" && (
                      <span className="text-amber-600 font-semibold ml-1">
                        ({health.remainingDays}d)
                      </span>
                    )}
                    {health.remainingDays !== null && health.status === "expired" && (
                      <span className="text-rose-600 font-semibold ml-1">
                        ({Math.abs(health.remainingDays)}d ago)
                      </span>
                    )}
                  </p>
                ) : s.lastPaymentPeriod ? (
                  <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                    {s.lastPaymentPeriod}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Promotion Banner if Eligible */}
            {pendingPromotion && !readOnly && nextLevel && (
              <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-indigo-50 p-2.5 rounded-xl border border-amber-200 text-xs">
                <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Eligible for {nextLevel.toUpperCase()}!</span>
                </div>
                <button
                  type="button"
                  onClick={() => onPromote && onPromote(s, pendingPromotion)}
                  className="px-2.5 py-1 rounded-lg bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-extrabold text-[11px] shadow-xs transition shrink-0 cursor-pointer"
                >
                  Promote
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-100 py-2.5 text-slate-600">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Parent</span>
                <span className="font-semibold text-slate-800">{s.parentName || "—"}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-[11px] text-slate-500 truncate">
                    {s.parentPhone || "No contact"}
                  </p>
                  {s.parentPhone && (
                    <button
                      type="button"
                      onClick={() =>
                        openWhatsAppParentChat(s.parentPhone, s.parentName, s.displayName)
                      }
                      title="Chat with parent on WhatsApp"
                      className="p-1 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition shrink-0 cursor-pointer"
                    >
                      <MessageCircle className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">
                  Education / Joined
                </span>
                <span className="font-semibold text-slate-800 truncate block">
                  {s.educationLevel || s.schoolOrJob || "—"}
                </span>
                <p className="text-[11px] text-slate-500">{s.effectiveJoinedDate || "—"}</p>
              </div>
              <div className="col-span-2 bg-slate-50/80 p-2.5 rounded-xl">
                <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Enrolled Class
                </span>
                {studentClasses.length === 0 ? (
                  !readOnly ? (
                    <button
                      type="button"
                      onClick={() => onAssignBatch && onAssignBatch(s)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition shadow-2xs cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-amber-600" />
                      <span>Assign Batch</span>
                    </button>
                  ) : (
                    <span className="text-amber-700 font-semibold text-xs">Unassigned</span>
                  )
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {studentClasses.map((c, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-1.5 bg-indigo-50 text-[#1a3a8f] px-2.5 py-1 rounded-lg border border-indigo-100 text-xs font-bold"
                      >
                        <span>{c.className}</span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => onTransferBatch && onTransferBatch(s, c)}
                            title="Transfer batch"
                            className="p-0.5 hover:text-[#122b6e] text-indigo-400 transition cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {(!readOnly || onBadgeClick) && (
              <div className="flex gap-2 pt-1">
                {onBadgeClick && (
                  <button
                    onClick={() => onBadgeClick(s)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#1a3a8f] border border-indigo-100 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Badge</span>
                  </button>
                )}
                {!readOnly && (
                  <>
                    <button
                      onClick={() => onEdit && onEdit(s)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => onDeleteStudent && onDeleteStudent(s)}
                      className="inline-flex items-center justify-center p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition cursor-pointer"
                      title="Delete student"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            )}
          </article>
        );
      })}
      {pageItems.length === 0 && (
        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-500 text-xs">
          No students found matching your criteria.
        </div>
      )}
    </div>
  );
}
