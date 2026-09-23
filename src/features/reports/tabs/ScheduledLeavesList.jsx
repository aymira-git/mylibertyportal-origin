import { Calendar, Trash2 } from "lucide-react";

export function ScheduledLeavesList({ leaves, canPerformAdminActions, onDeleteLeave }) {
  if (!leaves || leaves.length === 0) return null;

  return (
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
                onClick={() => onDeleteLeave(l.id)}
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
  );
}
