import {
  LevelBadge,
  LEVELS,
  LEVEL_LIST,
  TIERS,
  TIER_KEYS,
  getTier,
  PAYMENT_PLANS,
  PAYMENT_PLAN_KEYS,
} from "../shared";
import { STANDARD_BRANCHES } from "../staff/staffUtils";
import { normalizeBranch } from "../../constants/branches";
import { getEnabledPrograms, getProgram, normalizeProgram } from "../../constants/programs";
import {
  normalizeBatchType,
  getBatchTypeLabel,
  getBatchTypeList,
} from "../../constants/batchTypes";

export default function StudentAcademicFields({ formData, field, setAcademicLevel, editId }) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-black uppercase tracking-wider text-[#1a3a8f] flex items-center gap-1.5">
        <span>🏫</span> Academic &amp; Enrollment Details
      </h4>

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
                  // If already in this tier, keep the specific level; otherwise default to tier's starting level
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
        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {editId && (
            <div>
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
          <div className={editId ? "" : "sm:col-span-2"}>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Tuition Payment Plan Preference
            </label>
            <select
              value={formData.paymentPlan || "monthly"}
              onChange={(e) => field("paymentPlan", e.target.value)}
              className="w-full p-2.5 border rounded-xl bg-white font-bold text-xs capitalize text-slate-800 focus:border-[#1a3a8f] outline-none"
            >
              {PAYMENT_PLAN_KEYS.map((pKey) => {
                const p = PAYMENT_PLANS[pKey];
                return (
                  <option key={pKey} value={pKey}>
                    {p.label} ({p.termName})
                    {p.discountPercent > 0 ? ` — Save ${p.discountPercent}%` : ""}
                  </option>
                );
              })}
              <option value="custom">Custom (Flexible / Manual Billing)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
