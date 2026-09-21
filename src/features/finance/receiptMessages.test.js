/* global process */
import { afterEach, describe, expect, it } from "vitest";
import {
  buildWhatsAppReceiptMessage,
  buildWhatsAppRenewalReminderMessage,
  formatIDR,
  normalizeWhatsAppNumber,
} from "./receiptMessages.js";

describe("normalizeWhatsAppNumber", () => {
  it.each([
    ["081234567890", "6281234567890"],
    ["0812-3456-7890", "6281234567890"],
    ["+62 812 3456 7890", "6281234567890"],
    ["6281234567890", "6281234567890"],
    ["81234567890", "6281234567890"],
    ["(0812) 3456.7890", "6281234567890"],
  ])("turns %s into %s", (input, expected) => {
    expect(normalizeWhatsAppNumber(input)).toBe(expected);
  });

  it.each(["", null, undefined])("returns an empty string for %s", (v) => {
    expect(normalizeWhatsAppNumber(v)).toBe("");
  });

  it("leaves numbers that are not Indonesian in their digits-only form", () => {
    expect(normalizeWhatsAppNumber("+1 415 555 0100")).toBe("14155550100");
  });
});

describe("formatIDR", () => {
  // Intl inserts a non-breaking space after "Rp", so spaces are normalised first.
  const plain = (v) => formatIDR(v).replace(/\s/g, " ");

  it("formats rupiah with dots and no decimals", () => {
    expect(plain(350000)).toBe("Rp 350.000");
    expect(plain(1050000)).toBe("Rp 1.050.000");
    expect(plain("997500")).toBe("Rp 997.500");
  });

  it.each([null, undefined, "abc", ""])("shows Rp 0 for %s", (v) => {
    expect(plain(v)).toBe("Rp 0");
  });
});

describe("buildWhatsAppReceiptMessage", () => {
  const rcp = {
    receiptNumber: "R-001",
    studentName: "Budi",
    planName: "3 Months",
    period: "October 2026 – December 2026 (3 Mo)",
    coverageEnd: "2026-12-21",
    method: "Cash",
    amount: 997500,
    recordedAt: "2026-09-21T02:00:00.000Z",
    notes: "Paid by mother",
  };

  it("includes every detail of the payment", () => {
    const msg = buildWhatsAppReceiptMessage(rcp);
    ["R-001", "Budi", "3 Months", "October 2026 – December 2026", "Cash", "997.500", "Sep 21, 2026", "Dec 21, 2026", "Paid by mother"].forEach(
      (part) => expect(msg).toContain(part)
    );
  });

  it("leaves out optional lines that have no value", () => {
    const msg = buildWhatsAppReceiptMessage({ ...rcp, planName: "", coverageEnd: undefined, paidUntil: undefined, notes: "" });
    expect(msg).not.toContain("Payment Plan");
    expect(msg).not.toContain("Valid Through");
    expect(msg).not.toContain("Notes");
  });

  it("falls back to N/A for a missing receipt number or date", () => {
    const msg = buildWhatsAppReceiptMessage({ ...rcp, receiptNumber: undefined, recordedAt: undefined });
    expect(msg).toContain("*Receipt No:* N/A");
    expect(msg).toContain("*Date:* N/A");
  });

  it("uses paidUntil when there is no coverageEnd", () => {
    expect(buildWhatsAppReceiptMessage({ ...rcp, coverageEnd: undefined, paidUntil: "2027-01-05" })).toContain("Jan 5, 2027");
  });

  describe("on a device set behind UTC", () => {
    const originalTz = process.env.TZ;
    afterEach(() => {
      process.env.TZ = originalTz;
    });

    // Open to debate: "2026-12-21" is read as midnight UTC and then shown in the
    // device's timezone, so a device west of UTC prints the day before.
    it("still prints 'Dec 21, 2026' for a date-only coverage end", () => {
      process.env.TZ = "America/Los_Angeles";
      expect(buildWhatsAppReceiptMessage(rcp)).toContain("Dec 21, 2026");
    });
  });
});

describe("buildWhatsAppRenewalReminderMessage", () => {
  const base = { student: { displayName: "Budi" }, paidUntil: "2026-10-05", planLabel: "3 Months" };

  it("says the plan expired when remainingDays is negative", () => {
    expect(buildWhatsAppRenewalReminderMessage({ ...base, remainingDays: -3 })).toContain("expired on *Oct 5, 2026*");
  });

  it("says it expires today at zero days", () => {
    expect(buildWhatsAppRenewalReminderMessage({ ...base, remainingDays: 0 })).toContain("expires *today*");
  });

  it("counts days remaining, with correct singular and plural", () => {
    expect(buildWhatsAppRenewalReminderMessage({ ...base, remainingDays: 1 })).toContain("(1 day remaining)");
    expect(buildWhatsAppRenewalReminderMessage({ ...base, remainingDays: 5 })).toContain("(5 days remaining)");
  });

  it("uses a general sentence when remainingDays is unknown", () => {
    expect(buildWhatsAppRenewalReminderMessage({ ...base, remainingDays: null })).toContain("is due for renewal.");
    expect(buildWhatsAppRenewalReminderMessage({ ...base })).toContain("is due for renewal.");
  });

  it("has sensible fallbacks for missing student, plan and date", () => {
    const msg = buildWhatsAppRenewalReminderMessage({ remainingDays: -1 });
    expect(msg).toContain("*Student*");
    expect(msg).toContain("tuition plan");
    expect(msg).toContain("expired on *recently*");
  });
});
