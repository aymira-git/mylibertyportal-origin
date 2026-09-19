import { useState } from "react";
import { X, Calendar, Check, AlertCircle } from "lucide-react";
import { logStaffLeave } from "./shiftsRepository";
import { useToast } from "../shared";

const LEAVE_TYPES = [
  { id: "sakit", label: "Sakit (Sick Leave)", desc: "Requires medical/doctor note" },
  { id: "izin", label: "Izin (Permitted Absence)", desc: "Personal or family emergency" },
  { id: "cuti", label: "Cuti (Annual / Scheduled Leave)", desc: "Pre-approved vacation/break" },
  { id: "dinas_luar", label: "Dinas Luar (Official Duty)", desc: "Off-site course competition/event" },
];

export default function StaffLeaveModal({
  staff = [],
  actor,
  onClose,
  onSuccess,
}) {
  const toast = useToast();
  const todayStr = new Date().toISOString().slice(0, 10);

  const [userId, setUserId] = useState("");
  const [type, setType] = useState("sakit");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [dayPortion, setDayPortion] = useState("full");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userId) {
      toast("Please select a staff member.", "error");
      return;
    }
    if (startDate > endDate) {
      toast("End date cannot be earlier than start date.", "error");
      return;
    }

    const selectedStaff = staff.find((s) => s.id === userId);

    try {
      setSaving(true);
      await logStaffLeave({
        userId,
        displayNameSnapshot: selectedStaff?.displayName || selectedStaff?.name || "Staff Member",
        type,
        startDate,
        endDate,
        dayPortion,
        note: note.trim(),
        createdBy: actor?.uid || "admin",
      });

      toast(`Leave logged for ${selectedStaff?.displayName || "staff member"}.`, "success");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Staff leave error:", err);
      toast("Failed to log leave: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-indigo-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#1a3a8f] text-white flex items-center justify-center shadow-xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Log Staff Absence / Leave
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Official absence recording (Sakit, Izin, Cuti, Dinas Luar)
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-700 uppercase text-[10px]">
              Select Staff Member *
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:bg-white focus:border-[#1a3a8f] outline-none"
            >
              <option value="">-- Choose Staff Member --</option>
              {staff
                .filter((s) => s.role !== "manager" && s.role !== "student")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName || s.name || s.email} ({s.role})
                  </option>
                ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 uppercase text-[10px]">
              Leave Category *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {LEAVE_TYPES.map((lt) => (
                <button
                  key={lt.id}
                  type="button"
                  onClick={() => setType(lt.id)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                    type === lt.id
                      ? "border-[#1a3a8f] bg-indigo-50/60 text-[#1a3a8f] font-extrabold"
                      : "border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-medium"
                  }`}
                >
                  <p className="text-xs">{lt.label}</p>
                  <p className="text-[10px] text-slate-400 font-normal">{lt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 uppercase text-[10px]">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:bg-white focus:border-[#1a3a8f] outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 uppercase text-[10px]">
                End Date *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:bg-white focus:border-[#1a3a8f] outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 uppercase text-[10px]">
              Day Portion
            </label>
            <div className="flex gap-2">
              {[
                { id: "full", label: "Full Day" },
                { id: "half_morning", label: "Half Day (Morning)" },
                { id: "half_afternoon", label: "Half Day (Afternoon)" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDayPortion(p.id)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                    dayPortion === p.id
                      ? "border-[#1a3a8f] bg-[#1a3a8f] text-white"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 uppercase text-[10px]">
              Reference / Doctor&apos;s Note
            </label>
            <input
              type="text"
              placeholder="e.g. Surat Dokter No. 12/RSUD/IX, or family permit notice..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500">
            <AlertCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>
              Approved leave exempts instructors from unexcused absence calculations in monthly reports.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#1a3a8f] hover:bg-[#122b6e] text-white font-extrabold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : "Approve & Log Leave"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
