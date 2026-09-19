import { useState } from "react";
import { X, ShieldAlert, Check } from "lucide-react";
import { adjustShiftWithAudit } from "./shiftsRepository";
import { useToast } from "../shared";

const REASON_CODES = [
  { id: "forgot_clock_out", label: "Forgot to Clock Out" },
  { id: "forgot_clock_in", label: "Forgot to Clock In" },
  { id: "wrong_class", label: "Wrong Class Selected" },
  { id: "system_error", label: "System / Device Error" },
  { id: "other", label: "Other / Administrative Adjustment" },
];

export default function ShiftAdjustmentModal({
  shift,
  actor,
  onClose,
  onSuccess,
}) {
  const toast = useToast();
  const [clockIn, setClockIn] = useState(
    shift?.clockIn ? new Date(shift.clockIn).toISOString().slice(0, 16) : ""
  );
  const [clockOut, setClockOut] = useState(
    shift?.clockOut ? new Date(shift.clockOut).toISOString().slice(0, 16) : ""
  );
  const [reasonCode, setReasonCode] = useState(
    shift?.autoClosed ? "forgot_clock_out" : "other"
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!shift) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!clockIn) {
      toast("Clock-in time is required.", "error");
      return;
    }

    try {
      setSaving(true);
      const afterData = {
        clockIn: new Date(clockIn).toISOString(),
        clockOut: clockOut ? new Date(clockOut).toISOString() : null,
      };

      await adjustShiftWithAudit({
        shiftId: shift.id,
        beforeShift: shift,
        afterData,
        reasonCode,
        note: note.trim(),
        actorId: actor?.uid || "admin",
        actorName: actor?.displayName || "Administrator",
      });

      toast("Shift successfully adjusted and audited.", "success");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error("Shift adjust error:", err);
      toast("Failed to adjust shift: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleForceClockOut = () => {
    setClockOut(new Date().toISOString().slice(0, 16));
    setReasonCode("forgot_clock_out");
    setNote((prev) => prev || "Force closed by admin at current time.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-amber-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Audited Shift Adjustment
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {shift.displayName} ({shift.role}) — {shift.className || "General Duty"}
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
          {shift.autoClosed && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 font-medium">
              ⚠️ This shift was auto-closed by the system due to a missing clock-out. Please review and adjust the actual exit time below.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 uppercase text-[10px]">
                Clock-In Time *
              </label>
              <input
                type="datetime-local"
                value={clockIn}
                onChange={(e) => setClockIn(e.target.value)}
                required
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:bg-white focus:border-[#1a3a8f] outline-none"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="font-bold text-slate-700 uppercase text-[10px]">
                  Clock-Out Time
                </label>
                {!clockOut && (
                  <button
                    type="button"
                    onClick={handleForceClockOut}
                    className="text-[10px] text-amber-700 font-extrabold hover:underline"
                  >
                    Force Close Now
                  </button>
                )}
              </div>
              <input
                type="datetime-local"
                value={clockOut}
                onChange={(e) => setClockOut(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:bg-white focus:border-[#1a3a8f] outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 uppercase text-[10px]">
              Correction Reason Code *
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:bg-white focus:border-[#1a3a8f] outline-none"
            >
              {REASON_CODES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 uppercase text-[10px]">
              Audit Note / Explanation *
            </label>
            <textarea
              rows="2"
              placeholder="e.g. Verified with front desk log that teacher departed at 17:30..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
              className="w-full p-2.5 border border-slate-200 rounded-xl bg-slate-50 font-medium focus:bg-white focus:border-[#1a3a8f] outline-none"
            />
          </div>

          <p className="text-[10px] text-slate-400 italic">
            This correction will be recorded in the immutable shiftAuditEvents collection with your admin ID and timestamp.
          </p>

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
              <span>{saving ? "Saving Audit..." : "Commit Correction"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
