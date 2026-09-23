import { Calendar, Clock, MapPin, Users, User } from "lucide-react";
import { LevelBadge } from "../shared";
import { BRANCHES } from "../../constants/branches";

export function BatchBasicFields({
  className,
  onClassNameChange,
  classLevel,
  onClassLevelChange,
  programId,
  currentLevels,
  branch,
  onBranchChange,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
      <div className="sm:col-span-2 space-y-1">
        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Batch Title *
        </label>
        <input
          type="text"
          required
          placeholder="e.g. Cambridge B1 - Evening Cohort"
          value={className}
          onChange={(e) => onClassNameChange(e.target.value)}
          className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Level Track *
          </label>
          <LevelBadge level={classLevel} programId={programId} showStars={true} />
        </div>
        <select
          value={classLevel}
          onChange={(e) => onClassLevelChange(e.target.value)}
          className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition capitalize"
        >
          {currentLevels.map((lvl) => (
            <option key={lvl.id} value={lvl.id}>
              {lvl.label} {lvl.stars ? `(${"⭐".repeat(lvl.stars)})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Campus Branch *
        </label>
        <select
          value={branch}
          onChange={(e) => onBranchChange(e.target.value)}
          className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
        >
          {BRANCHES.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function BatchInstructorFields({
  instructorId,
  onInstructorChange,
  substituteInstructorId,
  onSubstituteChange,
  classRoom,
  onClassRoomChange,
  assignableInstructors,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div className="space-y-1">
        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
          <User className="w-3.5 h-3.5 text-[#1a3a8f]" />
          <span>Assigned Instructor</span>
        </label>
        <select
          value={instructorId}
          onChange={(e) => onInstructorChange(e.target.value)}
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
          onChange={(e) => onSubstituteChange(e.target.value)}
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
          onChange={(e) => onClassRoomChange(e.target.value)}
          className="w-full p-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-slate-50 focus:bg-white focus:border-[#1a3a8f] outline-none transition"
        />
      </div>
    </div>
  );
}

export function BatchScheduleFields({
  classDay,
  onClassDayChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  classStartDate,
  onClassStartDateChange,
  currentProgram,
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-100">
      <div className="space-y-1">
        <label className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
          <span>Frequency / Days</span>
        </label>
        <select
          value={classDay}
          onChange={(e) => onClassDayChange(e.target.value)}
          className="w-full p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:border-[#1a3a8f] outline-none"
        >
          {currentProgram.allowedDays.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
          {!currentProgram.allowedDays.includes(classDay) && (
            <option value={classDay}>{classDay} (Current / Legacy)</option>
          )}
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
          onChange={(e) => onStartTimeChange(e.target.value)}
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
          onChange={(e) => onEndTimeChange(e.target.value)}
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
          onChange={(e) => onClassStartDateChange(e.target.value)}
          className="w-full p-2 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:border-[#1a3a8f] outline-none"
        />
      </div>
    </div>
  );
}

export function BatchCapacityFields({
  maxCapacity,
  onMaxCapacityChange,
  minQuorum,
  onMinQuorumChange,
  status,
  onStatusChange,
}) {
  return (
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
          onChange={(e) => onMaxCapacityChange(e.target.value)}
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
          onChange={(e) => onMinQuorumChange(e.target.value)}
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
          onChange={(e) => onStatusChange(e.target.value)}
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
  );
}
