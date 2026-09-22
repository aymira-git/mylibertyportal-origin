import { describe, expect, it } from "vitest";
import { extractEnrolledStudentIds } from "./useInstructorRoster.js";

describe("extractEnrolledStudentIds", () => {
  it("returns an empty array when class list is empty or undefined", () => {
    expect(extractEnrolledStudentIds()).toEqual([]);
    expect(extractEnrolledStudentIds([])).toEqual([]);
  });

  it("extracts unique student IDs from modern studentIds arrays", () => {
    const classes = [
      { id: "c1", studentIds: ["s1", "s2", "s3"] },
      { id: "c2", studentIds: ["s2", "s3", "s4"] },
    ];
    const result = extractEnrolledStudentIds(classes);
    expect(result.sort()).toEqual(["s1", "s2", "s3", "s4"]);
  });

  it("extracts student IDs from legacy enrollments objects", () => {
    const classes = [
      { id: "c1", enrollments: [{ studentId: "s1" }, { studentId: "s5" }] },
    ];
    const result = extractEnrolledStudentIds(classes);
    expect(result).toEqual(["s1", "s5"]);
  });

  it("handles mixed modern studentIds and legacy enrollments", () => {
    const classes = [
      { id: "c1", studentIds: ["s1"], enrollments: [{ studentId: "s2" }] },
      { id: "c2", studentIds: ["s2", "s3"] },
    ];
    const result = extractEnrolledStudentIds(classes);
    expect(result.sort()).toEqual(["s1", "s2", "s3"]);
  });

  it("safely ignores malformed or null values", () => {
    const classes = [
      { id: "c1", studentIds: [null, "", undefined, "s10"] },
      { id: "c2", enrollments: [null, { studentId: null }] },
    ];
    const result = extractEnrolledStudentIds(classes);
    expect(result).toEqual(["s10"]);
  });
});
