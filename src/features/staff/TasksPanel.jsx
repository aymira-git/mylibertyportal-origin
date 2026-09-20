import { useState, useMemo } from "react";
import {
  Pin,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Search,
  Plus,
  Square,
} from "lucide-react";
import { useConfirm, useToast } from "../shared";

const ROLE_OPTIONS = [
  { value: "all", label: "All Academy Staff", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "frontoffice", label: "Front Office", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "marketing", label: "Marketing", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { value: "instructor", label: "Instructors", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "officeboy", label: "Office Boy / Facilities", color: "bg-amber-100 text-amber-800 border-amber-200" },
];

function getAssigneeBadge(assignee, assigneeType, assigneeName) {
  if (assigneeType === "individual" && assigneeName) {
    return {
      label: `👤 ${assigneeName}`,
      color: "bg-indigo-50 text-indigo-800 border-indigo-200 font-bold",
    };
  }
  const match = ROLE_OPTIONS.find((r) => r.value === assignee);
  if (match) {
    return { label: match.label, color: match.color };
  }
  return { label: assigneeName || assignee || "Everyone", color: "bg-slate-100 text-slate-700 border-slate-200" };
}

function formatDueDate(dueDate) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      label: `Overdue (${Math.abs(diffDays)}d)`,
      isOverdue: true,
      badgeColor: "bg-rose-100 text-rose-800 border-rose-200 font-black",
    };
  }
  if (diffDays === 0) {
    return {
      label: "Due Today",
      isOverdue: false,
      badgeColor: "bg-amber-100 text-amber-900 border-amber-300 font-black",
    };
  }
  if (diffDays === 1) {
    return {
      label: "Due Tomorrow",
      isOverdue: false,
      badgeColor: "bg-blue-100 text-blue-800 border-blue-200 font-bold",
    };
  }
  return {
    label: `Due ${due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    isOverdue: false,
    badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
  };
}

export default function TasksPanel({
  todos = [],
  users = [],
  currentUser = null,
  onAddTodo,
  onDeleteTodo,
  onToggleTodo,
}) {
  const confirm = useConfirm();
  const toast = useToast();

  // Form State
  const [newText, setNewText] = useState("");
  const [newType, setNewType] = useState("directive");
  const [newPriority, setNewPriority] = useState("normal");
  const [newAssigneeValue, setNewAssigneeValue] = useState("all");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPinned, setNewPinned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // "active" | "completed" | "all"
  const [targetFilter, setTargetFilter] = useState("all"); // "all" | "frontoffice" | etc.
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Staff members eligible for individual assignment
  const staffMembers = useMemo(() => {
    return users
      .filter((u) => u.role && u.role !== "student" && (u.status || "active") === "active")
      .sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
  }, [users]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = newText.trim();
    if (!trimmed) return;

    setSubmitting(true);

    let assignee = newAssigneeValue;
    let assigneeType = "role";
    let assigneeName = "All Academy Staff";

    if (newAssigneeValue.startsWith("user:")) {
      const uid = newAssigneeValue.replace("user:", "");
      const staff = staffMembers.find((s) => s.id === uid);
      assignee = uid;
      assigneeType = "individual";
      assigneeName = staff?.displayName || staff?.email || "Staff Member";
    } else {
      const match = ROLE_OPTIONS.find((r) => r.value === newAssigneeValue);
      if (match) assigneeName = match.label;
    }

    try {
      await onAddTodo({
        text: trimmed,
        type: newType,
        priority: newPriority,
        assignee,
        assigneeType,
        assigneeName,
        dueDate: newDueDate || null,
        isPinned: newPinned,
        createdBy: currentUser?.uid || null,
        createdByName: currentUser?.displayName || currentUser?.email || "Leadership",
      });

      setNewText("");
      setNewType("directive");
      setNewPriority("normal");
      setNewAssigneeValue("all");
      setNewDueDate("");
      setNewPinned(false);
    } catch (err) {
      toast("Failed to create directive: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (t) => {
    if (onToggleTodo) {
      try {
        await onToggleTodo(t.id, !t.completed);
      } catch (err) {
        toast("Error updating directive: " + err.message, "error");
      }
    }
  };

  const handleDelete = async (t) => {
    const prompt = `Delete directive: "${t.text}"?`;
    if (!(await confirm(prompt))) return;
    try {
      await onDeleteTodo(t.id);
    } catch (err) {
      toast("Error deleting directive: " + err.message, "error");
    }
  };

  // Pinned directives
  const pinnedDirectives = useMemo(() => {
    return todos.filter((t) => (t.isPinned || t.type === "deadline") && !t.completed);
  }, [todos]);

  // Filtered directives
  const filteredTodos = useMemo(() => {
    return todos.filter((t) => {
      // Status filter
      if (statusFilter === "active" && t.completed) return false;
      if (statusFilter === "completed" && !t.completed) return false;

      // Target / Assignee filter
      if (targetFilter !== "all") {
        if (targetFilter === "individual" && t.assigneeType !== "individual") return false;
        if (targetFilter !== "individual" && t.assignee !== targetFilter) return false;
      }

      // Priority filter
      if (priorityFilter !== "all" && (t.priority || "normal") !== priorityFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const textMatch = (t.text || "").toLowerCase().includes(query);
        const nameMatch = (t.assigneeName || "").toLowerCase().includes(query);
        const creatorMatch = (t.createdByName || "").toLowerCase().includes(query);
        if (!textMatch && !nameMatch && !creatorMatch) return false;
      }

      return true;
    });
  }, [todos, statusFilter, targetFilter, priorityFilter, searchQuery]);

  return (
    <div className="space-y-8 max-w-6xl mx-auto text-sm">
      {/* ── Corkboard Section (Pinned Urgent Directives) ── */}
      {pinnedDirectives.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="font-extrabold text-slate-800 text-sm sm:text-base flex items-center gap-2">
              <span>📌 Leadership Corkboard</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                {pinnedDirectives.length} pinned
              </span>
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              High-priority announcements visible across campus
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {pinnedDirectives.map((t) => {
              const dueInfo = formatDueDate(t.dueDate);
              const badge = getAssigneeBadge(t.assignee, t.assigneeType, t.assigneeName);
              return (
                <div
                  key={t.id}
                  className="p-5 border-2 border-yellow-300 rounded-3xl shadow-sm space-y-3 relative bg-gradient-to-br from-[#fef9c3] to-[#fef08a]/60 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-black uppercase text-amber-900 bg-yellow-200 px-2 py-0.5 rounded-md border border-yellow-300">
                      {t.type || "DIRECTIVE"}
                    </span>
                    {dueInfo && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-md border ${dueInfo.badgeColor}`}>
                        {dueInfo.label}
                      </span>
                    )}
                  </div>

                  <p className="font-extrabold text-slate-900 text-sm leading-snug break-words">
                    {t.text}
                  </p>

                  <div className="pt-2 border-t border-yellow-200/80 flex items-center justify-between text-[11px]">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.color}`}>
                      {badge.label}
                    </span>

                    <div className="flex items-center gap-2">
                      {onToggleTodo && (
                        <button
                          onClick={() => handleToggle(t)}
                          className="text-slate-600 hover:text-emerald-700 font-bold text-xs"
                          title="Mark complete"
                        >
                          ✓ Done
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(t)}
                        className="text-red-600 hover:text-red-800 font-bold text-xs"
                        title="Delete directive"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main Layout: Creation Form & Directives Management ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Directive Creator (4 cols on lg) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
          <div>
            <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-[#1a3a8f]" />
              <span>Issue New Directive</span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
              Create an operational task or mandate for your team.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                Directive / Task Description *
              </label>
              <textarea
                rows={3}
                placeholder="e.g., Submit CEFR progress reports by Friday 5 PM..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-2xl text-xs focus:ring-2 focus:ring-[#1a3a8f]/20 focus:border-[#1a3a8f] outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                  Type
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full min-h-11 px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white font-semibold text-xs text-slate-700"
                >
                  <option value="directive">Directive</option>
                  <option value="task">Task</option>
                  <option value="deadline">Deadline</option>
                  <option value="appointment">Appointment</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                  Priority
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full min-h-11 px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white font-semibold text-xs text-slate-700"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High Priority</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                Assign Directive To *
              </label>
              <select
                value={newAssigneeValue}
                onChange={(e) => setNewAssigneeValue(e.target.value)}
                className="w-full min-h-11 px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white font-bold text-xs text-slate-800"
              >
                <optgroup label="Departments / Broadcast">
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </optgroup>
                {staffMembers.length > 0 && (
                  <optgroup label="Specific Staff Members">
                    {staffMembers.map((staff) => (
                      <option key={staff.id} value={`user:${staff.id}`}>
                        👤 {staff.displayName || staff.email} ({staff.role})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1">
                Due Date (Optional)
              </label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full min-h-11 px-3 py-1.5 border border-slate-200 rounded-xl bg-white font-medium text-xs text-slate-700"
              />
            </div>

            <label className="flex items-center gap-2 p-2.5 rounded-xl bg-yellow-50/70 border border-yellow-200 font-bold text-xs text-amber-900 cursor-pointer">
              <input
                type="checkbox"
                checked={newPinned}
                onChange={(e) => setNewPinned(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded"
              />
              <Pin className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              <span>Pin to Leadership Corkboard</span>
            </label>

            <button
              type="submit"
              disabled={submitting || !newText.trim()}
              className="w-full min-h-12 bg-[#1a3a8f] hover:bg-[#122b6e] text-white p-3 rounded-2xl font-black text-xs shadow-xs active:scale-[0.98] transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Publishing..." : "Issue Directive"}
            </button>
          </form>
        </div>

        {/* Right Column: Directives Management Workspace (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Controls: Search & Filters Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search directives, staff names, or issuers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9.5 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 outline-none focus:border-[#1a3a8f]"
                />
              </div>

              {/* Status Segmented Buttons */}
              <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold shrink-0">
                <button
                  onClick={() => setStatusFilter("active")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    statusFilter === "active"
                      ? "bg-white text-slate-800 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Active ({todos.filter((t) => !t.completed).length})
                </button>
                <button
                  onClick={() => setStatusFilter("completed")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    statusFilter === "completed"
                      ? "bg-white text-slate-800 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  Completed ({todos.filter((t) => t.completed).length})
                </button>
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    statusFilter === "all"
                      ? "bg-white text-slate-800 shadow-2xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  All ({todos.length})
                </button>
              </div>
            </div>

            {/* Sub-filters (Target & Priority) */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 text-xs">
              <span className="text-slate-400 font-bold text-[10px] uppercase">Filter by:</span>

              <select
                value={targetFilter}
                onChange={(e) => setTargetFilter(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold text-xs"
              >
                <option value="all">All Targets</option>
                <option value="all">Everyone</option>
                <option value="frontoffice">Front Office</option>
                <option value="marketing">Marketing</option>
                <option value="instructor">Instructors</option>
                <option value="officeboy">Office Boy</option>
                <option value="individual">Individual Staff Only</option>
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold text-xs"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent Only</option>
                <option value="high">High Priority</option>
                <option value="normal">Normal Priority</option>
              </select>

              {(searchQuery || targetFilter !== "all" || priorityFilter !== "all") && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setTargetFilter("all");
                    setPriorityFilter("all");
                  }}
                  className="text-xs text-[#1a3a8f] font-bold hover:underline ml-auto"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {/* Directives Cards List (Responsive & Scrollable) */}
          <div className="space-y-2.5">
            {filteredTodos.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center space-y-2">
                <p className="text-3xl">📋</p>
                <p className="text-sm font-extrabold text-slate-700">No directives found</p>
                <p className="text-xs text-slate-400">
                  {todos.length === 0
                    ? "No directives created yet. Use the form on the left to issue your first order."
                    : "No directives match your selected filters."}
                </p>
              </div>
            ) : (
              filteredTodos.map((t) => {
                const dueInfo = formatDueDate(t.dueDate);
                const badge = getAssigneeBadge(t.assignee, t.assigneeType, t.assigneeName);
                return (
                  <div
                    key={t.id}
                    className={`p-4 sm:p-5 rounded-2xl border transition flex items-start justify-between gap-3 ${
                      t.completed
                        ? "bg-slate-50/70 border-slate-200 opacity-80"
                        : "bg-white border-slate-200 shadow-2xs hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggle(t)}
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
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.color}`}>
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
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${dueInfo.badgeColor}`}>
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
                            t.completed ? "line-through text-slate-400 font-medium" : "text-slate-800"
                          }`}
                        >
                          {t.text}
                        </p>

                        <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-2 pt-0.5">
                          {t.createdByName && (
                            <span>Issued by: <strong>{t.createdByName}</strong></span>
                          )}
                          {t.createdAt && (
                            <span>
                              · {new Date(t.createdAt).toLocaleDateString("en-US", {
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
                      onClick={() => handleDelete(t)}
                      className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-rose-50 transition shrink-0 cursor-pointer"
                      title="Delete directive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
