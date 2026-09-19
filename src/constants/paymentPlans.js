/**
 * Payment Plans Constants & Calculation Helpers (Single Source of Truth)
 *
 * Defines the 5 canonical fixed-duration payment plans:
 * 1 Month (Monthly), 3 Months (Quarterly), 6 Months (Semester),
 * 12 Months (Annual), and 24 Months (2-Year Mastery).
 *
 * Note: "Custom" is not a fixed plan entry — it is a dynamic mode handled
 * in the Payment Modal and stored as paymentPlan = "custom".
 */

import { addMonths, format, parseISO, startOfDay, differenceInCalendarDays } from "date-fns";

export const PAYMENT_PLANS = {
  monthly: {
    id: "monthly",
    months: 1,
    label: "1 Month",
    termName: "Monthly",
    discountPercent: 0,
    badgeTone: "slate",
    description: "Standard month-to-month tuition",
  },
  quarterly: {
    id: "quarterly",
    months: 3,
    label: "3 Months",
    termName: "Quarterly",
    discountPercent: 5,
    badgeTone: "blue",
    description: "1 Academic Quarter (5% Bundle Discount)",
  },
  semester: {
    id: "semester",
    months: 6,
    label: "6 Months",
    termName: "Semester",
    discountPercent: 10,
    badgeTone: "purple",
    description: "Full Semester Package (10% Bundle Discount)",
  },
  annual: {
    id: "annual",
    months: 12,
    label: "12 Months",
    termName: "Annual",
    discountPercent: 15,
    badgeTone: "amber",
    description: "1 Full Academic Year (15% Bundle Discount)",
  },
  biennial: {
    id: "biennial",
    months: 24,
    label: "24 Months",
    termName: "2-Year Mastery",
    discountPercent: 20,
    badgeTone: "rose",
    description: "2-Year Comprehensive Fluency Track (20% Bundle Discount)",
  },
};

export const PAYMENT_PLAN_KEYS = Object.keys(PAYMENT_PLANS);
export const PAYMENT_PLAN_LIST = Object.values(PAYMENT_PLANS);

export const DEFAULT_BASE_MONTHLY_RATE = 350000; // IDR 350,000 / month

/**
 * Calculates pricing, bundle discounts, and net total for a given plan.
 */
export function calculatePlanPricing(planId, baseMonthlyRate = DEFAULT_BASE_MONTHLY_RATE) {
  const plan = PAYMENT_PLANS[planId];
  const rate = Number(baseMonthlyRate) || DEFAULT_BASE_MONTHLY_RATE;

  if (!plan) {
    return {
      planId: planId || "custom",
      baseMonthlyRate: rate,
      months: 1,
      subtotal: rate,
      discountPercent: 0,
      discountAmount: 0,
      total: rate,
    };
  }

  const subtotal = rate * plan.months;
  const discountAmount = Math.round((subtotal * plan.discountPercent) / 100);
  const total = subtotal - discountAmount;

  return {
    planId: plan.id,
    baseMonthlyRate: rate,
    months: plan.months,
    subtotal,
    discountPercent: plan.discountPercent,
    discountAmount,
    total,
  };
}

/**
 * Calculates the exact expiry / paidUntil date string (YYYY-MM-DD)
 * clamped accurately with date-fns addMonths.
 */
export function calculateExpiryDate(startDate, months) {
  if (!months || months <= 0) return null;
  const start = typeof startDate === "string" ? parseISO(startDate) : (startDate || new Date());
  const end = addMonths(start, months);
  return format(end, "yyyy-MM-dd");
}

/**
 * Human-readable billing period text for receipts and UI.
 * e.g. "October 2026 – September 2027 (12 Mo)" or "October 2026"
 */
export function calculateCoveragePeriod(startDate, months) {
  const start = typeof startDate === "string" ? parseISO(startDate) : (startDate || new Date());
  if (!months || months === 1) {
    return format(start, "MMMM yyyy");
  }
  // Coverage spans from start month to (start + months - 1 day or inclusive month)
  // E.g. 3 months starting in October = Oct, Nov, Dec -> October 2026 – December 2026
  const endInclusive = addMonths(start, months - 1);
  return `${format(start, "MMMM yyyy")} – ${format(endInclusive, "MMMM yyyy")} (${months} Mo)`;
}

/**
 * Evaluates the payment health status of a student based on their paidUntil date.
 * Returns:
 * - "legacy": if paidUntil is absent (renders as "No Plan Set", gray)
 * - "active": remainingDays > 14 (green)
 * - "due_soon": 0 <= remainingDays <= 14 (amber)
 * - "expired": remainingDays < 0 (red)
 */
export function getPaymentHealthStatus(paidUntil) {
  if (!paidUntil) {
    return {
      status: "legacy",
      label: "No Plan Set",
      tone: "slate",
      remainingDays: null,
    };
  }

  try {
    const target = parseISO(paidUntil);
    const today = startOfDay(new Date());
    const remainingDays = differenceInCalendarDays(target, today);

    if (remainingDays < 0) {
      return {
        status: "expired",
        label: "Expired",
        tone: "rose",
        remainingDays,
      };
    }

    if (remainingDays <= 14) {
      return {
        status: "due_soon",
        label: "Due Soon",
        tone: "amber",
        remainingDays,
      };
    }

    return {
      status: "active",
      label: "Active",
      tone: "emerald",
      remainingDays,
    };
  } catch {
    return {
      status: "legacy",
      label: "No Plan Set",
      tone: "slate",
      remainingDays: null,
    };
  }
}

export function getPlanDetails(planId) {
  return PAYMENT_PLANS[planId] || null;
}
