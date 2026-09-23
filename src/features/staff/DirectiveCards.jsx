import { AlertTriangle, CheckCircle2, Square, Trash2 } from "lucide-react";
import { formatDueDate, getAssigneeBadge } from "./tasksUtils";

export function DirectiveCard({ t, onToggle, onDelete }) {
  const dueInfo = formatDueDate(t.dueDate);
  const badge = getAssigneeBadge(t.assignee, t.assigneeType, t.assigneeName);

  return (
    <div
      className={`p-4 sm:p-5 rounded-2xl border transition flex items-start justify-between gap-3 ${
        t.completed
          ? "bg-slate-50/70 border-slate-200 opacity-80"
          : "bg-white border-slate-200 shadow-2xs hover:border-slate-300"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <button
          onClick={() => onToggle?.(t)}
          className="mt-0.5 text-slate-400 hover:text-[#1a3a8f] transition shrink-0 cursor-pointer"
          title={t.completed ? "Mark as active" : "Mark as complete"}
        >
          {t.completed ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <Square className="w-5 h-5 text-slate-300 hover:text-slate-500" />
          )}
        </button>

        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              {t.type || "directive"}
            </span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.color}`}
            >
              {badge.label}
            </span>
            {t.priority === "urgent" && (
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3 text-rose-600" /> Urgent
              </span>
            )}
            {t.priority === "high" && (
              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                High Priority
              </span>
            )}
            {dueInfo && !t.completed && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${dueInfo.badgeColor}`}
              >
                {dueInfo.label}
              </span>
            )}
            {t.isPinned && (
              <span className="text-[9px] font-bold text-amber-700 bg-yellow-100 border border-yellow-200 px-1 rounded">
                📌 Corkboard
              </span>
            )}
          </div>

          <p
            className={`font-bold text-xs sm:text-sm leading-snug break-words ${
              t.completed
                ? "line-through text-slate-400 font-medium"
                : "text-slate-800"
            }`}
          >
            {t.text}
          </p>

          <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-2 pt-0.5">
            {t.createdByName && (
              <span>
                Issued by: <strong>{t.createdByName}</strong>
              </span>
            )}
            {t.createdAt && (
              <span>
                ·{" "}
                {new Date(t.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            {t.completed && (
              <span className="text-emerald-700 font-bold">
                · Completed by {t.completedByName || "Staff"}
              </span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={() => onDelete?.(t)}
        className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-rose-50 transition shrink-0 cursor-pointer"
        title="Delete directive"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export function CorkboardCard({ t, onToggle, onDelete }) {
  const dueInfo = formatDueDate(t.dueDate);
  const badge = getAssigneeBadge(t.assignee, t.assigneeType, t.assigneeName);

  return (
    <div className="p-5 border-2 border-yellow-300 rounded-3xl shadow-sm space-y-3 relative bg-gradient-to-br from-[#fef9c3] to-[#fef08a]/60 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-black uppercase text-amber-900 bg-yellow-200 px-2 py-0.5 rounded-md border border-yellow-300">
          {t.type || "DIRECTIVE"}
        </span>
        {dueInfo && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-md border ${dueInfo.badgeColor}`}
          >
            {dueInfo.label}
          </span>
        )}
      </div>

      <p className="font-extrabold text-slate-900 text-sm leading-snug break-words">
        {t.text}
      </p>

      <div className="pt-2 border-t border-yellow-200/80 flex items-center justify-between text-[11px]">
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.color}`}
        >
          {badge.label}
        </span>

        <div className="flex items-center gap-2">
          {onToggle && (
            <button
              onClick={() => onToggle(t)}
              className="text-slate-600 hover:text-emerald-700 font-bold text-xs cursor-pointer"
              title="Mark complete"
            >
              ✓ Done
            </button>
          )}
          <button
            onClick={() => onDelete?.(t)}
            className="text-red-600 hover:text-red-800 font-bold text-xs cursor-pointer"
            title="Delete directive"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
