/**
 * ApplicationRejectModal.jsx
 * Modal for capturing rejection reason and optional internal notes before
 * soft-archiving an applicant submission.
 */

import { useState } from "react";
import { X, AlertCircle, Loader2, Archive } from "lucide-react";

const REJECT_REASONS = [
  "Schedule conflict",
  "Unreachable / No response",
  "Outside age bracket",
  "Duplicate entry",
  "Other",
];

export default function ApplicationRejectModal({
  app,
  submitting = false,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState(REJECT_REASONS[0]);
  const [note, setNote] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitting) return;
    onConfirm({ reason, note });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
        {/* Header */}
        <div className="px-5 py-4 bg-rose-50/70 border-b border-rose-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-rose-950 text-sm">
                Reject &amp; Archive Application
              </h3>
              <p className="text-[11px] text-rose-700">
                Move submission to the archive repository
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 space-y-1">
            <p className="font-bold text-slate-900">{app?.displayName || "Applicant"}</p>
            <p className="text-[11px] text-slate-500">
              {app?.program || "General Program"} · {app?.phone || "No phone"}
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">
              Rejection Reason (Optional)
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2.5 border rounded-xl bg-white font-medium text-xs text-slate-800 focus:border-rose-500 outline-none"
            >
              {REJECT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px]">
              Internal Notes / Follow-up Context (Optional)
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Called 3x via WhatsApp, prospective student requested cancellation due to relocation..."
              className="w-full p-2.5 border rounded-xl text-xs text-slate-800 focus:border-rose-500 outline-none placeholder:text-slate-400"
            />
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            Archived applications can be reviewed in the <strong>Archived / Rejected</strong> view and restored to Pending at any time if the student reconnects.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="py-2 px-3.5 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="py-2 px-4 rounded-xl font-extrabold text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )}
              <span>Reject &amp; Archive</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
