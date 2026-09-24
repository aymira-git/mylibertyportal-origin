import { useState } from "react";
import {
  LevelBadge,
  LEVELS,
  LEVEL_LIST,
  TIERS,
  TIER_KEYS,
  getTier,
} from "../shared";
import { STANDARD_BRANCHES } from "../staff/staffUtils";
import { normalizeBranch } from "../../constants/branches";
import { getEnabledPrograms, getProgram, normalizeProgram } from "../../constants/programs";
import {
  normalizeBatchType,
  getBatchTypeLabel,
  getBatchTypeList,
} from "../../constants/batchTypes";
import { Award, Plus, Trash2 } from "lucide-react";
import { todayWita } from "../../utils/dateWita";

export default function StudentAcademicFields({ formData, field, setAcademicLevel, editId }) {
  const [showAddTest, setShowAddTest] = useState(false);
  const [testScore, setTestScore] = useState("");
  const [testLevel, setTestLevel] = useState(formData.currentLevel || "warrior");
  const [testTester, setTestTester] = useState("");
  const [testDate, setTestDate] = useState(() => todayWita());
  const [testNotes, setTestNotes] = useState("");

  const placementTests = Array.isArray(formData.placementTests) ? formData.placementTests : [];

  const handleAddPlacementTest = () => {
    if (!testLevel) return;
    const newTest = {
      id: `pt-${Date.now()}`,
      score: testScore !== "" ? Number(testScore) : null,
      assessedLevel: testLevel,
      testedBy: testTester.trim() || "Staff",
      testedAt: testDate || todayWita(),
      notes: testNotes.trim(),
    };
    const updatedTests = [...placementTests, newTest];
    field("placementTests", updatedTests);
    setAcademicLevel(testLevel);
    setShowAddTest(false);
    setTestScore("");
    setTestNotes("");
  };

  const handleRemoveTest = (idx) => {
    const updated = placementTests.filter((_, i) => i !== idx);
    field("placementTests", updated);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-xs font-black uppercase tracking-wider text-[#1a3a8f] flex items-center gap-1.5">
        <span>🏫</span> Academic &amp; Enrollment Details
      </h4>

      {/* Placement Tests History Section */}
      <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black">
              <Award className="w-3.5 h-3.5" />
            </div>
            <div>
              <label className="block text-[11px] font-extrabold text-amber-950 uppercase tracking-wider">
                Placement Test History ({placementTests.length})
              </label>
              <p className="text-[10px] text-amber-800">
                Log and view official assessment scores and recommended placement levels.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddTest(!showAddTest)}
            className="px-2.5 py-1 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold text-[11px] transition inline-flex items-center gap-1 shadow-2xs cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>{showAddTest ? "Cancel" : "Add Test"}</span>
          </button>
        </div>

        {/* Existing Test List */}
        {placementTests.length > 0 ? (
          <div className="space-y-1.5 pt-1">
            {placementTests.map((pt, idx) => (
              <div
                key={pt.id || idx}
                className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-amber-200/70 shadow-2xs"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-slate-900 bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                    {pt.score != null ? `${pt.score} pts` : "Assessed"}
                  </span>
                  <span className="font-black text-[#1a3a8f] capitalize">
                    {pt.assessedLevel || "Warrior"}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    by {pt.testedBy || "Staff"} on {pt.testedAt || "-"}
                  </span>
                  {pt.notes && (
                    <span className="text-[11px] text-slate-600 italic">
                      — &quot;{pt.notes}&quot;
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveTest(idx)}
                  className="text-slate-400 hover:text-red-600 p-1 transition cursor-pointer"
                  title="Remove test entry"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          !showAddTest && (
            <p className="text-[11px] text-amber-700/80 italic">
              No placement test recorded yet. Default baseline level applied.
            </p>
          )
        )}

        {/* Inline Add Test Form */}
        {showAddTest && (
          <div className="p-3 bg-white rounded-xl border border-amber-300 space-y-2.5 animate-in fade-in">
            <h5 className="text-[11px] font-bold text-slate-800">Record New Placement Assessment</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                  Score (0-100)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 85"
                  value={testScore}
                  onChange={(e) => {
                    setTestScore(e.target.value);
                    const n = Number(e.target.value);
                    if (!isNaN(n) && e.target.value !== "") {
                      if (n >= 85) setTestLevel("epic");
                      else if (n >= 65) setTestLevel("master");
                      else setTestLevel("warrior");
                    }
                  }}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                  Assessed Level *
                </label>
                <select
                  value={testLevel}
                  onChange={(e) => setTestLevel(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs font-bold capitalize"
                >
                  {LEVEL_LIST.map((lvl) => (
                    <option key={lvl.id} value={lvl.id}>
                      {lvl.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                  Tester / Assessor
                </label>
                <input
                  type="text"
                  placeholder="Staff name"
                  value={testTester}
                  onChange={(e) => setTestTester(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                  Test Date
                </label>
                <input
                  type="date"
                  value={testDate}
                  onChange={(e) => setTestDate(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                  Test Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fluent speaking, place in Master"
                  value={testNotes}
                  onChange={(e) => setTestNotes(e.target.value)}
                  className="w-full p-2 border border-slate-200 rounded-lg text-xs font-medium"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddTest(false)}
                className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddPlacementTest}
                className="px-3 py-1.5 rounded-lg bg-[#1a3a8f] text-white font-bold text-xs hover:bg-[#153075] transition shadow-xs cursor-pointer"
              >
                Save Placement Test
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fluency Tier & Academic Level Placement */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <label className="block text-[11px] font-extrabold text-[#1a3a8f] uppercase tracking-wider">
              Fluency Tier &amp; Placement Level *
            </label>
            <p className="text-[11px] text-slate-500">
              Determines eligible batches and cohort placement. Select a quick tier shortcut
              or pick the exact track.
            </p>
          </div>
          {formData.currentLevel && (
            <LevelBadge level={formData.currentLevel} showStars={true} showTier={true} />
          )}
        </div>

        {/* 3-Tier Shortcut Buttons */}
        <div className="grid grid-cols-3 gap-2">
          {TIER_KEYS.map((tierKey) => {
            const tier = TIERS[tierKey];
            const currentTier = getTier(formData.currentLevel);
            const isSelected = currentTier === tierKey;
            return (
              <button
                key={tierKey}
                type="button"
                onClick={() => {
                  if (!tier.levels.includes(formData.currentLevel)) {
                    setAcademicLevel(tier.levels[0]);
                  }
                }}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                  isSelected
                    ? "bg-[#1a3a8f] text-white border-[#1a3a8f] shadow-xs"
                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100"
                }`}
              >
                <span className="text-sm font-black">{tier.starText}</span>
                <span className="text-xs font-extrabold">{tier.label}</span>
                <span
                  className={`text-[10px] ${isSelected ? "text-indigo-200" : "text-slate-500"}`}
                >
                  {tier.levels.map((l) => LEVELS[l]?.label).join(" / ")}
                </span>
              </button>
            );
          })}
        </div>

        {/* Exact Level Track Dropdown */}
        <div className="pt-1">
          <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
            Specific Academic Track (Stored Level)
          </label>
          <select
            value={formData.currentLevel || "warrior"}
            onChange={(e) => setAcademicLevel(e.target.value)}
            className="w-full p-2.5 border rounded-xl bg-white font-bold text-xs capitalize text-slate-800 focus:border-[#1a3a8f] outline-none"
          >
            {LEVEL_LIST.map((lvl) => (
              <option key={lvl.id} value={lvl.id}>
                {lvl.label} ({lvl.starText || "⭐".repeat(lvl.stars)} {TIERS[lvl.tier]?.label}
                )
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Branch (Pilihan Cabang)
          </label>
          <select
            value={normalizeBranch(formData.branch)}
            onChange={(e) => field("branch", e.target.value)}
            className="w-full p-2.5 border rounded-xl bg-white font-bold text-xs"
          >
            {STANDARD_BRANCHES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
            {formData.branch && !STANDARD_BRANCHES.includes(formData.branch) && (
              <option value={formData.branch}>{formData.branch}</option>
            )}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Program
          </label>
          <select
            value={formData.programId || normalizeProgram(formData.program)}
            onChange={(e) => {
              const chosenId = e.target.value;
              const prog = getProgram(chosenId);
              field("programId", chosenId);
              field("program", prog.label);
            }}
            className="w-full p-2.5 border rounded-xl bg-white font-semibold text-xs text-slate-800"
          >
            {getEnabledPrograms().map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
            {formData.program &&
              !getEnabledPrograms().some(
                (p) =>
                  p.id === formData.programId ||
                  p.label === formData.program ||
                  p.id === formData.program
              ) && <option value={formData.program}>{formData.program}</option>}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Batch Type (Jenis Kelas)
          </label>
          <select
            value={normalizeBatchType(formData.batchType || formData.classType)}
            onChange={(e) => {
              const norm = normalizeBatchType(e.target.value);
              field("batchType", norm);
              field("classType", getBatchTypeLabel(norm));
            }}
            className="w-full p-2.5 border rounded-xl bg-white font-semibold"
          >
            {getBatchTypeList().map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Joined Date (Tanggal Bergabung)
          </label>
          <input
            type="date"
            value={formData.joinedDate || ""}
            onChange={(e) => field("joinedDate", e.target.value)}
            className="w-full p-2.5 border rounded-xl bg-white font-semibold"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            School / Company (Sekolah/Pekerjaan)
          </label>
          <input
            type="text"
            placeholder="e.g. SMA Negeri 1 / Universitas"
            value={formData.schoolOrJob || ""}
            onChange={(e) => field("schoolOrJob", e.target.value)}
            className="w-full p-2.5 border rounded-xl"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
            Grade / Semester (Kelas/Semester)
          </label>
          <input
            type="text"
            placeholder="e.g. Kelas 10 / Semester 4"
            value={formData.classOrSemester || ""}
            onChange={(e) => field("classOrSemester", e.target.value)}
            className="w-full p-2.5 border rounded-xl"
          />
        </div>
        {editId && (
          <div className="md:col-span-3">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Student Lifecycle Status *
            </label>
            <select
              value={formData.status || "active"}
              onChange={(e) => field("status", e.target.value)}
              className="w-full p-2.5 border rounded-xl bg-white font-bold text-xs capitalize text-slate-800 focus:border-[#1a3a8f] outline-none"
            >
              <option value="active">🟢 Active (Currently Enrolled &amp; Attending)</option>
              <option value="on_leave">🟡 On Leave (Temporary Pause / Break)</option>
              <option value="graduated">🟣 Graduated (Completed Course / Program)</option>
              <option value="inactive">⚪ Inactive (Withdrawn / Dropped Out)</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
