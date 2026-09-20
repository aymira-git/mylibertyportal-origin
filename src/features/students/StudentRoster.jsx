import { useState, useEffect, useMemo } from "react";
import { PaymentModal } from "../finance";
import { TransferModal } from "../classes";
import {
  exportTableCSV,
  Pagination,
  usePagination,
  getPaymentHealthStatus,
  PAYMENT_PLANS,
  getTier,
  getNextLevel,
  useToast,
  useConfirm,
} from "../shared";
import {
  normalizeWhatsAppNumber,
  buildWhatsAppRenewalReminderMessage,
} from "../finance/receiptMessages";
import {
  fetchPendingPromotions,
  promoteStudentLevel,
} from "./progressReportsRepository";
import { updateStudentStatus, checkStudentHasHistory } from "../dashboard/usersRepository";
import { removeStudentFromClass } from "../classes/classesRepository";
import { isActiveStudent, STUDENT_STATUS_MAP, STUDENT_STATUS_OPTIONS } from "./studentRecord";
import {
  Users,
  Search,
  FileSpreadsheet,
  QrCode,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  UserPlus,
  MessageCircle,
  ArrowRightLeft,
  Sparkles,
} from "lucide-react";

function getInitials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function getStudentPlanLabel(student) {
  if (!student.paymentPlan) return null;
  if (student.paymentPlan === "custom") return "Custom";
  return PAYMENT_PLANS[student.paymentPlan]?.label || student.paymentPlan;
}

function getHealthBadgeClasses(tone) {
  switch (tone) {
    case "emerald":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:ring-emerald-400";
    case "amber":
      return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:ring-amber-400";
    case "rose":
      return "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:ring-rose-400";
    case "slate":
    default:
      return "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:ring-slate-400";
  }
}

