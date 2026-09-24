import { PAYMENT_PLAN_LIST, PAYMENT_PLANS } from "../../constants/paymentPlans";
import { CreditCard, CheckCircle2, Sparkles, Building2, Banknote, UserPlus, BookOpen } from "lucide-react";

/**
 * StudentTuitionFields
 * Dedicated section in the Add / Edit Student form for manually typing
 * the agreed tuition nominal, registration fee, and 6-month handbook fee
 * per branch/program/batch policy, and selecting the billing commitment schedule.
 */
export default function StudentTuitionFields({ formData, field }) {
  const currentPlanId = formData.paymentPlan || "monthly";
  const tuitionRate = Number(formData.tuitionRate) || 0;
  const registrationFee = Number(formData.registrationFee) || 0;
  const handbookFee = Number(formData.handbookFee) || 0;
  const selectedPlan = PAYMENT_PLANS[currentPlanId];

  // Duration in months
  const planMonths = selectedPlan?.months || 1;
  const tuitionSubtotal = tuitionRate * planMonths;
  const totalPayable = tuitionSubtotal + registrationFee + handbookFee;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <h4 className="text-xs font-black uppercase tracking-wider text-[#1a3a8f] flex items-center gap-1.5">
          <CreditCard className="w-4 h-4 text-[#1a3a8f]" />
          <span>Tuition &amp; Fees Configuration</span>
        </h4>
        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 w-fit">
          Manual Rate &amp; Fees Intake
        </span>
      </div>

      <p className="text-xs text-slate-500 -mt-1">
        Type the agreed tuition rate, registration fee, and 6-month handbook fee per branch and program policy.
      </p>

      {/* Manual Fees Inputs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Monthly Tuition Rate */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5 text-[#1a3a8f]" />
              <span>Tuition Rate (IDR)</span>
            </label>
            <span className="text-[10px] text-slate-400 font-medium">Per Month</span>
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-slate-400 font-extrabold text-sm">
              Rp
            </span>
            <input
              type="number"
              value={formData.tuitionRate === "" || formData.tuitionRate === undefined || formData.tuitionRate === null ? "" : formData.tuitionRate}
              onChange={(e) => field("tuitionRate", e.target.value === "" ? "" : Number(e.target.value))}
              min="0"
              step="1000"
              placeholder="e.g. 350000"
              className="w-full pl-11 pr-3 py-2 bg-white border border-slate-300 rounded-xl font-extrabold text-slate-900 text-sm focus:ring-2 focus:ring-[#1a3a8f] focus:border-transparent outline-hidden transition shadow-2xs"
            />
          </div>
        </div>

        {/* 2. Registration Fee */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
              <span>Registration Fee (IDR)</span>
            </label>
            <span className="text-[10px] text-slate-400 font-medium">One-Time</span>
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-slate-400 font-extrabold text-sm">
              Rp
            </span>
            <input
              type="number"
              value={formData.registrationFee === "" || formData.registrationFee === undefined || formData.registrationFee === null ? "" : formData.registrationFee}
              onChange={(e) => field("registrationFee", e.target.value === "" ? "" : Number(e.target.value))}
              min="0"
              step="1000"
              placeholder="e.g. 150000"
              className="w-full pl-11 pr-3 py-2 bg-white border border-slate-300 rounded-xl font-extrabold text-slate-900 text-sm focus:ring-2 focus:ring-[#1a3a8f] focus:border-transparent outline-hidden transition shadow-2xs"
            />
          </div>
        </div>

        {/* 3. Handbook for 6 Months */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <label className="block font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
              <span>Handbook 6-Mo (IDR)</span>
            </label>
            <span className="text-[10px] text-slate-400 font-medium">Semester Material</span>
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-2.5 text-slate-400 font-extrabold text-sm">
              Rp
            </span>
            <input
              type="number"
              value={formData.handbookFee === "" || formData.handbookFee === undefined || formData.handbookFee === null ? "" : formData.handbookFee}
              onChange={(e) => field("handbookFee", e.target.value === "" ? "" : Number(e.target.value))}
              min="0"
              step="1000"
              placeholder="e.g. 100000"
              className="w-full pl-11 pr-3 py-2 bg-white border border-slate-300 rounded-xl font-extrabold text-slate-900 text-sm focus:ring-2 focus:ring-[#1a3a8f] focus:border-transparent outline-hidden transition shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Plan Selection Cards Grid */}
      <div>
        <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1.5">
          Billing Commitment Cycle
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {PAYMENT_PLAN_LIST.map((plan) => {
            const isSelected = currentPlanId === plan.id;

            return (
              <button
                type="button"
                key={plan.id}
                onClick={() => field("paymentPlan", plan.id)}
                className={`p-3.5 rounded-xl border text-left transition relative cursor-pointer flex flex-col justify-between ${
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

                  <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">
                    {plan.months === 1
                      ? "Standard 1-month tuition schedule"
                      : `${plan.months}-month commitment cycle`}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-extrabold text-slate-700">
                    {plan.months} {plan.months === 1 ? "Month Cycle" : "Months Duration"}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {plan.termName}
                  </span>
                </div>
              </button>
            );
          })}

          {/* Custom Plan Option */}
          <button
            type="button"
            onClick={() => field("paymentPlan", "custom")}
            className={`p-3.5 rounded-xl border text-left transition relative cursor-pointer flex flex-col justify-between ${
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
              <p className="text-[11px] text-slate-500 line-clamp-2 mb-2">
                Flexible billing, special scholarship, or manual rate
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600">Manual Intake</span>
              <span className="text-[10px] text-slate-400 font-medium">Negotiated</span>
            </div>
          </button>
        </div>
      </div>

      {/* Selected Plan Summary Banner */}
      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-[#1a3a8f] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="font-extrabold text-slate-900">
              Active Schedule: {currentPlanId === "custom" ? "Custom Schedule" : `${currentPlanId.toUpperCase()} (${planMonths} Mo)`}
            </div>
            <div className="text-[11px] text-slate-500">
              {tuitionRate > 0 || registrationFee > 0 || handbookFee > 0 ? (
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                  {tuitionRate > 0 && <span>Tuition: IDR {tuitionRate.toLocaleString("id-ID")}/mo</span>}
                  {registrationFee > 0 && <span>• Reg: IDR {registrationFee.toLocaleString("id-ID")}</span>}
                  {handbookFee > 0 && <span>• Handbook (6-Mo): IDR {handbookFee.toLocaleString("id-ID")}</span>}
                </div>
              ) : (
                "Duration and coverage dates will be calculated automatically based on this plan."
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
          {totalPayable > 0 ? (
            <>
              <span className="text-[11px] text-slate-500 font-medium">Est. Upfront Total:</span>
              <span className="font-black text-[#1a3a8f] text-sm">
                IDR {totalPayable.toLocaleString("id-ID")}
              </span>
            </>
          ) : (
            <>
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px] text-slate-600 font-semibold">
                Branch / Program Rate Policy
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
