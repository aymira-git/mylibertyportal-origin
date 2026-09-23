import { getBatchType, getBatchTypeList } from "../../constants/batchTypes";

export function BatchTypeSelector({ batchType, onSelect }) {
  return (
    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Batch Type (Tipe Batch) *
        </label>
        <span
          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
            getBatchType(batchType).badgeBg
          }`}
        >
          {getBatchType(batchType).label}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {getBatchTypeList().map((t) => (
          <button
            type="button"
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`p-2.5 rounded-xl text-xs font-bold border transition text-left cursor-pointer ${
              batchType === t.id
                ? "bg-[#1a3a8f] text-white border-[#1a3a8f] shadow-xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-extrabold">{t.label}</span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                  batchType === t.id ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {t.shortLabel}
              </span>
            </div>
            <div
              className={`text-[10px] font-normal line-clamp-2 mt-1 ${
                batchType === t.id ? "text-indigo-100" : "text-slate-400"
              }`}
            >
              {t.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProgramSelector({ programId, currentProgram, enabledPrograms, onSelect }) {
  return (
    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Educational Program *
        </label>
        <span
          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${currentProgram.badgeBg}`}
        >
          {currentProgram.label}
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {enabledPrograms.map((prog) => (
          <button
            type="button"
            key={prog.id}
            onClick={() => onSelect(prog.id)}
            className={`p-2 rounded-xl text-xs font-bold border transition text-left ${
              programId === prog.id
                ? "bg-[#1a3a8f] text-white border-[#1a3a8f] shadow-xs"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <div className="truncate">{prog.shortLabel || prog.label}</div>
            <div
              className={`text-[9px] font-normal truncate ${
                programId === prog.id ? "text-indigo-100" : "text-slate-400"
              }`}
            >
              {prog.scheduleType === "daily_school" ? "Mon-Fri School" : "Course Cohort"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function BatchPlacementRange({ currentLevels, minLevel, maxLevel, onMinChange, onMaxChange }) {
  return (
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
            onChange={(e) => onMinChange(e.target.value)}
            className="w-full p-2 border rounded-xl bg-white text-xs font-semibold capitalize"
          >
            {currentLevels.map((lvl) => (
              <option key={lvl.id} value={lvl.id}>
                {lvl.label} {lvl.stars ? `(${lvl.stars}★)` : ""}
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
            onChange={(e) => onMaxChange(e.target.value)}
            className="w-full p-2 border rounded-xl bg-white text-xs font-semibold capitalize"
          >
            {currentLevels.map((lvl) => (
              <option key={lvl.id} value={lvl.id}>
                {lvl.label} {lvl.stars ? `(${lvl.stars}★)` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export function BatchConflictAlert({ conflicts }) {
  return (
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
  );
}
