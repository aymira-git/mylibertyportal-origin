import { useState, useMemo } from "react";
import { BookOpen, Plus, Search } from "lucide-react";
import { LEVELS, LEVEL_KEYS, TIERS, TIER_KEYS, getTier, useToast, useConfirm } from "../shared";
import BatchModal from "./BatchModal";
import EnrollModal from "./EnrollModal";
import BatchesOverviewWidget from "./BatchesOverviewWidget";
import AvailableBatchCard from "./AvailableBatchCard";
import { deleteClass } from "./classesRepository";
import { copyText } from "../../utils/copyText";
import { getRegistrationUrl } from "../../constants/externalLinks";
import { BRANCHES, matchesBranchFilter } from "../../constants/branches";

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
  const [branchFilter, setBranchFilter] = useState("all");
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
        ? instructorMap.get(cls.instructorId) || cls.instructorName || "Assigned Instructor"
        : cls.instructorName || "Unassigned (TBA)";

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
    const fillingFastCount = augmentedBatches.filter(
      (b) => b.computedStatus === "filling_fast"
    ).length;
    const openBatchesCount = augmentedBatches.filter((b) => b.isAvailable).length;
    const overallOccupancy =
      totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

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
        if (branchFilter !== "all" && !matchesBranchFilter(b.branch, branchFilter)) return false;
        if (tierFilter !== "all" && getTier(b.classLevel) !== tierFilter) return false;
        if (levelFilter !== "all" && b.classLevel !== levelFilter) return false;
        if (statusFilter === "open" && (!b.isAvailable || b.seatsAvailable <= 0)) return false;
        if (statusFilter === "filling_fast" && b.computedStatus !== "filling_fast") return false;
        if (statusFilter === "upcoming" && b.computedStatus !== "upcoming") return false;
        if (statusFilter === "full" && b.computedStatus !== "full" && b.seatsAvailable > 0)
          return false;
        if (
          statusFilter === "completed" &&
          b.computedStatus !== "completed" &&
          b.computedStatus !== "cancelled"
        )
          return false;
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
  }, [augmentedBatches, tierFilter, levelFilter, statusFilter, branchFilter, search]);

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

  const handleCopyMarketingBlurb = async (batch) => {
    const regUrl = getRegistrationUrl();
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

    const res = await copyText(text);
    if (res.ok) {
      setCopiedBatchId(batch.id);
      toast("Batch promo details copied to clipboard for WhatsApp & social!", "success");
      setTimeout(() => setCopiedBatchId(null), 2500);
    } else {
      toast("Could not access clipboard: " + (res.error || "Blocked"), "error");
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // COMPACT OVERVIEW WIDGET VIEW (For Admin / Front Office / Manager / Instructor)
  // ──────────────────────────────────────────────────────────────────────────
  if (isOverviewWidget) {
    return (
      <>
        <BatchesOverviewWidget
          augmentedBatches={augmentedBatches}
          stats={stats}
          canAdminister={canAdminister}
          canEnroll={canEnroll}
          onOpenAddModal={handleOpenAddModal}
          onOpenEditModal={handleOpenEditModal}
          onNavigateToClasses={onNavigateToClasses}
          onSetEnrollingBatch={setEnrollingBatch}
        />

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
            existingClasses={classes}
          />
        )}
      </>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FULL AVAILABLE BATCHES VIEW (For Classes Tab across all Dashboards)
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 w-full">
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
              Monitor seat capacity, schedules, room allocations, and student enrollment status
              across the academy.
            </p>
          </div>

          {canAdminister && (
            <button
              onClick={handleOpenAddModal}
              className="px-4 py-2.5 bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
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
            <p className="text-[10px] text-amber-700 font-medium mt-0.5">High demand cohorts</p>
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
                  <span
                    className={`text-[10px] font-normal ${isSelected ? "text-indigo-200" : "text-slate-400"}`}
                  >
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

          {/* Campus Branch Filter */}
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 focus:border-[#1a3a8f] outline-none"
          >
            <option value="all">All Campuses</option>
            {BRANCHES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
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
              className="mt-2 px-4 py-2 bg-[#1a3a8f] text-white text-xs font-bold rounded-xl hover:bg-[#122b6e] transition inline-flex items-center gap-1.5 cursor-pointer"
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
              currentUserId &&
              (batch.instructorId === currentUserId ||
                batch.substituteInstructorId === currentUserId);

            return (
              <AvailableBatchCard
                key={batch.id}
                batch={batch}
                isAssignedToCurrentUser={isAssignedToCurrentUser}
                canAdminister={canAdminister}
                canEnroll={canEnroll}
                role={role}
                copiedBatchId={copiedBatchId}
                onOpenEditModal={handleOpenEditModal}
                onDeleteBatch={handleDeleteBatch}
                onCopyMarketingBlurb={handleCopyMarketingBlurb}
                onSetEnrollingBatch={setEnrollingBatch}
              />
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
          existingClasses={classes}
        />
      )}
    </div>
  );
}
