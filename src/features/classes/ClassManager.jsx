import { useState, useMemo, Fragment } from "react";
import {
  LevelBadge,
  LEVELS,
  LEVEL_KEYS,
  useToast,
  useConfirm,
  exportTableCSV,
} from "../shared";
import {
  deleteClass,
  addStudentToClass,
  removeStudentFromClass,
  setClassGroupLevel,
  syncStudentsCurrentLevel,
} from "./classesRepository";
import AvailableBatches from "./AvailableBatches";
import BatchModal from "./BatchModal";
import TransferModal from "./TransferModal";
import BatchOutreachPanel from "./BatchOutreachPanel";
import { findScheduleConflicts } from "./scheduleConflict";
import { getPaymentHealthStatus } from "../../constants/paymentPlans";
import { normalizeWhatsAppNumber } from "../finance/receiptMessages";
import {
  MapPin,
  Plus,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Search,
  ExternalLink,
  ArrowRightLeft,
  MessageCircle,
  AlertTriangle,
  Radio,
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

  // Filter Bar state
  const [statusFilter, setStatusFilter] = useState("active_upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");

  // Modals state
  const [isNewBatchModalOpen, setIsNewBatchModalOpen] = useState(false);
  const [editingBatchFromCard, setEditingBatchFromCard] = useState(null);
  const [outreachBatch, setOutreachBatch] = useState(null);
  const [transferringStudent, setTransferringStudent] = useState(null);

  // Quick enroll inline state (in roster accordion)
  const [enrollingIntoClassId, setEnrollingIntoClassId] = useState(null);
  const [addStudentId, setAddStudentId] = useState("");
  const [addDateJoined, setAddDateJoined] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Sorting & expansion state for Cohort Table
  const [classSortField, setClassSortField] = useState("className");
  const [classSortAsc, setClassSortAsc] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editingLevelKey, setEditingLevelKey] = useState(null);
  const [pendingLevel, setPendingLevel] = useState("warrior");

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

  // ── Cohort Grouping & Filtering for Table View ────────────────────────
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

  const handleAddStudentToClass = async (classId, e) => {
    e.preventDefault();
    if (!addStudentId) return;

    const cls = classes.find((c) => c.id === classId);
    const targetLevel = cls?.classLevel || "warrior";
    const student = users.find((u) => u.id === addStudentId);

    if (student?.currentLevel && student.currentLevel !== targetLevel) {
      if (
        !(await confirm(
          `${student.displayName} is recorded at level "${student.currentLevel}", but this class is "${targetLevel}".\n\nEnroll anyway?`
        ))
      ) {
        return;
      }
    }

    try {
      await addStudentToClass(classId, {
        studentId: addStudentId,
        dateJoined: addDateJoined || new Date().toISOString().slice(0, 10),
        level: targetLevel,
      });
      await syncStudentsCurrentLevel([addStudentId], targetLevel);
      setEnrollingIntoClassId(null);
      setAddStudentId("");
      setAddDateJoined(new Date().toISOString().slice(0, 10));
      toast("Student enrolled successfully!", "success");
    } catch (err) {
      toast("Error enrolling student: " + err.message, "error");
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
      toast("Cohort level updated!", "success");
    } catch (err) {
      toast("Error setting level: " + err.message, "error");
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

  const getEnrollment = (cls, studentId) =>
    (cls.enrollments || []).find((enrollment) => enrollment.studentId === studentId) || {};

  const getDuration = (dateJoined) => {
    if (!dateJoined) return "Not recorded";
    const joined = new Date(`${dateJoined}T00:00:00`);
    if (Number.isNaN(joined.getTime())) return "Not recorded";
    const now = new Date();
    let months =
      (now.getFullYear() - joined.getFullYear()) * 12 +
      now.getMonth() -
      joined.getMonth();
    if (now.getDate() < joined.getDate()) months -= 1;
    if (months < 1) return "Joined this month";
    const years = Math.floor(months / 12);
    months %= 12;
    return [
      years ? `${years} yr${years === 1 ? "" : "s"}` : "",
      months ? `${months} mo${months === 1 ? "" : "s"}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  };

  const openWhatsAppParentChat = (parentPhone, studentName, cls) => {
    const formatted = normalizeWhatsAppNumber(parentPhone);
    if (!formatted) {
      toast("No valid parent phone number recorded.", "error");
      return;
    }
    const text = `Halo Bapak/Ibu, kami dari Liberty English School ingin menginformasikan mengenai ananda ${studentName || "siswa"} di kelas ${cls.className}...`;
    const url = `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  // ── Render Helpers ───────────────────────────────────────────────────
  const renderPaymentBadge = (student) => {
    if (!student) return null;
    const health =
      student.paymentStatus === "pending"
        ? { status: "pending", label: "Pending", tone: "amber" }
        : getPaymentHealthStatus(student.paidUntil);

    let badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
    if (health.status === "active") {
      badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    } else if (health.status === "due_soon") {
      badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
    } else if (health.status === "expired") {
      badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
    } else if (health.status === "pending") {
      badgeClass = "bg-yellow-50 text-yellow-800 border-yellow-200";
    }

    return (
      <span
        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeClass} inline-flex items-center gap-1`}
        title={`Valid until: ${student.paidUntil || "No Plan"}`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            health.status === "active"
              ? "bg-emerald-500"
              : health.status === "due_soon"
              ? "bg-amber-500"
              : health.status === "expired"
              ? "bg-rose-500"
              : "bg-slate-400"
          }`}
        />
        <span>{health.label}</span>
      </span>
    );
  };

  const renderBatchCard = (cls) => {
    const studentCount = (cls.studentIds || []).length;
    const capacity = Number(cls.maxCapacity) || 15;
    const quorum = Number(cls.minQuorum) || 4;
    const isUnderQuorum =
      studentCount < quorum &&
      (cls.status === "upcoming" || cls.status === "open" || !cls.status);

    return (
      <div
        key={cls.id}
        className="border border-slate-200 bg-white rounded-2xl p-4 space-y-3 shadow-2xs"
      >
        <div className="flex justify-between items-start gap-2 flex-wrap pb-2 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                <span>Room: {cls.classRoom || "Standard Classroom"}</span>
              </span>

              {/* Quorum Warning Badge */}
              {isUnderQuorum && (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 font-extrabold text-[10px] inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>
                    Under Quorum ({studentCount}/{quorum})
                  </span>
                </span>
              )}

              {/* Status Badge */}
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px] uppercase tracking-wide">
                {cls.status || "Open"}
              </span>

              {cls.worksheetUrl && (
                <a
                  href={cls.worksheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md hover:bg-emerald-100 transition"
                >
                  <FileText className="w-3 h-3" />
                  <span>Worksheet</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>

            <p className="text-[11px] text-slate-400 font-medium">
              Start Date: {cls.classStartDate || "Recorded"} · {studentCount}/{capacity}{" "}
              Students Enrolled · Min Quorum: {quorum}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Outreach Button */}
            <button
              onClick={() => setOutreachBatch(cls)}
              className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-emerald-200"
              title="Message Parents / Copy Phone List"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-600" />
              <span>Outreach</span>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setEditingBatchFromCard(cls)}
                  className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-indigo-100"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Batch</span>
                </button>
                <button
                  onClick={() => handleDeleteClass(cls.id)}
                  className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Batch</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Capacity Meter */}
        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              studentCount >= capacity
                ? "bg-rose-500"
                : studentCount / capacity >= 0.75
                ? "bg-amber-500"
                : "bg-indigo-600"
            }`}
            style={{
              width: `${Math.min(100, Math.round((studentCount / capacity) * 100))}%`,
            }}
          />
        </div>

        {/* Roster of Students in this Batch */}
        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
          {studentCount === 0 ? (
            <p className="text-[11px] text-slate-400 italic py-1">
              No students enrolled in this batch yet.
            </p>
          ) : (
            (cls.studentIds || []).map((studentId) => {
              const student = users.find((user) => user.id === studentId);
              const enrollment = getEnrollment(cls, studentId);
              const parentPhone = student?.parentPhone || student?.phone;

              return (
                <div
                  key={studentId}
                  className="text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex justify-between items-center gap-2 hover:bg-indigo-50/30 transition"
                >
                  <div className="min-w-0 flex items-center gap-2.5 flex-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-extrabold text-slate-800 truncate">
                          {student?.displayName || "Enrolled Student"}
                        </p>
                        {renderPaymentBadge(student)}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Joined: {enrollment.dateJoined || "N/A"} ·{" "}
                        {getDuration(enrollment.dateJoined)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* WhatsApp Parent Button */}
                    {parentPhone && (
                      <button
                        onClick={() =>
                          openWhatsAppParentChat(
                            parentPhone,
                            student?.displayName,
                            cls
                          )
                        }
                        title={`Chat with parent (+${normalizeWhatsAppNumber(parentPhone)})`}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition flex items-center gap-1 border border-emerald-200"
                      >
                        <MessageCircle className="w-3 h-3 text-emerald-600" />
                        <span className="hidden sm:inline">Parent</span>
                      </button>
                    )}

                    {canEnroll && (
                      <button
                        onClick={() =>
                          setTransferringStudent({
                            student:
                              student || {
                                id: studentId,
                                displayName: "Enrolled Student",
                              },
                            sourceClass: cls,
                          })
                        }
                        title="Transfer to another batch"
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                        <span className="hidden sm:inline">Transfer</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleRemoveStudentFromClass(cls, studentId)}
                      className="text-[10px] font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg transition cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add Student to Existing Batch */}
        {enrollingIntoClassId === cls.id ? (
          <form
            onSubmit={(e) => handleAddStudentToClass(cls.id, e)}
            className="mt-2 space-y-2.5 border border-indigo-200 rounded-2xl p-3 bg-indigo-50/30"
          >
            <p className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>Enroll Unassigned Student</span>
            </p>

            <select
              value={addStudentId}
              onChange={(e) => {
                const sid = e.target.value;
                setAddStudentId(sid);
                const st = users.find((u) => u.id === sid);
                if (st?.joinedDate) setAddDateJoined(st.joinedDate);
              }}
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-xs font-semibold"
              required
            >
              <option value="">Select unassigned student...</option>
              {unenrolledStudents.map((stud) => (
                <option key={stud.id} value={stud.id}>
                  {stud.displayName}
                  {stud.currentLevel &&
                  stud.currentLevel !== (cls.classLevel || "warrior")
                    ? ` (currently ${stud.currentLevel})`
                    : ""}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2 items-center">
              <input
                type="date"
                value={addDateJoined}
                onChange={(e) => setAddDateJoined(e.target.value)}
                className="w-full p-2 border border-slate-200 rounded-xl bg-white text-xs font-medium"
                required
              />
              <div className="text-[10px] text-slate-600">
                <span className="font-bold">Track:</span> {cls.classLevel || "Warrior"}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 bg-[#1a3a8f] text-white py-2 px-3 rounded-xl font-bold text-xs hover:bg-[#122b6e] transition shadow-xs"
              >
                Confirm Enrollment
              </button>
              <button
                type="button"
                onClick={() => setEnrollingIntoClassId(null)}
                className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => {
              setEnrollingIntoClassId(cls.id);
              setAddStudentId("");
            }}
            disabled={unenrolledStudents.length === 0}
            className="w-full py-2 px-3 rounded-xl border border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/20 text-indigo-900 font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>
              {unenrolledStudents.length === 0
                ? "All Students Enrolled"
                : "Enroll Student to this Batch"}
            </span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200/90 max-w-6xl mx-auto space-y-6 shadow-sm">
      {/* ── Cockpit Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-extrabold text-slate-900 text-xl tracking-tight">
            Class Cohort Management
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Timetable schedules, classroom allocations & student rosters
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
            <button
              onClick={() => setViewMode("batches")}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
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
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 ${
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
              className="px-4 py-2 bg-[#1a3a8f] hover:bg-[#122b6e] text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-xs"
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
                              {group.items.map((cls) => renderBatchCard(cls))}
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
                      {group.items.map((cls) => renderBatchCard(cls))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
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
