import { X, UserCheck, Calendar, Sparkles, UserPlus } from "lucide-react";
import { getEnabledPrograms, getProgram } from "../../../constants/programs";

export function WalkInModal({
  isOpen,
  onClose,
  formData,
  setFormData,
  calculatedAge,
  tierOptions,
  submitting,
  onSubmit,
  canEnrollImmediately,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-xs max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#1a3a8f]" />
            <span>Log Walk-In Visitor / Prospect</span>
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ enrollImmediately: false });
          }}
          className="space-y-3.5"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">
                Parent / Visitor Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ibu Maria"
                value={formData.parentName}
                onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
              />
            </div>

            <div>
              <label className="font-extrabold text-slate-700 block mb-1">
                WhatsApp Phone Number *
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 081234567890"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
              />
            </div>

            <div>
              <label className="font-extrabold text-slate-700 block mb-1">
                Child / Student Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Kevin"
                value={formData.studentName}
                onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
              />
            </div>

            {/* Date of Birth with instant calculated age */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-extrabold text-slate-700 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Date of Birth</span>
                </label>
                {calculatedAge !== null && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-extrabold text-[10px] inline-flex items-center gap-1 animate-in fade-in">
                    <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                    <span>{calculatedAge} years old</span>
                  </span>
                )}
              </div>
              <input
                type="date"
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
              />
            </div>
          </div>

          {/* Fluency Tier & School/Grade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-extrabold text-slate-700 block mb-1">
                Approximate Fluency Tier
              </label>
              <select
                value={formData.fluencyTier}
                onChange={(e) => {
                  const selectedId = e.target.value;
                  const matched = tierOptions.find((t) => t.id === selectedId);
                  setFormData({
                    ...formData,
                    fluencyTier: selectedId,
                    currentLevel: matched?.defaultLevel || "warrior",
                  });
                }}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:bg-white focus:border-[#1a3a8f] outline-none cursor-pointer"
              >
                {tierOptions.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.starText} {tier.label} ({tier.levelsText})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-extrabold text-slate-700 block mb-1">
                Current Grade / School (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Grade 3 / SD Negeri 1"
                value={formData.ageOrGrade}
                onChange={(e) => setFormData({ ...formData, ageOrGrade: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
              />
            </div>
          </div>

          {/* Program of Interest Dropdown */}
          <div>
            <label className="font-extrabold text-slate-700 block mb-1">
              Program of Interest
            </label>
            <select
              value={formData.programId}
              onChange={(e) => {
                const chosenId = e.target.value;
                const prog = getProgram(chosenId);
                setFormData({
                  ...formData,
                  programId: chosenId,
                  program: prog?.label || chosenId,
                });
              }}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs focus:bg-white focus:border-[#1a3a8f] outline-none cursor-pointer"
            >
              {getEnabledPrograms().map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Inquiry Notes */}
          <div>
            <label className="font-extrabold text-slate-700 block mb-1">Inquiry Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Inquired about weekend morning classes, requested schedule and pricing"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full p-2.5 border border-slate-200 rounded-xl font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
            />
          </div>

          {/* Modal Action Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold shadow-xs disabled:opacity-50 transition cursor-pointer"
            >
              {submitting ? "Saving..." : "Save Prospect Only"}
            </button>

            {canEnrollImmediately && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => onSubmit({ enrollImmediately: true })}
                className="px-4 py-2.5 rounded-xl bg-[#1a3a8f] text-white hover:bg-[#153075] font-bold shadow-xs disabled:opacity-50 transition flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{submitting ? "Saving..." : "Save & Enroll Immediately"}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
