import { describe, expect, it } from "vitest";
import {
  checkDraftConflicts,
  doDaysOverlap,
  doTimesOverlap,
  findScheduleConflicts,
  parseTimeMinutes,
} from "./scheduleConflict.js";

const cls = (over) => ({
  id: "c",
  className: "Batch",
  classDay: "Mon/Wed",
  startTime: "10:00",
  endTime: "11:30",
  instructorId: "i1",
  classRoom: "Room A",
  status: "open",
  ...over,
});

describe("parseTimeMinutes", () => {
  it("converts HH:MM to minutes since midnight", () => {
    expect(parseTimeMinutes("00:00")).toBe(0);
    expect(parseTimeMinutes("09:30")).toBe(570);
    expect(parseTimeMinutes("23:59")).toBe(1439);
  });

  it.each([null, undefined, "", "abc", "9", 930])("returns NaN for %s", (v) => {
    expect(parseTimeMinutes(v)).toBeNaN();
  });
});

describe("doDaysOverlap", () => {
  it("detects a shared weekday between the dropdown values", () => {
    expect(doDaysOverlap("Mon/Wed", "Mon/Wed")).toBe(true);
    expect(doDaysOverlap("Sat Only", "Everyday")).toBe(true);
    expect(doDaysOverlap("Mon/Wed", "Everyday")).toBe(true);
  });

  it("returns false when no weekday is shared", () => {
    expect(doDaysOverlap("Mon/Wed", "Tue/Thu")).toBe(false);
    expect(doDaysOverlap("Sat Only", "Sat/Sun")).toBe(true);
    expect(doDaysOverlap("Sat/Sun", "Fri Only")).toBe(false);
  });

  it("returns false when either side is missing", () => {
    expect(doDaysOverlap("", "Mon/Wed")).toBe(false);
    expect(doDaysOverlap("Mon/Wed", undefined)).toBe(false);
  });

  it("understands unknown values that use the same 'Day/Day' shape", () => {
    expect(doDaysOverlap("Mon/Thu", "Thu/Fri")).toBe(true);
    expect(doDaysOverlap("Mon/Thu", "Tue/Fri")).toBe(false);
  });

  it("treats 'Everyday' as a school-week batch (Sat–Thu) that overlaps a Saturday class", () => {
    expect(doDaysOverlap("Everyday", "Sat Only")).toBe(true);
  });

  it("treats 'Everyday' as overlapping a Sunday-only class", () => {
    expect(doDaysOverlap("Everyday", "Sun Only")).toBe(true);
  });

  it("does not treat 'Everyday' as overlapping a legacy Friday-only class", () => {
    expect(doDaysOverlap("Everyday", "Fri Only")).toBe(false);
  });
});

describe("doTimesOverlap", () => {
  it("detects overlapping intervals", () => {
    expect(doTimesOverlap(600, 690, 660, 750)).toBe(true);
    expect(doTimesOverlap(600, 690, 600, 690)).toBe(true);
    expect(doTimesOverlap(600, 720, 630, 660)).toBe(true); // one inside the other
  });

  it("does not treat back-to-back classes as a clash", () => {
    expect(doTimesOverlap(600, 690, 690, 780)).toBe(false);
    expect(doTimesOverlap(690, 780, 600, 690)).toBe(false);
  });

  it("returns false for clearly separate intervals", () => {
    expect(doTimesOverlap(600, 690, 800, 900)).toBe(false);
  });
});

