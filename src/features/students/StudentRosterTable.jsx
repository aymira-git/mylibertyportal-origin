import {
  ChevronUp,
  ChevronDown,
  MessageCircle,
  UserPlus,
  ArrowRightLeft,
  Sparkles,
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

export default function StudentRosterTable({
  pageItems = [],
  studentSortField,
  studentSortAsc,
  onSort,
  readOnly = false,
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
    <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200/90 shadow-2xs">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px] select-none">
            <th
              className="p-3.5 cursor-pointer hover:text-slate-900 transition"
              onClick={() => onSort("displayName")}
            >
              <div className="flex items-center gap-1">
                <span>Student Name</span>
                {studentSortField === "displayName" &&
                  (studentSortAsc ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#1a3a8f]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#1a3a8f]" />
                  ))}
              </div>
            </th>
            <th className="p-3.5">Status</th>
            <th
              className="p-3.5 cursor-pointer hover:text-slate-900 transition"
              onClick={() => onSort("parentName")}
            >
              <div className="flex items-center gap-1">
                <span>Parent Contact</span>
                {studentSortField === "parentName" &&
                  (studentSortAsc ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#1a3a8f]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#1a3a8f]" />
                  ))}
              </div>
            </th>
            <th
              className="p-3.5 cursor-pointer hover:text-slate-900 transition"
              onClick={() => onSort("educationLevel")}
            >
              <div className="flex items-center gap-1">
                <span>Education</span>
                {studentSortField === "educationLevel" &&
                  (studentSortAsc ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#1a3a8f]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#1a3a8f]" />
                  ))}
              </div>
            </th>
            <th
              className="p-3.5 cursor-pointer hover:text-slate-900 transition"
              onClick={() => onSort("dob")}
            >
              <div className="flex items-center gap-1">
                <span>DOB</span>
                {studentSortField === "dob" &&
                  (studentSortAsc ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#1a3a8f]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#1a3a8f]" />
                  ))}
              </div>
            </th>
            <th
              className="p-3.5 cursor-pointer hover:text-slate-900 transition"
              onClick={() => onSort("joinedDate")}
            >
              <div className="flex items-center gap-1">
                <span>Joined</span>
                {studentSortField === "joinedDate" &&
                  (studentSortAsc ? (
                    <ChevronUp className="w-3.5 h-3.5 text-[#1a3a8f]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#1a3a8f]" />
                  ))}
              </div>
            </th>
            <th className="p-3.5">Payment</th>
            <th className="p-3.5">Class Cohort</th>
            <th className="p-3.5">Instructor</th>
            {(!readOnly || onBadgeClick) && <th className="p-3.5 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
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
              <tr key={s.id} className="hover:bg-slate-50/60 transition group">
                <td className="p-3.5 font-bold text-slate-900">
                  <div className="flex items-center gap-2.5">
                    {s.photoURL ? (
                      <img
                        src={s.photoURL}
                        alt={s.displayName}
                        className="w-8 h-8 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1a3a8f] to-indigo-700 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
                        {getInitials(s.displayName)}
                      </div>
                    )}
                    <div>
                      <p className="font-extrabold text-slate-900 group-hover:text-[#1a3a8f] transition">
                        {s.displayName}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-mono text-slate-400 font-normal">
                          ID: {s.id.slice(0, 10)}
                        </span>
                        {s.currentLevel && (
                          <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 uppercase">
                            {s.currentLevel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="p-3.5 whitespace-nowrap">
                  {!readOnly ? (
                    <select
                      value={s.effectiveStatus}
                      disabled={updatingStatusId === s.id}
                      onChange={(e) => onStatusChange && onStatusChange(s, e.target.value)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border outline-none cursor-pointer ${statusBadge.tone}`}
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
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.tone}`}
                    >
                      {statusBadge.label}
                    </span>
                  )}
                </td>
                <td className="p-3.5 text-slate-600">
                  <p className="font-semibold text-slate-800">{s.parentName || "—"}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[11px] text-slate-400">{s.parentPhone || "No contact"}</p>
                    {s.parentPhone && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openWhatsAppParentChat(s.parentPhone, s.parentName, s.displayName);
                        }}
                        title="Chat with parent on WhatsApp"
                        className="p-0.5 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
                <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">
                  {s.educationLevel || s.schoolOrJob || "—"}
                </td>
                <td className="p-3.5 text-slate-500 whitespace-nowrap text-[11px]">{s.dob || "—"}</td>
                <td className="p-3.5 text-slate-600 font-semibold whitespace-nowrap">
                  {s.effectiveJoinedDate || "—"}
                </td>
                <td className="p-3.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {readOnly ? (
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getHealthBadgeReadOnlyClasses(health.tone)}`}
                      >
                        {health.label}
                      </span>
                    ) : (
                      <button
                        onClick={() => onPaymentClick && onPaymentClick(s)}
                        title="Click to manage payments"
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition shadow-2xs hover:ring-2 hover:ring-offset-1 cursor-pointer ${getHealthBadgeClasses(health.tone)}`}
                      >
                        {health.label}
                      </button>
                    )}

                    {planLabel && (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-[#1a3a8f] border border-indigo-100">
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
                    <p className="text-[10px] text-slate-500 mt-1 font-medium whitespace-nowrap">
                      Until {s.paidUntil}
                      {health.remainingDays !== null && health.status === "due_soon" && (
                        <span className="text-amber-600 font-semibold ml-1">
                          ({health.remainingDays}d left)
                        </span>
                      )}
                      {health.remainingDays !== null && health.status === "expired" && (
                        <span className="text-rose-600 font-semibold ml-1">
                          ({Math.abs(health.remainingDays)}d ago)
                        </span>
                      )}
                    </p>
                  ) : s.lastPaymentPeriod ? (
                    <p className="text-[10px] text-slate-400 mt-1 font-medium whitespace-nowrap">
                      {s.lastPaymentPeriod}
                    </p>
                  ) : null}
                </td>
                <td className="p-3.5">
                  {studentClasses.length === 0 ? (
                    !readOnly ? (
                      <button
                        type="button"
                        onClick={() => onAssignBatch && onAssignBatch(s)}
                        className="inline-flex items-center gap-1 text-amber-800 font-bold bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-md text-[11px] border border-amber-200 transition shadow-2xs cursor-pointer"
                        title="Assign to a batch"
                      >
                        <UserPlus className="w-3 h-3 text-amber-600" />
                        <span>Assign Batch</span>
                      </button>
                    ) : (
                      <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200/60 whitespace-nowrap">
                        Unassigned
                      </span>
                    )
                  ) : (
                    studentClasses.map((c, idx) => (
                      <div key={idx} className="mb-1 last:mb-0 whitespace-nowrap inline-flex items-center gap-1.5 mr-2">
                        <span className="text-[#1a3a8f] font-bold text-[11px] bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100">
                          {c.className}
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => onTransferBatch && onTransferBatch(s, c)}
                            title="Transfer to another batch"
                            className="p-0.5 text-slate-400 hover:text-[#1a3a8f] hover:bg-indigo-50 rounded transition cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </td>
                <td className="p-3.5">
                  {studentClasses.length === 0 ? (
                    <span className="text-slate-400 text-xs">—</span>
                  ) : (
                    studentClasses.map((c, idx) => (
                      <div key={idx} className="mb-1 last:mb-0 whitespace-nowrap">
                        <span className="text-slate-700 font-medium text-[11px]">
                          {c.instructorName || "Unassigned"}
                        </span>
                      </div>
                    ))
                  )}
                </td>
                {(!readOnly || onBadgeClick) && (
                  <td className="p-3.5 text-right font-bold whitespace-nowrap">
                    <div className="flex items-center gap-1.5 justify-end">
                      {pendingPromotion && !readOnly && nextLevel && (
                        <button
                          type="button"
                          onClick={() => onPromote && onPromote(s, pendingPromotion)}
                          className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 rounded-lg font-bold text-[11px] transition shadow-2xs cursor-pointer"
                          title={`Promote to ${nextLevel.toUpperCase()}`}
                        >
                          <Sparkles className="w-3 h-3 text-amber-600 animate-pulse" />
                          <span>Promote</span>
                        </button>
                      )}
                      {onBadgeClick && (
                        <button
                          onClick={() => onBadgeClick(s)}
                          className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-[#1a3a8f] border border-indigo-200/60 px-2.5 py-1 rounded-lg font-bold text-[11px] transition shadow-2xs cursor-pointer"
                          title="View / Print ID Badge"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>Badge</span>
                        </button>
                      )}
                      {!readOnly && (
                        <>
                          <button
                            onClick={() => onEdit && onEdit(s)}
                            className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-bold text-[11px] transition shadow-2xs cursor-pointer"
                            title="Edit profile"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => onDeleteStudent && onDeleteStudent(s)}
                            className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
                            title="Delete record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
