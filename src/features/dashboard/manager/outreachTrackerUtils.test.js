import { describe, expect, it } from "vitest";
import {
  calculateCoverage,
  filterVisitsByOfficer,
  calculateWeeklyMetrics,
  getFollowUpSchools,
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
