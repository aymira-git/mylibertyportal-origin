/**
 * TasksPanel.jsx
 * Office corkboard & task manager for the staff feature.
 * Displays pinned reminders and lets admins create/delete tasks.
 */

import { useState } from "react";

const ASSIGNEE_CONFIG = {
  all: { label: "Everyone", color: "bg-slate-100 text-slate-700 border-slate-200" },
  frontoffice: { label: "Front Office", color: "bg-blue-100 text-blue-800 border-blue-200" },
  marketing: { label: "Marketing", color: "bg-purple-100 text-purple-800 border-purple-200" },
  instructor: { label: "Instructors", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  officeboy: { label: "Office Boy", color: "bg-amber-100 text-amber-800 border-amber-200" },
};

export default function TasksPanel({ todos, onAddTodo, onDeleteTodo }) {
  const [newTodo, setNewTodo]       = useState("");
  const [todoType, setTodoType]     = useState("task");
  const [todoPinned, setTodoPinned] = useState(false);
  const [todoAssignee, setTodoAssignee] = useState("all");

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onAddTodo({ text: newTodo, type: todoType, isPinned: todoPinned, assignee: todoAssignee });
    setNewTodo("");
    setTodoType("task");
    setTodoPinned(false);
    setTodoAssignee("all");
  };

  const pinned = todos.filter(t => t.isPinned || t.type === "deadline");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto text-sm">

      {/* Column 1: Corkboard */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-800 text-base">📌 Corkboard (Pinned Reminders)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pinned.map(t => (
            <div
              key={t.id}
              className="p-4 border-yellow-300 border rounded-xl shadow-md transform rotate-1 space-y-2 relative bg-[#fef9c3]"
            >
              <span className="absolute top-2 right-2 text-[9px] font-bold uppercase text-red-600">{t.type}</span>
              <p className="font-bold text-slate-800 pt-2">{t.text}</p>
              {t.assignee && t.assignee !== "all" && (
                <span className={`inline-block text-[9px] font-bold px-2 py-0.5 rounded border ${ASSIGNEE_CONFIG[t.assignee]?.color || ASSIGNEE_CONFIG.all.color}`}>
                  {ASSIGNEE_CONFIG[t.assignee]?.label || t.assignee}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Column 2: Task Manager */}
      <div className="bg-white p-5 rounded-2xl border border-slate-150 space-y-3">
        <h3 className="font-bold text-slate-700 text-sm border-b pb-2">Office Task Manager</h3>

        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            type="text"
            placeholder="Add task / appointment / deadline..."
            value={newTodo}
            onChange={e => setNewTodo(e.target.value)}
            className="min-h-12 w-full p-2.5 border rounded-xl"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={todoType}
              onChange={e => setTodoType(e.target.value)}
              className="min-h-12 p-2.5 border rounded-xl bg-white font-bold"
            >
              <option value="task">Task</option>
              <option value="appointment">Appointment</option>
              <option value="deadline">Deadline</option>
            </select>
            <select
              value={todoAssignee}
              onChange={e => setTodoAssignee(e.target.value)}
              className="min-h-12 p-2.5 border rounded-xl bg-white font-bold"
            >
              <option value="all">Everyone</option>
              <option value="frontoffice">Front Office</option>
              <option value="marketing">Marketing</option>
              <option value="instructor">Instructors</option>
              <option value="officeboy">Office Boy</option>
            </select>
            <label className="col-span-2 flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-50 font-bold text-xs text-slate-600">
              <input
                type="checkbox"
                checked={todoPinned}
                onChange={e => setTodoPinned(e.target.checked)}
              /> Pin
            </label>
          </div>
          <button
            type="submit"
            className="min-h-14 w-full bg-[#1a3a8f] text-white p-3 rounded-2xl font-black hover:bg-[#122b6e] active:scale-[0.98] transition"
          >
            Add Item
          </button>
        </form>

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {todos.map(t => (
            <div
              key={t.id}
              className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex justify-between items-center text-xs gap-2"
            >
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="font-bold uppercase text-[9px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 shrink-0">
                  {t.type}
                </span>
                <span className={`font-bold uppercase text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${ASSIGNEE_CONFIG[t.assignee]?.color || ASSIGNEE_CONFIG.all.color}`}>
                  {ASSIGNEE_CONFIG[t.assignee]?.label || t.assignee || "Everyone"}
                </span>
                <span className="font-medium text-slate-800 break-words">{t.text}</span>
              </div>
              <button
                onClick={() => onDeleteTodo(t.id)}
                className="min-h-10 rounded-lg px-2 text-red-600 hover:bg-rose-50 font-bold text-xs shrink-0"
                title="Delete task"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
