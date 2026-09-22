import { describe, expect, it } from "vitest";
import { isEventEligible, findMatchingCorporateEvents } from "./corporateEvents.js";

describe("corporateEvents - isEventEligible", () => {
  const dateToday = "2026-09-22";

  const makeEvent = (overrides = {}) => ({
    id: "evt-1",
    name: "General Assembly",
    eventDate: dateToday,
    audienceType: "all",
    audienceValue: null,
    status: "active",
    ...overrides,
  });

  describe("status and date checks", () => {
    it("rejects cancelled events", () => {
      const evt = makeEvent({ status: "cancelled" });
      const user = { role: "instructor", branch: "Kota Gorontalo" };
      expect(isEventEligible(evt, user, dateToday)).toBe(false);
    });

    it("rejects events on a different date", () => {
      const evt = makeEvent({ eventDate: "2026-09-23" });
      const user = { role: "instructor", branch: "Kota Gorontalo" };
      expect(isEventEligible(evt, user, dateToday)).toBe(false);
    });

    it("returns false if user is missing", () => {
      const evt = makeEvent();
      expect(isEventEligible(evt, null, dateToday)).toBe(false);
    });
  });

  describe("audienceType: 'all'", () => {
    it("matches students", () => {
      const evt = makeEvent({ audienceType: "all" });
      const user = { role: "student", branch: "Bone Bolango" };
      expect(isEventEligible(evt, user, dateToday)).toBe(true);
    });

    it("matches instructors and general staff", () => {
      const evt = makeEvent({ audienceType: "all" });
      expect(isEventEligible(evt, { role: "instructor" }, dateToday)).toBe(true);
      expect(isEventEligible(evt, { role: "frontoffice" }, dateToday)).toBe(true);
      expect(isEventEligible(evt, { role: "marketing" }, dateToday)).toBe(true);
      expect(isEventEligible(evt, { role: "officeboy" }, dateToday)).toBe(true);
      expect(isEventEligible(evt, { role: "admin" }, dateToday)).toBe(true);
    });

    it("matches managers", () => {
      const evt = makeEvent({ audienceType: "all" });
      expect(isEventEligible(evt, { role: "manager" }, dateToday)).toBe(true);
    });
  });

  describe("audienceType: 'branch'", () => {
    const branchEvt = makeEvent({
      audienceType: "branch",
      audienceValue: "Kota Gorontalo",
    });

    it("matches exact branch", () => {
      expect(
        isEventEligible(branchEvt, { role: "instructor", branch: "Kota Gorontalo" }, dateToday)
      ).toBe(true);
      expect(
        isEventEligible(branchEvt, { role: "student", branch: "Kota Gorontalo" }, dateToday)
      ).toBe(true);
      expect(
        isEventEligible(branchEvt, { role: "manager", branch: "Kota Gorontalo" }, dateToday)
      ).toBe(true);
    });

    it("matches legacy branch aliases through normalization", () => {
      expect(
        isEventEligible(branchEvt, { role: "instructor", branch: "cabang utama" }, dateToday)
      ).toBe(true);
      expect(
        isEventEligible(branchEvt, { role: "student", branch: "Gorontalo" }, dateToday)
      ).toBe(true);
    });

    it("rejects users from different branch", () => {
      expect(
        isEventEligible(branchEvt, { role: "instructor", branch: "Bone Bolango" }, dateToday)
      ).toBe(false);
      expect(
        isEventEligible(branchEvt, { role: "student", branch: "Pohuwato" }, dateToday)
      ).toBe(false);
    });
  });

  describe("audienceType: 'division'", () => {
    const kgEvt = makeEvent({
      audienceType: "division",
      audienceValue: "kindergarten",
    });

    it("matches kindergarten staff", () => {
      expect(
        isEventEligible(kgEvt, { role: "instructor", division: "kindergarten" }, dateToday)
      ).toBe(true);
      expect(
        isEventEligible(kgEvt, { role: "manager", division: "kindergarten" }, dateToday)
      ).toBe(true);
    });

    it("matches kindergarten students derived from program", () => {
      expect(
        isEventEligible(kgEvt, { role: "student", programId: "kids_school" }, dateToday)
      ).toBe(true);
      expect(
        isEventEligible(kgEvt, { role: "student", program: "Kids School" }, dateToday)
      ).toBe(true);
    });

    it("rejects courses staff and students", () => {
      expect(
        isEventEligible(kgEvt, { role: "instructor", division: "courses" }, dateToday)
      ).toBe(false);
      expect(
        isEventEligible(kgEvt, { role: "student", programId: "english_course" }, dateToday)
      ).toBe(false);
    });
  });

  describe("audienceType: 'role'", () => {
    const managerEvt = makeEvent({
      audienceType: "role",
      audienceValue: "manager",
    });

    it("matches manager role", () => {
      expect(isEventEligible(managerEvt, { role: "manager" }, dateToday)).toBe(true);
    });

    it("rejects other staff roles", () => {
      expect(isEventEligible(managerEvt, { role: "instructor" }, dateToday)).toBe(false);
      expect(isEventEligible(managerEvt, { role: "frontoffice" }, dateToday)).toBe(false);
      expect(isEventEligible(managerEvt, { role: "admin" }, dateToday)).toBe(false);
    });

    it("never matches students on role dimension", () => {
      const studentEvt = makeEvent({
        audienceType: "role",
        audienceValue: "student",
      });
      expect(isEventEligible(studentEvt, { role: "student" }, dateToday)).toBe(false);
    });
  });
});

describe("corporateEvents - findMatchingCorporateEvents", () => {
  const dateToday = "2026-09-22";

  it("returns match: null and count: 0 when no events match", () => {
    const events = [
      {
        id: "evt-1",
        name: "Limboto Meeting",
        eventDate: dateToday,
        audienceType: "branch",
        audienceValue: "Limboto",
        status: "active",
      },
    ];
    const user = { role: "instructor", branch: "Kota Gorontalo" };
    const result = findMatchingCorporateEvents(events, user, dateToday);
    expect(result).toEqual({ match: null, count: 0, ambiguous: false });
  });

  it("returns match: event and count: 1 when exactly one event matches", () => {
    const events = [
      {
        id: "evt-1",
        name: "Campus Training",
        eventDate: dateToday,
        audienceType: "branch",
        audienceValue: "Kota Gorontalo",
        status: "active",
      },
      {
        id: "evt-2",
        name: "Limboto Training",
        eventDate: dateToday,
        audienceType: "branch",
        audienceValue: "Limboto",
        status: "active",
      },
    ];
    const user = { role: "instructor", branch: "Kota Gorontalo" };
    const result = findMatchingCorporateEvents(events, user, dateToday);
    expect(result.count).toBe(1);
    expect(result.ambiguous).toBe(false);
    expect(result.match.id).toBe("evt-1");
  });

  it("returns ambiguous: true and match: null when two or more events match", () => {
    const events = [
      {
        id: "evt-1",
        name: "All-Hands Morning",
        eventDate: dateToday,
        audienceType: "all",
        audienceValue: null,
        status: "active",
      },
      {
        id: "evt-2",
        name: "Instructor Afternoon Workshop",
        eventDate: dateToday,
        audienceType: "role",
        audienceValue: "instructor",
        status: "active",
      },
    ];
    const user = { role: "instructor", branch: "Kota Gorontalo" };
    const result = findMatchingCorporateEvents(events, user, dateToday);
    expect(result.count).toBe(2);
    expect(result.ambiguous).toBe(true);
    expect(result.match).toBeNull();
    expect(result.matchedEvents).toHaveLength(2);
  });
});
