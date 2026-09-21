import { describe, expect, it } from "vitest";
import {
  DIVISIONS,
  DEFAULT_DIVISION,
  DIVISION_LABELS,
  normalizeDivision,
  divisionOfProgram,
  matchesDivisionFilter,
  isKindergartenDivision,
  isCoursesDivision,
  isDivisionWeekendOff,
  isWorkDayForDivision,
} from "./divisions.js";

describe("divisions.js", () => {
  describe("constants and defaults", () => {
    it("exports canonical divisions array and default", () => {
      expect(DIVISIONS).toEqual(["courses", "kindergarten"]);
      expect(DEFAULT_DIVISION).toBe("courses");
      expect(DIVISION_LABELS.courses).toBeDefined();
      expect(DIVISION_LABELS.kindergarten).toBeDefined();
    });
  });

  describe("normalizeDivision", () => {
    it("falls back safely to DEFAULT_DIVISION on null, undefined, empty, or non-string", () => {
      expect(normalizeDivision(null)).toBe("courses");
      expect(normalizeDivision(undefined)).toBe("courses");
      expect(normalizeDivision("")).toBe("courses");
      expect(normalizeDivision("   ")).toBe("courses");
      expect(normalizeDivision(123)).toBe("courses");
    });

    it("normalizes standard division names case-insensitively with trimming", () => {
      expect(normalizeDivision("courses")).toBe("courses");
      expect(normalizeDivision("Courses")).toBe("courses");
      expect(normalizeDivision(" COURSES ")).toBe("courses");
      expect(normalizeDivision("kindergarten")).toBe("kindergarten");
      expect(normalizeDivision(" Kindergarten ")).toBe("kindergarten");
    });

    it("maps recognized kindergarten aliases", () => {
      expect(normalizeDivision("kids school")).toBe("kindergarten");
      expect(normalizeDivision("kids_school")).toBe("kindergarten");
      expect(normalizeDivision("tk")).toBe("kindergarten");
      expect(normalizeDivision("tk-a")).toBe("kindergarten");
      expect(normalizeDivision("tk-b")).toBe("kindergarten");
      expect(normalizeDivision("paud")).toBe("kindergarten");
      expect(normalizeDivision("playgroup")).toBe("kindergarten");
      expect(normalizeDivision("nursery")).toBe("kindergarten");
    });

    it("maps recognized courses aliases and unrecognized strings to courses", () => {
      expect(normalizeDivision("academy")).toBe("courses");
      expect(normalizeDivision("course")).toBe("courses");
      expect(normalizeDivision("unknown_thing")).toBe("courses");
    });
  });

  describe("divisionOfProgram", () => {
    it("maps kids_school program to kindergarten division", () => {
      expect(divisionOfProgram("kids_school")).toBe("kindergarten");
      expect(divisionOfProgram("Kids School")).toBe("kindergarten");
      expect(divisionOfProgram("kindergarten")).toBe("kindergarten");
      expect(divisionOfProgram("tk")).toBe("kindergarten");
      expect(divisionOfProgram("paud")).toBe("kindergarten");
    });

    it("maps all other educational programs to courses division", () => {
      expect(divisionOfProgram("english_course")).toBe("courses");
      expect(divisionOfProgram("kids_course")).toBe("courses");
      expect(divisionOfProgram("professional_school")).toBe("courses");
      expect(divisionOfProgram("toefl")).toBe("courses");
      expect(divisionOfProgram("")).toBe("courses");
      expect(divisionOfProgram(null)).toBe("courses");
    });
  });

  describe("matchesDivisionFilter", () => {
    it("returns true when filter is empty or 'all'", () => {
      expect(matchesDivisionFilter("courses", "all")).toBe(true);
      expect(matchesDivisionFilter("kindergarten", "all")).toBe(true);
      expect(matchesDivisionFilter(null, "all")).toBe(true);
      expect(matchesDivisionFilter("courses", "")).toBe(true);
      expect(matchesDivisionFilter("courses", null)).toBe(true);
    });

    it("matches canonical divisions accurately with normalization", () => {
      expect(matchesDivisionFilter("courses", "courses")).toBe(true);
      expect(matchesDivisionFilter("kindergarten", "kindergarten")).toBe(true);
      expect(matchesDivisionFilter("tk", "kindergarten")).toBe(true);
      expect(matchesDivisionFilter(null, "courses")).toBe(true); // legacy defaults to courses
      expect(matchesDivisionFilter("courses", "kindergarten")).toBe(false);
      expect(matchesDivisionFilter("kindergarten", "courses")).toBe(false);
    });
  });

  describe("division helpers", () => {
    it("isKindergartenDivision and isCoursesDivision return accurate booleans", () => {
      expect(isKindergartenDivision("kindergarten")).toBe(true);
      expect(isKindergartenDivision("tk")).toBe(true);
      expect(isKindergartenDivision("courses")).toBe(false);

      expect(isCoursesDivision("courses")).toBe(true);
      expect(isCoursesDivision(null)).toBe(true);
      expect(isCoursesDivision("kindergarten")).toBe(false);
    });

    it("isDivisionWeekendOff returns true for kindergarten and false for courses", () => {
      expect(isDivisionWeekendOff("kindergarten")).toBe(true);
      expect(isDivisionWeekendOff("courses")).toBe(false);
      expect(isDivisionWeekendOff(null)).toBe(false);
    });

    it("isWorkDayForDivision identifies working days correctly", () => {
      // 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat
      // Kindergarten: Mon-Fri working, Sat-Sun off
      expect(isWorkDayForDivision("kindergarten", 1)).toBe(true); // Mon
      expect(isWorkDayForDivision("kindergarten", 2)).toBe(true); // Tue
      expect(isWorkDayForDivision("kindergarten", 3)).toBe(true); // Wed
      expect(isWorkDayForDivision("kindergarten", 4)).toBe(true); // Thu
      expect(isWorkDayForDivision("kindergarten", 5)).toBe(true); // Fri
      expect(isWorkDayForDivision("kindergarten", 6)).toBe(false); // Sat (OFF)
      expect(isWorkDayForDivision("kindergarten", 0)).toBe(false); // Sun (OFF)

      // Courses: Fri off, Sat-Thu working
      expect(isWorkDayForDivision("courses", 6)).toBe(true); // Sat
      expect(isWorkDayForDivision("courses", 0)).toBe(true); // Sun
      expect(isWorkDayForDivision("courses", 1)).toBe(true); // Mon
      expect(isWorkDayForDivision("courses", 5)).toBe(false); // Fri (Rest day)
    });
  });
});
