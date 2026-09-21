import { useState, useMemo } from "react";
import { checkDraftConflicts } from "./scheduleConflict";
import {
  X,
  BookOpen,
  Calendar,
  Clock,
  MapPin,
  Users,
  User,
  FileText,
  Upload,
  Info,
} from "lucide-react";
import {
  LEVELS,
  LEVEL_KEYS,
  TIERS,
  LevelBadge,
  getStarText,
  useToast,
  uploadFileToCloudinary,
} from "../shared";
import { createClass, updateClass } from "./classesRepository";

function BatchForm({ batch, instructors, existingClasses = [], onClose, onSuccess }) {
  const toast = useToast();
  const isEditing = Boolean(batch?.id);

  const [className, setClassName] = useState(batch?.className || "");
  const [classLevel, setClassLevel] = useState(batch?.classLevel || "warrior");
  const [minLevel, setMinLevel] = useState(batch?.minLevel || batch?.classLevel || "warrior");
  const [maxLevel, setMaxLevel] = useState(batch?.maxLevel || batch?.classLevel || "warrior");
  const [instructorId, setInstructorId] = useState(batch?.instructorId || "");
  const [substituteInstructorId, setSubstituteInstructorId] = useState(
    batch?.substituteInstructorId || ""
  );
  const [classDay, setClassDay] = useState(batch?.classDay || "Mon/Wed");
  const [classStartDate, setClassStartDate] = useState(
    batch?.classStartDate || new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState(batch?.startTime || "17:00");
  const [endTime, setEndTime] = useState(batch?.endTime || "18:30");
  const [classRoom, setClassRoom] = useState(
    batch?.classRoom && batch.classRoom !== "N/A" ? batch.classRoom : ""
  );
  const [maxCapacity, setMaxCapacity] = useState(batch?.maxCapacity || 15);
  const [minQuorum, setMinQuorum] = useState(batch?.minQuorum ?? 4);
  const [status, setStatus] = useState(batch?.status || "open");
  const [notes, setNotes] = useState(batch?.notes || "");
  const [worksheetUrl, setWorksheetUrl] = useState(batch?.worksheetUrl || "");
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);

  // Exclude non-active instructors from assignment dropdown, but preserve the currently assigned instructor if already attached
  const assignableInstructors = useMemo(() => {
    return instructors.filter(
      (inst) => (inst.status || "active") === "active" || inst.id === instructorId
    );
  }, [instructors, instructorId]);

  // Live collision detection against existing classes
  const conflicts = useMemo(() => {
    const draft = {
      id: batch?.id,
      classDay,
      startTime,
      endTime,
      instructorId,
      classRoom,
      status: status || "open",
      className: className || "(New Batch)",
    };
    return checkDraftConflicts(draft, existingClasses);
  }, [
    batch?.id,
    classDay,
    startTime,
    endTime,
    instructorId,
    classRoom,
    status,
    className,
    existingClasses,
  ]);

  const hasConflicts = conflicts.teacherConflicts.length > 0 || conflicts.roomConflicts.length > 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!className.trim()) {
      toast("Please provide a batch title.", "error");
      return;
    }

    setSaving(true);
    try {
      let finalFileUrl = worksheetUrl;
      if (selectedFile) {
        finalFileUrl = await uploadFileToCloudinary(selectedFile);
      }

      const scheduleFormatted = `${classDay} @ ${startTime} - ${endTime}`;

      const selectedInstructor = instructors.find((i) => i.id === instructorId);
      const instructorName = selectedInstructor
        ? selectedInstructor.displayName ||
          selectedInstructor.name ||
          selectedInstructor.email ||
          ""
        : "";

      const selectedSub = instructors.find((i) => i.id === substituteInstructorId);
      const substituteInstructorName = selectedSub
        ? selectedSub.displayName || selectedSub.name || selectedSub.email || ""
        : "";

      const payload = {
        className: className.trim(),
        classLevel,
        minLevel: minLevel || classLevel,
        maxLevel: maxLevel || classLevel,
        instructorId: instructorId || "",
        instructorName: instructorName || "",
        substituteInstructorId: substituteInstructorId || null,
        substituteInstructorName: substituteInstructorName || null,
        classDay,
        classStartDate,
        startTime,
        endTime,
        schedule: scheduleFormatted,
        classRoom: classRoom.trim() || "Main Campus",
        maxCapacity: Number(maxCapacity) || 15,
        minQuorum: Number(minQuorum) || 4,
        status: status || "open",
        notes: notes.trim(),
        worksheetUrl: finalFileUrl || "",
        updatedAt: new Date().toISOString(),
      };

      if (isEditing) {
        await updateClass(batch.id, payload);
        toast(`Batch "${className}" updated successfully.`, "success");
      } else {
        const createPayload = {
          ...payload,
          studentIds: [],
          enrollments: [],
          createdAt: new Date().toISOString(),
        };
        await createClass(createPayload);
        toast(`New batch "${className}" added to available batches!`, "success");
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Batch save error:", err);
      toast("Failed to save batch: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#1a3a8f] text-white flex items-center justify-center shadow-xs">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg">
              {isEditing ? "Edit Available Batch" : "Add Available Class Batch"}
            </h3>
            <p className="text-xs text-slate-500">
              {isEditing
                ? "Update batch schedule, room, instructor, and seat capacity."
                : "Set up a new student batch open for enrollment across the academy."}
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

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        {/* Live Schedule Conflict Alert */}
        {hasConflicts && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 space-y-2">
            <p className="text-xs font-extrabold text-rose-800 flex items-center gap-1.5">
              <span className="text-base">⚠️</span>
              <span>Schedule Conflict Detected</span>
            </p>
            {conflicts.teacherConflicts.map((c, i) => (
              <p key={`t-${i}`} className="text-[11px] text-rose-700 font-medium pl-6">
                🧑‍🏫 {c.detail}
              </p>
            ))}
            {conflicts.roomConflicts.map((c, i) => (
              <p key={`r-${i}`} className="text-[11px] text-rose-700 font-medium pl-6">
                🏫 {c.detail}
              </p>
            ))}
            <p className="text-[10px] text-rose-600 font-medium pl-6 italic">
              You can still save, but the timetable clash should be resolved to avoid on-site
              confusion.
            </p>
          </div>
        )}

        {/* Cohort Name & Level */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Batch Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Cambridge B1 - Evening Cohort"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Level Track *
              </label>
              <LevelBadge level={classLevel} showStars={true} showTier={true} />
            </div>
            <select
              value={classLevel}
              onChange={(e) => {
                const newLvl = e.target.value;
                setClassLevel(newLvl);
                if (minLevel === classLevel && maxLevel === classLevel) {
                  setMinLevel(newLvl);
                  setMaxLevel(newLvl);
                }
              }}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition capitalize"
            >
              {LEVEL_KEYS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {LEVELS[lvl]?.label} ({getStarText(lvl)} {TIERS[LEVELS[lvl]?.tier]?.label})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Option B: Eligible Placement Range */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between text-slate-700">
            <span className="text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 text-[#1a3a8f]">
              <span>🎯</span> Eligible Placement Range (Option B)
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Controls which student levels qualify for enrollment
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">
                Minimum Level
              </label>
              <select
                value={minLevel}
                onChange={(e) => setMinLevel(e.target.value)}
                className="w-full p-2 border rounded-xl bg-white text-xs font-semibold capitalize"
              >
                {LEVEL_KEYS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {LEVELS[lvl]?.label} ({LEVELS[lvl]?.stars}★)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 uppercase mb-0.5">
                Maximum Level
              </label>
              <select
                value={maxLevel}
                onChange={(e) => setMaxLevel(e.target.value)}
                className="w-full p-2 border rounded-xl bg-white text-xs font-semibold capitalize"
              >
                {LEVEL_KEYS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {LEVELS[lvl]?.label} ({LEVELS[lvl]?.stars}★)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Instructor, Substitute & Room */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-[#1a3a8f]" />
              <span>Assigned Instructor</span>
            </label>
            <select
              value={instructorId}
              onChange={(e) => setInstructorId(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            >
              <option value="">-- Unassigned (TBA) --</option>
              {assignableInstructors.map((inst) => {
                const isInactive = inst.status && inst.status !== "active";
                return (
                  <option key={inst.id} value={inst.id}>
                    {inst.displayName || inst.name || inst.email}
                    {isInactive ? " (Inactive / Assigned)" : ` (${inst.role || "Instructor"})`}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-amber-600" />
              <span>Substitute (Optional)</span>
            </label>
            <select
              value={substituteInstructorId}
              onChange={(e) => setSubstituteInstructorId(e.target.value)}
              className="w-full p-2.5 border border-amber-200 rounded-xl text-xs sm:text-sm font-semibold bg-amber-50/40 focus:bg-white focus:border-amber-600 outline-none transition"
            >
              <option value="">-- No Substitute --</option>
              {assignableInstructors
                .filter((inst) => inst.id !== instructorId)
                .map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.displayName || inst.name || inst.email}
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              <span>Room / Classroom</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Studio Lab 2"
              value={classRoom}
              onChange={(e) => setClassRoom(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            />
          </div>
        </div>

        {/* Schedule Days, Times, Start Date */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-100">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Frequency / Days</span>
            </label>
            <select
              value={classDay}
              onChange={(e) => setClassDay(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:border-[#1a3a8f] outline-none"
            >
              <option value="Mon/Wed">Mon / Wed</option>
              <option value="Tue/Thu">Tue / Thu</option>
              <option value="Sat Only">Sat Only</option>
              <option value="Sat/Sun">Sat / Sun (Weekend)</option>
              <option value="Everyday">Sat - Thu (Intensive)</option>
              {classDay === "Fri Only" && <option value="Fri Only">Fri Only (Legacy)</option>}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Start Time</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:border-[#1a3a8f] outline-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>End Time</span>
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:border-[#1a3a8f] outline-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Intake Date</span>
            </label>
            <input
              type="date"
              value={classStartDate}
              onChange={(e) => setClassStartDate(e.target.value)}
              className="w-full p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:border-[#1a3a8f] outline-none"
            />
          </div>
        </div>

        {/* Seat Capacity, Quorum & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#1a3a8f]" />
              <span>Max Capacity (Seats)</span>
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            />
            <p className="text-[10px] text-slate-400">Default is 15 students per batch.</p>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-amber-600" />
              <span>Min Quorum</span>
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={minQuorum}
              onChange={(e) => setMinQuorum(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            />
            <p className="text-[10px] text-slate-400">Alert if fewer than this many enrolled.</p>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Enrollment Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            >
              <option value="open">🟢 Open for Enrollment</option>
              <option value="upcoming">🔵 Upcoming / Registration Only</option>
              <option value="in_progress">⚪ Ongoing / In Progress</option>
              <option value="full">🔴 Full / Waitlist</option>
              <option value="completed">🟣 Completed / Archived</option>
              <option value="cancelled">⛔ Cancelled</option>
            </select>
          </div>
        </div>

        {/* Notes / Promotional Blurb */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Batch Details / Promotional Notes</span>
          </label>
          <textarea
            rows="2"
            placeholder="e.g. Focus on conversational fluency, Cambridge test prep, age 12-16..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
          />
        </div>

        {/* Syllabus / Worksheet PDF Link or File */}
        <div className="space-y-1.5 pt-1 border-t border-slate-100">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            <span>Syllabus / Worksheet (PDF or Link)</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              placeholder="https://... (or choose a file below)"
              value={worksheetUrl}
              onChange={(e) => setWorksheetUrl(e.target.value)}
              className="flex-1 p-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white outline-none"
            />
            <label className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>{selectedFile ? selectedFile.name.slice(0, 15) + "..." : "Upload File"}</span>
              <input
                type="file"
                accept=".pdf,.doc,.docx,image/*"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-extrabold text-xs rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? "Saving Batch..." : isEditing ? "Save Changes" : "Create Available Batch"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function BatchModal({
  isOpen,
  onClose,
  batch = null,
  instructors = [],
  existingClasses = [],
  onSuccess,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <BatchForm
        key={batch?.id || "new"}
        batch={batch}
        instructors={instructors}
        existingClasses={existingClasses}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </div>
  );
}
