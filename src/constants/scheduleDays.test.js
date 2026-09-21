import { describe, it, expect } from "vitest";
import {
  parseScheduleDayCodes,
  parseClassDayNumbers,
  doDaysOverlap,
  CANONICAL_SCHEDULE_DAYS,
} from "./scheduleDays.js";

describe("scheduleDays constants and helpers", () => {
  it("defines standard canonical frequencies including Mon - Fri", () => {
    expect(CANONICAL_SCHEDULE_DAYS["mon/wed"].codes).toEqual(["mon", "wed"]);
    expect(CANONICAL_SCHEDULE_DAYS["tue/thu"].codes).toEqual(["tue", "thu"]);
    expect(CANONICAL_SCHEDULE_DAYS["mon - fri"].codes).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    expect(CANONICAL_SCHEDULE_DAYS["mon - fri"].numbers).toEqual([1, 2, 3, 4, 5]);
    expect(CANONICAL_SCHEDULE_DAYS["sat/sun"].codes).toEqual(["sat", "sun"]);
    expect(CANONICAL_SCHEDULE_DAYS["everyday"].codes).toEqual(["sat", "sun", "mon", "tue", "wed", "thu"]);
  });

  describe("parseScheduleDayCodes", () => {
    it("parses Mon - Fri variations into 5 weekday codes", () => {
      expect([...parseScheduleDayCodes("Mon - Fri")]).toEqual(["mon", "tue", "wed", "thu", "fri"]);
      expect([...parseScheduleDayCodes("Mon-Fri")]).toEqual(["mon", "tue", "wed", "thu", "fri"]);
      expect([...parseScheduleDayCodes("Monday to Friday")]).toEqual(["mon", "tue", "wed", "thu", "fri"]);
      expect([...parseScheduleDayCodes("Weekdays")]).toEqual(["mon", "tue", "wed", "thu", "fri"]);
    });

    it("parses slash separated frequencies", () => {
      expect([...parseScheduleDayCodes("Mon/Wed")]).toEqual(["mon", "wed"]);
      expect([...parseScheduleDayCodes("Tue/Thu")]).toEqual(["tue", "thu"]);
      expect([...parseScheduleDayCodes("Sat/Sun")]).toEqual(["sat", "sun"]);
    });

    it("parses single day with only", () => {
      expect([...parseScheduleDayCodes("Sat Only")]).toEqual(["sat"]);
      expect([...parseScheduleDayCodes("Fri Only")]).toEqual(["fri"]);
    });

    it("returns empty set for null, empty or invalid strings", () => {
      expect(parseScheduleDayCodes("").size).toBe(0);
      expect(parseScheduleDayCodes(null).size).toBe(0);
    });
  });

  describe("parseClassDayNumbers", () => {
    it("returns [1, 2, 3, 4, 5] for Mon - Fri", () => {
      expect(parseClassDayNumbers("Mon - Fri")).toEqual([1, 2, 3, 4, 5]);
      expect(parseClassDayNumbers("mon-fri")).toEqual([1, 2, 3, 4, 5]);
    });

    it("returns [1, 3] for Mon/Wed and [2, 4] for Tue/Thu", () => {
      expect(parseClassDayNumbers("Mon/Wed")).toEqual([1, 3]);
      expect(parseClassDayNumbers("Tue/Thu")).toEqual([2, 4]);
    });

    it("returns [6, 0] for Sat/Sun", () => {
      expect(parseClassDayNumbers("Sat/Sun")).toEqual([6, 0]);
    });

    it("returns null for Private classes", () => {
      expect(parseClassDayNumbers("Private 1-on-1")).toBeNull();
      expect(parseClassDayNumbers("VIP Private")).toBeNull();
    });
  });

  describe("doDaysOverlap", () => {
    it("detects Mon - Fri overlaps with Mon/Wed, Tue/Thu, and Fri Only", () => {
      expect(doDaysOverlap("Mon - Fri", "Mon/Wed")).toBe(true);
      expect(doDaysOverlap("Mon - Fri", "Tue/Thu")).toBe(true);
      expect(doDaysOverlap("Mon - Fri", "Fri Only")).toBe(true);
    });

    it("confirms Mon - Fri NEVER overlaps with Sat Only, Sun Only, or Sat/Sun", () => {
      expect(doDaysOverlap("Mon - Fri", "Sat Only")).toBe(false);
      expect(doDaysOverlap("Mon - Fri", "Sun Only")).toBe(false);
      expect(doDaysOverlap("Mon - Fri", "Sat/Sun")).toBe(false);
    });

    it("confirms Mon/Wed and Tue/Thu do not overlap", () => {
      expect(doDaysOverlap("Mon/Wed", "Tue/Thu")).toBe(false);
    });
  });
});
