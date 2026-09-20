import { useState } from "react";
import { useToast, WelcomeBanner } from "../shared";
import { CheckSquare, Sparkles, AlertTriangle, Clock, ChevronDown, ChevronRight, Undo2 } from "lucide-react";
import { useStaffDirectives } from "../staff";

function formatDueDate(dueDate) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "Overdue", badgeColor: "bg-rose-100 text-rose-800 border-rose-200" };
  }
  if (diffDays === 0) {
    return { label: "Due Today", badgeColor: "bg-amber-100 text-amber-900 border-amber-300" };
  }
  return {
    label: `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
  };
}

export default function OfficeBoyDashboard() {
  const toast = useToast();
  const [showCompleted, setShowCompleted] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const {
    activeDirectives: tasks,
    completedDirectives,
    loading,
    handleToggle,
  } = useStaffDirectives("officeboy");

  const handleComplete = async (taskId) => {
    setProcessingId(taskId);
    try {
      await handleToggle(taskId, true);
      toast("Task completed!", "success");
    } catch (err) {
      toast("Error completing task: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReopen = async (taskId) => {
    setProcessingId(taskId);
    try {
      await handleToggle(taskId, false);
      toast("Task reopened.", "info");
    } catch (err) {
      toast("Error reopening task: " + err.message, "error");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-4">
      <WelcomeBanner
        portalLabel="Campus Support & Facilities"
        roleLabel="General Operations Staff"
        fallbackName="Support Staff"
        subtitle="Review classroom setups, campus supplies, facility requests, and daily operational tasks."
        stats={[
          {
            label: "Pending Directives",
            value: loading ? "..." : tasks.length,
            icon: CheckSquare,
          },
          {
            label: "Campus Readiness",
            value: tasks.length === 0 ? "All Clear" : "Active Tasks",
            icon: Sparkles,
          },
        ]}
      />

      {loading ? (
        <p className="text-center text-slate-400 py-10 animate-pulse font-medium text-xs">
          Checking assigned tasks...
        </p>
      ) : tasks.length === 0 ? (
        <div className="bg-slate-50 p-10 rounded-2xl border border-dashed border-slate-300 text-center">
          <p className="text-3xl mb-2">✨</p>
          <p className="text-sm font-bold text-slate-600">All caught up! No tasks right now.</p>
          <p className="text-xs text-slate-400 mt-1">Check back later or check in with the front desk.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
              Assigned Tasks ({tasks.length})
            </h3>
            <span className="text-[10px] font-bold text-slate-400">Tap to complete</span>
          </div>

          {tasks.map((task) => {
            const dueInfo = formatDueDate(task.dueDate);
            const isWorking = processingId === task.id;
            return (
              <button
                key={task.id}
                onClick={() => handleComplete(task.id)}
                disabled={isWorking}
                className="w-full bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between group active:scale-[0.99] transition cursor-pointer text-left disabled:opacity-50"
              >
                <div className="min-w-0 pr-3 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full inline-block">
                      {task.type || "TASK"}
                    </span>
                    {task.priority === "urgent" && (
                      <span className="text-[10px] font-black uppercase bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600" /> Urgent
                      </span>
                    )}
                    {dueInfo && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dueInfo.badgeColor}`}>
                        <Clock className="w-3 h-3 inline mr-1" />
                        {dueInfo.label}
                      </span>
                    )}
                    {task.assignee === "all" && (
                      <span className="text-[10px] font-semibold text-slate-400">
                        (All Staff)
                      </span>
                    )}
                  </div>
                  <p className="font-bold text-slate-800 text-base leading-snug break-words">
                    {task.text}
                  </p>
                  {task.createdByName && (
                    <p className="text-[11px] text-slate-400">
                      From: <strong>{task.createdByName}</strong>
                    </p>
                  )}
                </div>
                <div className="w-9 h-9 rounded-full border-2 border-slate-200 flex items-center justify-center group-hover:border-[#1a3a8f] group-hover:bg-indigo-50 transition shrink-0">
                  <span className="text-transparent group-hover:text-[#1a3a8f] text-sm font-black">
                    {isWorking ? "..." : "✓"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Collapsible Completed Tasks ── */}
      {completedDirectives.length > 0 && (
        <div className="pt-2">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition px-1"
          >
            {showCompleted ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <span>Completed Tasks ({completedDirectives.length})</span>
          </button>

          {showCompleted && (
            <div className="mt-2 space-y-2">
              {completedDirectives.slice(0, 10).map((task) => (
                <div
                  key={task.id}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs opacity-75"
                >
                  <div className="min-w-0 flex-1">
                    <p className="line-through text-slate-500 font-medium truncate">{task.text}</p>
                    <p className="text-[10px] text-slate-400">
                      Completed by {task.completedByName || "Staff"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleReopen(task.id)}
                    className="p-1.5 text-slate-400 hover:text-[#1a3a8f] rounded hover:bg-slate-200 transition"
                    title="Reopen task"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