describe("findScheduleConflicts", () => {
  it("returns empty lists for empty or missing input", () => {
    expect(findScheduleConflicts([])).toEqual({ teacherConflicts: [], roomConflicts: [] });
    expect(findScheduleConflicts(undefined)).toEqual({ teacherConflicts: [], roomConflicts: [] });
  });

  it("finds an instructor double-booking", () => {
    const a = cls({ id: "a", classRoom: "Room A" });
    const b = cls({ id: "b", classRoom: "Room B", startTime: "11:00", endTime: "12:00" });
    const { teacherConflicts, roomConflicts } = findScheduleConflicts([a, b]);
    expect(teacherConflicts).toHaveLength(1);
    expect(teacherConflicts[0]).toMatchObject({ type: "teacher", classA: a, classB: b });
    expect(roomConflicts).toHaveLength(0);
  });

  it("finds a room double-booking, ignoring case and stray spaces in the room name", () => {
    const a = cls({ id: "a", instructorId: "i1", classRoom: "Room A" });
    const b = cls({ id: "b", instructorId: "i2", classRoom: "  room a " });
    const { teacherConflicts, roomConflicts } = findScheduleConflicts([a, b]);
    expect(roomConflicts).toHaveLength(1);
    expect(teacherConflicts).toHaveLength(0);
  });

  it("reports both kinds when instructor and room clash together", () => {
    const { teacherConflicts, roomConflicts } = findScheduleConflicts([
      cls({ id: "a" }),
      cls({ id: "b" }),
    ]);
    expect(teacherConflicts).toHaveLength(1);
    expect(roomConflicts).toHaveLength(1);
  });

  it("does not flag classes on different days, or back-to-back classes", () => {
    const a = cls({ id: "a" });
    expect(
      findScheduleConflicts([a, cls({ id: "b", classDay: "Tue/Thu" })]).teacherConflicts
    ).toHaveLength(0);
    expect(
      findScheduleConflicts([a, cls({ id: "c", startTime: "11:30", endTime: "13:00" })])
        .teacherConflicts
    ).toHaveLength(0);
  });

  it("ignores completed and cancelled classes", () => {
    const a = cls({ id: "a" });
    expect(
      findScheduleConflicts([a, cls({ id: "b", status: "completed" })]).teacherConflicts
    ).toHaveLength(0);
    expect(
      findScheduleConflicts([a, cls({ id: "c", status: "Cancelled" })]).teacherConflicts
    ).toHaveLength(0);
  });

  it("treats a missing status as open (still checked)", () => {
    const { teacherConflicts } = findScheduleConflicts([
      cls({ id: "a", status: undefined }),
      cls({ id: "b", status: undefined }),
    ]);
    expect(teacherConflicts).toHaveLength(1);
  });

  it("skips classes with missing or malformed times instead of crashing", () => {
    const a = cls({ id: "a" });
    expect(() =>
      findScheduleConflicts([a, cls({ id: "b", startTime: "" }), cls({ id: "c", endTime: "soon" })])
    ).not.toThrow();
    expect(
      findScheduleConflicts([a, cls({ id: "b", startTime: "" })]).teacherConflicts
    ).toHaveLength(0);
  });

  it("does not flag two classes that have no instructor or no room assigned", () => {
    const a = cls({ id: "a", instructorId: "", classRoom: "" });
    const b = cls({ id: "b", instructorId: "", classRoom: "" });
    const { teacherConflicts, roomConflicts } = findScheduleConflicts([a, b]);
    expect(teacherConflicts).toHaveLength(0);
    expect(roomConflicts).toHaveLength(0);
  });

  it("reports each clashing pair once", () => {
    const three = [cls({ id: "a" }), cls({ id: "b" }), cls({ id: "c" })];
    expect(findScheduleConflicts(three).teacherConflicts).toHaveLength(3); // ab, ac, bc
  });

  it("writes a readable message that names both classes", () => {
    const { teacherConflicts } = findScheduleConflicts([
      cls({ id: "a", className: "Alpha" }),
      cls({ id: "b", className: "Beta" }),
    ]);
    expect(teacherConflicts[0].detail).toContain("Alpha");
    expect(teacherConflicts[0].detail).toContain("Beta");
  });
});

