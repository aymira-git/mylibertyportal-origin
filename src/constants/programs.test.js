import { describe, it, expect } from "vitest";
import {
  PROGRAMS,
  PROGRAM_KEYS,
  DEFAULT_PROGRAM,
  normalizeProgram,
  getProgram,
  getBatchProgram,
  getStudentProgram,
  getEnabledPrograms,
  getEnabledProgramKeys,
  getProgramLevels,
  getProgramLevel,
  getProgramLevelLabel,
  isProgramWeekendOff,
  isValidScheduleForProgram,
  getProgramsByDivision,
} from "./programs.js";

describe("programs constants", () => {
  it("defines exactly the 5 company programs", () => {
    expect(PROGRAM_KEYS).toHaveLength(5);
    expect(PROGRAM_KEYS).toEqual([
      "english_course",
      "kids_course",
      "professional_school",
      "toefl",
      "kids_school",
    ]);
    expect(getProgram("english_course").label).toBe("English Course");
  });

  it("configures Kids School with dedicated Kindergarten operational settings", () => {
    const kidsSchool = PROGRAMS.kids_school;
    expect(kidsSchool.enabled).toBe(true);
    expect(kidsSchool.weekendOff).toBe(true);
    expect(kidsSchool.weekendAllowed).toBe(false);
    expect(kidsSchool.allowedDays).toEqual(["Mon - Fri"]);
    expect(kidsSchool.scheduleType).toBe("daily_school");
    expect(kidsSchool.defaultDay).toBe("Mon - Fri");
    expect(isProgramWeekendOff("kids_school")).toBe(true);
  });

  it("returns all 5 enabled programs in getEnabledPrograms", () => {
    const enabled = getEnabledPrograms();
    expect(enabled).toHaveLength(5);
    expect(getEnabledProgramKeys()).toEqual([
      "english_course",
      "kids_course",
      "professional_school",
      "toefl",
      "kids_school",
    ]);
  });

  it("filters programs by division using getProgramsByDivision", () => {
    const kindergartenProgs = getProgramsByDivision("kindergarten");
    expect(kindergartenProgs).toHaveLength(1);
    expect(kindergartenProgs[0].id).toBe("kids_school");

    const coursesProgs = getProgramsByDivision("courses");
    expect(coursesProgs).toHaveLength(4);
    expect(coursesProgs.map((p) => p.id)).toEqual([
      "english_course",
      "kids_course",
      "professional_school",
      "toefl",
    ]);

    const allProgs = getProgramsByDivision("all");
    expect(allProgs).toHaveLength(5);
  });

  describe("normalizeProgram", () => {
    it("normalizes Kids School variants correctly", () => {
      expect(normalizeProgram("Kids School")).toBe("kids_school");
      expect(normalizeProgram("kids_school")).toBe("kids_school");
      expect(normalizeProgram("Kindergarten")).toBe("kids_school");
      expect(normalizeProgram("TK")).toBe("kids_school");
      expect(normalizeProgram("TK-A")).toBe("kids_school");
      expect(normalizeProgram("TK-B")).toBe("kids_school");
      expect(normalizeProgram("Playgroup")).toBe("kids_school");
      expect(normalizeProgram("PAUD")).toBe("kids_school");
    });

    it("does not false-positive match words like network or toolkit as kids_school", () => {
      expect(normalizeProgram("Computer Networking")).toBe("english_course");
      expect(normalizeProgram("Teacher Toolkit")).toBe("english_course");
    });

    it("normalizes kids course variants to kids_course", () => {
      expect(normalizeProgram("Kids Course")).toBe("kids_course");
      expect(normalizeProgram("kids_course")).toBe("kids_course");
      expect(normalizeProgram("Young learners")).toBe("kids_course");
      expect(normalizeProgram("Cambridge Kids")).toBe("kids_course");
    });

    it("normalizes professional school variants", () => {
      expect(normalizeProgram("Professional School")).toBe("professional_school");
      expect(normalizeProgram("vocational")).toBe("professional_school");
      expect(normalizeProgram("business english")).toBe("professional_school");
      expect(normalizeProgram("Executive")).toBe("professional_school");
    });

    it("normalizes TOEFL / IELTS variants", () => {
      expect(normalizeProgram("TOEFL")).toBe("toefl");
      expect(normalizeProgram("TOEFL iBT")).toBe("toefl");
      expect(normalizeProgram("TOEFL ITP")).toBe("toefl");
      expect(normalizeProgram("toefl preparation")).toBe("toefl");
      expect(normalizeProgram("ielts")).toBe("toefl");
      expect(normalizeProgram("test prep")).toBe("toefl");
    });

    it("falls back to english_course for general or unrecognized inputs", () => {
      expect(normalizeProgram("")).toBe(DEFAULT_PROGRAM);
      expect(normalizeProgram(null)).toBe(DEFAULT_PROGRAM);
      expect(normalizeProgram(undefined)).toBe(DEFAULT_PROGRAM);
      expect(normalizeProgram("General English")).toBe("english_course");
      expect(normalizeProgram("unknown_xyz")).toBe("english_course");
    });
  });

  describe("getBatchProgram and getStudentProgram", () => {
    it("extracts programId when available", () => {
      expect(getBatchProgram({ programId: "toefl" })).toBe("toefl");
      expect(getStudentProgram({ programId: "kids_course" })).toBe("kids_course");
    });

    it("falls back to legacy program string", () => {
      expect(getBatchProgram({ program: "IELTS" })).toBe("toefl");
      expect(getStudentProgram({ program: "Young learners" })).toBe("kids_course");
    });

    it("falls back to default english_course for empty records", () => {
      expect(getBatchProgram({})).toBe("english_course");
      expect(getBatchProgram(null)).toBe("english_course");
      expect(getStudentProgram({})).toBe("english_course");
      expect(getStudentProgram(null)).toBe("english_course");
    });
  });

  describe("isValidScheduleForProgram", () => {
    it("prohibits weekend and everyday schedules for Kids School", () => {
      expect(isValidScheduleForProgram("kids_school", "Sat Only")).toBe(false);
      expect(isValidScheduleForProgram("kids_school", "Sat/Sun")).toBe(false);
      expect(isValidScheduleForProgram("kids_school", "Sun Only")).toBe(false);
      expect(isValidScheduleForProgram("kids_school", "Everyday")).toBe(false);
      expect(isValidScheduleForProgram("kids_school", "Mon - Fri")).toBe(true);
    });

    it("enforces allowedDays for Kids Course (no Everyday intensive)", () => {
      expect(isValidScheduleForProgram("kids_course", "Mon/Wed")).toBe(true);
      expect(isValidScheduleForProgram("kids_course", "Sat Only")).toBe(true);
      expect(isValidScheduleForProgram("kids_course", "Everyday")).toBe(false);
    });

    it("tolerates legacy Fri Only across programs", () => {
      expect(isValidScheduleForProgram("english_course", "Fri Only")).toBe(true);
      expect(isValidScheduleForProgram("kids_course", "Fri Only")).toBe(true);
    });

    it("allows standard schedules for English Course", () => {
      expect(isValidScheduleForProgram("english_course", "Mon/Wed")).toBe(true);
      expect(isValidScheduleForProgram("english_course", "Sat/Sun")).toBe(true);
      expect(isValidScheduleForProgram("english_course", "Sat Only")).toBe(true);
      expect(isValidScheduleForProgram("english_course", "Everyday")).toBe(true);
    });
  });

  describe("levels helper functions", () => {
    it("returns correct level progression for Kids School", () => {
      const levels = getProgramLevels("kids_school");
      expect(levels.map((l) => l.id)).toEqual(["nursery", "tk_a", "tk_b"]);
    });

    it("looks up specific level definitions by program and levelId", () => {
      const level = getProgramLevel("toefl", "toefl_mastery");
      expect(level).toBeDefined();
      expect(level.label).toBe("High Scorer (550+)");
      expect(level.stars).toBe(3);
    });

    it("returns formatted level labels", () => {
      expect(getProgramLevelLabel("kids_course", "starters")).toBe("Starters (Pre-A1)");
      expect(getProgramLevelLabel("professional_school", "prof_executive")).toBe("Executive Leadership");
      expect(getProgramLevelLabel("english_course", "epic")).toBe("Epic");
    });
  });
});
