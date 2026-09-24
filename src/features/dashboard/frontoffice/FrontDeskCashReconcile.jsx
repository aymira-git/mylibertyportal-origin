import { useState, useEffect, useCallback, useMemo } from "react";
import { getPaymentsForRecordedDay } from "../../finance/paymentsRepository";
import { summarizePaymentsByMethod } from "../../finance/financeUtils";
import { formatIDR } from "../../finance/receiptMessages";
import { matchesBranchFilter, normalizeBranch } from "../../../constants/branches";
import { todayWita } from "../../../utils/dateWita";
import { useToast } from "../../shared";
import ShiftReconciliationModal from "./ShiftReconciliationModal";
import {
  Wallet,
  ArrowDownCircle,
  QrCode,
  CreditCard,
  RefreshCw,
  Copy,
  Check,
  Building2,
  Calendar,
  LogOut,
} from "lucide-react";

/**
 * End-of-Shift Cash Reconciliation & Daily Intake Summary for Front Office.
 *
 * Guarantees that ALL payments for the current WITA calendar day are fetched
 * (NO artificial limit cap), computing exact Cash, Transfer, and QRIS totals.
 * Optionally filters payments to a specific branch when students/branchLabel are provided.
 */
export default function FrontDeskCashReconcile({
  branchLabel = null,
  students = [],
  activeShift = null,
  currentUser = {},
  onShiftClosed = null,
}) {
  const toast = useToast();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState("");
  const [showReconcileModal, setShowReconcileModal] = useState(false);

  const todayStr = todayWita();

  const studentBranchMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(students)) {
      for (const s of students) {
        if (s?.id) {
          map.set(s.id, normalizeBranch(s.branch));
        }
      }
    }
    return map;
  }, [students]);

  const loadDailyPayments = useCallback(async () => {
    setLoading(true);
    try {
      const list = await getPaymentsForRecordedDay(new Date());
      setPayments(list);
      setLastRefreshed(
        new Date().toLocaleTimeString("id-ID", {
          timeZone: "Asia/Makassar",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " WITA"
      );
    } catch (err) {
      console.error("Failed to load daily payments for reconciliation:", err);
      toast("Failed to load today's reconciliation payments.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    let active = true;
    getPaymentsForRecordedDay(new Date())
      .then((list) => {
        if (active) {
          setPayments(list);
          setLastRefreshed(
            new Date().toLocaleTimeString("id-ID", {
              timeZone: "Asia/Makassar",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }) + " WITA"
          );
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Failed to load daily payments for reconciliation:", err);
          toast("Failed to load today's reconciliation payments.", "error");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [toast]);

  const filteredPayments = useMemo(() => {
    if (!branchLabel || branchLabel === "all" || studentBranchMap.size === 0) {
      return payments;
    }
    return payments.filter((p) => {
      const b = studentBranchMap.get(p.studentId);
      return matchesBranchFilter(b, branchLabel);
    });
  }, [payments, branchLabel, studentBranchMap]);

  const summary = useMemo(() => {
    return summarizePaymentsByMethod(filteredPayments);
  }, [filteredPayments]);

  const handleCopySummary = () => {
    const lines = [
      `*MY LIBERTY FRONT DESK CASH RECONCILIATION*`,
      `Date: ${todayStr} (WITA)`,
      branchLabel ? `Branch: ${branchLabel}` : `Scope: All Front Desk Transactions`,
      `---------------------------------`,
      `💵 Cash (Drawer): ${formatIDR(summary.cashTotal)}`,
      `🏦 Bank Transfer: ${formatIDR(summary.transferTotal)}`,
      `📱 QRIS: ${formatIDR(summary.qrisTotal)}`,
      summary.otherTotal > 0 ? `🔹 Other: ${formatIDR(summary.otherTotal)}` : null,
      `---------------------------------`,
      `*TOTAL REVENUE: ${formatIDR(summary.grandTotal)}*`,
      `Total Transactions: ${summary.count} receipts`,
      `Reconciled At: ${lastRefreshed || "Today"}`,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast("Shift report copied to clipboard! Ready to share with Manager.", "success");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <span>Today&apos;s Desk Cash Reconciliation</span>
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Shift Closing
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                {todayStr} (WITA)
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-400" />
                {branchLabel || "Front Desk Register"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeShift && (
            <button
              onClick={() => setShowReconcileModal(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>End Shift &amp; Count Drawer</span>
            </button>
          )}

          <button
            onClick={loadDailyPayments}
            disabled={loading}
            title="Refresh Totals"
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleCopySummary}
            disabled={summary.count === 0}
            className="px-3.5 py-2 rounded-xl bg-[#1a3a8f] text-white hover:bg-[#153075] text-xs font-bold transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied!" : "Copy Shift Handover"}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
          <div className="flex items-center justify-between text-emerald-800 font-bold text-[11px]">
            <span>Cash (Drawer)</span>
            <ArrowDownCircle className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-base font-black text-emerald-950 mt-1">
            {formatIDR(summary.cashTotal)}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100">
          <div className="flex items-center justify-between text-blue-800 font-bold text-[11px]">
            <span>Bank Transfer</span>
            <CreditCard className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-base font-black text-blue-950 mt-1">
            {formatIDR(summary.transferTotal)}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100">
          <div className="flex items-center justify-between text-purple-800 font-bold text-[11px]">
            <span>QRIS</span>
            <QrCode className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <p className="text-base font-black text-purple-950 mt-1">
            {formatIDR(summary.qrisTotal)}
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-100/80 border border-slate-200">
          <div className="flex items-center justify-between text-slate-700 font-bold text-[11px]">
            <span>Grand Total ({summary.count} tx)</span>
            <Wallet className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <p className="text-base font-black text-slate-900 mt-1">
            {formatIDR(summary.grandTotal)}
          </p>
        </div>
      </div>

      {lastRefreshed && (
        <p className="text-[10px] text-slate-400 font-medium text-right">
          Last reconciled at {lastRefreshed}
        </p>
      )}

      {showReconcileModal && (
        <ShiftReconciliationModal
          isOpen={showReconcileModal}
          onClose={() => setShowReconcileModal(false)}
          activeShift={activeShift}
          expectedCash={summary.cashTotal}
          expectedQris={summary.qrisTotal}
          currentUser={currentUser}
          onSuccess={() => {
            onShiftClosed?.();
            loadDailyPayments();
          }}
        />
      )}
    </div>
  );
}
