import { Sparkles, X } from "lucide-react";
import { BRANCHES } from "../../constants/branches.js";
import { DIVISIONS, DIVISION_LABELS } from "../../constants/divisions.js";
import { STAFF_ROLES, STAFF_ROLE_LABELS } from "../staff/staffUtils.js";

export function CorporateEventModal({
  showModal,
  onClose,
  onSubmit,
  formData,
  setFormData,
  submitting,
  onAudienceTypeChange,
}) {
  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-[#1a3a8f] rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-slate-800 text-base">Schedule Corporate Event</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Event Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Annual Staff Training Summit"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1a3a8f] transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Event Date (WITA) <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={formData.eventDate}
              onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1a3a8f] transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Start Time <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1a3a8f] transition"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                End Time <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#1a3a8f] transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Audience Scope <span className="text-rose-500">*</span>
            </label>
            <select
              value={formData.audienceType}
              onChange={(e) => onAudienceTypeChange(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-[#1a3a8f] transition cursor-pointer"
            >
              <option value="all">Everyone (All Students, Staff & Managers)</option>
              <option value="branch">By Campus Branch</option>
              <option value="division">By Division (Courses vs Kindergarten)</option>
              <option value="role">By Staff Role</option>
            </select>
          </div>

          {formData.audienceType === "branch" && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Branch <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.audienceValue}
                onChange={(e) => setFormData({ ...formData, audienceValue: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-[#1a3a8f] transition cursor-pointer"
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.audienceType === "division" && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Division <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.audienceValue}
                onChange={(e) => setFormData({ ...formData, audienceValue: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-[#1a3a8f] transition cursor-pointer"
              >
                {DIVISIONS.map((d) => (
                  <option key={d} value={d}>
                    {DIVISION_LABELS[d] || d}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.audienceType === "role" && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Select Role <span className="text-rose-500">*</span>
              </label>
              <select
                value={formData.audienceValue}
                onChange={(e) => setFormData({ ...formData, audienceValue: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white focus:outline-none focus:border-[#1a3a8f] transition cursor-pointer"
              >
                {STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {STAFF_ROLE_LABELS[r] || r}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-[#1a3a8f] hover:bg-[#152e72] rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Save Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
