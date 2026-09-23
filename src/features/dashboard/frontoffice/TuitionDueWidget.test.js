import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getPaymentHealthStatus } from "../../../constants/paymentPlans";

describe("Tuition Due & Expiry 8-Day (7+1 Face-to-Face Buffer) Alert Logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-21T02:00:00Z")); // 21 Sep 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("classifies tuition expiring today as due_soon (0 remaining days)", () => {
    const health = getPaymentHealthStatus("2026-09-21");
    expect(health.status).toBe("due_soon");
    expect(health.remainingDays).toBe(0);
  });

  it("classifies tuition expiring in 7 days as due_soon", () => {
    // 21 Sep + 7 days = 28 Sep
    const health = getPaymentHealthStatus("2026-09-28");
    expect(health.status).toBe("due_soon");
    expect(health.remainingDays).toBe(7);
  });

  it("classifies tuition expiring in 8 days as due_soon (last face-to-face class reminder buffer)", () => {
    // 21 Sep + 8 days = 29 Sep
    const health = getPaymentHealthStatus("2026-09-29");
    expect(health.status).toBe("due_soon");
    expect(health.remainingDays).toBe(8);
  });

  it("classifies tuition expiring in 9 days as active (not due soon)", () => {
    // 21 Sep + 9 days = 30 Sep
    const health = getPaymentHealthStatus("2026-09-30");
    expect(health.status).toBe("active");
    expect(health.remainingDays).toBe(9);
  });

  it("classifies past tuition as expired", () => {
    const health = getPaymentHealthStatus("2026-09-20");
    expect(health.status).toBe("expired");
    expect(health.remainingDays).toBe(-1);
  });

  it("filters students list correctly for 8-day (7+1) tuition alerts", () => {
    const students = [
      { id: "s1", displayName: "Student Active", paidUntil: "2026-10-15" }, // > 8 days -> active
      { id: "s2", displayName: "Student Expired", paidUntil: "2026-09-10" }, // expired
      { id: "s3", displayName: "Student Due In 5 Days", paidUntil: "2026-09-26" }, // 5 days -> due_soon
      { id: "s4", displayName: "Student Due In 7 Days", paidUntil: "2026-09-28" }, // 7 days -> due_soon
      { id: "s5", displayName: "Student Due In 8 Days", paidUntil: "2026-09-29" }, // 8 days -> due_soon (7+1 buffer)
      { id: "s6", displayName: "Student Due In 9 Days", paidUntil: "2026-09-30" }, // 9 days -> active
    ];

    const flagged = students
      .map((student) => ({
        student,
        health: getPaymentHealthStatus(student.paidUntil, 8),
      }))
      .filter(({ health }) => health.status === "expired" || health.status === "due_soon");

    expect(flagged.map((f) => f.student.id)).toEqual(["s2", "s3", "s4", "s5"]);
    expect(flagged.find((f) => f.student.id === "s1")).toBeUndefined();
    expect(flagged.find((f) => f.student.id === "s6")).toBeUndefined();
  });
});
