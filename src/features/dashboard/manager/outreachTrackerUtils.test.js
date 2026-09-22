import { describe, expect, it } from "vitest";
import {
  calculateCoverage,
  filterVisitsByOfficer,
  calculateWeeklyMetrics,
  getFollowUpSchools,
  normalizeVisitDate,
} from "./outreachTrackerUtils.js";

describe("outreachTrackerUtils", () => {
  describe("calculateCoverage", () => {
    it("calculates visited percentage from active schools only", () => {
      const schools = [
        { id: "1", name: "School 1", status: "visited", active: true },
        { id: "2", name: "School 2", status: "pending", active: true },
        { id: "3", name: "School 3", status: "scheduled", active: true },
        { id: "4", name: "School 4", status: "visited", active: true },
        { id: "5", name: "Inactive School", status: "visited", active: false },
      ];

      const res = calculateCoverage(schools);
      expect(res.total).toBe(4);
      expect(res.visited).toBe(2);
      expect(res.percentage).toBe(50);
    });

    it("handles empty school list without dividing by zero", () => {
      const res = calculateCoverage([]);
      expect(res.total).toBe(0);
      expect(res.visited).toBe(0);
      expect(res.percentage).toBe(0);
    });
  });

  describe("filterVisitsByOfficer", () => {
    it("returns all visits when officerId is all", () => {
      const visits = [
        { id: "v1", createdBy: "user-1" },
        { id: "v2", createdBy: "user-2" },
      ];
      expect(filterVisitsByOfficer(visits, "all").length).toBe(2);
    });

    it("filters visits by specific officer UID", () => {
      const visits = [
        { id: "v1", createdBy: "user-1" },
        { id: "v2", createdBy: "user-2" },
        { id: "v3", createdBy: "user-1" },
      ];
      const res = filterVisitsByOfficer(visits, "user-1");
      expect(res.length).toBe(2);
      expect(res.every((v) => v.createdBy === "user-1")).toBe(true);
    });
  });

  describe("calculateWeeklyMetrics", () => {
    it("sums visits, flyers, and leads within WITA week boundaries", () => {
      const visits = [
        {
          id: "v1",
          visitDate: "2026-09-21", // Inside week (Mon)
          flyersHandedOut: 30,
          leadsCollected: 10,
        },
        {
          id: "v2",
          visitDate: "2026-09-23", // Inside week (Wed)
          flyersHandedOut: 50,
          leadsCollected: 15,
        },
        {
          id: "v3",
          visitDate: "2026-09-15", // Prior week
          flyersHandedOut: 100,
          leadsCollected: 50,
        },
      ];

      const res = calculateWeeklyMetrics(visits, "2026-09-21", "2026-09-27");
      expect(res.visitsCount).toBe(2);
      expect(res.flyersCount).toBe(80);
      expect(res.leadsCount).toBe(25);
    });

    it("handles missing dates or empty visits safely", () => {
      const res = calculateWeeklyMetrics([], "2026-09-21", "2026-09-27");
      expect(res.visitsCount).toBe(0);
      expect(res.flyersCount).toBe(0);
      expect(res.leadsCount).toBe(0);
    });

    it("defensively handles ISO strings, Date objects, and Timestamp objects without miscounting", () => {
      const visits = [
        {
          id: "v-iso",
          visitDate: "2026-09-27T18:30:00.000Z", // End of week with time component
          flyersHandedOut: 15,
          leadsCollected: 5,
        },
        {
          id: "v-date",
          visitDate: new Date(2026, 8, 22), // Sep 22, 2026 (local date)
          flyersHandedOut: 20,
          leadsCollected: 8,
        },
        {
          id: "v-timestamp",
          visitDate: { toDate: () => new Date("2026-09-25T10:00:00Z") },
          flyersHandedOut: 10,
          leadsCollected: 2,
        },
        {
          id: "v-invalid",
          visitDate: "not-a-valid-date",
          flyersHandedOut: 99,
          leadsCollected: 99,
        },
        {
          id: "v-outside",
          visitDate: "2026-09-28T01:00:00.000Z", // Next week Monday
          flyersHandedOut: 50,
          leadsCollected: 20,
        },
      ];

      const res = calculateWeeklyMetrics(visits, "2026-09-21", "2026-09-27");
      expect(res.visitsCount).toBe(3);
      expect(res.flyersCount).toBe(45);
      expect(res.leadsCount).toBe(15);
      expect(res.weeklyVisits.map((v) => v.id)).toEqual(["v-iso", "v-date", "v-timestamp"]);
    });
  });

  describe("normalizeVisitDate", () => {
    it("returns YYYY-MM-DD for standard date strings", () => {
      expect(normalizeVisitDate("2026-09-21")).toBe("2026-09-21");
      expect(normalizeVisitDate("  2026-12-05  ")).toBe("2026-12-05");
    });

    it("extracts leading YYYY-MM-DD from ISO strings", () => {
      expect(normalizeVisitDate("2026-09-27T18:30:00.000Z")).toBe("2026-09-27");
      expect(normalizeVisitDate("2026-09-21 14:00:00")).toBe("2026-09-21");
    });

    it("handles Date instances, Timestamp objects, and epoch timestamps", () => {
      const d = new Date(2026, 8, 23);
      expect(normalizeVisitDate(d)).toBe("2026-09-23");

      const ts = { toDate: () => new Date(2026, 8, 24) };
      expect(normalizeVisitDate(ts)).toBe("2026-09-24");

      const secTs = { seconds: Math.floor(new Date(2026, 8, 25).getTime() / 1000) };
      expect(normalizeVisitDate(secTs)).toBe("2026-09-25");
    });

    it("returns null for invalid or empty inputs", () => {
      expect(normalizeVisitDate(null)).toBeNull();
      expect(normalizeVisitDate(undefined)).toBeNull();
      expect(normalizeVisitDate("")).toBeNull();
      expect(normalizeVisitDate("invalid-date-string")).toBeNull();
    });
  });

  describe("getFollowUpSchools", () => {
    it("extracts active schools with status follow_up or nextActionDate", () => {
      const schools = [
        { id: "s1", status: "follow_up", active: true },
        { id: "s2", status: "visited", nextActionDate: "2026-09-30", active: true },
        { id: "s3", status: "visited", nextActionDate: "", active: true },
        { id: "s4", status: "follow_up", active: false }, // Inactive excluded
      ];

      const res = getFollowUpSchools(schools);
      expect(res.length).toBe(2);
      expect(res.map((s) => s.id)).toEqual(["s1", "s2"]);
    });
  });
});
