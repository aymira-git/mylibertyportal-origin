import { useState, useMemo } from "react";
import { formatIDR } from "../../finance/receiptMessages";
import {
  calculateCashDiscrepancyThreshold,
  clockOutShiftWithCashReconciliation,
} from "../../attendance/shiftsRepository";
import { useToast } from "../../shared";
import {
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Lock,
  X,
  ArrowRight,
  Sparkles,
} from "lucide-react";

/**
 * ShiftReconciliationModal
 * Front Desk Shift Closing & Physical Cash Drawer Count Dialog.
 *
 * Prompts staff to count actual cash and QRIS amounts, compares against expected
 * totals recorded in the system, highlights discrepancies, and auto-routes
 * to Branch Manager approval queue if discrepancy exceeds the threshold.
 */
export default function ShiftReconciliationModal({
  isOpen,
  onClose,
  activeShift,
  expectedCash = 0,
  expectedQris = 0,
  currentUser = /** @type {any} */ ({}),
  onSuccess,
}) {
  const toast = useToast();
  const [countedCashInput, setCountedCashInput] = useState("");
  const [countedQrisInput, setCountedQrisInput] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Auto-fill convenience
  const handleAutoFillExpected = () => {
    setCountedCashInput(String(expectedCash));
    setCountedQrisInput(String(expectedQris));
  };

  const countedCash = Number(countedCashInput) || 0;
  const countedQris = Number(countedQrisInput) || 0;

  const totalExpected = expectedCash + expectedQris;
  const totalCounted = countedCash + countedQris;
  const discrepancy = totalCounted - totalExpected;

  const threshold = useMemo(() => {
    return calculateCashDiscrepancyThreshold(totalExpected);
  }, [totalExpected]);

  const exceedsThreshold = Math.abs(discrepancy) > threshold;

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeShift?.id) {
      toast("No active shift found to reconcile.", "error");
      return;
    }

    if (exceedsThreshold && !notes.trim()) {
      toast("Please provide an explanatory note for the discrepancy.", "warning");
      return;
    }

    setSubmitting(true);
    try {
      await clockOutShiftWithCashReconciliation(activeShift.id, {
        clockOutAt: new Date(),
        countedCash,
        countedQris,
        expectedCash,
        expectedQris,
        notes,
        requester: {
          name: currentUser.displayName || currentUser.name || "Front Desk Staff",
          uid: currentUser.uid,
          role: currentUser.role || "frontoffice",
        },
      });

      if (exceedsThreshold) {
        toast(
          `Shift closed with discrepancy of ${formatIDR(Math.abs(discrepancy))}. Escalated to Branch Manager for review.`,
          "warning"
        );
      } else {
        toast("Shift closed and cash drawer reconciled successfully!", "success");
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error("Failed to reconcile shift:", err);
      toast("Failed to submit shift reconciliation: " + err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center font-bold text-indigo-300">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight leading-none text-white">
                Shift End Cash Count
              </h2>
              <p className="text-xs text-indigo-200 mt-1">
                Physical drawer reconciliation &amp; handover
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Expected Summary Banner */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500 font-bold block">Expected Register Intake</span>
              <span className="font-extrabold text-slate-800 text-sm">
                {formatIDR(totalExpected)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Cash: {formatIDR(expectedCash)} • QRIS: {formatIDR(expectedQris)}
              </span>
            </div>
            <button
              type="button"
              onClick={handleAutoFillExpected}
              className="px-2.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs flex items-center gap-1 transition cursor-pointer border border-indigo-200"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Match Expected</span>
            </button>
          </div>

          {/* Actual Input Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">
                Actual Physical Cash (IDR)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(e.target.value)}
                placeholder="e.g. 1500000"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase text-slate-600 mb-1">
                Actual Verified QRIS (IDR)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={countedQrisInput}
                onChange={(e) => setCountedQrisInput(e.target.value)}
                placeholder="e.g. 500000"
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
              />
            </div>
          </div>

          {/* Live Discrepancy Indicator */}
          <div
            className={`p-4 rounded-2xl border text-xs ${
              exceedsThreshold
                ? "bg-amber-50/90 border-amber-200 text-amber-900"
                : discrepancy === 0
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-900"
                : "bg-blue-50/90 border-blue-200 text-blue-900"
            }`}
          >
            <div className="flex items-center justify-between font-bold">
              <div className="flex items-center gap-2">
                {exceedsThreshold ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <span>
                  {discrepancy === 0
                    ? "Drawer Perfectly Balanced"
                    : discrepancy > 0
                    ? `Over by ${formatIDR(discrepancy)}`
                    : `Short by ${formatIDR(Math.abs(discrepancy))}`}
                </span>
              </div>
              <span className="font-black text-sm">
                Counted: {formatIDR(totalCounted)}
              </span>
            </div>

            {exceedsThreshold && (
              <div className="mt-2.5 pt-2 border-t border-amber-200/80 text-[11px] leading-relaxed text-amber-800">
                <span className="font-extrabold flex items-center gap-1 text-amber-900">
                  <Lock className="w-3.5 h-3.5" />
                  Dual-Control Escalation Triggered:
                </span>
                Discrepancy exceeds tolerance threshold ({formatIDR(threshold)}). This shift will
                automatically be flagged in the <strong>Branch Manager Approval Queue</strong> for review.
              </div>
            )}
          </div>

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-600 mb-1">
              Shift Notes / Discrepancy Reason {exceedsThreshold && <span className="text-red-500">*</span>}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                exceedsThreshold
                  ? "Required: Explain reason for cash variance or handover notes..."
                  : "Optional handover or drawer notes for incoming staff..."
              }
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>{submitting ? "Clocking Out..." : "Confirm & Clock Out"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
