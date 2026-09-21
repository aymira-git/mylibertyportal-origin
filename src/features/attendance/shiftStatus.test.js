import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  detectMultipleOpenShifts,
  EXPECTED_MINUTES,
  getShiftStatus,
  GRACE_HOURS,
  isShiftStale,
} from "./shiftStatus.js";

const NOW = new Date("2026-09-21T06:00:00.000Z");
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3600 * 1000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("isShiftStale", () => {
  it("uses a 3 hour grace period for instructors", () => {
    expect(GRACE_HOURS.instructor).toBe(3);
    expect(isShiftStale({ role: "instructor", clockIn: hoursAgo(3) })).toBe(false); // exactly 3h
    expect(isShiftStale({ role: "instructor", clockIn: hoursAgo(3.01) })).toBe(true);
  });

  it("uses 14 hours for every other role, including unknown ones", () => {
    expect(isShiftStale({ role: "frontoffice", clockIn: hoursAgo(13.9) })).toBe(false);
    expect(isShiftStale({ role: "frontoffice", clockIn: hoursAgo(14.1) })).toBe(true);
    expect(isShiftStale({ role: "something-new", clockIn: hoursAgo(14.1) })).toBe(true);
  });

  it("is never stale once clocked out, or when data is missing", () => {
    expect(isShiftStale({ role: "instructor", clockIn: hoursAgo(50), clockOut: hoursAgo(1) })).toBe(
      false
    );
    expect(isShiftStale({ role: "instructor" })).toBe(false);
    expect(isShiftStale(null)).toBe(false);
    expect(isShiftStale(undefined)).toBe(false);
  });
});

describe("getShiftStatus", () => {
  it("prefers 'corrected' over every other flag", () => {
    expect(
      getShiftStatus({
        corrected: true,
        autoClosed: true,
        clockOut: hoursAgo(1),
        clockIn: hoursAgo(5),
      })
    ).toBe("corrected");
  });

  it("reports auto_closed when the system closed the shift", () => {
    expect(getShiftStatus({ autoClosed: true, clockIn: hoursAgo(9), clockOut: hoursAgo(1) })).toBe(
      "auto_closed"
    );
  });

  it("distinguishes on_duty from stale for open shifts", () => {
    expect(getShiftStatus({ role: "instructor", clockIn: hoursAgo(1) })).toBe("on_duty");
    expect(getShiftStatus({ role: "instructor", clockIn: hoursAgo(4) })).toBe("stale");
  });

  it("reports completed when there is a clock-out", () => {
    expect(
      getShiftStatus({ role: "instructor", clockIn: hoursAgo(5), clockOut: hoursAgo(3) })
    ).toBe("completed");
  });

  it("treats a missing shift as completed rather than crashing", () => {
    expect(getShiftStatus(null)).toBe("completed");
  });
});

describe("EXPECTED_MINUTES", () => {
  it("expects 90 minutes for instructors and a full day for everyone else", () => {
    expect(EXPECTED_MINUTES.instructor).toBe(90);
    expect(EXPECTED_MINUTES.default).toBe(480);
  });
});

describe("detectMultipleOpenShifts", () => {
  it("returns the userIds that have more than one open shift", () => {
    const shifts = [
      { userId: "a", clockOut: null },
      { userId: "a", clockOut: null },
      { userId: "b", clockOut: null },
      { userId: "c", clockOut: "2026-09-21T01:00:00Z" },
      { userId: "c", clockOut: null },
    ];
    expect([...detectMultipleOpenShifts(shifts)]).toEqual(["a"]);
  });

  it("ignores closed shifts and shifts without a userId", () => {
    const shifts = [
      { userId: "a", clockOut: "x" },
      { userId: "a", clockOut: "y" },
      { clockOut: null },
      { clockOut: null },
    ];
    expect(detectMultipleOpenShifts(shifts).size).toBe(0);
  });

  it("works with no argument", () => {
    expect(detectMultipleOpenShifts().size).toBe(0);
  });
});
