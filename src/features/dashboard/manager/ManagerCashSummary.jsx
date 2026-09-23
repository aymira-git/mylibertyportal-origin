import { useState, useMemo } from "react";
import { formatIDR } from "../../finance/receiptMessages";
import { summarizePaymentsByMethod } from "../../finance/financeUtils";
import { todayWita } from "../../../utils/dateWita";
import { useToast } from "../../shared";
import {
  Wallet,
  Building2,
  RefreshCw,
  Copy,
  Check,
  CreditCard,
  QrCode,
  ArrowDownCircle,
} from "lucide-react";

/**
 * Manager Daily Cash Drawer & Revenue Summary Component.
 *
 * Provides operations managers with real-time financial oversight scoped to their branch,
 * computing exact cash drawer, bank transfers, QRIS, and total collection for WITA today.
 *
 * @param {{
 *   branch: string,
 *   payments: Array<any>,
 *   loading?: boolean,
 *   onRefresh?: () => void,
 *   isScopedToBranch?: boolean,
 *   onToggleBranchScope?: () => void
 * }} props
 */
export function ManagerCashSummary({
  branch = "Kota Gorontalo",
  payments = [],
  loading = false,
  onRefresh = null,
  isScopedToBranch = true,
  onToggleBranchScope = null,
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const summary = useMemo(() => {
    return summarizePaymentsByMethod(payments);
  }, [payments]);

  const handleCopySummary = () => {
    const lines = [
      `*MY LIBERTY MANAGER DAILY CASH REPORT*`,
      `Date: ${todayStr} (WITA)`,
      `Branch: ${isScopedToBranch ? branch : "All Branches (Consolidated)"}`,
      `---------------------------------`,
      `💵 Cash (Drawer Intake): ${formatIDR(summary.cashTotal)}`,
      `🏦 Bank Transfer: ${formatIDR(summary.transferTotal)}`,
      `📱 QRIS: ${formatIDR(summary.qrisTotal)}`,
      summary.otherTotal > 0 ? `🔹 Other: ${formatIDR(summary.otherTotal)}` : null,
      `---------------------------------`,
      `*TOTAL REVENUE TODAY: ${formatIDR(summary.grandTotal)}*`,
      `Transactions: ${summary.count} receipts`,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast("Cash intake summary copied to clipboard.", "success");
    setTimeout(() => setCopied(false), 2200);
  };

  const todayStr = todayWita();

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-slate-800">
                Today&apos;s Cash Drawer &amp; Intake
              </h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {isScopedToBranch ? branch : "All Branches"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Exact receipts recorded today ({todayStr} WITA) by Front Office cashiers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onToggleBranchScope && (
            <button
              onClick={onToggleBranchScope}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 transition cursor-pointer"
            >
              {isScopedToBranch ? "View All Branches" : `Scope to ${branch}`}
            </button>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition disabled:opacity-50 cursor-pointer"
              title="Refresh intake"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-[#1a3a8f]" : ""}`} />
            </button>
          )}
          <button
            onClick={handleCopySummary}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 transition flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </div>

      {/* Grid of Financial Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Cash In Drawer */}
        <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-bold mb-1">
            <span className="flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5" /> Cash (Drawer)
            </span>
          </div>
          <div className="text-lg font-black text-emerald-900 tracking-tight">
            {formatIDR(summary.cashTotal)}
          </div>
          <p className="text-[10px] text-emerald-600 font-medium mt-0.5">Physical cash collected</p>
        </div>

        {/* Bank Transfer */}
        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-700 text-xs font-bold mb-1">
            <span className="flex items-center gap-1">
              <ArrowDownCircle className="w-3.5 h-3.5" /> Bank Transfer
            </span>
          </div>
          <div className="text-lg font-black text-blue-900 tracking-tight">
            {formatIDR(summary.transferTotal)}
          </div>
          <p className="text-[10px] text-blue-600 font-medium mt-0.5">Direct account credits</p>
        </div>

        {/* QRIS */}
        <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-700 text-xs font-bold mb-1">
            <span className="flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5" /> QRIS
            </span>
          </div>
          <div className="text-lg font-black text-purple-900 tracking-tight">
            {formatIDR(summary.qrisTotal)}
          </div>
          <p className="text-[10px] text-purple-600 font-medium mt-0.5">Digital barcode payments</p>
        </div>

        {/* Grand Total */}
        <div className="p-3.5 rounded-xl bg-slate-900 text-white flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-slate-300 text-xs font-bold mb-1">
            <span className="flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-amber-400" /> Total Intake
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-bold">
              {summary.count} txns
            </span>
          </div>
          <div className="text-lg font-black text-white tracking-tight">
            {formatIDR(summary.grandTotal)}
          </div>
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">All methods combined</p>
        </div>
      </div>
    </div>
  );
}
