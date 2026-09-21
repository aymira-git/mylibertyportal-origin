import {
  PAYMENT_PLANS,
  PAYMENT_PLAN_KEYS,
  calculateExpiryDate,
  calculateCoveragePeriod,
} from "../shared";
import { formatIDR } from "./receiptMessages";

export default function RecordPaymentTab({
  student,
  existingHealth,
  selectedPlan,
  onSelectPlan,
  startDateMode,
  onStartDateModeChange,
  hasFutureCoverage,
  nextDayAfterExpiry,
  todayStr,
  effectiveStartDate,
  pricing,
  period,
  onPeriodChange,
  customStartDate,
  onCustomStartDateChange,
  customEndDate,
  onCustomEndDateChange,
  amount,
  onAmountChange,
  method,
  onMethodChange,
  notes,
  onNotesChange,
  saving,
  onSubmit,
  onMarkPending,
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4 text-xs">
      {/* Current Status Banner */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
        <div className="space-y-0.5">
          <span className="text-slate-400 font-bold block text-[10px] uppercase">
            Current Payment Health
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full font-extrabold uppercase text-[10px] ${
                existingHealth.status === "active"
                  ? "bg-emerald-100 text-emerald-800"
                  : existingHealth.status === "due_soon"
                    ? "bg-amber-100 text-amber-800"
                    : existingHealth.status === "expired"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-slate-200 text-slate-700"
              }`}
            >
              {existingHealth.label}
            </span>
            {student.paidUntil && (
              <span className="text-slate-600 font-semibold text-[11px]">
                Valid through: <strong>{student.paidUntil}</strong>
                {existingHealth.remainingDays !== null && (
                  <span className="ml-1 text-slate-400 text-[10px]">
                    (
                    {existingHealth.remainingDays > 0
                      ? `${existingHealth.remainingDays}d left`
                      : "Expired"}
                    )
                  </span>
                )}
              </span>
            )}
            {!student.paidUntil && student.lastPaymentPeriod && (
              <span className="text-slate-500 text-[11px]">
                (Last: {student.lastPaymentPeriod})
              </span>
            )}
          </div>
        </div>

        {student.paymentStatus === "paid" && onMarkPending && (
          <button
            type="button"
            onClick={onMarkPending}
            className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-3 py-1.5 rounded-xl transition cursor-pointer"
          >
            Reset to Pending
          </button>
        )}
      </div>

      {/* Payment Plan Selector (6 Chips) */}
      <div>
        <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1.5">
          Payment Plan *
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {PAYMENT_PLAN_KEYS.map((pKey) => {
            const p = PAYMENT_PLANS[pKey];
            const isSelected = selectedPlan === pKey;
            return (
              <button
                type="button"
                key={pKey}
                onClick={() => onSelectPlan(pKey)}
                className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
                  isSelected
                    ? "bg-[#1a3a8f] text-white border-[#1a3a8f] shadow-xs"
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="text-xs">{p.label}</span>
                <span
                  className={`text-[10px] font-semibold ${
                    isSelected ? "text-indigo-200" : "text-slate-400"
                  }`}
                >
                  {p.termName}
                </span>
                {p.discountPercent > 0 && (
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-black mt-0.5 ${
                      isSelected ? "bg-amber-400 text-slate-950" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    Save {p.discountPercent}%
                  </span>
                )}
              </button>
            );
          })}

          {/* 6th Chip: Custom */}
          <button
            type="button"
            onClick={() => onSelectPlan("custom")}
            className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center justify-center gap-0.5 transition cursor-pointer ${
              selectedPlan === "custom"
                ? "bg-[#1a3a8f] text-white border-[#1a3a8f] shadow-xs"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="text-xs">Custom</span>
            <span
              className={`text-[10px] font-semibold ${
                selectedPlan === "custom" ? "text-indigo-200" : "text-slate-400"
              }`}
            >
              Manual
            </span>
            <span
              className={`text-[9px] px-1 py-0.2 rounded font-black mt-0.5 ${
                selectedPlan === "custom" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              Flexible
            </span>
          </button>
        </div>
      </div>

      {/* Start Date Mode Toggle (Early Renewal for Fixed Plans) */}
      {selectedPlan !== "custom" && hasFutureCoverage && (
        <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-[#1a3a8f] uppercase tracking-wider flex items-center gap-1.5">
              <span>🔄</span> Early Renewal Detected
            </span>
            <span className="text-[10px] text-slate-500">
              Current coverage ends: <strong className="text-slate-800">{student.paidUntil}</strong>
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onStartDateModeChange("extend")}
              className={`p-2.5 rounded-xl border text-left text-xs font-bold transition flex flex-col cursor-pointer ${
                startDateMode === "extend"
                  ? "bg-white border-[#1a3a8f] text-[#1a3a8f] shadow-xs"
                  : "bg-slate-100/80 border-transparent text-slate-600 hover:bg-white"
              }`}
            >
              <span>Extend from Current Plan (Recommended)</span>
              <span className="text-[10px] font-normal text-slate-500">
                Starts {nextDayAfterExpiry} (no lost days)
              </span>
            </button>
            <button
              type="button"
              onClick={() => onStartDateModeChange("today")}
              className={`p-2.5 rounded-xl border text-left text-xs font-bold transition flex flex-col cursor-pointer ${
                startDateMode === "today"
                  ? "bg-white border-[#1a3a8f] text-[#1a3a8f] shadow-xs"
                  : "bg-slate-100/80 border-transparent text-slate-600 hover:bg-white"
              }`}
            >
              <span>Start Today Instead</span>
              <span className="text-[10px] font-normal text-slate-500">
                Starts today {todayStr} (resets coverage)
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Fixed Plan: Coverage Period & Expiry Preview */}
      {selectedPlan !== "custom" && (
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
          <div>
            <span className="text-slate-400 font-bold block text-[10px] uppercase">
              Coverage Period
            </span>
            <span className="font-extrabold text-slate-800 text-xs">
              {calculateCoveragePeriod(effectiveStartDate, pricing.months)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 font-bold block text-[10px] uppercase">Expires On</span>
            <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 text-xs">
              {calculateExpiryDate(effectiveStartDate, pricing.months)}
            </span>
          </div>
        </div>
      )}

      {/* Custom Plan: Free-text Billing Period & Optional End Date */}
      {selectedPlan === "custom" && (
        <div className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                Billing Period Description *
              </label>
              <input
                type="text"
                value={period}
                onChange={(e) => onPeriodChange(e.target.value)}
                placeholder="e.g. September 2026 or Special Intake"
                required
                className="w-full p-2.5 border rounded-xl font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3a8f]/20 focus:border-[#1a3a8f]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                Coverage Start Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => onCustomStartDateChange(e.target.value)}
                className="w-full p-2.5 border rounded-xl font-semibold text-slate-800 bg-white"
              />
            </div>
          </div>
          <div>
            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
              Optional Coverage End Date (Paid Until)
            </label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => onCustomEndDateChange(e.target.value)}
              className="w-full p-2.5 border rounded-xl font-semibold text-slate-800 bg-white"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Leave blank if this is an ad-hoc payment without automatic expiry tracking (student
              shows &ldquo;No Plan Set&rdquo; on roster).
            </p>
          </div>
        </div>
      )}

      {/* Payment Amount */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px]">
            Amount (IDR)
          </label>
          {selectedPlan !== "custom" && pricing.discountAmount > 0 && (
            <span className="text-[11px] text-emerald-700 font-bold">
              Includes {pricing.discountPercent}% bundle discount (
              {formatIDR(pricing.discountAmount)})
            </span>
          )}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-2.5 text-slate-400 font-bold text-sm">Rp</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => onAmountChange(Number(e.target.value))}
            min="1000"
            step="1000"
            required
            className="w-full pl-10 pr-3 py-2 border rounded-xl font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a8f]/20 focus:border-[#1a3a8f]"
            placeholder="350000"
          />
        </div>
        {/* Quick nominal chips */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {[250000, 350000, 500000, 997500, 1890000, 3570000].map((val) => (
            <button
              type="button"
              key={val}
              onClick={() => onAmountChange(val)}
              className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                amount === val
                  ? "bg-[#1a3a8f] text-white border-[#1a3a8f]"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {formatIDR(val)}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Method */}
      <div>
        <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1.5">
          Payment Method
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "Bank Transfer", icon: "🏦", label: "Bank Transfer" },
            { id: "QRIS", icon: "📱", label: "QRIS" },
            { id: "Cash", icon: "💵", label: "Cash" },
          ].map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => onMethodChange(m.id)}
              className={`p-3 rounded-xl border text-center font-bold flex flex-col items-center gap-1 transition cursor-pointer ${
                method === m.id
                  ? "bg-indigo-50 border-[#1a3a8f] text-[#1a3a8f] shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="text-xl">{m.icon}</span>
              <span className="text-xs">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Reference / Notes */}
      <div>
        <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
          Reference Note (Optional)
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="e.g. BCA transfer ref #9872 or Cash at front desk"
          className="w-full p-2.5 border rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1a3a8f]/20 focus:border-[#1a3a8f]"
        />
      </div>

      {/* Parent Contact Summary */}
      <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-bold text-slate-700">Parent Contact</p>
          <p className="text-slate-500 text-[11px]">
            {student.parentName || "N/A"} ({student.parentPhone || student.phone || "No phone"})
          </p>
        </div>
        <span className="text-[10px] font-bold text-[#1a3a8f] bg-blue-100 px-2 py-0.5 rounded">
          WhatsApp Ready
        </span>
      </div>

      {/* Offline Warning */}
      {typeof navigator !== "undefined" && !navigator.onLine && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold flex items-center gap-2">
          <span>⚠️</span>
          <span>
            Offline Mode: Payment processing is paused to protect database records. Reconnect to
            internet to save.
          </span>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={saving || (typeof navigator !== "undefined" && !navigator.onLine)}
        className="w-full bg-[#1a3a8f] hover:bg-[#122b6e] text-white p-3 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
      >
        {saving ? "Saving Payment..." : "💾 Save Payment & Generate Receipt"}
      </button>
    </form>
  );
}
