import { useState, useMemo } from "react";
import { useToast, useConfirm } from "../shared";
import {
  deleteClass,
  addStudentToClass,
  removeStudentFromClass,
  syncStudentsCurrentLevel,
} from "./classesRepository";
import AvailableBatches from "./AvailableBatches";
import BatchModal from "./BatchModal";
import TransferModal from "./TransferModal";
import BatchOutreachPanel from "./BatchOutreachPanel";
import CohortRosterTable from "./CohortRosterTable";
import { findScheduleConflicts } from "./scheduleConflict";
import {
  Plus,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";

export default function ClassManager({
  classes = [],
  users = [],
  instructors = [],
  unenrolledStudents = [],
  role = "admin",
  isAdmin = true,
}) {
  const toast = useToast();
  const confirm = useConfirm();

  // View Switcher: "batches" (Visual Cards) vs "roster" (Cohort Table)
  const [viewMode, setViewMode] = useState("batches");

  // Modals state
  const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
  const [editingBatchFromCard, setEditingBatchFromCard] = useState(null);
  const [outreachBatch, setOutreachBatch] = useState(null);
  const [transferringStudent, setTransferringStudent] = useState(null);

  const canEnroll = isAdmin || role === "frontoffice";

  // ── Global Conflict Detection ──────────────────────────────────────────
  const { teacherConflicts, roomConflicts } = useMemo(() => {
    return findScheduleConflicts(classes);
  }, [classes]);

  const totalConflicts = teacherConflicts.length + roomConflicts.length;

  // ── Unified KPI Summary Stats ──────────────────────────────────────────
  const kpiStats = useMemo(() => {
    let activeBatches = 0;
    let totalEnrolled = 0;
    let totalCapacity = 0;
    let underQuorumCount = 0;

    classes.forEach((cls) => {
      const s = (cls.status || "open").toLowerCase();
      const isActiveOrUpcoming = s === "open" || s === "in_progress" || s === "upcoming";
      const studentCount = (cls.studentIds || []).length;
      const capacity = Number(cls.maxCapacity) || 15;
      const quorum = Number(cls.minQuorum) || 4;

      if (isActiveOrUpcoming) {
        activeBatches += 1;
        totalCapacity += capacity;
        totalEnrolled += studentCount;

        if (studentCount < quorum) {
          underQuorumCount += 1;
        }
      }
    });

    const openSeats = Math.max(0, totalCapacity - totalEnrolled);
    const overallOccupancy =
      totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

    return {
      activeBatches,
      totalEnrolled,
      openSeats,
      overallOccupancy,
      underQuorumCount,
    };
  }, [classes]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleDeleteClass = async (classId) => {
    if (
      await confirm(
        "Are you sure you want to delete this scheduled class batch? This action cannot be undone."
      )
    ) {
      try {
        await deleteClass(classId);
        toast("Class batch deleted.", "info");
      } catch (err) {
        toast(err.message, "error");
      }
    }
  };

  const handleAddStudentToClass = async (classId, { studentId, dateJoined }) => {
    if (!studentId) return false;

    const cls = classes.find((c) => c.id === classId);
    const targetLevel = cls?.classLevel || "warrior";
    const student = users.find((u) => u.id === studentId);

    if (student?.currentLevel && student.currentLevel !== targetLevel) {
      if (
        !(await confirm(
          `${student.displayName} is recorded at level "${student.currentLevel}", but this class is "${targetLevel}".\n\nEnroll anyway?`
        ))
      ) {
        return false;
      }
    }

    try {
      await addStudentToClass(classId, {
        studentId,
        dateJoined: dateJoined || new Date().toISOString().slice(0, 10),
        level: targetLevel,
      });
      await syncStudentsCurrentLevel([studentId], targetLevel);
      toast("Student enrolled successfully!", "success");
      return true;
    } catch (err) {
      toast("Error enrolling student: " + err.message, "error");
      return false;
    }
  };

  const handleRemoveStudentFromClass = async (cls, studentId) => {
    const student = users.find((u) => u.id === studentId);
    if (
      !(await confirm(
        `Remove ${student?.displayName || "this student"} from ${cls.className}?`
      ))
    )
      return;
    try {
      await removeStudentFromClass(cls, studentId);
      toast("Student removed from class.", "info");
    } catch (err) {
      toast("Error removing student: " + err.message, "error");
    }
  };

  return (
    <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 w-full space-y-6 shadow-sm">
      {/* ── Cockpit Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-extrabold text-slate-900 text-xl tracking-tight">
            Class Cohort Management
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Timetable schedules, classroom allocations &amp; student rosters
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
            <button
              onClick={() => setViewMode("batches")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === "batches"
                  ? "bg-white text-[#1a3a8f] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Visual Batches</span>
            </button>
            <button
              onClick={() => setViewMode("roster")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === "roster"
                  ? "bg-white text-[#1a3a8f] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Cohort Rosters</span>
            </button>
          </div>

          {/* New Batch Trigger */}
          {isAdmin && (
            <button
              onClick={() => setIsNewBatchModalOpen(true)}
              className="px-4 py-2 bg-[#1a3a8f] hover:bg-[#122b6e] text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule New Batch</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Global Conflict Banner (if any) ── */}
      {totalConflicts > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <h4 className="text-xs sm:text-sm font-extrabold text-rose-900">
                {totalConflicts} Timetable Collision{totalConflicts > 1 ? "s" : ""} Detected
              </h4>
            </div>
            <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full">
              Attention Required
            </span>
          </div>

          <div className="space-y-1 pt-1">
            {teacherConflicts.map((c, i) => (
              <p key={`tc-${i}`} className="text-xs text-rose-800 font-medium pl-6">
                🧑‍🏫 {c.detail}
              </p>
            ))}
            {roomConflicts.map((c, i) => (
              <p key={`rc-${i}`} className="text-xs text-rose-800 font-medium pl-6">
                🏫 {c.detail}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Unified Header KPI Summary Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100/80">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-900">
            Active Cohorts
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-indigo-950 mt-0.5">
            {kpiStats.activeBatches}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Total Enrolled
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
            {kpiStats.totalEnrolled}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            Occupancy Rate
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
            {kpiStats.overallOccupancy}%
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100/80">
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-900">
            Open Seats
          </p>
          <p className="text-lg sm:text-xl font-extrabold text-emerald-950 mt-0.5">
            {kpiStats.openSeats}
          </p>
        </div>

        <div
          className={`p-3.5 rounded-2xl border col-span-2 sm:col-span-1 ${
            kpiStats.underQuorumCount > 0
              ? "bg-amber-50/70 border-amber-200/80 text-amber-950"
              : "bg-slate-50 border-slate-200/80 text-slate-900"
          }`}
        >
          <p
            className={`text-[10px] font-extrabold uppercase tracking-wider ${
              kpiStats.underQuorumCount > 0 ? "text-amber-800" : "text-slate-500"
            }`}
          >
            Under Quorum (&lt;4)
          </p>
          <p className="text-lg sm:text-xl font-extrabold mt-0.5 flex items-center gap-1">
            <span>{kpiStats.underQuorumCount}</span>
            {kpiStats.underQuorumCount > 0 && (
              <span className="text-xs text-amber-600 font-bold">⚠️</span>
            )}
          </p>
        </div>
      </div>

      {/* ── View 1: Available Batches (Visual Cards) ── */}
      {viewMode === "batches" && (
        <AvailableBatches
          classes={classes}
          instructors={instructors}
          users={users}
          canEdit={isAdmin}
          role={role}
        />
      )}

      {/* ── View 2: Detailed Cohort Rosters Table ── */}
      {viewMode === "roster" && (
        <CohortRosterTable
          classes={classes}
          users={users}
          unenrolledStudents={unenrolledStudents}
          isAdmin={isAdmin}
          canEnroll={canEnroll}
          onOutreach={(cls) => setOutreachBatch(cls)}
          onEditBatch={(cls) => setEditingBatchFromCard(cls)}
          onDeleteClass={handleDeleteClass}
          onTransferStudent={(data) => setTransferringStudent(data)}
          onRemoveStudent={handleRemoveStudentFromClass}
          onAddStudent={handleAddStudentToClass}
          toast={toast}
        />
      )}

      {/* ── Schedule New Batch Modal (Admin only) ── */}
      {isAdmin && (
        <BatchModal
          isOpen={isNewBatchModalOpen}
          onClose={() => setIsNewBatchModalOpen(false)}
          batch={null}
          instructors={instructors}
          existingClasses={classes}
        />
      )}

      {/* ── Batch Edit Modal (Admin only) ── */}
      {isAdmin && (
        <BatchModal
          isOpen={Boolean(editingBatchFromCard)}
          onClose={() => setEditingBatchFromCard(null)}
          batch={editingBatchFromCard}
          instructors={instructors}
          existingClasses={classes}
        />
      )}

      {/* ── Batch Outreach Panel ── */}
      {outreachBatch && (
        <BatchOutreachPanel
          batch={outreachBatch}
          users={users}
          onClose={() => setOutreachBatch(null)}
        />
      )}

      {/* ── Dedicated One-Click Batch Transfer Modal ── */}
      {transferringStudent && (
        <TransferModal
          isOpen={Boolean(transferringStudent)}
          onClose={() => setTransferringStudent(null)}
          student={transferringStudent.student}
          sourceClass={transferringStudent.sourceClass}
          classes={classes}
          users={users}
        />
      )}
    </div>
  );
}
