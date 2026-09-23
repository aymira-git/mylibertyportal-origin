export const ROLE_OPTIONS = [
  {
    value: "all",
    label: "All Academy Staff",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  },
  {
    value: "frontoffice",
    label: "Front Office",
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  {
    value: "marketing",
    label: "Marketing",
    color: "bg-purple-100 text-purple-800 border-purple-200",
  },
  {
    value: "instructor",
    label: "Instructors",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  {
    value: "officeboy",
    label: "Office Boy / Facilities",
    color: "bg-amber-100 text-amber-800 border-amber-200",
  },
];

export function getAssigneeBadge(assignee, assigneeType, assigneeName) {
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
  return {
    label: assigneeName || assignee || "Everyone",
    color: "bg-slate-100 text-slate-700 border-slate-200",
  };
}

export function formatDueDate(dueDate) {
  if (!dueDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

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