describe("checkDraftConflicts", () => {
  const existing = [cls({ id: "e1", classRoom: "Room B" })];

  it("returns nothing for a missing draft", () => {
    expect(checkDraftConflicts(null, existing)).toEqual({
      teacherConflicts: [],
      roomConflicts: [],
    });
  });

  it("flags a draft that clashes with an existing class", () => {
    const draft = cls({ id: undefined, className: "New", startTime: "10:30", endTime: "12:00" });
    const { teacherConflicts } = checkDraftConflicts(draft, existing);
    expect(teacherConflicts).toHaveLength(1);
  });

  it("does not make an edited batch clash with its own saved version", () => {
    const draft = cls({ id: "e1", classRoom: "Room B" });
    expect(checkDraftConflicts(draft, existing)).toEqual({
      teacherConflicts: [],
      roomConflicts: [],
    });
  });

  it("gives a clean result for a draft that fits", () => {
    const draft = cls({ id: undefined, classDay: "Tue/Thu" });
    expect(checkDraftConflicts(draft, existing)).toEqual({
      teacherConflicts: [],
      roomConflicts: [],
    });
  });

  // Open to debate: BatchModal shows a warning whenever this function returns
  // anything. Right now it returns clashes between OTHER classes as well, so if
  // two saved classes already overlap, every new draft shows a warning that is
  // not about the draft.
  it("only reports clashes that involve the draft itself", () => {
    const alreadyClashing = [cls({ id: "x1" }), cls({ id: "x2" })];
    const unrelatedDraft = cls({
      id: undefined,
      classDay: "Sat Only",
      instructorId: "i9",
      classRoom: "Room Z",
    });
    const result = checkDraftConflicts(unrelatedDraft, alreadyClashing);
    expect(result.teacherConflicts).toHaveLength(0);
    expect(result.roomConflicts).toHaveLength(0);
  });

  describe("multi-campus branch conflict handling", () => {
    it("does not report room conflicts when identical room names belong to different branches", () => {
      const clsPohuwato = cls({
        id: "p1",
        className: "Pohuwato Batch",
        branch: "Pohuwato",
        classRoom: "Main Campus",
        instructorId: "inst1",
      });
      const clsGorontalo = cls({
        id: "g1",
        className: "Gorontalo Batch",
        branch: "Kota Gorontalo",
        classRoom: "Main Campus",
        instructorId: "inst2",
      });

      const { roomConflicts, teacherConflicts } = findScheduleConflicts([
        clsPohuwato,
        clsGorontalo,
      ]);
      expect(roomConflicts).toHaveLength(0);
      expect(teacherConflicts).toHaveLength(0);
    });

    it("reports room conflicts when identical room names belong to the same branch", () => {
      const cls1 = cls({
        id: "g1",
        className: "Batch 1",
        branch: "Kota Gorontalo",
        classRoom: "Lab A",
        instructorId: "inst1",
      });
      const cls2 = cls({
        id: "g2",
        className: "Batch 2",
        branch: "Kota Gorontalo",
        classRoom: "Lab A",
        instructorId: "inst2",
      });

      const { roomConflicts } = findScheduleConflicts([cls1, cls2]);
      expect(roomConflicts).toHaveLength(1);
      expect(roomConflicts[0].detail).toContain("Kota Gorontalo");
    });

    it("reports teacher conflict if the same instructor is scheduled across different branches", () => {
      const cls1 = cls({
        id: "g1",
        className: "Batch 1",
        branch: "Kota Gorontalo",
        classRoom: "Room A",
        instructorId: "shared-instructor",
      });
      const cls2 = cls({
        id: "b1",
        className: "Batch 2",
        branch: "Bone Bolango",
        classRoom: "Room B",
        instructorId: "shared-instructor",
      });

      const { teacherConflicts, roomConflicts } = findScheduleConflicts([cls1, cls2]);
      expect(roomConflicts).toHaveLength(0);
      expect(teacherConflicts).toHaveLength(1);
    });

    it("respects draft.branch in checkDraftConflicts", () => {
      const existing = [
        cls({
          id: "ex1",
          branch: "Kota Gorontalo",
          classRoom: "Room 1",
          instructorId: "inst1",
        }),
      ];
      const draftDifferentBranch = cls({
        id: undefined,
        branch: "Limboto",
        classRoom: "Room 1",
        instructorId: "inst2",
      });
      const draftSameBranch = cls({
        id: undefined,
        branch: "Kota Gorontalo",
        classRoom: "Room 1",
        instructorId: "inst2",
      });

      expect(checkDraftConflicts(draftDifferentBranch, existing).roomConflicts).toHaveLength(0);
      expect(checkDraftConflicts(draftSameBranch, existing).roomConflicts).toHaveLength(1);
    });
  });
});
