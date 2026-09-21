import { useState, useEffect, useMemo, useCallback } from "react";
import { PaymentModal } from "../finance";
import { TransferModal } from "../classes";
import {
  exportTableCSV,
  Pagination,
  usePagination,
  getPaymentHealthStatus,
  getTier,
  getNextLevel,
  useToast,
  useConfirm,
} from "../shared";
import {
  normalizeWhatsAppNumber,
  buildWhatsAppRenewalReminderMessage,
} from "../finance/receiptMessages";
import { fetchPendingPromotions, promoteStudentLevel } from "./progressReportsRepository";
import { updateStudentStatus, checkStudentHasHistory } from "../dashboard/usersRepository";
import { removeStudentFromClass } from "../classes/classesRepository";
import { isActiveStudent, STUDENT_STATUS_MAP } from "./studentRecord";
import { getStudentPlanLabel } from "./studentRosterBadges";
import StudentRosterFilters from "./StudentRosterFilters";
import StudentRosterMobileList from "./StudentRosterMobileList";
import StudentRosterTable from "./StudentRosterTable";
import { Users, FileSpreadsheet, UserPlus } from "lucide-react";

export default function StudentRoster({
  students = [],
  classes = [],
  users = [],
  getStudentClasses = null,
  setSelectedStudent = null,
  handleEdit = null,
  handleDelete = null,
  handleAddStudent = null,
  readOnly = false,
  canEditStatus = true,
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const [paymentStudent, setPaymentStudent] = useState(null);
  const [studentSortField, setStudentSortField] = useState("displayName");
  const [studentSortAsc, setStudentSortAsc] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingPromotions, setPendingPromotions] = useState([]);
  const [selectedTransferStudent, setSelectedTransferStudent] = useState(null); // { student, sourceClass }
  const [statusFilter, setStatusFilter] = useState("active"); // "active" | "on_leave" | "inactive_graduated" | "all"
  const [actionFilter, setActionFilter] = useState("all"); // "all" | "unassigned" | "due_or_expired" | "beginner" | "intermediate" | "fluent"
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  const handleStatusChange = async (student, newStatus) => {
    const currentStatus = student.status || "active";
    if (currentStatus === newStatus) return;

    if (newStatus === "graduated" || newStatus === "inactive") {
      const targetLabel = STUDENT_STATUS_MAP[newStatus]?.label || newStatus;
      const ok = await confirm(
        `Are you sure you want to mark ${student.displayName || "this student"} as ${targetLabel}?`
      );
      if (!ok) return;

      const enrolledClasses = classes.filter((c) => (c.studentIds || []).includes(student.id));
      if (enrolledClasses.length > 0) {
        const classNames = enrolledClasses.map((c) => c.className).join(", ");
        const shouldRemove = await confirm(
          `${student.displayName || "This student"} is currently enrolled in ${enrolledClasses.length} cohort(s): ${classNames}.\n\n` +
            `Would you like to remove them from these cohorts now to immediately free up seats?`
        );
        if (shouldRemove) {
          try {
            await Promise.all(
              enrolledClasses.map((cls) => removeStudentFromClass(cls, student.id))
            );
            toast(
              `Removed ${student.displayName || "Student"} from ${enrolledClasses.length} cohort(s).`,
              "info"
            );
          } catch (err) {
            toast(`Could not remove from cohorts: ${err.message}`, "error");
          }
        }
      }
    }

    setUpdatingStatusId(student.id);
    try {
      await updateStudentStatus(student.id, newStatus);
      const label = STUDENT_STATUS_MAP[newStatus]?.label || newStatus;
      toast(`Updated ${student.displayName || "Student"}'s status to ${label}.`);
    } catch (err) {
      toast("Error updating student status: " + err.message, "error");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDeleteStudent = async (student) => {
    const enrolledClasses = classes.filter((c) => (c.studentIds || []).includes(student.id));
    if (enrolledClasses.length > 0) {
      const classNames = enrolledClasses.map((c) => c.className).join(", ");
      toast(
        `Cannot delete ${student.displayName}: Student is actively enrolled in ${enrolledClasses.length} cohort(s) (${classNames}). ` +
          `Please remove them from cohorts or mark their status as "Inactive" or "Graduated" instead.`,
        "error"
      );
      return;
    }

    try {
      const { hasPayments, hasAttendance, hasReports, error } = await checkStudentHasHistory(
        student.id
      );
      if (error) {
        toast(
          `Could not verify student history (${error}). Deletion cancelled for data safety.`,
          "error"
        );
        return;
      }
      if (hasPayments || hasAttendance || hasReports) {
        const reasons = [];
        if (hasPayments) reasons.push("tuition payments");
        if (hasAttendance) reasons.push("session attendance");
        if (hasReports) reasons.push("academic evaluations");
        toast(
          `Cannot delete: ${student.displayName} has recorded history (${reasons.join(", ")}). ` +
            `Deleting this profile would corrupt historical records. Please mark their status as "Inactive" or "Graduated" instead.`,
          "error"
        );
        return;
      }
    } catch (err) {
      toast(
        `Failed to verify student history: ${err.message}. Deletion cancelled for safety.`,
        "error"
      );
      return;
    }

    const ok = await confirm(
      `Delete ${student.displayName}'s student profile? This will permanently remove the record.`
    );
    if (!ok) return;

    await handleDelete(student.id, { skipConfirm: true });
  };

  const loadPendingPromotions = useCallback(() => {
    fetchPendingPromotions()
      .then((reports) => {
        setPendingPromotions(reports);
      })
      .catch((err) => {
        console.error("Error loading pending promotions:", err);
      });
  }, []);

  useEffect(() => {
    let active = true;
    fetchPendingPromotions()
      .then((reports) => {
        if (active) {
          setPendingPromotions(reports);
        }
      })
      .catch((err) => {
        console.error("Error loading pending promotions:", err);
      });
    return () => {
      active = false;
    };
  }, []);

  const pendingPromotionsMap = useMemo(() => {
    const map = {};
    pendingPromotions.forEach((rep) => {
      if (rep.studentId) map[rep.studentId] = rep;
    });
    return map;
  }, [pendingPromotions]);

  const handlePromote = async (student, report) => {
    const nextLevel = getNextLevel(student.currentLevel || "warrior");
    if (!nextLevel) {
      toast(`${student.displayName || "Student"} is already at the highest level!`, "info");
      return;
    }

    const confirmed = await confirm(
      `Promote ${student.displayName || "Student"} from ${(student.currentLevel || "warrior").toUpperCase()} to ${nextLevel.toUpperCase()}?`
    );
    if (!confirmed) return;

    try {
      await promoteStudentLevel(student.id, nextLevel, report?.id);
      toast(
        `Successfully promoted ${student.displayName} to ${nextLevel.toUpperCase()}!`,
        "success"
      );
      loadPendingPromotions();
    } catch (err) {
      toast(`Failed to promote student: ${err.message}`, "error");
    }
  };

  const statusCounts = useMemo(() => {
    let active = 0;
    let onLeave = 0;
    let inactiveGrad = 0;
    students.forEach((s) => {
      const st = s.status || "active";
      if (st === "active") active++;
      else if (st === "on_leave") onLeave++;
      else if (st === "inactive" || st === "graduated") inactiveGrad++;
    });
    return { active, onLeave, inactiveGrad, total: students.length };
  }, [students]);

  const actionCounts = useMemo(() => {
    let unassigned = 0;
    let dueOrExpired = 0;
    students.filter(isActiveStudent).forEach((s) => {
      const cls = getStudentClasses(s.id);
      if (!cls || cls.length === 0) unassigned++;
      const health =
        s.paymentStatus === "pending" ? { status: "pending" } : getPaymentHealthStatus(s.paidUntil);
      if (
        health.status === "due_soon" ||
        health.status === "expired" ||
        health.status === "invalid_date"
      ) {
        dueOrExpired++;
      }
    });
    return { unassigned, dueOrExpired };
  }, [students, getStudentClasses]);

  const handleSendRenewalReminder = (e, s, health) => {
    e.stopPropagation();
    const rawPhone = s.parentPhone || s.phone;
    const formatted = normalizeWhatsAppNumber(rawPhone);
    if (!formatted) {
      toast(
        `No valid phone number for ${s.displayName}. Please update contact details first.`,
        "error"
      );
      return;
    }

    const planLabel = getStudentPlanLabel(s);
    const message = buildWhatsAppRenewalReminderMessage({
      student: s,
      paidUntil: s.paidUntil,
      planLabel,
      remainingDays: health.remainingDays,
    });

    const waUrl = `https://wa.me/${formatted}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");
  };

  const handleStudentSort = (field) => {
    if (studentSortField === field) {
      setStudentSortAsc(!studentSortAsc);
    } else {
      setStudentSortField(field);
      setStudentSortAsc(true);
    }
  };

  const sortedStudents = useMemo(() => {
    return [...students]
      .map((s) => {
        const studentClasses = getStudentClasses(s.id);
        const enrollmentJoinedDate = studentClasses.find((c) => c.dateJoined)?.dateJoined || "";
        const effectiveStatus = s.status || "active";
        const health =
          s.paymentStatus === "pending"
            ? { status: "pending", label: "Pending", tone: "amber", remainingDays: null }
            : getPaymentHealthStatus(s.paidUntil);
        const tier = getTier(s.currentLevel || "warrior");
        return {
          ...s,
          studentClasses,
          effectiveJoinedDate: s.joinedDate || enrollmentJoinedDate || "",
          effectiveStatus,
          paymentHealth: health,
          tier,
        };
      })
      .filter((s) => {
        // 1. Status Filter
        if (statusFilter === "active" && s.effectiveStatus !== "active") return false;
        if (statusFilter === "on_leave" && s.effectiveStatus !== "on_leave") return false;
        if (
          statusFilter === "inactive_graduated" &&
          s.effectiveStatus !== "inactive" &&
          s.effectiveStatus !== "graduated"
        )
          return false;

        // 2. Action Filter
        if (actionFilter === "unassigned" && s.studentClasses.length > 0) return false;
        if (
          actionFilter === "due_or_expired" &&
          s.paymentHealth.status !== "due_soon" &&
          s.paymentHealth.status !== "expired" &&
          s.paymentHealth.status !== "invalid_date"
        )
          return false;
        if (actionFilter === "beginner" && s.tier !== "beginner") return false;
        if (actionFilter === "intermediate" && s.tier !== "intermediate") return false;
        if (actionFilter === "fluent" && s.tier !== "fluent") return false;

        // 3. Search Query
        const q = searchQuery.trim().toLowerCase();
        if (!q) return true;
        return (
          (s.displayName || "").toLowerCase().includes(q) ||
          (s.phone || "").includes(q) ||
          (s.id || "").toLowerCase().includes(q) ||
          (s.parentName || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const field = studentSortField === "joinedDate" ? "effectiveJoinedDate" : studentSortField;
        let valA = a[field] || "";
        let valB = b[field] || "";

        if (valA < valB) return studentSortAsc ? -1 : 1;
        if (valA > valB) return studentSortAsc ? 1 : -1;
        return 0;
      });
  }, [
    students,
    getStudentClasses,
    statusFilter,
    actionFilter,
    searchQuery,
    studentSortField,
    studentSortAsc,
  ]);

  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(
    sortedStudents,
    25
  );

  const handlePrint = () => {
    const headers = [
      "Student Name",
      "Parent Contact",
      "Status",
      "Education",
      "DOB",
      "Joined",
      "Payment Status",
      "Plan",
      "Paid Until",
      "Class",
      "Instructor",
    ];
    const rows = sortedStudents.map((s) => {
      const planLabel = getStudentPlanLabel(s) || "—";
      const isPending = s.paymentStatus === "pending";
      const health = isPending ? { label: "Pending" } : getPaymentHealthStatus(s.paidUntil);
      return [
        s.displayName || "",
        `${s.parentName || "N/A"} (${s.parentPhone || "N/A"})`,
        s.effectiveStatus || "active",
        s.educationLevel || s.schoolOrJob || "N/A",
        s.dob || "N/A",
        s.effectiveJoinedDate || "N/A",
        health.label,
        planLabel,
        s.paidUntil || s.lastPaymentPeriod || "—",
        s.studentClasses.length
          ? s.studentClasses.map((c) => c.className).join(", ")
          : "Unassigned",
        s.studentClasses.length
          ? s.studentClasses.map((c) => c.instructorName || "Unassigned").join(", ")
          : "—",
      ];
    });
    exportTableCSV(`student-roster-${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200/90 w-full space-y-5">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-[#1a3a8f] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">Student Roster</h3>
            <p className="text-xs text-slate-500 font-medium">
              Manage student dossiers, enrollments, and ID badges
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {handleAddStudent && !readOnly && (
            <button
              onClick={handleAddStudent}
              className="inline-flex items-center gap-1.5 bg-[#1a3a8f] hover:bg-[#122b6e] text-white px-3.5 py-2 rounded-xl font-bold text-xs transition shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Student</span>
            </button>
          )}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 px-3.5 py-2 rounded-xl font-bold text-xs transition shadow-2xs cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>
          <span className="bg-[#1a3a8f]/10 text-[#1a3a8f] px-3 py-1.5 rounded-full font-bold text-xs uppercase tracking-wider">
            {statusCounts.active} Active Students
          </span>
        </div>
      </div>

      {/* Operational Quick Filters Bar */}
      <StudentRosterFilters
        searchQuery={searchQuery}
        onSearchChange={(val) => {
          setSearchQuery(val);
          setPage(1);
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(val) => {
          setStatusFilter(val);
          setPage(1);
        }}
        actionFilter={actionFilter}
        onActionFilterChange={(val) => {
          setActionFilter(val);
          setPage(1);
        }}
        statusCounts={statusCounts}
        actionCounts={actionCounts}
      />

      {/* Mobile Card List View */}
      <StudentRosterMobileList
        pageItems={pageItems}
        readOnly={readOnly}
        canEditStatus={canEditStatus}
        updatingStatusId={updatingStatusId}
        pendingPromotionsMap={pendingPromotionsMap}
        onStatusChange={handleStatusChange}
        onPaymentClick={(s) => setPaymentStudent(s)}
        onSendRenewalReminder={handleSendRenewalReminder}
        onPromote={handlePromote}
        onAssignBatch={(s) => setSelectedTransferStudent({ student: s, sourceClass: null })}
        onTransferBatch={(s, c) => setSelectedTransferStudent({ student: s, sourceClass: c })}
        onBadgeClick={setSelectedStudent}
        onEdit={handleEdit}
        onDeleteStudent={handleDeleteStudent}
      />

      {/* Desktop Full Table View */}
      <StudentRosterTable
        pageItems={pageItems}
        studentSortField={studentSortField}
        studentSortAsc={studentSortAsc}
        onSort={handleStudentSort}
        readOnly={readOnly}
        canEditStatus={canEditStatus}
        updatingStatusId={updatingStatusId}
        pendingPromotionsMap={pendingPromotionsMap}
        onStatusChange={handleStatusChange}
        onPaymentClick={(s) => setPaymentStudent(s)}
        onSendRenewalReminder={handleSendRenewalReminder}
        onPromote={handlePromote}
        onAssignBatch={(s) => setSelectedTransferStudent({ student: s, sourceClass: null })}
        onTransferBatch={(s, c) => setSelectedTransferStudent({ student: s, sourceClass: c })}
        onBadgeClick={setSelectedStudent}
        onEdit={handleEdit}
        onDeleteStudent={handleDeleteStudent}
      />

      {/* Pagination Footer */}
      <Pagination
        page={page}
        totalPages={totalPages}
        setPage={setPage}
        from={from}
        to={to}
        total={total}
        label="students"
      />

      {/* Payment Modal */}
      {!readOnly && paymentStudent && (
        <PaymentModal
          student={students.find((s) => s.id === paymentStudent.id) || paymentStudent}
          onClose={() => setPaymentStudent(null)}
        />
      )}

      {/* Batch Placement & Lateral Transfer Modal */}
      {!readOnly && selectedTransferStudent && (
        <TransferModal
          isOpen={true}
          student={selectedTransferStudent.student}
          sourceClass={selectedTransferStudent.sourceClass}
          classes={classes}
          users={users}
          onClose={() => setSelectedTransferStudent(null)}
        />
      )}
    </div>
  );
}
