import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateCoveragePeriod,
  calculateExpiryDate,
  calculatePlanPricing,
  DEFAULT_BASE_MONTHLY_RATE,
  getPaymentHealthStatus,
  getPlanDetails,
  PAYMENT_PLAN_KEYS,
} from "./paymentPlans.js";

describe("calculatePlanPricing", () => {
  it.each([
    ["monthly", 1, 350000, 0, 350000],
    ["quarterly", 3, 1050000, 52500, 997500],
    ["semester", 6, 2100000, 210000, 1890000],
    ["annual", 12, 4200000, 630000, 3570000],
    ["biennial", 24, 8400000, 1680000, 6720000],
  ])("prices the %s plan (%i months)", (planId, months, subtotal, discountAmount, total) => {
    expect(calculatePlanPricing(planId)).toMatchObject({ planId, months, subtotal, discountAmount, total });
  });

  it("always satisfies subtotal - discount = total", () => {
    PAYMENT_PLAN_KEYS.forEach((id) => {
      const p = calculatePlanPricing(id, 275000);
      expect(p.subtotal - p.discountAmount).toBe(p.total);
    });
  });

  it("uses a custom monthly rate when supplied", () => {
    expect(calculatePlanPricing("quarterly", 400000).total).toBe(1140000);
  });

  it.each([0, "abc", null, undefined])("falls back to the default rate for %s", (rate) => {
    expect(calculatePlanPricing("monthly", rate).baseMonthlyRate).toBe(DEFAULT_BASE_MONTHLY_RATE);
  });

  it("prices an unknown or custom plan as one month with no discount", () => {
    expect(calculatePlanPricing("custom")).toMatchObject({ planId: "custom", months: 1, total: 350000, discountAmount: 0 });
    expect(calculatePlanPricing("nonsense").total).toBe(350000);
    expect(calculatePlanPricing(undefined).planId).toBe("custom");
  });

  it("rounds a discount that is not a whole rupiah", () => {
    const p = calculatePlanPricing("quarterly", 333333); // 999,999 * 5% = 49,999.95
    expect(Number.isInteger(p.discountAmount)).toBe(true);
    expect(p.discountAmount).toBe(50000);
  });
});

describe("calculateExpiryDate", () => {
  it("adds whole months", () => {
    expect(calculateExpiryDate("2026-09-21", 3)).toBe("2026-12-21");
    expect(calculateExpiryDate("2026-09-21", 12)).toBe("2027-09-21");
  });

  it("clamps to the last day of a shorter month", () => {
    expect(calculateExpiryDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(calculateExpiryDate("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("accepts a Date object", () => {
    expect(calculateExpiryDate(new Date(2026, 8, 21), 1)).toBe("2026-10-21");
  });

  it.each([0, -1, null, undefined])("returns null for %s months", (months) => {
    expect(calculateExpiryDate("2026-09-21", months)).toBeNull();
  });

  it("returns null for an unreadable start date", () => {
    expect(calculateExpiryDate("garbage", 1)).toBeNull();
  });
});

describe("calculateCoveragePeriod", () => {
  it("shows a single month name for one month or no length", () => {
    expect(calculateCoveragePeriod("2026-10-01", 1)).toBe("October 2026");
    expect(calculateCoveragePeriod("2026-10-01")).toBe("October 2026");
  });

  it("shows an inclusive month range for longer plans", () => {
    expect(calculateCoveragePeriod("2026-10-01", 3)).toBe("October 2026 – December 2026 (3 Mo)");
    expect(calculateCoveragePeriod("2026-10-01", 12)).toBe("October 2026 – September 2027 (12 Mo)");
  });

  it("returns a dash for an unreadable date", () => {
    expect(calculateCoveragePeriod("garbage", 3)).toBe("—");
  });
});

describe("getPaymentHealthStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T02:00:00Z")); // 21 Sep 2026, 10:00 WITA
  });
  afterEach(() => vi.useRealTimers());

  it.each([undefined, null, "", "   ", 20261001])("reports 'legacy' when paidUntil is %s", (v) => {
    expect(getPaymentHealthStatus(v)).toMatchObject({ status: "legacy", label: "No Plan Set", remainingDays: null });
  });

  it("reports 'invalid_date' for text that is not a date", () => {
    expect(getPaymentHealthStatus("next month")).toMatchObject({ status: "invalid_date", tone: "rose" });
  });

  it("is 'expired' from the day after paidUntil", () => {
    expect(getPaymentHealthStatus("2026-09-20")).toMatchObject({ status: "expired", remainingDays: -1, tone: "rose" });
  });

  it("is 'due_soon' on the day itself and up to 14 days out", () => {
    expect(getPaymentHealthStatus("2026-09-21")).toMatchObject({ status: "due_soon", remainingDays: 0 });
    expect(getPaymentHealthStatus("2026-10-05")).toMatchObject({ status: "due_soon", remainingDays: 14, tone: "amber" });
  });

  it("is 'active' from 15 days out", () => {
    expect(getPaymentHealthStatus("2026-10-06")).toMatchObject({ status: "active", remainingDays: 15, tone: "emerald" });
  });
});

describe("getPlanDetails", () => {
  it("returns plan info, or null for an unknown plan", () => {
    expect(getPlanDetails("annual").months).toBe(12);
    expect(getPlanDetails("custom")).toBeNull();
  });
});