function getHealthBadgeReadOnlyClasses(tone) {
  switch (tone) {
    case "emerald":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "amber":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "rose":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "slate":
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function getStatusBadge(status) {
  const eff = status || "active";
  return STUDENT_STATUS_MAP[eff] || STUDENT_STATUS_MAP.active;
}

function openWhatsAppParentChat(parentPhone, parentName, studentName) {
  const formatted = normalizeWhatsAppNumber(parentPhone);
  if (!formatted) return;
  const greeting = parentName ? `Halo Bapak/Ibu ${parentName}, ` : "Halo, ";
  const text = `${greeting}kami dari Liberty English Course ingin menginformasikan mengenai ananda ${studentName || "siswa"}...`;
  const url = `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}

export default function StudentRoster({
  students = [],
  classes = [],
  users = [],
  getStudentClasses,
  setSelectedStudent,
  handleEdit,
  handleDelete,
  handleAddStudent,
  readOnly = false
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
            await Promise.all(enrolledClasses.map((cls) => removeStudentFromClass(cls, student.id)));
            toast(`Removed ${student.displayName || "Student"} from ${enrolledClasses.length} cohort(s).`, "info");
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
      const { hasPayments, hasAttendance, hasReports, error } = await checkStudentHasHistory(student.id);
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
      toast(`Failed to verify student history: ${err.message}. Deletion cancelled for safety.`, "error");
      return;
    }

    const ok = await confirm(
      `Delete ${student.displayName}'s student profile? This will permanently remove the record.`
    );
    if (!ok) return;

    await handleDelete(student.id, { skipConfirm: true });
  };

  const loadPendingPromotions = () => {
    fetchPendingPromotions()
      .then((reports) => {
        setPendingPromotions(reports);
      })
      .catch((err) => {
        console.error("Error loading pending promotions:", err);
      });
  };

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
      toast(`Successfully promoted ${student.displayName} to ${nextLevel.toUpperCase()}!`, "success");
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
      const health = s.paymentStatus === "pending"
        ? { status: "pending" }
        : getPaymentHealthStatus(s.paidUntil);
      if (health.status === "due_soon" || health.status === "expired") {
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
      toast(`No valid phone number for ${s.displayName}. Please update contact details first.`, "error");
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
        const health = s.paymentStatus === "pending"
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
        if (statusFilter === "inactive_graduated" && s.effectiveStatus !== "inactive" && s.effectiveStatus !== "graduated") return false;

        // 2. Action Filter
        if (actionFilter === "unassigned" && s.studentClasses.length > 0) return false;
        if (actionFilter === "due_or_expired" && s.paymentHealth.status !== "due_soon" && s.paymentHealth.status !== "expired") return false;
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
  }, [students, getStudentClasses, statusFilter, actionFilter, searchQuery, studentSortField, studentSortAsc]);

  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(sortedStudents, 25);

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
      "Instructor"
    ];
    const rows = sortedStudents.map((s) => {
      const planLabel = getStudentPlanLabel(s) || "—";
      const isPending = s.paymentStatus === "pending";
      const health = isPending
        ? { label: "Pending" }
        : getPaymentHealthStatus(s.paidUntil);
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
        s.studentClasses.length ? s.studentClasses.map((c) => c.className).join(", ") : "Unassigned",
        s.studentClasses.length ? s.studentClasses.map((c) => c.instructorName || "Unassigned").join(", ") : "—"
      ];
    });
    exportTableCSV(`student-roster-${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-200/90 max-w-6xl mx-auto space-y-5">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-[#1a3a8f] flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">Student Roster</h3>
            <p className="text-xs text-slate-500 font-medium">Manage student dossiers, enrollments, and ID badges</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {handleAddStudent && !readOnly && (
            <button
              onClick={handleAddStudent}
              className="inline-flex items-center gap-1.5 bg-[#1a3a8f] hover:bg-[#122b6e] text-white px-3.5 py-2 rounded-xl font-bold text-xs transition shadow-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add Student</span>
            </button>
          )}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 px-3.5 py-2 rounded-xl font-bold text-xs transition shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export CSV</span>
          </button>
          <span className="bg-[#1a3a8f]/10 text-[#1a3a8f] px-3 py-1.5 rounded-full font-bold text-xs uppercase tracking-wider">
            {statusCounts.active} Active Students
          </span>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search students by name, phone, or ID code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-9 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium bg-slate-50/50 focus:bg-white focus:border-[#1a3a8f] focus:ring-1 focus:ring-[#1a3a8f] outline-none transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Operational Quick Filters Bar */}
      <div className="space-y-2.5 pt-1">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs border-b border-slate-100 no-scrollbar">
          {[
            { id: "active", label: "Active", count: statusCounts.active },
            { id: "on_leave", label: "On Leave", count: statusCounts.onLeave },
            { id: "inactive_graduated", label: "Inactive / Graduated", count: statusCounts.inactiveGrad },
            { id: "all", label: "All Records", count: statusCounts.total },
          ].map((tab) => {
            const isSelected = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-[#1a3a8f] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action & Tier Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Filter:
          </span>
          {[
            { id: "all", label: "All" },
            {
              id: "unassigned",
              label: `⚠️ Unassigned (${actionCounts.unassigned})`,
              tone: actionCounts.unassigned > 0 ? "text-amber-700 bg-amber-50 border-amber-200" : "",
            },
            {
              id: "due_or_expired",
              label: `💳 Due Soon / Expired (${actionCounts.dueOrExpired})`,
              tone: actionCounts.dueOrExpired > 0 ? "text-rose-700 bg-rose-50 border-rose-200" : "",
            },
            { id: "beginner", label: "⭐ Beginner" },
            { id: "intermediate", label: "⭐⭐ Intermediate" },
            { id: "fluent", label: "⭐⭐⭐ Fluent" },
          ].map((pill) => {
            const isSelected = actionFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => {
                  setActionFilter(pill.id);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition whitespace-nowrap border ${
                  isSelected
                    ? "bg-[#1a3a8f] text-white border-[#1a3a8f] shadow-2xs"
                    : pill.tone || "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Card List View */}
      <div className="space-y-3.5 md:hidden">
        {pageItems.map((s) => {
          const studentClasses = s.studentClasses;
          const statusBadge = getStatusBadge(s.effectiveStatus);
          const isPending = s.paymentStatus === "pending";
          const health = isPending
            ? { status: "pending", label: "Pending", tone: "amber", remainingDays: null }
            : getPaymentHealthStatus(s.paidUntil);
          const planLabel = getStudentPlanLabel(s);
          const canRemind = !readOnly && isActiveStudent(s) && (health.status === "due_soon" || health.status === "expired") && (s.parentPhone || s.phone);
          const pendingPromotion = pendingPromotionsMap[s.id];
          const nextLevel = pendingPromotion ? getNextLevel(s.currentLevel || "warrior") : null;

          return (
            <article
              key={s.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3 hover:border-indigo-200 transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {s.photoURL ? (
                    <img
                      src={s.photoURL}
                      alt={s.displayName}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1a3a8f] to-indigo-700 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                      {getInitials(s.displayName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="truncate text-sm font-extrabold text-slate-900">
                        {s.displayName || "Unnamed student"}
                      </h4>
                      {!readOnly ? (
                        <select
                          value={s.effectiveStatus}
                          disabled={updatingStatusId === s.id}
                          onChange={(e) => handleStatusChange(s, e.target.value)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border outline-none cursor-pointer ${statusBadge.tone}`}
                          title="Change student lifecycle status"
                        >
                          {STUDENT_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.tone}`}>
                          {statusBadge.label}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[11px] font-mono text-slate-400">ID: {s.id.slice(0, 10)}</p>
                      {s.currentLevel && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 uppercase">
                          {s.currentLevel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {readOnly ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${getHealthBadgeReadOnlyClasses(health.tone)}`}
                      >
                        {health.label}
                      </span>
                    ) : (
                      <button
                        onClick={() => setPaymentStudent(s)}
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border transition shadow-2xs ${getHealthBadgeClasses(health.tone)}`}
                      >
                        {health.label}
                      </button>
                    )}

                    {planLabel && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-[#1a3a8f] border border-indigo-100">
                        {planLabel}
                      </span>
                    )}

                    {canRemind && (
                      <button
                        type="button"
                        onClick={(e) => handleSendRenewalReminder(e, s, health)}
                        title="Send WhatsApp renewal reminder"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition shadow-2xs"
                      >
                        <MessageCircle className="w-3 h-3" />
                        <span>Remind</span>
                      </button>
                    )}
                  </div>

                  {s.paidUntil ? (
                    <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                      Until {s.paidUntil}
                      {health.remainingDays !== null && health.status === "due_soon" && (
                        <span className="text-amber-600 font-semibold ml-1">({health.remainingDays}d)</span>
                      )}
                      {health.remainingDays !== null && health.status === "expired" && (
                        <span className="text-rose-600 font-semibold ml-1">({Math.abs(health.remainingDays)}d ago)</span>
                      )}
                    </p>
                  ) : s.lastPaymentPeriod ? (
                    <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                      {s.lastPaymentPeriod}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Promotion Banner if Eligible */}
              {pendingPromotion && !readOnly && nextLevel && (
                <div className="flex items-center justify-between bg-gradient-to-r from-amber-50 to-indigo-50 p-2.5 rounded-xl border border-amber-200 text-xs">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold">
                    <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Eligible for {nextLevel.toUpperCase()}!</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePromote(s, pendingPromotion)}
                    className="px-2.5 py-1 rounded-lg bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-extrabold text-[11px] shadow-xs transition shrink-0"
                  >
                    Promote
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-100 py-2.5 text-slate-600">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Parent</span>
                  <span className="font-semibold text-slate-800">{s.parentName || "—"}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-[11px] text-slate-500 truncate">{s.parentPhone || "No contact"}</p>
                    {s.parentPhone && (
                      <button
                        type="button"
                        onClick={() => openWhatsAppParentChat(s.parentPhone, s.parentName, s.displayName)}
                        title="Chat with parent on WhatsApp"
                        className="p-1 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition shrink-0"
                      >
                        <MessageCircle className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Education / Joined</span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {s.educationLevel || s.schoolOrJob || "—"}
                  </span>
                  <p className="text-[11px] text-slate-500">{s.effectiveJoinedDate || "—"}</p>
                </div>
                <div className="col-span-2 bg-slate-50/80 p-2.5 rounded-xl">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Enrolled Class</span>
                  {studentClasses.length === 0 ? (
                    !readOnly ? (
                      <button
                        type="button"
                        onClick={() => setSelectedTransferStudent({ student: s, sourceClass: null })}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition shadow-2xs"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-amber-600" />
                        <span>Assign Batch</span>
                      </button>
                    ) : (
                      <span className="text-amber-700 font-semibold text-xs">Unassigned</span>
                    )
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {studentClasses.map((c, idx) => (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-1.5 bg-indigo-50 text-[#1a3a8f] px-2.5 py-1 rounded-lg border border-indigo-100 text-xs font-bold"
                        >
                          <span>{c.className}</span>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => setSelectedTransferStudent({ student: s, sourceClass: c })}
                              title="Transfer batch"
                              className="p-0.5 hover:text-[#122b6e] text-indigo-400 transition"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {(!readOnly || setSelectedStudent) && (
                <div className="flex gap-2 pt-1">
                  {setSelectedStudent && (
                    <button
                      onClick={() => setSelectedStudent(s)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#1a3a8f] border border-indigo-100 py-2 px-3 rounded-xl text-xs font-bold transition"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Badge</span>
                    </button>
                  )}
                  {!readOnly && (
                    <>
                      <button
                        onClick={() => handleEdit(s)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-3 rounded-xl text-xs font-bold transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteStudent(s)}
                        className="inline-flex items-center justify-center p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition"
                        title="Delete student"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {sortedStudents.length === 0 && (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-500 text-xs">
            No students found matching your criteria.
          </div>
        )}
      </div>

      {/* Desktop Full Table View */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200/90 shadow-2xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px] select-none">
              <th
                className="p-3.5 cursor-pointer hover:text-slate-900 transition"
                onClick={() => handleStudentSort("displayName")}
              >
                <div className="flex items-center gap-1">
                  <span>Student Name</span>
                  {studentSortField === "displayName" &&
                    (studentSortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#1a3a8f]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#1a3a8f]" />)}
                </div>
              </th>
              <th className="p-3.5">Status</th>
              <th
                className="p-3.5 cursor-pointer hover:text-slate-900 transition"
                onClick={() => handleStudentSort("parentName")}
              >
                <div className="flex items-center gap-1">
                  <span>Parent Contact</span>
                  {studentSortField === "parentName" &&
                    (studentSortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#1a3a8f]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#1a3a8f]" />)}
                </div>
              </th>
              <th
                className="p-3.5 cursor-pointer hover:text-slate-900 transition"
                onClick={() => handleStudentSort("educationLevel")}
              >
                <div className="flex items-center gap-1">
                  <span>Education</span>
                  {studentSortField === "educationLevel" &&
                    (studentSortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#1a3a8f]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#1a3a8f]" />)}
                </div>
              </th>
              <th
                className="p-3.5 cursor-pointer hover:text-slate-900 transition"
                onClick={() => handleStudentSort("dob")}
              >
                <div className="flex items-center gap-1">
                  <span>DOB</span>
                  {studentSortField === "dob" &&
                    (studentSortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#1a3a8f]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#1a3a8f]" />)}
                </div>
              </th>
              <th
                className="p-3.5 cursor-pointer hover:text-slate-900 transition"
                onClick={() => handleStudentSort("joinedDate")}
              >
                <div className="flex items-center gap-1">
                  <span>Joined</span>
                  {studentSortField === "joinedDate" &&
                    (studentSortAsc ? <ChevronUp className="w-3.5 h-3.5 text-[#1a3a8f]" /> : <ChevronDown className="w-3.5 h-3.5 text-[#1a3a8f]" />)}
                </div>
              </th>
              <th className="p-3.5">Payment</th>
              <th className="p-3.5">Class Cohort</th>
              <th className="p-3.5">Instructor</th>
              {(!readOnly || setSelectedStudent) && <th className="p-3.5 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {pageItems.map((s) => {
              const studentClasses = s.studentClasses;
              const statusBadge = getStatusBadge(s.effectiveStatus);
              const isPending = s.paymentStatus === "pending";
              const health = isPending
                ? { status: "pending", label: "Pending", tone: "amber", remainingDays: null }
                : getPaymentHealthStatus(s.paidUntil);
              const planLabel = getStudentPlanLabel(s);
              const canRemind = !readOnly && isActiveStudent(s) && (health.status === "due_soon" || health.status === "expired") && (s.parentPhone || s.phone);
              const pendingPromotion = pendingPromotionsMap[s.id];
              const nextLevel = pendingPromotion ? getNextLevel(s.currentLevel || "warrior") : null;

              return (
                <tr key={s.id} className="hover:bg-slate-50/60 transition group">
                  <td className="p-3.5 font-bold text-slate-900">
                    <div className="flex items-center gap-2.5">
                      {s.photoURL ? (
                        <img
                          src={s.photoURL}
                          alt={s.displayName}
                          className="w-8 h-8 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1a3a8f] to-indigo-700 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
                          {getInitials(s.displayName)}
                        </div>
                      )}
                      <div>
                        <p className="font-extrabold text-slate-900 group-hover:text-[#1a3a8f] transition">{s.displayName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono text-slate-400 font-normal">ID: {s.id.slice(0, 10)}</span>
                          {s.currentLevel && (
                            <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 uppercase">
                              {s.currentLevel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    {!readOnly ? (
                      <select
                        value={s.effectiveStatus}
                        disabled={updatingStatusId === s.id}
                        onChange={(e) => handleStatusChange(s, e.target.value)}
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border outline-none cursor-pointer ${statusBadge.tone}`}
                        title="Change student lifecycle status"
                      >
                        {STUDENT_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusBadge.tone}`}>
                        {statusBadge.label}
                      </span>
                    )}
                  </td>
                  <td className="p-3.5 text-slate-600">
                    <p className="font-semibold text-slate-800">{s.parentName || "—"}</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] text-slate-400">{s.parentPhone || "No contact"}</p>
                      {s.parentPhone && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openWhatsAppParentChat(s.parentPhone, s.parentName, s.displayName);
                          }}
                          title="Chat with parent on WhatsApp"
                          className="p-0.5 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">
                    {s.educationLevel || s.schoolOrJob || "—"}
                  </td>
                  <td className="p-3.5 text-slate-500 whitespace-nowrap text-[11px]">{s.dob || "—"}</td>
                  <td className="p-3.5 text-slate-600 font-semibold whitespace-nowrap">{s.effectiveJoinedDate || "—"}</td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {readOnly ? (
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getHealthBadgeReadOnlyClasses(health.tone)}`}
                        >
                          {health.label}
                        </span>
                      ) : (
                        <button
                          onClick={() => setPaymentStudent(s)}
                          title="Click to manage payments"
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition shadow-2xs hover:ring-2 hover:ring-offset-1 ${getHealthBadgeClasses(health.tone)}`}
                        >
                          {health.label}
                        </button>
                      )}

                      {planLabel && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-[#1a3a8f] border border-indigo-100">
                          {planLabel}
                        </span>
                      )}

                      {canRemind && (
                        <button
                          type="button"
                          onClick={(e) => handleSendRenewalReminder(e, s, health)}
                          title="Send WhatsApp renewal reminder"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition shadow-2xs"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>Remind</span>
                        </button>
                      )}
                    </div>

                    {s.paidUntil ? (
                      <p className="text-[10px] text-slate-500 mt-1 font-medium whitespace-nowrap">
                        Until {s.paidUntil}
                        {health.remainingDays !== null && health.status === "due_soon" && (
                          <span className="text-amber-600 font-semibold ml-1">({health.remainingDays}d left)</span>
                        )}
                        {health.remainingDays !== null && health.status === "expired" && (
                          <span className="text-rose-600 font-semibold ml-1">({Math.abs(health.remainingDays)}d ago)</span>
                        )}
                      </p>
                    ) : s.lastPaymentPeriod ? (
                      <p className="text-[10px] text-slate-400 mt-1 font-medium whitespace-nowrap">
                        {s.lastPaymentPeriod}
                      </p>
                    ) : null}
                  </td>
                  <td className="p-3.5">
                    {studentClasses.length === 0 ? (
                      !readOnly ? (
                        <button
                          type="button"
                          onClick={() => setSelectedTransferStudent({ student: s, sourceClass: null })}
                          className="inline-flex items-center gap-1 text-amber-800 font-bold bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-md text-[11px] border border-amber-200 transition shadow-2xs"
                          title="Assign to a batch"
                        >
                          <UserPlus className="w-3 h-3 text-amber-600" />
                          <span>Assign Batch</span>
                        </button>
                      ) : (
                        <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded text-[11px] border border-amber-200/60 whitespace-nowrap">
                          Unassigned
                        </span>
                      )
                    ) : (
                      studentClasses.map((c, idx) => (
                        <div key={idx} className="mb-1 last:mb-0 whitespace-nowrap inline-flex items-center gap-1.5 mr-2">
                          <span className="text-[#1a3a8f] font-bold text-[11px] bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100">
                            {c.className}
                          </span>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => setSelectedTransferStudent({ student: s, sourceClass: c })}
                              title="Transfer to another batch"
                              className="p-0.5 text-slate-400 hover:text-[#1a3a8f] hover:bg-indigo-50 rounded transition"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </td>
                  <td className="p-3.5">
                    {studentClasses.length === 0 ? (
                      <span className="text-slate-400 text-xs">—</span>
                    ) : (
                      studentClasses.map((c, idx) => (
                        <div key={idx} className="mb-1 last:mb-0 whitespace-nowrap">
                          <span className="text-slate-700 font-medium text-[11px]">
                            {c.instructorName || "Unassigned"}
                          </span>
                        </div>
                      ))
                    )}
                  </td>
                  {(!readOnly || setSelectedStudent) && (
                    <td className="p-3.5 text-right font-bold whitespace-nowrap">
                      <div className="flex items-center gap-1.5 justify-end">
                        {pendingPromotion && !readOnly && nextLevel && (
                          <button
                            type="button"
                            onClick={() => handlePromote(s, pendingPromotion)}
                            className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 rounded-lg font-bold text-[11px] transition shadow-2xs"
                            title={`Promote to ${nextLevel.toUpperCase()}`}
                          >
                            <Sparkles className="w-3 h-3 text-amber-600 animate-pulse" />
                            <span>Promote</span>
                          </button>
                        )}
                        {setSelectedStudent && (
                          <button
                            onClick={() => setSelectedStudent(s)}
                            className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-[#1a3a8f] border border-indigo-200/60 px-2.5 py-1 rounded-lg font-bold text-[11px] transition shadow-2xs"
                            title="View / Print ID Badge"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Badge</span>
                          </button>
                        )}
                        {!readOnly && (
                          <>
                            <button
                              onClick={() => handleEdit(s)}
                              className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg font-bold text-[11px] transition shadow-2xs"
                              title="Edit profile"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteStudent(s)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                              title="Delete record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
