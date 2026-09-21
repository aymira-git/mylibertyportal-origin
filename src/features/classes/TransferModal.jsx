import { useState, useMemo } from "react";
import {
  X,
  ArrowRightLeft,
  UserPlus,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Search,
} from "lucide-react";
import { LevelBadge, useToast, isCompatible } from "../shared";
import {
  transferStudentBetweenClasses,
  addStudentToClass,
  syncStudentsCurrentLevel,
} from "./classesRepository";

export default function TransferModal({
  isOpen = true,
  onClose,
  student,
  sourceClass = null,
  classes = [],
  users = [],
  onTransferred,
}) {
  const toast = useToast();

  const [targetClassId, setTargetClassId] = useState("");
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("Schedule adjustment");
  const [customReason, setCustomReason] = useState("");
  const [search, setSearch] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Instructor lookup map
  const instructorMap = useMemo(() => {
    const map = new Map();
    users.forEach((u) => {
      map.set(u.id, u.displayName || u.name || u.email || "Instructor");
    });
    return map;
  }, [users]);

  // Candidate target classes (exclude source class and any where student is already in)
  const candidateClasses = useMemo(() => {
    if (!student) return [];
    return classes
      .filter((c) => !sourceClass || c.id !== sourceClass.id)
      .filter((c) => !(c.studentIds || []).includes(student.id))
      .map((c) => {
        const studentCount = (c.studentIds || []).length;
        const capacity = Number(c.maxCapacity) || 15;
        const seatsAvailable = Math.max(0, capacity - studentCount);
        const isClosed = c.status === "cancelled" || c.status === "completed";
        return {
          ...c,
          studentCount,
          capacity,
          seatsAvailable,
          isAvailable: seatsAvailable > 0 && !isClosed,
          instructorName: c.instructorId
            ? instructorMap.get(c.instructorId) || "Instructor"
            : "To Be Assigned",
        };
      });
  }, [classes, sourceClass, student, instructorMap]);

  // Filtered target classes based on search
  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidateClasses;
    return candidateClasses.filter(
      (c) =>
        (c.className || "").toLowerCase().includes(q) ||
        (c.classLevel || "").toLowerCase().includes(q) ||
        (c.schedule || "").toLowerCase().includes(q) ||
        (c.classRoom || "").toLowerCase().includes(q) ||
        (c.instructorName || "").toLowerCase().includes(q)
    );
  }, [candidateClasses, search]);

  const selectedTargetClass = useMemo(() => {
    return candidateClasses.find((c) => c.id === targetClassId) || null;
  }, [candidateClasses, targetClassId]);

  const levelMismatch = Boolean(
    selectedTargetClass &&
    student?.currentLevel &&
    !isCompatible(student.currentLevel, selectedTargetClass)
  );

  if (!isOpen || !student) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetClassId) {
      toast("Please select a target batch to enroll or transfer into.", "error");
      return;
    }
    if (selectedTargetClass && selectedTargetClass.seatsAvailable <= 0) {
      toast("Cannot proceed: Selected batch has no remaining seats.", "error");
      return;
    }

    setTransferring(true);
    const finalReason = reason === "Other" ? customReason.trim() : reason;

    try {
      if (sourceClass) {
        await transferStudentBetweenClasses({
          sourceClass,
          targetClassId,
          targetClass: selectedTargetClass,
          studentId: student.id,
          dateTransferred: transferDate || new Date().toISOString().slice(0, 10),
          newLevel: selectedTargetClass?.classLevel || student.currentLevel,
          transferReason: finalReason || "Batch transfer",
        });

        toast(
          `Transferred ${student.displayName || "Student"} from ${sourceClass.className} to ${selectedTargetClass.className}.`,
          "success"
        );
      } else {
        const effectiveDate = transferDate || new Date().toISOString().slice(0, 10);
        const targetLevel = selectedTargetClass?.classLevel || student.currentLevel || "warrior";
        await addStudentToClass(targetClassId, {
          studentId: student.id,
          dateJoined: effectiveDate,
          level: targetLevel,
        });
        await syncStudentsCurrentLevel([student.id], targetLevel);

        toast(
          `Enrolled "${student.displayName || "Student"}" into ${selectedTargetClass.className}!`,
          "success"
        );
      }

      if (onTransferred) onTransferred();
      onClose();
    } catch (err) {
      console.error("Batch placement/transfer error:", err);
      toast("Failed to complete operation: " + (err.message || "Unknown error"), "error");
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-[#1a3a8f] flex items-center justify-center font-bold shrink-0">
              {sourceClass ? (
                <ArrowRightLeft className="w-5 h-5" />
              ) : (
                <UserPlus className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">
                {sourceClass ? "One-Click Batch Transfer" : "Enroll Student into Batch"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {sourceClass
                  ? "Atomically move student from their current cohort to an available batch."
                  : "Direct placement of student into an available cohort opening."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={transferring}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Transfer Context Summary: Source -> Target */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Student &amp; Current Cohort
            </p>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-black text-slate-900 text-sm">
                  {student.displayName || student.firstName || "Student"}
                </p>
                <p className="text-xs text-slate-500">
                  {student.email || student.phone || "Enrolled active student"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-500">Current Level:</span>
                <LevelBadge level={student.currentLevel || sourceClass?.classLevel || "warrior"} />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-600">
              <span className="font-semibold">Current Batch:</span>
              {sourceClass ? (
                <span className="font-extrabold text-[#1a3a8f]">{sourceClass.className}</span>
              ) : (
                <span className="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60">
                  Unassigned
                </span>
              )}
            </div>
          </div>

          {/* Select Target Batch */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700">
                Select Destination Batch <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] font-bold text-slate-400">
                {filteredCandidates.length} eligible cohorts
              </span>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search destination by name, schedule, or room..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none"
              />
            </div>

            {/* Candidate Cohorts List */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {filteredCandidates.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  No other active batches available for transfer.
                </div>
              ) : (
                filteredCandidates.map((cand) => {
                  const isSelected = targetClassId === cand.id;
                  const isAvailable = cand.isAvailable;

                  return (
                    <div
                      key={cand.id}
                      onClick={() => {
                        if (isAvailable) setTargetClassId(cand.id);
                      }}
                      className={`p-3 rounded-2xl border transition text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                        isSelected
                          ? "border-[#1a3a8f] bg-indigo-50/50 shadow-xs ring-1 ring-[#1a3a8f]"
                          : isAvailable
                            ? "border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
                            : "border-slate-200/60 bg-slate-100/60 opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-slate-900 truncate">
                            {cand.className}
                          </span>
                          <LevelBadge level={cand.classLevel || "warrior"} />
                          {cand.seatsAvailable <= 0 ? (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                              Full
                            </span>
                          ) : cand.seatsAvailable <= 3 ? (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              {cand.seatsAvailable} seats left
                            </span>
                          ) : (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              {cand.seatsAvailable} open
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{cand.schedule || "Regular schedule"}</span>
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{cand.classRoom || "Campus"}</span>
                          </span>
                          <span>·</span>
                          <span className="text-slate-600 font-semibold truncate max-w-[120px]">
                            {cand.instructorName}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <span className="text-[11px] font-bold text-slate-600">
                          {cand.studentCount} / {cand.capacity} seats
                        </span>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            isSelected
                              ? "border-[#1a3a8f] bg-[#1a3a8f] text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <CheckCircle className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Level track warning if target level differs from student */}
          {levelMismatch && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Level Track Change Detected</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {student.displayName} is currently recorded as{" "}
                <span className="font-bold uppercase">{student.currentLevel || "warrior"}</span>,
                while the selected batch is{" "}
                <span className="font-bold uppercase">{selectedTargetClass.classLevel}</span>.
                Completing this transfer will automatically update the student&apos;s active level
                to <strong>{selectedTargetClass.classLevel}</strong>.
              </p>
            </div>
          )}

          {/* Effective Date & Optional Reason */}
          <div
            className={`grid gap-3 pt-1 ${sourceClass ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}
          >
            <div className="space-y-1">
              <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700">
                {sourceClass ? "Transfer Effective Date" : "Enrollment Date"}
              </label>
              <input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none"
                required
              />
            </div>

            {/* Transfer Reason - only shown when transferring out of an existing cohort */}
            {sourceClass && (
              <div className="space-y-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700">
                  Reason for Transfer
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 focus:border-[#1a3a8f] outline-none"
                >
                  <option value="Schedule adjustment">Schedule adjustment / time conflict</option>
                  <option value="Level advancement">Level advancement / promotion</option>
                  <option value="Student request">Personal / student preference</option>
                  <option value="Cohort rebalancing">Cohort capacity rebalancing</option>
                  <option value="Other">Other reason...</option>
                </select>
              </div>
            )}
          </div>

          {sourceClass && reason === "Other" && (
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-600">Specify Reason</label>
              <input
                type="text"
                placeholder="Enter specific transfer note..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none"
                required
              />
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={transferring}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={transferring || !targetClassId}
              className="px-5 py-2.5 bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-extrabold text-xs rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {sourceClass ? (
                <ArrowRightLeft className="w-3.5 h-3.5" />
              ) : (
                <UserPlus className="w-3.5 h-3.5" />
              )}
              <span>
                {sourceClass
                  ? transferring
                    ? "Transferring..."
                    : "Confirm Transfer"
                  : transferring
                    ? "Enrolling..."
                    : "Confirm Enrollment"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
