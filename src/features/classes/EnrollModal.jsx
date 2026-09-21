import { useState, useMemo } from "react";
import { UserPlus, ArrowRightLeft, X } from "lucide-react";
import { LevelBadge, isCompatible, useToast } from "../shared";
import {
  addStudentToClass,
  syncStudentsCurrentLevel,
  transferStudentBetweenClasses,
} from "./classesRepository";

export default function EnrollModal({
  batch,
  students = [],
  allClasses = [],
  onClose,
  onEnrolled = null,
}) {
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
    return students.filter((s) => (s.status || "active") === "active" && !enrolledSet.has(s.id));
  }, [students, enrolledSet]);

  // Students currently enrolled in other cohorts available for lateral transfer
  const transferCandidates = useMemo(() => {
    const list = [];
    allClasses.forEach((cls) => {
      if (cls.id === batchId) return;
      (cls.studentIds || []).forEach((sId) => {
        if (enrolledSet.has(sId)) return;
        const student = students.find((s) => s.id === sId && (s.status || "active") === "active");
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
    selectedStudent?.currentLevel && !isCompatible(selectedStudent.currentLevel, batch)
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
                {enrollMode === "transfer"
                  ? "Transfer Student to Batch"
                  : "Enroll Student into Batch"}
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
            <span>
              {batch.schedule || batch.classDay} · {batch.classRoom || "Main Campus"}
            </span>
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
                  All active students are already enrolled in this batch, or no students are
                  registered yet.
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
                      {cand.student.displayName || cand.student.name || cand.student.email} (from{" "}
                      {cand.sourceClass.className})
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
                Enrolling will update the student&apos;s recorded current level to{" "}
                {batch.classLevel}.
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
