import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Pin,
  Sparkles,
  Undo2,
} from "lucide-react";
import { useToast } from "../shared";

function formatDueDate(dueDate) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `Overdue by ${Math.abs(diffDays)}d`,
      isOverdue: true,
      badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
    };
  }
  if (diffDays === 0) {
    return {
      label: "Due Today",
      isOverdue: false,
      badgeColor: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
    };
  }
  if (diffDays === 1) {
    return {
      label: "Due Tomorrow",
      isOverdue: false,
      badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    };
  }
  return {
    label: `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    isOverdue: false,
    badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
  };
}

export default function StaffDirectivesWidget({
  activeDirectives = [],
  completedDirectives = [],
  loading = false,
  onToggle,
  roleLabel = "Staff Member",
}) {
  const toast = useToast();
  const [showCompleted, setShowCompleted] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const handleToggleClick = async (directive, newStatus) => {
    setProcessingId(directive.id);
    try {
      await onToggle(directive.id, newStatus);
      if (newStatus) {
        toast("Directive marked as completed!", "success");
      } else {
        toast("Directive reopened.", "info");
      }
    } catch (err) {
      toast("Failed to update directive: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-3 w-full">
        <p className="text-slate-400 text-xs font-semibold animate-pulse">
          Loading assigned directives...
        </p>
      </div>
    );
  }

  const pinnedItems = activeDirectives.filter((d) => d.isPinned);
  const unpinnedItems = activeDirectives.filter((d) => !d.isPinned);

  return (
    <div className="space-y-6 w-full">
      {/* ── Directives Header ── */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1a3a8f] animate-pulse" />
            <h3 className="font-extrabold text-slate-800 text-base">
              Directives &amp; Operational Orders
            </h3>
            {activeDirectives.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#1a3a8f] text-white">
                {activeDirectives.length} pending
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Official instructions and tasks assigned by Academy Leadership for {roleLabel}.
          </p>
        </div>

        {activeDirectives.length === 0 && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>All Directives Cleared</span>
          </div>
        )}
      </div>

      {/* ── Pinned Alerts / Bulletin ── */}
      {pinnedItems.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5 px-1">
            <Pin className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
            <span>Pinned Priority Orders</span>
          </h4>
          <div className="grid grid-cols-1 gap-3">
            {pinnedItems.map((item) => {
              const dueInfo = formatDueDate(item.dueDate);
              const isWorking = processingId === item.id;
              return (
                <div
                  key={item.id}
                  className="p-5 bg-gradient-to-r from-amber-50/80 to-yellow-50/60 border-2 border-amber-300 rounded-3xl shadow-xs relative transition hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 border border-amber-300">
                          📌 Pinned
                        </span>
                        {item.priority === "urgent" && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-600 text-white shadow-2xs flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Urgent
                          </span>
                        )}
                        {dueInfo && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${dueInfo.badgeColor}`}
                          >
                            {dueInfo.label}
                          </span>
                        )}
                      </div>
                      <p className="font-extrabold text-slate-800 text-base leading-snug">
                        {item.text}
                      </p>
                      <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-3 pt-1">
                        {item.createdByName && (
                          <span>
                            From: <strong>{item.createdByName}</strong>
                          </span>
                        )}
                        {item.createdAt && (
                          <span>
                            {new Date(item.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleClick(item, true)}
                      disabled={isWorking}
                      className="px-4 py-2 bg-[#1a3a8f] hover:bg-[#122b6e] text-white text-xs font-black rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>{isWorking ? "Updating..." : "Mark Done"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Active Directives List ── */}
      <div className="space-y-3">
        {unpinnedItems.length > 0 && (
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">
            Active Directives ({unpinnedItems.length})
          </h4>
        )}

        {unpinnedItems.length === 0 && pinnedItems.length === 0 ? (
          <div className="bg-slate-50 p-12 rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
            <p className="text-3xl">✨</p>
            <p className="text-sm font-extrabold text-slate-700">
              No active directives at the moment
            </p>
            <p className="text-xs text-slate-400">
              You are all caught up on operational mandates and campus directives.
            </p>
          </div>
        ) : (
          unpinnedItems.map((item) => {
            const dueInfo = formatDueDate(item.dueDate);
            const isWorking = processingId === item.id;
            return (
              <div
                key={item.id}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-4 transition hover:border-slate-300"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                      {item.type || "directive"}
                    </span>
                    {item.priority === "urgent" && (
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Urgent
                      </span>
                    )}
                    {item.priority === "high" && (
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        High Priority
                      </span>
                    )}
                    {dueInfo && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border flex items-center gap-1 ${dueInfo.badgeColor}`}
                      >
                        <Clock className="w-3 h-3" />
                        {dueInfo.label}
                      </span>
                    )}
                    {item.assignee === "all" && (
                      <span className="text-[10px] font-semibold text-slate-400">
                        (All Academy Staff)
                      </span>
                    )}
                  </div>
                  <p className="font-extrabold text-slate-800 text-sm sm:text-base leading-snug break-words">
                    {item.text}
                  </p>
                  <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-3 pt-0.5">
                    {item.createdByName && (
                      <span>
                        Issued by: <strong>{item.createdByName}</strong>
                      </span>
                    )}
                    {item.createdAt && (
                      <span>
                        {new Date(item.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleClick(item, true)}
                  disabled={isWorking}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-[#1a3a8f] hover:text-white text-slate-700 text-xs font-extrabold rounded-xl transition flex items-center gap-1.5 shrink-0 group active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Mark as completed"
                >
                  <CheckCircle2 className="w-4 h-4 text-slate-400 group-hover:text-emerald-300 transition-colors" />
                  <span className="hidden sm:inline">{isWorking ? "Saving..." : "Done"}</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* ── Collapsible Completed Directives ── */}
      {completedDirectives.length > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition"
          >
            {showCompleted ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
            <span>Completed Directives ({completedDirectives.length})</span>
          </button>

          {showCompleted && (
            <div className="mt-3 space-y-2">
              {completedDirectives.map((item) => {
                const isWorking = processingId === item.id;
                return (
                  <div
                    key={item.id}
                    className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-xs opacity-75 hover:opacity-100 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-through text-slate-500 font-medium break-words">
                        {item.text}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Completed by {item.completedByName || "Staff"}
                        {item.completedAt && (
                          <>
                            {" "}
                            ·{" "}
                            {new Date(item.completedAt).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </>
                        )}
                      </p>
                    </div>

                    <button
                      onClick={() => handleToggleClick(item, false)}
                      disabled={isWorking}
                      className="px-2.5 py-1 text-slate-500 hover:text-[#1a3a8f] font-semibold text-[11px] rounded-lg hover:bg-slate-200/60 transition flex items-center gap-1 shrink-0"
                      title="Reopen directive"
                    >
                      <Undo2 className="w-3 h-3" />
                      <span>Reopen</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
