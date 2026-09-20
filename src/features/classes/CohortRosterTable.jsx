import { useState, useMemo, Fragment } from "react";
import {
  LevelBadge,
  LEVELS,
  LEVEL_KEYS,
  exportTableCSV,
} from "../shared";
import {
  setClassGroupLevel,
  syncStudentsCurrentLevel,
} from "./classesRepository";
import BatchCard from "./BatchCard";
import {
  Search,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

export default function CohortRosterTable({
  classes = [],
  users = [],
  unenrolledStudents = [],
  isAdmin = false,
  canEnroll = false,
  onOutreach,
  onEditBatch,
  onDeleteClass,
  onTransferStudent,
  onRemoveStudent,
  onAddStudent,
  toast,
}) {
  // Filter Bar state
  const [statusFilter, setStatusFilter] = useState("active_upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");

  // Sorting & expansion state
  const [classSortField, setClassSortField] = useState("className");
  const [classSortAsc, setClassSortAsc] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editingLevelKey, setEditingLevelKey] = useState(null);
  const [pendingLevel, setPendingLevel] = useState("warrior");

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => {
      let valA = a[classSortField] || "";
      let valB = b[classSortField] || "";

      if (classSortField === "instructorId") {
        valA = users.find((u) => u.id === a.instructorId)?.displayName || "";
        valB = users.find((u) => u.id === b.instructorId)?.displayName || "";
      }

      if (valA < valB) return classSortAsc ? -1 : 1;
      if (valA > valB) return classSortAsc ? 1 : -1;
      return 0;
    });
  }, [classes, classSortField, classSortAsc, users]);

  const getGroupKey = (cls) =>
    [cls.className, cls.schedule, cls.instructorId, cls.classLevel || "unset"].join("::");

  const classGroups = useMemo(() => {
    const groups = [];
    const groupIndex = {};

    sortedClasses.forEach((cls) => {
      const key = getGroupKey(cls);
      if (!groupIndex[key]) {
        groupIndex[key] = {
          key,
          className: cls.className,
          schedule: cls.schedule,
          instructorId: cls.instructorId,
          classLevel: cls.classLevel,
          items: [],
        };
        groups.push(groupIndex[key]);
      }
      groupIndex[key].items.push(cls);
    });

    return groups;
  }, [sortedClasses]);

  const filteredGroups = useMemo(() => {
    return classGroups.filter((group) => {
      const matchesSearch =
        !searchQuery ||
        group.className.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (group.schedule || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLevel = filterLevel === "all" || group.classLevel === filterLevel;

      // Status Filter matching across batches inside group
      const matchesStatus = group.items.some((cls) => {
        const s = (cls.status || "open").toLowerCase();
        const studentCount = (cls.studentIds || []).length;
        const capacity = Number(cls.maxCapacity) || 15;
        const quorum = Number(cls.minQuorum) || 4;

        if (statusFilter === "all") return true;
        if (statusFilter === "active_upcoming") {
          return s === "open" || s === "in_progress" || s === "upcoming";
        }
        if (statusFilter === "under_quorum") {
          return (
            (s === "open" || s === "in_progress" || s === "upcoming") &&
            studentCount < quorum
          );
        }
        if (statusFilter === "filling_fast_full") {
          return (
            (s === "open" || s === "in_progress" || s === "upcoming") &&
            (studentCount >= capacity || (capacity - studentCount <= 3 && capacity - studentCount > 0))
          );
        }
        if (statusFilter === "archived") {
          return s === "completed" || s === "cancelled";
        }
        return true;
      });

      return matchesSearch && matchesLevel && matchesStatus;
    });
  }, [classGroups, searchQuery, filterLevel, statusFilter]);

  const handleClassSort = (field) => {
    if (classSortField === field) {
      setClassSortAsc(!classSortAsc);
    } else {
      setClassSortField(field);
      setClassSortAsc(true);
    }
  };

  const handleSetGroupLevel = async (group, level) => {
    try {
      await setClassGroupLevel(group.items, level);
      const studentIds = [
        ...new Set(group.items.flatMap((cls) => cls.studentIds || [])),
      ];
      await syncStudentsCurrentLevel(studentIds, level);
      setEditingLevelKey(null);
      if (toast) toast("Cohort level updated!", "success");
    } catch (err) {
      if (toast) toast("Error setting level: " + err.message, "error");
    }
  };

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Quick Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 pb-2">
        {[
          { id: "active_upcoming", label: "Active & Upcoming" },
          { id: "under_quorum", label: "⚠️ Under Quorum (<4)" },
          { id: "filling_fast_full", label: "🔥 Filling Fast & Full" },
          { id: "archived", label: "Archived / Completed" },
          { id: "all", label: "All Cohorts" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              statusFilter === tab.id
                ? "bg-[#1a3a8f] text-white shadow-xs"
                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Action & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by class name or schedule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            />
          </div>

          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white text-slate-700 outline-none"
          >
            <option value="all">All Levels</option>
            {LEVEL_KEYS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {LEVELS[lvl]?.label?.toUpperCase() || lvl.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            const headers = [
              "Class Name",
              "Level",
              "Instructor",
              "Schedule",
              "Students",
            ];
            const rows = classGroups.map((group) => {
              const teacher = users.find((u) => u.id === group.instructorId);
              const totalStudents = group.items.reduce(
                (sum, cls) => sum + (cls.studentIds || []).length,
                0
              );
              return [
                group.className +
                  (group.items.length > 1 ? ` (${group.items.length} batches)` : ""),
                group.classLevel || "Unset",
                teacher ? teacher.displayName : "Unassigned",
                group.schedule,
                `${totalStudents} enrolled`,
              ];
            });
            exportTableCSV(
              `cohort-rosters-${new Date().toISOString().slice(0, 10)}`,
              headers,
              rows
            );
          }}
          className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-xl font-bold text-xs border border-slate-200 transition shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-500 font-extrabold uppercase text-[11px]">
              <th
                className="p-3.5 cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleClassSort("className")}
              >
                Class Cohort {classSortField === "className" && (classSortAsc ? "▲" : "▼")}
              </th>
              <th
                className="p-3.5 cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleClassSort("classLevel")}
              >
                Level {classSortField === "classLevel" && (classSortAsc ? "▲" : "▼")}
              </th>
              <th
                className="p-3.5 cursor-pointer hover:bg-slate-100 transition"
                onClick={() => handleClassSort("instructorId")}
              >
                Instructor {classSortField === "instructorId" && (classSortAsc ? "▲" : "▼")}
              </th>
              <th className="p-3.5">Schedule</th>
              <th className="p-3.5">Enrollment</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredGroups.map((group) => {
              const teacher = users.find((u) => u.id === group.instructorId);
              const totalStudents = group.items.reduce(
                (sum, cls) => sum + (cls.studentIds || []).length,
                0
              );
              const isExpanded = expandedGroups.has(group.key);

              return (
                <Fragment key={group.key}>
                  <tr
                    className={`hover:bg-indigo-50/30 transition cursor-pointer ${
                      isExpanded ? "bg-indigo-50/20" : ""
                    }`}
                    onClick={() => toggleGroup(group.key)}
                  >
                    <td className="p-3.5 font-extrabold text-slate-900">
                      <div>{group.className}</div>
                      {group.items.length > 1 && (
                        <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">
                          {group.items.length} batches
                        </span>
                      )}
                    </td>

                    <td className="p-3.5" onClick={(e) => e.stopPropagation()}>
                      {group.classLevel ? (
                        <LevelBadge level={group.classLevel} />
                      ) : editingLevelKey === group.key ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={pendingLevel}
                            onChange={(e) => setPendingLevel(e.target.value)}
                            className="text-[11px] border rounded p-1 bg-white font-bold"
                          >
                            {LEVEL_KEYS.map((lvl) => (
                              <option key={lvl} value={lvl}>
                                {LEVELS[lvl]?.label?.toUpperCase() || lvl.toUpperCase()}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleSetGroupLevel(group, pendingLevel)}
                            className="text-[10px] font-bold text-emerald-600 hover:underline"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingLevelKey(null)}
                            className="text-[10px] font-bold text-slate-400 hover:underline"
                          >
                            ✕
                          </button>
                        </div>
                      ) : isAdmin ? (
                        <button
                          onClick={() => {
                            setEditingLevelKey(group.key);
                            setPendingLevel("warrior");
                          }}
                          className="text-[11px] font-bold text-amber-600 hover:underline"
                        >
                          Set Level
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">
                          Unset
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 font-bold text-slate-700">
                      {teacher ? teacher.displayName : "Unassigned"}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-600">
                      {group.schedule}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-extrabold text-slate-800 text-[11px]">
                        {totalStudents} Enrolled
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-bold text-xs text-indigo-700">
                      <span className="inline-flex items-center gap-1">
                        {isExpanded ? (
                          <>
                            <span>Collapse</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </>
                        ) : (
                          <>
                            <span>Manage</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </span>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-4 bg-slate-50/70 border-b border-slate-200"
                      >
                        <div className="space-y-3">
                          {group.items.map((cls) => (
                            <BatchCard
                              key={cls.id}
                              cls={cls}
                              users={users}
                              unenrolledStudents={unenrolledStudents}
                              isAdmin={isAdmin}
                              canEnroll={canEnroll}
                              onOutreach={onOutreach}
                              onEditBatch={onEditBatch}
                              onDeleteClass={onDeleteClass}
                              onTransferStudent={onTransferStudent}
                              onRemoveStudent={onRemoveStudent}
                              onAddStudent={onAddStudent}
                              toast={toast}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {filteredGroups.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-slate-400 text-xs font-medium"
                >
                  No matching class cohorts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="space-y-3 md:hidden">
        {filteredGroups.map((group) => {
          const teacher = users.find((u) => u.id === group.instructorId);
          const totalStudents = group.items.reduce(
            (sum, cls) => sum + (cls.studentIds || []).length,
            0
          );
          const isExpanded = expandedGroups.has(group.key);

          return (
            <div
              key={group.key}
              className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-2xs"
            >
              <div
                onClick={() => toggleGroup(group.key)}
                className="cursor-pointer space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    {group.className}
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-[#1a3a8f] font-extrabold text-[10px]">
                    {totalStudents} students
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>{teacher?.displayName || "Unassigned"}</span>
                  <span>{group.schedule}</span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  {group.classLevel ? (
                    <LevelBadge level={group.classLevel} />
                  ) : (
                    <span className="text-xs font-bold text-amber-700">
                      Level Unset
                    </span>
                  )}
                  <span className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                    {isExpanded ? "Hide Details" : "Manage Batches"}
                    <ChevronRight
                      className={`w-3 h-3 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </span>
                </div>
              </div>

              {isExpanded && (
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  {group.items.map((cls) => (
                    <BatchCard
                      key={cls.id}
                      cls={cls}
                      users={users}
                      unenrolledStudents={unenrolledStudents}
                      isAdmin={isAdmin}
                      canEnroll={canEnroll}
                      onOutreach={onOutreach}
                      onEditBatch={onEditBatch}
                      onDeleteClass={onDeleteClass}
                      onTransferStudent={onTransferStudent}
                      onRemoveStudent={onRemoveStudent}
                      onAddStudent={onAddStudent}
                      toast={toast}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
