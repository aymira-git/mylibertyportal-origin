import { useMemo } from "react";
import { TasksPanel } from "../../staff";

export function StaffDirectivesTab({
  todos,
  users = [],
  currentUser = null,
  onAddTodo,
  onDeleteTodo,
  onToggleTodo,
  todosPermission = true,
}) {
  const activeCount = todos.filter((t) => !t.completed).length;
  const pinnedCount = todos.filter((t) => t.isPinned || t.type === "deadline").length;
  const deptCounts = useMemo(() => {
    const counts = { all: 0, frontoffice: 0, marketing: 0, instructor: 0, officeboy: 0 };
    todos.forEach((t) => {
      const a = t.assignee || "all";
      if (counts[a] !== undefined) counts[a] += 1;
    });
    return counts;
  }, [todos]);

  return (
    <div className="w-full space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-2xl font-black text-[#1a3a8f]">Staff Directives &amp; Delegation</h2>
        <p className="text-sm text-slate-500">
          Issue actionable directives, target specific departments, and track operational execution
          across the school.
        </p>

        {!todosPermission && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <span className="text-sm">ℹ️</span>
              <span>Firestore Rules Deployment Required for Live Cloud Sync</span>
            </div>
            <p className="leading-relaxed">
              Your live Firebase project currently restricts Manager access on the{" "}
              <code>todos</code> collection. To enable cloud-synced directives across all devices,
              deploy the updated rules with <code>firebase deploy --only firestore:rules</code> or
              update the <code>/todos</code> rule in your Firebase Console. Local directives work
              during your current session.
            </p>
          </div>
        )}

        {/* Department Delegation Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 text-center text-xs">
          <div className="p-2.5 rounded-xl border bg-slate-50 font-semibold">
            <p className="text-slate-400 text-[10px] uppercase">Active Tasks</p>
            <p className="text-lg font-black text-slate-800 mt-0.5">{activeCount}</p>
          </div>
          <div className="p-2.5 rounded-xl border bg-red-50 font-semibold border-red-100">
            <p className="text-red-500 text-[10px] uppercase">Pinned / Deadlines</p>
            <p className="text-lg font-black text-red-700 mt-0.5">{pinnedCount}</p>
          </div>
          <div className="p-2.5 rounded-xl border bg-blue-50 font-semibold border-blue-100">
            <p className="text-blue-600 text-[10px] uppercase">Front Office</p>
            <p className="text-lg font-black text-blue-800 mt-0.5">{deptCounts.frontoffice}</p>
          </div>
          <div className="p-2.5 rounded-xl border bg-purple-50 font-semibold border-purple-100">
            <p className="text-purple-600 text-[10px] uppercase">Marketing</p>
            <p className="text-lg font-black text-purple-800 mt-0.5">{deptCounts.marketing}</p>
          </div>
          <div className="p-2.5 rounded-xl border bg-emerald-50 font-semibold border-emerald-100">
            <p className="text-emerald-600 text-[10px] uppercase">Instructors</p>
            <p className="text-lg font-black text-emerald-800 mt-0.5">{deptCounts.instructor}</p>
          </div>
          <div className="p-2.5 rounded-xl border bg-amber-50 font-semibold border-amber-100">
            <p className="text-amber-600 text-[10px] uppercase">Office Boy</p>
            <p className="text-lg font-black text-amber-800 mt-0.5">{deptCounts.officeboy}</p>
          </div>
        </div>
      </div>

      <TasksPanel
        todos={todos}
        users={users}
        currentUser={currentUser}
        onAddTodo={onAddTodo}
        onDeleteTodo={onDeleteTodo}
        onToggleTodo={onToggleTodo}
      />
    </div>
  );
}
