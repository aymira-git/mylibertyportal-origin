import { describe, expect, it } from "vitest";
import { AT_RISK_THRESHOLD_DAYS, isStudentAtRisk } from "./atRisk.js";

const NOW = new Date("2026-09-21T02:00:00Z").getTime();
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

describe("isStudentAtRisk", () => {
  it("uses a 14 day threshold", () => {
    expect(AT_RISK_THRESHOLD_DAYS).toBe(14);
  });

  it("flags an active, long-enrolled student with no recent check-in", () => {
    expect(isStudentAtRisk({ joinedDate: daysAgo(60), lastCheckIn: daysAgo(20) }, NOW)).toBe(true);
  });

  it("does not flag a student who checked in within 14 days", () => {
    expect(isStudentAtRisk({ joinedDate: daysAgo(60), lastCheckIn: daysAgo(3) }, NOW)).toBe(false);
  });

  it("treats exactly 14 days as still OK, and 14 days + 1 second as at risk", () => {
    expect(isStudentAtRisk({ joinedDate: daysAgo(60), lastCheckIn: daysAgo(14) }, NOW)).toBe(false);
    expect(isStudentAtRisk({ joinedDate: daysAgo(60), lastCheckIn: new Date(NOW - 14 * 86400000 - 1000).toISOString() }, NOW)).toBe(true);
  });

  it("does not flag a student who joined less than 14 days ago", () => {
    expect(isStudentAtRisk({ joinedDate: daysAgo(5) }, NOW)).toBe(false);
  });

  it("flags a long-enrolled student who has never checked in", () => {
    expect(isStudentAtRisk({ joinedDate: daysAgo(90) }, NOW)).toBe(true);
  });

  it("flags a student with no joined date and no check-ins", () => {
    expect(isStudentAtRisk({}, NOW)).toBe(true);
  });

  it("looks at the first attendance history entry when lastCheckIn is missing", () => {
    expect(isStudentAtRisk({ joinedDate: daysAgo(90), history: [{ timestamp: daysAgo(2) }] }, NOW)).toBe(false);
    expect(isStudentAtRisk({ joinedDate: daysAgo(90), history: [{ timestamp: daysAgo(40) }] }, NOW)).toBe(true);
  });

  it.each(["on_leave", "graduated", "inactive"])("never flags a student whose status is %s", (status) => {
    expect(isStudentAtRisk({ status, joinedDate: daysAgo(90) }, NOW)).toBe(false);
  });

  it("never flags an archived student", () => {
    expect(isStudentAtRisk({ isArchived: true, joinedDate: daysAgo(90) }, NOW)).toBe(false);
  });

  it("treats a missing status as active", () => {
    expect(isStudentAtRisk({ joinedDate: daysAgo(90) }, NOW)).toBe(true);
  });

  it("returns false for a missing student", () => {
    expect(isStudentAtRisk(null, NOW)).toBe(false);
  });

  it("accepts a Date or ISO string as the reference time", () => {
    const student = { joinedDate: daysAgo(60), lastCheckIn: daysAgo(20) };
    expect(isStudentAtRisk(student, new Date(NOW))).toBe(true);
    expect(isStudentAtRisk(student, new Date(NOW).toISOString())).toBe(true);
  });
});
