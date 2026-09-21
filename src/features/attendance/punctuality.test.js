/* global process */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeMonthlyPunctuality,
  getInstantPunctuality,
  getTodaysClasses,
} from "./punctuality.js";

// Build a Date/ISO for a WITA wall-clock time, e.g. wita("2026-09-07", "09:45").
const wita = (date, time) => new Date(`${date}T${time}:00+08:00`);
const witaIso = (date, time) => wita(date, time).toISOString();

afterEach(() => {
  vi.useRealTimers();
});

describe("getInstantPunctuality", () => {
  const cls = { startTime: "10:00" };

  it("counts arriving exactly 15 minutes before start as on time", () => {
    const r = getInstantPunctuality(cls, wita("2026-09-21", "09:45"));
    expect(r.status).toBe("On time");
    expect(r.minutesEarlyOrLate).toBe(15);
  });

  it("counts 14 minutes before start as late (the cutoff is a pre-start rule)", () => {
    const r = getInstantPunctuality(cls, wita("2026-09-21", "09:46"));
    expect(r.status).toBe("Late");
    expect(r.minutesEarlyOrLate).toBe(14);
  });

  it("reports negative minutes when the instructor arrives after class started", () => {
    const r = getInstantPunctuality(cls, wita("2026-09-21", "10:20"));
    expect(r.status).toBe("Late");
    expect(r.minutesEarlyOrLate).toBe(-20);
  });

  it("returns the scheduled start and required arrival as ISO strings", () => {
    const r = getInstantPunctuality(cls, wita("2026-09-21", "09:30"));
    expect(r.scheduledStart).toBe(witaIso("2026-09-21", "10:00"));
    expect(r.requiredArrival).toBe(witaIso("2026-09-21", "09:45"));
  });

  it.each([
    ["no class", null],
    ["no startTime", {}],
    ["empty startTime", { startTime: "" }],
    ["impossible time", { startTime: "25:00" }],
    ["text time", { startTime: "soon" }],
  ])("returns Unscheduled for %s", (_label, record) => {
    expect(getInstantPunctuality(record, wita("2026-09-21", "09:30"))).toEqual({
      status: "Unscheduled",
      scheduledStart: null,
      requiredArrival: null,
      minutesEarlyOrLate: null,
    });
  });

  // Open to debate: the rest of the app treats WITA as the school's clock no
  // matter what the device says (utils/dateWita.js). This function uses the
  // device's own timezone instead, so a kiosk set to another timezone would
  // judge lateness against the wrong wall clock.
  describe("device timezone", () => {
    const originalTz = process.env.TZ;
    beforeEach(() => {
      process.env.TZ = "UTC";
    });
    afterEach(() => {
      process.env.TZ = originalTz;
    });

    it.fails("judges 10:10 WITA as late even when the device clock is UTC", () => {
      const r = getInstantPunctuality(cls, wita("2026-09-21", "10:10"));
      expect(r.status).toBe("Late");
    });
  });
});

describe("getTodaysClasses", () => {
  const classes = [
    { id: "mw", classDay: "Mon/Wed" },
    { id: "tt", classDay: "Tue/Thu" },
    { id: "list", classDay: "Mon, Wed, Fri" },
    { id: "long", classDay: "Monday" },
    { id: "private", classDay: "Private" },
    { id: "none" },
  ];

  it("shows classes scheduled for today's WITA weekday, plus Private classes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(wita("2026-09-21", "10:00")); // Monday
    expect(getTodaysClasses(classes).map((c) => c.id)).toEqual(["mw", "list", "long", "private"]);
  });

  it("uses the WITA weekday, not the UTC weekday, right after WITA midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-20T16:30:00Z")); // Sunday 16:30 UTC = Monday 00:30 WITA
    expect(getTodaysClasses(classes).map((c) => c.id)).toContain("mw");
  });

  it("hides classes with no classDay at all", () => {
    vi.useFakeTimers();
    vi.setSystemTime(wita("2026-09-21", "10:00"));
    expect(getTodaysClasses([{ id: "none" }])).toEqual([]);
  });

  // The BatchModal dropdown only offers six values: "Mon/Wed", "Tue/Thu",
  // "Fri Only", "Sat Only", "Sat/Sun", "Everyday". The parser here only
  // understands day names separated by "/" or ",", so three of those six are
  // not recognised. Expectations below are proposals — open to challenge.
  describe("values that BatchModal can actually save", () => {
    it("shows 'Sat/Sun' on a Saturday", () => {
      vi.useFakeTimers();
      vi.setSystemTime(wita("2026-09-26", "10:00")); // Saturday
      expect(getTodaysClasses([{ id: "ws", classDay: "Sat/Sun" }])).toHaveLength(1);
    });

    // Friday is the school's day off, so the "Fri Only" option itself may be retired (audit F10);
    // the parser should still recognise the value so old data is not silently mis-handled.
    it.fails("still recognises a legacy 'Fri Only' value on a Friday", () => {
      vi.useFakeTimers();
      vi.setSystemTime(wita("2026-09-25", "10:00")); // Friday
      expect(getTodaysClasses([{ id: "f", classDay: "Fri Only" }])).toHaveLength(1);
    });

    it.fails("shows 'Sat Only' on a Saturday", () => {
      vi.useFakeTimers();
      vi.setSystemTime(wita("2026-09-26", "10:00"));
      expect(getTodaysClasses([{ id: "s", classDay: "Sat Only" }])).toHaveLength(1);
    });

    it.fails("shows 'Everyday' (Sat–Thu Intensive) on a Monday", () => {
      vi.useFakeTimers();
      vi.setSystemTime(wita("2026-09-21", "10:00"));
      expect(getTodaysClasses([{ id: "e", classDay: "Everyday" }])).toHaveLength(1);
    });

    // Kifry confirmed "Everyday" means Saturday to Thursday, so it includes the weekend.
    it.fails("shows 'Everyday' on a Sunday", () => {
      vi.useFakeTimers();
      vi.setSystemTime(wita("2026-09-27", "10:00")); // Sunday
      expect(getTodaysClasses([{ id: "e", classDay: "Everyday" }])).toHaveLength(1);
    });
  });
});

