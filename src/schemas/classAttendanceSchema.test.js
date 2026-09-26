import { describe, it, expect } from "vitest";
import {
  classAttendanceSchema,
  CLASS_ATTENDANCE_STATUSES,
  CLASS_ATTENDANCE_METHODS,
} from "./classAttendanceSchema.js";

describe("classAttendanceSchema", () => {
  const validPayload = {
    classId: "class_101",
    studentId: "student_abc",
    attendanceDate: "2026-09-27",
    status: "PRESENT",
    method: "SCAN",
    markedBy: "staff_xyz",
    markedByName: "Teacher John",
    markedAt: "2026-09-27T08:30:00.000Z",
    studentName: "Jane Doe",
    className: "Level 1 English",
    branchId: "kota_gorontalo",
  };

  it("validates and parses a complete valid record", () => {
    const result = classAttendanceSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.classId).toBe("class_101");
    expect(result.data.studentId).toBe("student_abc");
    expect(result.data.attendanceDate).toBe("2026-09-27");
    expect(result.data.status).toBe("PRESENT");
    expect(result.data.method).toBe("SCAN");
    expect(result.data.markedBy).toBe("staff_xyz");
    expect(result.data.markedByName).toBe("Teacher John");
    expect(result.data.studentName).toBe("Jane Doe");
    expect(result.data.className).toBe("Level 1 English");
    expect(result.data.branchId).toBe("kota_gorontalo");
    expect(result.data.note).toBe("");
    expect(result.data.createdAt).toBeDefined();
    expect(result.data.updatedAt).toBeDefined();
  });

  it("provides defaults for optional fields", () => {
    const minimalPayload = {
      classId: "class_101",
      studentId: "student_abc",
      attendanceDate: "2026-09-27",
      status: "ABSENT",
      method: "CLOSE_OUT",
      markedBy: "staff_xyz",
      markedAt: "2026-09-27T10:00:00.000Z",
    };

    const result = classAttendanceSchema.safeParse(minimalPayload);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.markedByName).toBe("");
    expect(result.data.studentName).toBe("");
    expect(result.data.className).toBe("");
    expect(result.data.branchId).toBe("");
    expect(result.data.note).toBe("");
    expect(typeof result.data.createdAt).toBe("string");
    expect(typeof result.data.updatedAt).toBe("string");
  });

  it("fails if required fields are missing or empty", () => {
    expect(classAttendanceSchema.safeParse({}).success).toBe(false);

    const missingClass = { ...validPayload, classId: "" };
    expect(classAttendanceSchema.safeParse(missingClass).success).toBe(false);

    const missingStudent = { ...validPayload, studentId: "" };
    expect(classAttendanceSchema.safeParse(missingStudent).success).toBe(false);

    const missingMarkedBy = { ...validPayload, markedBy: "" };
    expect(classAttendanceSchema.safeParse(missingMarkedBy).success).toBe(false);
  });

  it("fails on invalid date format", () => {
    const invalidDate = { ...validPayload, attendanceDate: "27-09-2026" };
    expect(classAttendanceSchema.safeParse(invalidDate).success).toBe(false);

    const badDateString = { ...validPayload, attendanceDate: "yesterday" };
    expect(classAttendanceSchema.safeParse(badDateString).success).toBe(false);
  });

  it("validates allowed statuses", () => {
    CLASS_ATTENDANCE_STATUSES.forEach((st) => {
      const res = classAttendanceSchema.safeParse({ ...validPayload, status: st });
      expect(res.success).toBe(true);
    });

    const invalidStatus = { ...validPayload, status: "UNKNOWN" };
    expect(classAttendanceSchema.safeParse(invalidStatus).success).toBe(false);
  });

  it("validates allowed methods", () => {
    CLASS_ATTENDANCE_METHODS.forEach((m) => {
      const res = classAttendanceSchema.safeParse({ ...validPayload, method: m });
      expect(res.success).toBe(true);
    });

    const invalidMethod = { ...validPayload, method: "KIOSK" };
    expect(classAttendanceSchema.safeParse(invalidMethod).success).toBe(false);
  });
});
