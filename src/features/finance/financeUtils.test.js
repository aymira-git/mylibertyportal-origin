import { describe, it, expect } from "vitest";
import { summarizePaymentsByMethod } from "./financeUtils";

describe("summarizePaymentsByMethod", () => {
  it("summarizes empty list correctly", () => {
    const res = summarizePaymentsByMethod([]);
    expect(res).toEqual({
      cashTotal: 0,
      transferTotal: 0,
      qrisTotal: 0,
      otherTotal: 0,
      grandTotal: 0,
      count: 0,
    });
  });

  it("handles null or non-array inputs safely", () => {
    const res = summarizePaymentsByMethod(null);
    expect(res.grandTotal).toBe(0);
    expect(res.count).toBe(0);
  });

  it("accurately categorizes cash (including 'tunai')", () => {
    const payments = [
      { amount: 150000, method: "cash" },
      { amount: 50000, method: "tunai" },
      { amount: "100000", method: " Cash " },
    ];
    const res = summarizePaymentsByMethod(payments);
    expect(res.cashTotal).toBe(300000);
    expect(res.grandTotal).toBe(300000);
    expect(res.count).toBe(3);
  });

  it("accurately categorizes transfer and QRIS", () => {
    const payments = [
      { amount: 200000, method: "transfer" },
      { amount: 300000, method: "bank transfer" },
      { amount: 100000, method: "QRIS" },
      { amount: 50000, method: "edc" }, // other
    ];
    const res = summarizePaymentsByMethod(payments);
    expect(res.transferTotal).toBe(500000);
    expect(res.qrisTotal).toBe(100000);
    expect(res.otherTotal).toBe(50000);
    expect(res.grandTotal).toBe(650000);
    expect(res.count).toBe(4);
  });
});