describe("computeMonthlyPunctuality", () => {
  const SEPT = { year: 2026, month: 8 }; // month is 0-based
  const instructors = { i1: { displayName: "Ms. Rina" } };
  // Mondays + Wednesdays in Sept 2026: 2, 7, 9, 14, 16, 21, 23, 28, 30 (9 sessions)
  const baseClass = {
    id: "c1",
    instructorId: "i1",
    classDay: "Mon/Wed",
    startTime: "10:00",
    classStartDate: "2026-09-01",
  };
  const shift = (id, date, time, extra = {}) => ({
    id,
    userId: "i1",
    classId: "c1",
    clockIn: witaIso(date, time),
    ...extra,
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(wita("2026-09-30", "22:00")); // after every session this month
  });

  it("returns an empty list when there is nothing to measure", () => {
    expect(computeMonthlyPunctuality([], [], {}, SEPT.year, SEPT.month)).toEqual([]);
  });

  it("classifies on-time, late and absent sessions and totals the minutes late", () => {
    const shifts = [
      shift("s1", "2026-09-02", "09:30"), // on time
      shift("s2", "2026-09-07", "09:45"), // exactly on the cutoff -> on time
      shift("s3", "2026-09-09", "09:50"), // 5 min after cutoff
      shift("s4", "2026-09-14", "10:15"), // 30 min after cutoff
      shift("s5", "2026-09-16", "09:00"), // on time
    ]; // 21, 23, 28, 30 have no shift -> absent

    const [stats] = computeMonthlyPunctuality([baseClass], shifts, instructors, SEPT.year, SEPT.month);

    expect(stats).toMatchObject({
      instructorId: "i1",
      instructorName: "Ms. Rina",
      sessionsScheduled: 9,
      sessionsAttended: 5,
      onTime: 3,
      late: 2,
      absent: 4,
      totalMinutesLate: 35,
      lateSessionCount: 2,
      punctualityRate: 33,
      avgMinutesLate: 18, // 35 / 2 = 17.5 rounds up
      limitedAccuracy: false,
    });
  });

  it("ignores sessions that have not happened yet", () => {
    vi.setSystemTime(wita("2026-09-15", "12:00"));
    const [stats] = computeMonthlyPunctuality([baseClass], [], instructors, SEPT.year, SEPT.month);
    expect(stats.sessionsScheduled).toBe(4); // 2, 7, 9, 14
    expect(stats.absent).toBe(4);
  });

  it("does not count sessions before the class start date", () => {
    const cls = { ...baseClass, classStartDate: "2026-09-15" };
    const [stats] = computeMonthlyPunctuality([cls], [], instructors, SEPT.year, SEPT.month);
    expect(stats.sessionsScheduled).toBe(5); // 16, 21, 23, 28, 30
  });

  it("falls back to the earliest known shift and flags limited accuracy when there is no start date", () => {
    const cls = { ...baseClass, classStartDate: undefined };
    const [stats] = computeMonthlyPunctuality(
      [cls],
      [shift("s1", "2026-09-16", "09:30")],
      instructors,
      SEPT.year,
      SEPT.month
    );
    expect(stats.limitedAccuracy).toBe(true);
    expect(stats.sessionsScheduled).toBe(5); // 16, 21, 23, 28, 30
    expect(stats.sessionsAttended).toBe(1);
  });

  it("skips classes whose startTime is missing or invalid", () => {
    const bad = [
      { ...baseClass, id: "x1", startTime: "" },
      { ...baseClass, id: "x2", startTime: "99:99" },
    ];
    expect(computeMonthlyPunctuality(bad, [], instructors, SEPT.year, SEPT.month)).toEqual([]);
  });

  it("uses 'Unknown' when the instructor record is missing", () => {
    const [stats] = computeMonthlyPunctuality([baseClass], [], {}, SEPT.year, SEPT.month);
    expect(stats.instructorName).toBe("Unknown");
  });

  it("reports a null punctuality rate when nothing was scheduled", () => {
    vi.setSystemTime(wita("2026-09-01", "08:00")); // before the first session
    const [stats] = computeMonthlyPunctuality([baseClass], [], instructors, SEPT.year, SEPT.month);
    expect(stats.sessionsScheduled).toBe(0);
    expect(stats.punctualityRate).toBeNull();
    expect(stats.avgMinutesLate).toBe(0);
  });

  it("only counts shifts that fall on the same calendar day as the session", () => {
    const yesterdayShift = shift("s1", "2026-09-06", "09:30"); // Sunday, not a class day
    const [stats] = computeMonthlyPunctuality([baseClass], [yesterdayShift], instructors, SEPT.year, SEPT.month);
    expect(stats.sessionsAttended).toBe(0);
  });

  it("matches old shifts that have no classId, and flags them as limited accuracy", () => {
    const legacy = { id: "old", userId: "i1", clockIn: witaIso("2026-09-02", "09:30") };
    const [stats] = computeMonthlyPunctuality([baseClass], [legacy], instructors, SEPT.year, SEPT.month);
    expect(stats.sessionsAttended).toBe(1);
    expect(stats.onTime).toBe(1);
    expect(stats.limitedAccuracy).toBe(true);
  });

  it("does not guess which class an old shift belonged to when two classes share a weekday", () => {
    const other = { ...baseClass, id: "c2", startTime: "15:00" };
    const legacy = { id: "old", userId: "i1", clockIn: witaIso("2026-09-02", "09:30") };
    const [stats] = computeMonthlyPunctuality([baseClass, other], [legacy], instructors, SEPT.year, SEPT.month);
    expect(stats.sessionsAttended).toBe(0);
  });

  it("never lets one shift satisfy two different sessions", () => {
    const only = shift("s1", "2026-09-02", "09:30");
    const twin = { ...baseClass, id: "c1" };
    const [stats] = computeMonthlyPunctuality([baseClass, twin], [only], instructors, SEPT.year, SEPT.month);
    expect(stats.sessionsAttended).toBe(1);
  });

  it("counts Private lessons by attended shifts only and marks the result limited", () => {
    const priv = { ...baseClass, id: "p1", classDay: "Private" };
    const shifts = [
      { id: "a", userId: "i1", classId: "p1", clockIn: witaIso("2026-09-03", "16:00") },
      { id: "b", userId: "i1", classId: "p1", clockIn: witaIso("2026-09-10", "16:00") },
      { id: "c", userId: "i1", classId: "p1", clockIn: witaIso("2026-10-01", "16:00") }, // other month
    ];
    const [stats] = computeMonthlyPunctuality([priv], shifts, instructors, SEPT.year, SEPT.month);
    expect(stats).toMatchObject({ sessionsScheduled: 2, sessionsAttended: 2, onTime: 2, absent: 0, limitedAccuracy: true });
  });

  it("tallies auto-closed shifts for instructors that have tracked classes, this month only", () => {
    const shifts = [
      shift("s1", "2026-09-02", "09:30", { autoClosed: true }),
      shift("s2", "2026-08-31", "09:30", { autoClosed: true }), // previous month
      { id: "s3", userId: "ghost", classId: "zz", clockIn: witaIso("2026-09-02", "09:30"), autoClosed: true },
    ];
    const result = computeMonthlyPunctuality([baseClass], shifts, instructors, SEPT.year, SEPT.month);
    expect(result).toHaveLength(1);
    expect(result[0].autoClosedCount).toBe(1);
  });

  // Same root cause as the getTodaysClasses gap: "Fri Only", "Sat Only" and
  // "Everyday" are not recognised, so those classes are treated like Private
  // lessons — absences are never counted and every attended shift is "on time".
  it.fails("schedules sessions for a 'Sat Only' class (so absences can be counted)", () => {
    const saturday = { ...baseClass, id: "f1", classDay: "Sat Only" };
    const [stats] = computeMonthlyPunctuality([saturday], [], instructors, SEPT.year, SEPT.month);
    expect(stats.sessionsScheduled).toBe(4); // Saturdays: 5, 12, 19, 26
    expect(stats.absent).toBe(4);
  });
});
