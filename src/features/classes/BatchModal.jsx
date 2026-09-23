import { useState, useMemo } from "react";
import { checkDraftConflicts } from "./scheduleConflict";
import {
  X,
  BookOpen,
  FileText,
  Upload,
  Info,
} from "lucide-react";
import {
  useToast,
  uploadFileToCloudinary,
} from "../shared";
import { createClass, updateClass } from "./classesRepository";
import { DEFAULT_BRANCH, normalizeBranch } from "../../constants/branches";
import {
  getBatchProgram,
  getEnabledPrograms,
  getProgram,
  getProgramLevels,
  normalizeProgram,
} from "../../constants/programs";
import {
  normalizeBatchType,
  getBatchTypeDefaults,
} from "../../constants/batchTypes";
import {
  BatchTypeSelector,
  ProgramSelector,
  BatchPlacementRange,
  BatchConflictAlert,
} from "./BatchModalFormParts";
import {
  BatchBasicFields,
  BatchInstructorFields,
  BatchScheduleFields,
  BatchCapacityFields,
} from "./BatchModalDetailSections";

function BatchForm({ batch, instructors, existingClasses = [], onClose, onSuccess = null }) {
  const toast = useToast();
  const isEditing = Boolean(batch?.id);

  const [programId, setProgramId] = useState(
    batch ? getBatchProgram(batch) : "english_course"
  );
  const [batchType, setBatchType] = useState(
    batch?.batchType ? normalizeBatchType(batch.batchType) : "reguler"
  );
  const currentProgram = useMemo(() => getProgram(programId), [programId]);
  const currentLevels = useMemo(() => getProgramLevels(programId), [programId]);
  const enabledPrograms = useMemo(() => getEnabledPrograms(), []);

  const [className, setClassName] = useState(batch?.className || "");
  const [branch, setBranch] = useState(
    batch?.branch ? normalizeBranch(batch.branch) : DEFAULT_BRANCH
  );
  const [classLevel, setClassLevel] = useState(
    batch?.classLevel || currentLevels[0]?.id || "warrior"
  );
  const [minLevel, setMinLevel] = useState(
    batch?.minLevel || batch?.classLevel || currentLevels[0]?.id || "warrior"
  );
  const [maxLevel, setMaxLevel] = useState(
    batch?.maxLevel || batch?.classLevel || currentLevels[0]?.id || "warrior"
  );
  const [instructorId, setInstructorId] = useState(batch?.instructorId || "");
  const [substituteInstructorId, setSubstituteInstructorId] = useState(
    batch?.substituteInstructorId || ""
  );
  const [classDay, setClassDay] = useState(batch?.classDay || currentProgram.defaultDay || "Mon/Wed");
  const [classStartDate, setClassStartDate] = useState(
    batch?.classStartDate || new Date().toISOString().slice(0, 10)
  );
  const [startTime, setStartTime] = useState(batch?.startTime || currentProgram.defaultStartTime || "17:00");
  const [endTime, setEndTime] = useState(batch?.endTime || currentProgram.defaultEndTime || "18:30");
  const [classRoom, setClassRoom] = useState(
    batch?.classRoom && batch.classRoom !== "N/A" ? batch.classRoom : ""
  );
  const initialDefaults = useMemo(
    () =>
      getBatchTypeDefaults({
        batchType: batch?.batchType || "reguler",
        programId: batch ? getBatchProgram(batch) : "english_course",
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const [maxCapacity, setMaxCapacity] = useState(
    batch?.maxCapacity || initialDefaults.defaultCapacity || 15
  );
  const [minQuorum, setMinQuorum] = useState(
    batch?.minQuorum ?? initialDefaults.minQuorum ?? 4
  );
  const [status, setStatus] = useState(batch?.status || "open");
  const [notes, setNotes] = useState(batch?.notes || "");
  const [worksheetUrl, setWorksheetUrl] = useState(batch?.worksheetUrl || "");
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleBatchTypeChange = (newType) => {
    const normType = normalizeBatchType(newType);
    if (!isEditing) {
      const prevDefaults = getBatchTypeDefaults({ batchType, programId });
      const newDefaults = getBatchTypeDefaults({ batchType: normType, programId });
      if (Number(maxCapacity) === prevDefaults.defaultCapacity) {
        setMaxCapacity(newDefaults.defaultCapacity);
      }
      if (Number(minQuorum) === prevDefaults.minQuorum) {
        setMinQuorum(newDefaults.minQuorum);
      }
    }
    setBatchType(normType);
  };

  const handleProgramChange = (newProgId) => {
    const norm = normalizeProgram(newProgId);
    setProgramId(norm);
    const prog = getProgram(norm);
    const levels = getProgramLevels(norm);
    const defaultLvl = levels[0]?.id || "warrior";
    setClassLevel(defaultLvl);
    setMinLevel(defaultLvl);
    setMaxLevel(defaultLvl);
    if (!prog.allowedDays.includes(classDay)) {
      setClassDay(prog.defaultDay || prog.allowedDays[0] || "Mon/Wed");
    }
    if (!isEditing) {
      if (prog.defaultStartTime) setStartTime(prog.defaultStartTime);
      if (prog.defaultEndTime) setEndTime(prog.defaultEndTime);
      if (batchType === "reguler") {
        const prevDefaults = getBatchTypeDefaults({ batchType: "reguler", programId });
        const newDefaults = getBatchTypeDefaults({ batchType: "reguler", programId: norm });
        if (Number(maxCapacity) === prevDefaults.defaultCapacity) {
          setMaxCapacity(newDefaults.defaultCapacity);
        }
        if (Number(minQuorum) === prevDefaults.minQuorum) {
          setMinQuorum(newDefaults.minQuorum);
        }
      }
    }
  };

  // Exclude non-active instructors from assignment dropdown, but preserve current
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
      branch,
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
    branch,
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
        programId: normalizeProgram(programId),
        batchType: normalizeBatchType(batchType),
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
        branch: branch ? normalizeBranch(branch) : DEFAULT_BRANCH,
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
          className="p-2 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        {hasConflicts && <BatchConflictAlert conflicts={conflicts} />}

        <BatchTypeSelector batchType={batchType} onSelect={handleBatchTypeChange} />

        <ProgramSelector
          programId={programId}
          currentProgram={currentProgram}
          enabledPrograms={enabledPrograms}
          onSelect={handleProgramChange}
        />

        {/* Cohort Name, Level, & Branch */}
        <BatchBasicFields
          className={className}
          onClassNameChange={setClassName}
          classLevel={classLevel}
          onClassLevelChange={(newLvl) => {
            setClassLevel(newLvl);
            if (minLevel === classLevel && maxLevel === classLevel) {
              setMinLevel(newLvl);
              setMaxLevel(newLvl);
            }
          }}
          programId={programId}
          currentLevels={currentLevels}
          branch={branch}
          onBranchChange={setBranch}
        />

        <BatchPlacementRange
          currentLevels={currentLevels}
          minLevel={minLevel}
          maxLevel={maxLevel}
          onMinChange={setMinLevel}
          onMaxChange={setMaxLevel}
        />

        {/* Instructor, Substitute & Room */}
        <BatchInstructorFields
          instructorId={instructorId}
          onInstructorChange={setInstructorId}
          substituteInstructorId={substituteInstructorId}
          onSubstituteChange={setSubstituteInstructorId}
          classRoom={classRoom}
          onClassRoomChange={setClassRoom}
          assignableInstructors={assignableInstructors}
        />

        {/* Schedule Days, Times, Start Date */}
        <BatchScheduleFields
          classDay={classDay}
          onClassDayChange={setClassDay}
          startTime={startTime}
          onStartTimeChange={setStartTime}
          endTime={endTime}
          onEndTimeChange={setEndTime}
          classStartDate={classStartDate}
          onClassStartDateChange={setClassStartDate}
          currentProgram={currentProgram}
        />

        {/* Seat Capacity, Quorum & Status */}
        <BatchCapacityFields
          maxCapacity={maxCapacity}
          onMaxCapacityChange={setMaxCapacity}
          minQuorum={minQuorum}
          onMinQuorumChange={setMinQuorum}
          status={status}
          onStatusChange={setStatus}
        />

        {/* Notes / Promotional Blurb */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Batch Details / Promotional Notes</span>
          </label>
          <textarea
            rows={2}
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
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-extrabold text-xs rounded-xl shadow-xs transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
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
  onSuccess = null,
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
