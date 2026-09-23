import { AlertTriangle, CheckCheck, Edit2 } from "lucide-react";
import { getShiftStatus } from "../../attendance";
import { normalizeBranch } from "../../../constants/branches";

export function ShiftRow({
  s,
  isMultiOpen,
  canPerformAdminActions,
  onMarkReviewed,
  onEditShift,
}) {
  const derivedStatus = getShiftStatus(s);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-2xl hover:bg-indigo-50/30 transition shadow-2xs">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-extrabold text-slate-900 text-xs">{s.displayName}</p>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded-full capitalize">
            {s.role}
          </span>
          {s.branch && (
            <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
              {normalizeBranch(s.branch)}
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
            onClick={() => onMarkReviewed(s.id)}
            className="px-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 transition cursor-pointer"
            title="Mark Auto-Closed Shift as Reviewed"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Mark Reviewed</span>
          </button>
        )}

        {/* Admin Shift Adjustment */}
        {canPerformAdminActions && (
          <button
            onClick={() => onEditShift(s)}
            className="p-1.5 text-slate-400 hover:text-[#1a3a8f] rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
            title="Adjust / Audit Shift"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
