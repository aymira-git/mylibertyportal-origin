import {
  PAYMENT_PLAN_LIST,
  calculatePlanPricing,
  DEFAULT_BASE_MONTHLY_RATE,
} from "../../constants/paymentPlans";
import { CreditCard, CheckCircle2, Sparkles, ShieldCheck } from "lucide-react";

/**
 * StudentTuitionFields
 * Dedicated section in the Add / Edit Student form for selecting
 * tuition plan commitments, viewing auto-calculated discounts, and
 * estimating tuition payments.
 */
export default function StudentTuitionFields({ formData, field }) {
  const currentPlanId = formData.paymentPlan || "monthly";
  const pricing = calculatePlanPricing(currentPlanId, DEFAULT_BASE_MONTHLY_RATE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-black uppercase tracking-wider text-[#1a3a8f] flex items-center gap-1.5">
          <CreditCard className="w-4 h-4 text-[#1a3a8f]" />
          <span>Tuition &amp; Billing Plan</span>
        </h4>
        <span className="text-[11px] font-semibold text-slate-500">
          Base: IDR {DEFAULT_BASE_MONTHLY_RATE.toLocaleString("id-ID")}/mo
        </span>
      </div>

      <p className="text-xs text-slate-500 -mt-2">
        Select the student&apos;s tuition payment schedule and bundle discount preference.
      </p>

      {/* Plan Selection Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {PAYMENT_PLAN_LIST.map((plan) => {
          const isSelected = currentPlanId === plan.id;
          const planPricing = calculatePlanPricing(plan.id, DEFAULT_BASE_MONTHLY_RATE);

          return (
            <button
              type="button"
              key={plan.id}
              onClick={() => field("paymentPlan", plan.id)}
              className={`p-3 rounded-xl border text-left transition relative cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "bg-indigo-50/80 border-[#1a3a8f] ring-2 ring-[#1a3a8f]/20 shadow-xs"
                  : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`font-black text-xs ${
                      isSelected ? "text-[#1a3a8f]" : "text-slate-800"
                    }`}
                  >
                    {plan.label} ({plan.termName})
                  </span>
                  {isSelected ? (
                    <CheckCircle2 className="w-4 h-4 text-[#1a3a8f] shrink-0" />
                  ) : null}
                </div>

                <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">
                  {plan.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900">
                    IDR {planPricing.total.toLocaleString("id-ID")}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {plan.months > 1
                      ? `~IDR ${Math.round(planPricing.total / plan.months).toLocaleString("id-ID")}/mo`
                      : "Standard rate"}
                  </span>
                </div>

                {plan.discountPercent > 0 && (
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                    Save {plan.discountPercent}%
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {/* Custom Plan Option */}
        <button
          type="button"
          onClick={() => field("paymentPlan", "custom")}
          className={`p-3 rounded-xl border text-left transition relative cursor-pointer flex flex-col justify-between ${
            currentPlanId === "custom"
              ? "bg-indigo-50/80 border-[#1a3a8f] ring-2 ring-[#1a3a8f]/20 shadow-xs"
              : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-1">
              <span
                className={`font-black text-xs ${
                  currentPlanId === "custom" ? "text-[#1a3a8f]" : "text-slate-800"
                }`}
              >
                Custom Plan
              </span>
              {currentPlanId === "custom" ? (
                <CheckCircle2 className="w-4 h-4 text-[#1a3a8f] shrink-0" />
              ) : null}
            </div>
            <p className="text-[11px] text-slate-500 line-clamp-1 mb-2">
              Flexible billing, special scholarship, or manual rate
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Manual Intake</span>
            <span className="text-[10px] text-slate-400">Negotiated</span>
          </div>
        </button>
      </div>

      {/* Selected Plan Summary Banner */}
      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-[#1a3a8f] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="font-extrabold text-slate-900">
              Active Selection: {pricing.planId === "custom" ? "Custom Schedule" : `${pricing.months} Month (${pricing.planId})`}
            </div>
            <div className="text-[11px] text-slate-500">
              {pricing.discountAmount > 0 ? (
                <span className="text-emerald-700 font-semibold">
                  Includes {pricing.discountPercent}% bundle savings (Save IDR {pricing.discountAmount.toLocaleString("id-ID")})
                </span>
              ) : (
                "Standard month-to-month billing without upfront commitment discount."
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-[11px] text-slate-500 font-medium">Est. Total:</span>
          <span className="font-black text-[#1a3a8f] text-sm">
            IDR {pricing.total.toLocaleString("id-ID")}
          </span>
        </div>
      </div>
    </div>
  );
}
