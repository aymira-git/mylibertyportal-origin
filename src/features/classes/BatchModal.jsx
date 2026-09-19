import { useState } from "react";
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
  Info
} from "lucide-react";
import { LEVELS, useToast, uploadFileToCloudinary } from "../shared";
import { createClass, updateClass } from "./classesRepository";

function BatchForm({ batch, instructors, onClose, onSuccess }) {
  const toast = useToast();
  const isEditing = Boolean(batch?.id);

  const [className, setClassName] = useState(batch?.className || "");
  const [classLevel, setClassLevel] = useState(batch?.classLevel || "warrior");
  const [instructorId, setInstructorId] = useState(batch?.instructorId || "");
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
  const [status, setStatus] = useState(batch?.status || "open");
  const [notes, setNotes] = useState(batch?.notes || "");
  const [worksheetUrl, setWorksheetUrl] = useState(batch?.worksheetUrl || "");
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);

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
        ? selectedInstructor.displayName || selectedInstructor.name || selectedInstructor.email || ""
        : "";

      const payload = {
        className: className.trim(),
        classLevel,
        instructorId: instructorId || "",
        instructorName: instructorName || "",
        classDay,
        classStartDate,
        startTime,
        endTime,
        schedule: scheduleFormatted,
        classRoom: classRoom.trim() || "Main Campus",
        maxCapacity: Number(maxCapacity) || 15,
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
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Level Track *
            </label>
            <select
              value={classLevel}
              onChange={(e) => setClassLevel(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition uppercase"
            >
              {Object.entries(LEVELS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Instructor & Room */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <option value="">-- Leave Unassigned (TBA) --</option>
              {instructors.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.displayName || inst.name || inst.email} ({inst.role || "Instructor"})
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
              placeholder="e.g. Studio Lab 2 / Oxford Hall"
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
              <option value="Fri Only">Fri Only</option>
              <option value="Sat Only">Sat Only</option>
              <option value="Sat/Sun">Sat / Sun (Weekend)</option>
              <option value="Everyday">Mon - Fri (Intensive)</option>
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

        {/* Seat Capacity & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-[#1a3a8f]" />
              <span>Max Student Capacity (Seats)</span>
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
            />
            <p className="text-[10px] text-slate-400">
              Default is 15 students per batch.
            </p>
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
  onSuccess
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <BatchForm
        key={batch?.id || "new"}
        batch={batch}
        instructors={instructors}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </div>
  );
}
