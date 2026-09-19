import { useState, useMemo } from "react";
import {
  BookOpen,
  Calendar,
  Clock,
  MapPin,
  Users,
  User,
  Plus,
  Edit2,
  Trash2,
  Share2,
  Check,
  Search,
  ArrowRight,
  ExternalLink,
  UserPlus,
  X,
  ArrowRightLeft,
} from "lucide-react";
import {
  LevelBadge,
  LEVELS,
  LEVEL_KEYS,
  TIERS,
  TIER_KEYS,
  getTier,
  isCompatible,
  useToast,
  useConfirm,
} from "../shared";
import BatchModal from "./BatchModal";
import {
  deleteClass,
  addStudentToClass,
  syncStudentsCurrentLevel,
  transferStudentBetweenClasses,
} from "./classesRepository";

function EnrollModal({ batch, students, allClasses = [], onClose, onEnrolled }) {
  const toast = useToast();
  const [enrollMode, setEnrollMode] = useState("direct"); // "direct" | "transfer"
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedTransferKey, setSelectedTransferKey] = useState("");
  const [dateJoined, setDateJoined] = useState(
    batch?.classStartDate || new Date().toISOString().slice(0, 10)
  );
  const [enrolling, setEnrolling] = useState(false);

  // Filter out students already enrolled in this batch to prevent duplicate active enrollments
  const studentIds = batch?.studentIds;
  const batchId = batch?.id;
  const enrolledSet = useMemo(() => new Set(studentIds || []), [studentIds]);
  const eligibleStudents = useMemo(() => {
    return students.filter((s) => !enrolledSet.has(s.id));
  }, [students, enrolledSet]);

  // Students currently enrolled in other cohorts available for lateral transfer
  const transferCandidates = useMemo(() => {
    const list = [];
    allClasses.forEach((cls) => {
      if (cls.id === batchId) return;
      (cls.studentIds || []).forEach((sId) => {
        if (enrolledSet.has(sId)) return;
        const student = students.find((s) => s.id === sId);
        if (student) {
          list.push({
            key: `${student.id}___${cls.id}`,
            student,
            sourceClass: cls,
          });
        }
      });
    });
    return list;
  }, [allClasses, batchId, enrolledSet, students]);

  const selectedTransfer = useMemo(() => {
    return transferCandidates.find((t) => t.key === selectedTransferKey) || null;
  }, [transferCandidates, selectedTransferKey]);

  const selectedStudent = useMemo(() => {
    if (enrollMode === "transfer") {
      return selectedTransfer?.student || null;
    }
    return students.find((s) => s.id === selectedStudentId) || null;
  }, [enrollMode, selectedTransfer, students, selectedStudentId]);

  const levelMismatch = Boolean(
    selectedStudent?.currentLevel &&
    !isCompatible(selectedStudent.currentLevel, batch)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (enrollMode === "direct" && !selectedStudentId) {
      toast("Please select a student to enroll.", "error");
      return;
    }
    if (enrollMode === "transfer" && !selectedTransfer) {
      toast("Please select a student to transfer.", "error");
      return;
    }
    if (batch.seatsAvailable <= 0) {
      toast("Cannot enroll: this batch is already at maximum capacity.", "error");
      return;
    }

    setEnrolling(true);
    const targetLevel = batch.classLevel || "warrior";
    const effectiveDate = dateJoined || new Date().toISOString().slice(0, 10);

    try {
      if (enrollMode === "transfer") {
        await transferStudentBetweenClasses({
          sourceClass: selectedTransfer.sourceClass,
          targetClassId: batch.id,
          targetClass: batch,
          studentId: selectedTransfer.student.id,
          dateTransferred: effectiveDate,
          newLevel: targetLevel,
          transferReason: `Transferred into ${batch.className}`,
        });
        toast(
          `Transferred "${selectedTransfer.student.displayName || "Student"}" from ${selectedTransfer.sourceClass.className} to ${batch.className}!`,
          "success"
        );
      } else {
        await addStudentToClass(batch.id, {
          studentId: selectedStudentId,
          dateJoined: effectiveDate,
          level: targetLevel,
        });
        await syncStudentsCurrentLevel([selectedStudentId], targetLevel);
        toast(
          `Enrolled "${selectedStudent?.displayName || "Student"}" into ${batch.className}!`,
          "success"
        );
      }

      if (onEnrolled) onEnrolled();
      onClose();
    } catch (err) {
      toast("Enrollment failed: " + err.message, "error");
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#1a3a8f] text-white flex items-center justify-center shadow-xs">
              {enrollMode === "transfer" ? (
                <ArrowRightLeft className="w-5 h-5" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base sm:text-lg">
                {enrollMode === "transfer" ? "Transfer Student to Batch" : "Enroll Student into Batch"}
              </h3>
              <p className="text-xs text-slate-500">
                {enrollMode === "transfer"
                  ? "Lateral transfer from another cohort"
                  : "Direct placement into available cohort opening"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Batch Snapshot */}
        <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-black text-slate-900 text-sm">{batch.className}</span>
            <LevelBadge level={batch.classLevel || "warrior"} />
          </div>
          <div className="flex items-center justify-between text-slate-600 font-medium text-[11px]">
            <span>{batch.schedule || batch.classDay} · {batch.classRoom || "Main Campus"}</span>
            <span className="font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
              {batch.seatsAvailable} seat{batch.seatsAvailable === 1 ? "" : "s"} remaining
            </span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Direct vs Transfer Mode Switcher */}
          <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setEnrollMode("direct")}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                enrollMode === "direct"
                  ? "bg-white text-[#1a3a8f] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Direct Placement</span>
            </button>
            <button
              type="button"
              onClick={() => setEnrollMode("transfer")}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                enrollMode === "transfer"
                  ? "bg-white text-[#1a3a8f] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Transfer from Cohort</span>
            </button>
          </div>

          {enrollMode === "direct" ? (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Select Student *
              </label>
              {eligibleStudents.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">
                  All active students are already enrolled in this batch, or no students are registered yet.
                </p>
              ) : (
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
                  required
                >
                  <option value="">-- Choose student to enroll --</option>
                  {eligibleStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.displayName || s.name || s.email}
                      {s.currentLevel ? ` [Track: ${s.currentLevel}]` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Select Enrolled Student to Transfer *
              </label>
              {transferCandidates.length === 0 ? (
                <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  No students found in other cohorts eligible for transfer.
                </p>
              ) : (
                <select
                  value={selectedTransferKey}
                  onChange={(e) => setSelectedTransferKey(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
                  required
                >
                  <option value="">-- Choose student &amp; source cohort --</option>
                  {transferCandidates.map((cand) => (
                    <option key={cand.key} value={cand.key}>
                      {cand.student.displayName || cand.student.name || cand.student.email} (from {cand.sourceClass.className})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Level mismatch warning */}
          {levelMismatch && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-bold">⚠️ Level Track Mismatch</p>
              <p className="text-[11px]">
                {selectedStudent?.displayName} is recorded at{" "}
                <span className="font-bold uppercase">{selectedStudent?.currentLevel}</span> level,
                while this batch is <span className="font-bold uppercase">{batch.classLevel}</span>.
                Enrolling will update the student&apos;s recorded current level to {batch.classLevel}.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Enrollment Date
            </label>
            <input
              type="date"
              value={dateJoined}
              onChange={(e) => setDateJoined(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={enrolling}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={enrolling || eligibleStudents.length === 0}
              className="px-5 py-2.5 bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-extrabold text-xs rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {enrolling ? "Enrolling..." : "Confirm Enrollment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AvailableBatches({
  classes = [],
  instructors = [],
  users = [],
  canEdit = false,
  role = "admin",
  isOverviewWidget = false,
  onNavigateToClasses = null,
  currentUserId = null,
}) {
  const toast = useToast();
  const confirm = useConfirm();

  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [enrollingBatch, setEnrollingBatch] = useState(null);
  const [copiedBatchId, setCopiedBatchId] = useState(null);

  // Strict role boundaries
  const canAdminister = role === "admin" && canEdit;
  const canEnroll = role === "admin" || role === "frontoffice";

  // Filter students list for direct enrollment
  const studentsList = useMemo(() => {
    const studentsOnly = users.filter((u) => u.role === "student");
    return studentsOnly.length > 0 ? studentsOnly : users;
  }, [users]);

  // Map instructor name lookups
  const instructorMap = useMemo(() => {
    const map = new Map();
    (users.length > 0 ? users : instructors).forEach((u) => {
      map.set(u.id, u.displayName || u.name || u.email || "Instructor");
    });
    return map;
  }, [users, instructors]);

  // Augment classes with capacity and availability calculations (Source of Truth is classes + enrollments)
  const augmentedBatches = useMemo(() => {
    return classes.map((cls) => {
      const studentCount = (cls.studentIds || []).length;
      const capacity = Number(cls.maxCapacity) || 15;
      const seatsAvailable = Math.max(0, capacity - studentCount);
      const occupancyRate = Math.min(100, Math.round((studentCount / capacity) * 100));

      // Determine computed availability status following the roadmap lifecycle:
      // OPEN and active_enrollment_count < capacity and not cancelled and not completed
      let computedStatus = cls.status || "open";
      if (cls.status === "cancelled") {
        computedStatus = "cancelled";
      } else if (cls.status === "completed") {
        computedStatus = "completed";
      } else if (cls.status === "in_progress") {
        computedStatus = "in_progress";
      } else if (studentCount >= capacity) {
        computedStatus = "full";
      } else if (seatsAvailable <= 3 && seatsAvailable > 0 && computedStatus !== "upcoming") {
        computedStatus = "filling_fast";
      }

      const isAvailable =
        computedStatus !== "cancelled" &&
        computedStatus !== "completed" &&
        computedStatus !== "in_progress" &&
        computedStatus !== "full" &&
        seatsAvailable > 0;

      const instructorName = cls.instructorId
        ? (instructorMap.get(cls.instructorId) || cls.instructorName || "Assigned Instructor")
        : (cls.instructorName || "Unassigned (TBA)");

      return {
        ...cls,
        studentCount,
        maxCapacity: capacity,
        seatsAvailable,
        occupancyRate,
        computedStatus,
        isAvailable,
        instructorName,
      };
    });
  }, [classes, instructorMap]);

  // Overall capacity statistics
  const stats = useMemo(() => {
    const totalBatches = augmentedBatches.length;
    const totalCapacity = augmentedBatches.reduce((acc, b) => acc + b.maxCapacity, 0);
    const totalEnrolled = augmentedBatches.reduce((acc, b) => acc + b.studentCount, 0);
    const totalOpenSeats = augmentedBatches
      .filter((b) => b.isAvailable)
      .reduce((acc, b) => acc + b.seatsAvailable, 0);
    const fillingFastCount = augmentedBatches.filter((b) => b.computedStatus === "filling_fast").length;
    const openBatchesCount = augmentedBatches.filter((b) => b.isAvailable).length;
    const overallOccupancy = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

    return {
      totalBatches,
      totalCapacity,
      totalEnrolled,
      totalOpenSeats,
      fillingFastCount,
      openBatchesCount,
      overallOccupancy,
    };
  }, [augmentedBatches]);

  // Filtered batches
  const filteredBatches = useMemo(() => {
    return augmentedBatches
      .filter((b) => {
        if (tierFilter !== "all" && getTier(b.classLevel) !== tierFilter) return false;
        if (levelFilter !== "all" && b.classLevel !== levelFilter) return false;
        if (statusFilter === "open" && (!b.isAvailable || b.seatsAvailable <= 0)) return false;
        if (statusFilter === "filling_fast" && b.computedStatus !== "filling_fast") return false;
        if (statusFilter === "upcoming" && b.computedStatus !== "upcoming") return false;
        if (statusFilter === "full" && b.computedStatus !== "full" && b.seatsAvailable > 0) return false;
        if (statusFilter === "completed" && b.computedStatus !== "completed" && b.computedStatus !== "cancelled") return false;
        return true;
      })
      .filter((b) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          (b.className || "").toLowerCase().includes(q) ||
          (b.instructorName || "").toLowerCase().includes(q) ||
          (b.classRoom || "").toLowerCase().includes(q) ||
          (b.schedule || "").toLowerCase().includes(q) ||
          (b.classDay || "").toLowerCase().includes(q)
        );
      });
  }, [augmentedBatches, tierFilter, levelFilter, statusFilter, search]);

  const handleOpenAddModal = () => {
    setEditingBatch(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (batch) => {
    setEditingBatch(batch);
    setModalOpen(true);
  };

  const handleDeleteBatch = async (batch) => {
    const confirmed = await confirm(
      `Are you sure you want to delete batch "${batch.className}"? This will remove the cohort from the school calendar.`
    );
    if (!confirmed) return;

    try {
      await deleteClass(batch.id);
      toast(`Batch "${batch.className}" deleted.`, "info");
    } catch (err) {
      toast("Error deleting batch: " + err.message, "error");
    }
  };

  const handleCopyMarketingBlurb = (batch) => {
    const regUrl = typeof window !== "undefined" ? `${window.location.origin}/register` : "https://myliberty.id/register";
    const levelName = LEVELS[batch.classLevel]?.label || batch.classLevel || "Standard";

    const text = [
      `🌟 AVAILABLE BATCH @ MY LIBERTY ENGLISH SCHOOL 🌟`,
      `📚 Cohort: ${batch.className}`,
      `🎯 Track: ${levelName} Level`,
      `📅 Schedule: ${batch.schedule || `${batch.classDay} (${batch.startTime} - ${batch.endTime})`}`,
      `📍 Location: ${batch.classRoom || "Main Campus"}`,
      `⏳ Intake Date: ${batch.classStartDate || "Immediate"}`,
      `👥 Open Seats: ${batch.seatsAvailable} seat${batch.seatsAvailable === 1 ? "" : "s"} remaining!`,
      batch.notes ? `💡 Note: ${batch.notes}` : null,
      `🔗 Register online here: ${regUrl}`,
    ]
      .filter(Boolean)
      .join("\n");

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedBatchId(batch.id);
      toast("Batch promo details copied to clipboard for WhatsApp & social!", "success");
      setTimeout(() => setCopiedBatchId(null), 2500);
    } else {
      toast("Could not access clipboard", "error");
    }
  };

  // Helper for status badge styling across all lifecycle states
  const renderStatusPill = (status, seatsAvailable) => {
    if (status === "cancelled") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Cancelled
        </span>
      );
    }
    if (status === "completed") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
          Completed
        </span>
      );
    }
    if (status === "in_progress") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
          Ongoing
        </span>
      );
    }
    if (status === "full" || seatsAvailable === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
          Full / Waitlist
        </span>
      );
    }
    if (status === "filling_fast" || seatsAvailable <= 3) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
          Filling Fast ({seatsAvailable} left)
        </span>
      );
    }
    if (status === "upcoming") {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
          Upcoming Intake
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
        Open ({seatsAvailable} seats)
      </span>
    );
  };

  // ──────────────────────────────────────────────────────────────────────────
  // COMPACT OVERVIEW WIDGET VIEW (For Admin / Front Office / Manager / Instructor)
  // ──────────────────────────────────────────────────────────────────────────
  if (isOverviewWidget) {
    const displayList = augmentedBatches.slice(0, 4);

    return (
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#1a3a8f] flex items-center justify-center font-bold">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
                <span>Available Batches &amp; Seat Openings</span>
                {stats.totalOpenSeats > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    {stats.totalOpenSeats} open seats
                  </span>
                )}
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                Live capacity across academy cohorts and intake schedules
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canAdminister && (
              <button
                onClick={handleOpenAddModal}
                className="px-3 py-1.5 bg-[#1a3a8f] hover:bg-[#122b6e] text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add Batch</span>
              </button>
            )}
            {onNavigateToClasses && (
              <button
                onClick={onNavigateToClasses}
                className="text-xs font-bold text-[#1a3a8f] hover:underline flex items-center gap-1 p-1"
              >
                <span>View All ({augmentedBatches.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Mini stats pill strip */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Batches</p>
            <p className="text-base font-black text-slate-800 mt-0.5">{stats.totalBatches}</p>
          </div>
          <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
            <p className="text-[10px] uppercase font-bold text-emerald-700">Open Seats</p>
            <p className="text-base font-black text-emerald-800 mt-0.5">{stats.totalOpenSeats}</p>
          </div>
          <div className="p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-100">
            <p className="text-[10px] uppercase font-bold text-indigo-700">School Occupancy</p>
            <p className="text-base font-black text-indigo-800 mt-0.5">{stats.overallOccupancy}%</p>
          </div>
        </div>

        {/* Mini list of top available batches */}
        {displayList.length === 0 ? (
          <div className="py-6 text-center text-slate-400 text-xs font-medium">
            No class batches scheduled yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayList.map((batch) => (
              <div
                key={batch.id}
                className="p-3 bg-slate-50/60 hover:bg-slate-50 rounded-2xl border border-slate-200/80 transition flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-slate-900 text-xs truncate">
                      {batch.className}
                    </span>
                    <LevelBadge level={batch.classLevel || "warrior"} />
                    {renderStatusPill(batch.computedStatus, batch.seatsAvailable)}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{batch.schedule || batch.classDay}</span>
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{batch.classRoom || "Main Campus"}</span>
                    </span>
                    <span>·</span>
                    <span className="text-slate-600 font-semibold">
                      {batch.instructorName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  {/* Capacity indicator */}
                  <div className="text-right">
                    <p className="text-[11px] font-black text-slate-800">
                      {batch.studentCount} / {batch.maxCapacity} seats
                    </p>
                    <div className="w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-0.5">
                      <div
                        className={`h-full rounded-full ${
                          batch.seatsAvailable === 0
                            ? "bg-rose-500"
                            : batch.seatsAvailable <= 3
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${batch.occupancyRate}%` }}
                      />
                    </div>
                  </div>

                  {canAdminister && (
                    <button
                      onClick={() => handleOpenEditModal(batch)}
                      title="Edit Batch"
                      className="p-1.5 text-slate-500 hover:text-[#1a3a8f] hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {canEnroll && batch.isAvailable && (
                    <button
                      onClick={() => setEnrollingBatch(batch)}
                      title="Enroll Student"
                      className="px-2.5 py-1.5 bg-[#1a3a8f] hover:bg-[#122b6e] text-white rounded-lg transition text-[11px] font-extrabold flex items-center gap-1 shadow-2xs cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>Enroll</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal for direct enrollment & transfer */}
        {enrollingBatch && (
          <EnrollModal
            batch={enrollingBatch}
            students={studentsList}
            allClasses={classes}
            onClose={() => setEnrollingBatch(null)}
          />
        )}

        {/* Modal for editing/adding if triggered from widget (Admin only) */}
        {canAdminister && (
          <BatchModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            batch={editingBatch}
            instructors={instructors}
          />
        )}
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FULL AVAILABLE BATCHES VIEW (For Classes Tab across all Dashboards)
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner & Control Bar */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-slate-900 text-xl tracking-tight">
                Available Batches &amp; Cohorts
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-[#1a3a8f] border border-indigo-100">
                {augmentedBatches.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Monitor seat capacity, schedules, room allocations, and student enrollment status across the academy.
            </p>
          </div>

          {canAdminister && (
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Available Batch</span>
            </button>
          )}
        </div>

        {/* Academy-Wide Capacity Overview Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
            <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
              Total Batches
            </p>
            <p className="text-2xl font-black text-slate-800 mt-0.5">{stats.totalBatches}</p>
            <p className="text-[10px] text-slate-500 font-medium mt-0.5">
              {stats.openBatchesCount} open for enrollment
            </p>
          </div>

          <div className="p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-100">
            <p className="text-[10px] font-extrabold uppercase text-emerald-700 tracking-wider">
              Available Open Seats
            </p>
            <p className="text-2xl font-black text-emerald-800 mt-0.5">{stats.totalOpenSeats}</p>
            <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
              Across all levels &amp; rooms
            </p>
          </div>

          <div className="p-3.5 bg-indigo-50/70 rounded-2xl border border-indigo-100">
            <p className="text-[10px] font-extrabold uppercase text-indigo-700 tracking-wider">
              Enrolled Students
            </p>
            <p className="text-2xl font-black text-indigo-800 mt-0.5">{stats.totalEnrolled}</p>
            <p className="text-[10px] text-indigo-600 font-medium mt-0.5">
              {stats.totalCapacity} total seat capacity
            </p>
          </div>

          <div className="p-3.5 bg-amber-50/70 rounded-2xl border border-amber-100">
            <p className="text-[10px] font-extrabold uppercase text-amber-800 tracking-wider">
              Filling Fast (&le; 3 seats)
            </p>
            <p className="text-2xl font-black text-amber-900 mt-0.5">{stats.fillingFastCount}</p>
            <p className="text-[10px] text-amber-700 font-medium mt-0.5">
              High demand cohorts
            </p>
          </div>
        </div>

        {/* Filter and Search Controls */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search batch title, instructor, schedule, or room..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            />
          </div>

          {/* Marketing-Friendly Tier Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => {
                setTierFilter("all");
                setLevelFilter("all");
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                tierFilter === "all" && levelFilter === "all"
                  ? "bg-[#1a3a8f] text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Batches
            </button>
            {TIER_KEYS.map((tierKey) => {
              const tier = TIERS[tierKey];
              const isSelected = tierFilter === tierKey;
              return (
                <button
                  key={tierKey}
                  onClick={() => {
                    setTierFilter(isSelected ? "all" : tierKey);
                    setLevelFilter("all");
                  }}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-[#1a3a8f] text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <span>{tier.starText}</span>
                  <span>{tier.label}</span>
                  <span className={`text-[10px] font-normal ${isSelected ? "text-indigo-200" : "text-slate-400"}`}>
                    ({tier.levels.map((l) => LEVELS[l]?.label).join("/")})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Sub-level Filter Dropdown */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 focus:border-[#1a3a8f] outline-none capitalize"
          >
            <option value="all">All Sub-Levels</option>
            {LEVEL_KEYS.map((lvl) => (
              <option key={lvl} value={lvl}>
                {LEVELS[lvl]?.label} ({LEVELS[lvl]?.stars ? "⭐".repeat(LEVELS[lvl].stars) : ""})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 focus:border-[#1a3a8f] outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="open">🟢 Open Seats Only</option>
            <option value="filling_fast">🟡 Filling Fast (&le; 3)</option>
            <option value="upcoming">🔵 Upcoming Intake</option>
            <option value="full">🔴 Full / Closed</option>
            <option value="completed">🟣 Completed / Cancelled</option>
          </select>
        </div>
      </div>

      {/* Batch Cards Grid */}
      {filteredBatches.length === 0 ? (
        <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="font-extrabold text-slate-800 text-base">No Available Batches Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
            {search || levelFilter !== "all" || statusFilter !== "all"
              ? "No cohorts match your selected search query or filters. Try resetting the filters."
              : "No class batches are currently available."}
          </p>
          {canAdminister && (
            <button
              onClick={handleOpenAddModal}
              className="mt-2 px-4 py-2 bg-[#1a3a8f] text-white text-xs font-bold rounded-xl hover:bg-[#122b6e] transition inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Batch</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBatches.map((batch) => {
            const isAssignedToCurrentUser =
              currentUserId && batch.instructorId === currentUserId;

            return (
              <div
                key={batch.id}
                className={`bg-white rounded-3xl border p-5 transition-all flex flex-col justify-between space-y-4 hover:shadow-md ${
                  isAssignedToCurrentUser
                    ? "border-indigo-300 bg-indigo-50/20 shadow-xs"
                    : "border-slate-200/90 shadow-2xs"
                }`}
              >
                {/* Card Top: Level, Status & Actions */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <LevelBadge level={batch.classLevel || "warrior"} />
                    <div className="flex items-center gap-1.5">
                      {renderStatusPill(batch.computedStatus, batch.seatsAvailable)}

                      {/* Edit / Delete strictly for Admin */}
                      {canAdminister && (
                        <div className="flex items-center gap-1 ml-1">
                          <button
                            onClick={() => handleOpenEditModal(batch)}
                            title="Edit Batch"
                            className="p-1.5 text-slate-400 hover:text-[#1a3a8f] hover:bg-slate-100 rounded-lg transition"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteBatch(batch)}
                            title="Delete Batch"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Intake */}
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-base leading-snug">
                      {batch.className}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Intake: {batch.classStartDate || "Rolling Admission"}</span>
                    </p>
                  </div>

                  {/* Details Grid: Schedule, Room, Instructor */}
                  <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Schedule</span>
                      </span>
                      <span className="font-extrabold text-slate-800 text-right">
                        {batch.schedule || `${batch.classDay} @ ${batch.startTime} - ${batch.endTime}`}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>Classroom</span>
                      </span>
                      <span className="font-bold text-slate-800">
                        {batch.classRoom || "Main Campus"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>Instructor</span>
                      </span>
                      <span
                        className={`font-bold truncate max-w-[140px] text-right ${
                          batch.instructorId ? "text-slate-800" : "text-amber-700"
                        }`}
                      >
                        {batch.instructorName}
                      </span>
                    </div>
                  </div>

                  {/* Notes / Description (if available) */}
                  {batch.notes && (
                    <p className="text-[11px] text-slate-600 bg-amber-50/60 p-2.5 rounded-xl border border-amber-100/80 line-clamp-2">
                      <span className="font-bold text-amber-900">Note: </span>
                      {batch.notes}
                    </p>
                  )}
                </div>

                {/* Card Bottom: Capacity Bar & Action Buttons */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {/* Capacity Progress Bar */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-extrabold text-slate-700 flex items-center gap-1">
                        <Users className="w-3 h-3 text-[#1a3a8f]" />
                        <span>{batch.studentCount} / {batch.maxCapacity} Enrolled</span>
                      </span>
                      <span
                        className={`font-black text-xs ${
                          batch.seatsAvailable === 0
                            ? "text-rose-600"
                            : batch.seatsAvailable <= 3
                            ? "text-amber-600"
                            : "text-emerald-700"
                        }`}
                      >
                        {batch.seatsAvailable} seat{batch.seatsAvailable === 1 ? "" : "s"} left
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          batch.seatsAvailable === 0
                            ? "bg-rose-500"
                            : batch.seatsAvailable <= 3
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${batch.occupancyRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Syllabus link or Actions */}
                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                    {batch.worksheetUrl ? (
                      <a
                        href={batch.worksheetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-bold text-slate-600 hover:text-[#1a3a8f] inline-flex items-center gap-1"
                      >
                        <span>Syllabus</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium">Standard Syllabus</span>
                    )}

                    {/* Actions container */}
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {/* Marketing Action */}
                      {role === "marketing" && (
                        <button
                          onClick={() => handleCopyMarketingBlurb(batch)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-extrabold shadow-xs transition flex items-center gap-1.5"
                        >
                          {copiedBatchId === batch.id ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Share2 className="w-3.5 h-3.5" />
                              <span>Share for Leads</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Admin Edit Batch */}
                      {canAdminister && (
                        <button
                          onClick={() => handleOpenEditModal(batch)}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#1a3a8f] rounded-xl text-[11px] font-extrabold transition flex items-center gap-1 border border-indigo-100"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      )}

                      {/* Operational Enrollment Action (Admin + Front Office) */}
                      {canEnroll && (
                        <button
                          onClick={() => setEnrollingBatch(batch)}
                          disabled={!batch.isAvailable}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition flex items-center gap-1.5 ${
                            batch.isAvailable
                              ? "bg-[#1a3a8f] hover:bg-[#122b6e] text-white shadow-xs cursor-pointer"
                              : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                          }`}
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>
                            {batch.isAvailable
                              ? "Enroll Student"
                              : batch.computedStatus === "full"
                              ? "Batch Full"
                              : batch.computedStatus === "cancelled"
                              ? "Cancelled"
                              : batch.computedStatus === "completed"
                              ? "Completed"
                              : "Unavailable"}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enroll Student / Transfer Modal */}
      {enrollingBatch && (
        <EnrollModal
          batch={enrollingBatch}
          students={studentsList}
          allClasses={classes}
          onClose={() => setEnrollingBatch(null)}
        />
      )}

      {/* Add / Edit Batch Modal (Admin only) */}
      {canAdminister && (
        <BatchModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          batch={editingBatch}
          instructors={instructors}
        />
      )}
    </div>
  );
}
