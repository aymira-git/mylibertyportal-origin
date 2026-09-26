import { describe, it, expect } from "vitest";
import { isStudentEnrolledInClass, resolveStudentClass } from "./classResolution.js";

describe("classResolution", () => {
  const classA = {
    id: "cls_a",
    className: "Class A",
    studentIds: ["std_1", "std_2"],
    enrollments: [{ studentId: "std_1" }, { studentId: "std_2" }],
  };

  const classB = {
    id: "cls_b",
    className: "Class B",
    studentIds: ["std_2", "std_3"],
    enrollments: [{ studentId: "std_2" }, { studentId: "std_3" }],
  };

  const legacyClass = {
    id: "cls_legacy",
    className: "Legacy Class",
    studentIds: [], // empty or missing studentIds
    enrollments: [{ studentId: "std_legacy" }],
  };

  describe("isStudentEnrolledInClass", () => {
    it("returns true when studentId is in studentIds", () => {
      expect(isStudentEnrolledInClass(classA, "std_1")).toBe(true);
      expect(isStudentEnrolledInClass(classA, "std_2")).toBe(true);
      expect(isStudentEnrolledInClass(classA, "std_3")).toBe(false);
    });

    it("falls back to enrollments when studentIds is empty", () => {
      expect(isStudentEnrolledInClass(legacyClass, "std_legacy")).toBe(true);
      expect(isStudentEnrolledInClass(legacyClass, "std_unknown")).toBe(false);
    });

    it("handles null or missing parameters gracefully", () => {
      expect(isStudentEnrolledInClass(null, "std_1")).toBe(false);
      expect(isStudentEnrolledInClass(classA, null)).toBe(false);
      expect(isStudentEnrolledInClass({}, "std_1")).toBe(false);
    });
  });

  describe("resolveStudentClass", () => {
    const todayClasses = [classA, classB, legacyClass];

    it("resolves successfully when primary selectedClassId is specified and student is enrolled", () => {
      const res = resolveStudentClass({
        studentId: "std_1",
        todayClasses,
        selectedClassId: "cls_a",
      });
      expect(res.resolved).toBe(true);
      expect(res.classItem.id).toBe("cls_a");
    });

    it("returns NOT_ENROLLED_IN_SELECTED_CLASS if student is not in selected class", () => {
      const res = resolveStudentClass({
        studentId: "std_3",
        todayClasses,
        selectedClassId: "cls_a",
      });
      expect(res.resolved).toBe(false);
      expect(res.reason).toBe("NOT_ENROLLED_IN_SELECTED_CLASS");
      expect(res.classItem.id).toBe("cls_a");
    });

    it("returns CLASS_NOT_FOUND if selectedClassId does not exist in todayClasses", () => {
      const res = resolveStudentClass({
        studentId: "std_1",
        todayClasses,
        selectedClassId: "non_existent",
      });
      expect(res.resolved).toBe(false);
      expect(res.reason).toBe("CLASS_NOT_FOUND");
    });

    it("fallback: resolves single enrolled class when no selectedClassId given", () => {
      const res = resolveStudentClass({
        studentId: "std_1",
        todayClasses,
      });
      expect(res.resolved).toBe(true);
      expect(res.classItem.id).toBe("cls_a");
    });

    it("fallback: detects ambiguous classes when student is enrolled in multiple classes today", () => {
      const res = resolveStudentClass({
        studentId: "std_2",
        todayClasses,
      });
      expect(res.resolved).toBe(false);
      expect(res.reason).toBe("AMBIGUOUS_CLASSES");
      expect(res.candidateClasses).toHaveLength(2);
      expect(res.candidateClasses.map((c) => c.id)).toEqual(["cls_a", "cls_b"]);
    });

    it("fallback: returns NO_ENROLLED_CLASS_TODAY when student has no classes today", () => {
      const res = resolveStudentClass({
        studentId: "std_999",
        todayClasses,
      });
      expect(res.resolved).toBe(false);
      expect(res.reason).toBe("NO_ENROLLED_CLASS_TODAY");
    });

    it("fallback: resolves legacy class enrolled via enrollments array", () => {
      const res = resolveStudentClass({
        studentId: "std_legacy",
        todayClasses,
      });
      expect(res.resolved).toBe(true);
      expect(res.classItem.id).toBe("cls_legacy");
    });

    it("fails with MISSING_STUDENT_ID when studentId is blank", () => {
      const res = resolveStudentClass({
        studentId: "",
        todayClasses,
      });
      expect(res.resolved).toBe(false);
      expect(res.reason).toBe("MISSING_STUDENT_ID");
    });
  });
});
