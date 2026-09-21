/* global process */
import { afterEach, describe, expect, it } from "vitest";
import {
  formatWitaForInput,
  getTodayWitaWeekday,
  parseWitaInputToUtcIso,
  startOfTodayWitaIso,
  todayWita,
  validateHHmm,
} from "./dateWita.js";

// WITA = UTC+8, no daylight saving. Midnight WITA is 16:00 UTC the day before.
const JUST_BEFORE_MIDNIGHT = new Date("2026-09-20T15:59:59.999Z"); // Sun 23:59:59 WITA
const MIDNIGHT = new Date("2026-09-20T16:00:00.000Z"); // Mon 00:00:00 WITA

describe("todayWita", () => {
  it("rolls over to the next WITA day exactly at 16:00 UTC", () => {
    expect(todayWita(JUST_BEFORE_MIDNIGHT)).toBe("2026-09-20");
    expect(todayWita(MIDNIGHT)).toBe("2026-09-21");
  });

  it("handles the new-year boundary", () => {
    expect(todayWita(new Date("2026-12-31T15:59:59Z"))).toBe("2026-12-31");
    expect(todayWita(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
  });

  it("handles a leap day", () => {
    expect(todayWita(new Date("2028-02-28T16:00:00Z"))).toBe("2028-02-29");
  });
});

describe("getTodayWitaWeekday", () => {
  it("returns 0 for Sunday and 1 for Monday around WITA midnight", () => {
    expect(getTodayWitaWeekday(JUST_BEFORE_MIDNIGHT)).toBe(0);
    expect(getTodayWitaWeekday(MIDNIGHT)).toBe(1);
  });
});

describe("startOfTodayWitaIso", () => {
  it("returns 00:00 WITA expressed in UTC", () => {
    expect(startOfTodayWitaIso(new Date("2026-09-21T05:30:00Z"))).toBe("2026-09-20T16:00:00.000Z");
  });

  it("is stable at the exact boundary", () => {
    expect(startOfTodayWitaIso(MIDNIGHT)).toBe("2026-09-20T16:00:00.000Z");
    expect(startOfTodayWitaIso(JUST_BEFORE_MIDNIGHT)).toBe("2026-09-19T16:00:00.000Z");
  });
});

describe("device timezone independence", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it.each(["UTC", "America/Los_Angeles", "Pacific/Auckland"])(
    "gives identical answers when the device is set to %s",
    (tz) => {
      process.env.TZ = tz;
      expect(todayWita(MIDNIGHT)).toBe("2026-09-21");
      expect(getTodayWitaWeekday(MIDNIGHT)).toBe(1);
      expect(startOfTodayWitaIso(MIDNIGHT)).toBe("2026-09-20T16:00:00.000Z");
      expect(formatWitaForInput("2026-09-20T16:00:00.000Z")).toBe("2026-09-21T00:00");
      expect(parseWitaInputToUtcIso("2026-09-21T00:00")).toBe("2026-09-20T16:00:00.000Z");
    }
  );
});

describe("formatWitaForInput / parseWitaInputToUtcIso", () => {
  it("formats a UTC ISO string as a WITA wall-clock value", () => {
    expect(formatWitaForInput("2026-09-21T00:30:00.000Z")).toBe("2026-09-21T08:30");
  });

  it.each([null, undefined, "", "not a date"])("returns an empty string for %s", (input) => {
    expect(formatWitaForInput(input)).toBe("");
  });

  it("parses an input value back to UTC", () => {
    expect(parseWitaInputToUtcIso("2026-09-21T08:30")).toBe("2026-09-21T00:30:00.000Z");
  });

  it("round-trips without drifting", () => {
    const iso = "2026-03-01T22:15:00.000Z";
    expect(parseWitaInputToUtcIso(formatWitaForInput(iso))).toBe(iso);
  });

  it.each([null, "", "2026-09-21", "21/09/2026 08:30", "garbage"])(
    "returns null for unusable input %s",
    (input) => {
      expect(parseWitaInputToUtcIso(input)).toBeNull();
    }
  );
});

describe("validateHHmm", () => {
  it.each(["00:00", "9:00", "09:00", "12:30", "23:59", " 09:00 "])("accepts %s", (v) => {
    expect(validateHHmm(v)).toBe(true);
  });

  it.each(["24:00", "12:60", "9", "09:0", "ab:cd", "", "09-00", null, undefined, 900])(
    "rejects %s",
    (v) => {
      expect(validateHHmm(v)).toBe(false);
    }
  );
});
