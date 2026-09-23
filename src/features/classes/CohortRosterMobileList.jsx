import BatchCard from "./BatchCard";
import { ChevronRight } from "lucide-react";
import { LevelBadge } from "../shared";
import { getBatchType } from "../../constants/batchTypes";

export function CohortRosterMobileList({
  filteredGroups,
  users,
  expandedGroups,
  toggleGroup,
  unenrolledStudents,
  isAdmin,
  canEnroll,
  onOutreach,
  onEditBatch,
  onDeleteClass,
  onTransferStudent,
  onRemoveStudent,
  onAddStudent,
  toast,
}) {
  return (
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
            <div onClick={() => toggleGroup(group.key)} className="cursor-pointer space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="font-extrabold text-slate-900 text-sm">{group.className}</h4>
                  <span
                    className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md border ${
                      getBatchType(group.batchType).badgeBg
                    }`}
                  >
                    {getBatchType(group.batchType).label}
                  </span>
                </div>
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
                  <span className="text-xs font-bold text-amber-700">Level Unset</span>
                )}
                <span className="text-xs font-bold text-indigo-700 flex items-center gap-1">
                  {isExpanded ? "Hide Details" : "Manage Batches"}
                  <ChevronRight
                    className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
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
  );
}
