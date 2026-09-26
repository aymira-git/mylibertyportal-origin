import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "../../test/firestoreFake.js";
import {
  getClassAttendanceDocId,
  fetchClassAttendance,
  recordClassAttendanceScan,
  updateClassAttendanceManual,
  closeOutClassAttendance,
  fetchClassAttendanceForStudent,
} from "./classAttendanceRepository.js";

vi.mock(
  "firebase/firestore",
  async () => (await import("../../test/firestoreFake.js")).firestoreModule
);
vi.mock("../../firebase", () => ({ db: {}, auth: {} }));

beforeEach(() => fake.reset());

describe("classAttendanceRepository", () => {
  const classId = "batch_1";
  const studentId = "student_alpha";
  const attendanceDate = "2026-09-27";
  const markedBy = "instructor_1";

  describe("getClassAttendanceDocId", () => {
    it("builds deterministic ID with classId_studentId_attendanceDate", () => {
      const id = getClassAttendanceDocId("c1", "s1", "2026-09-27");
      expect(id).toBe("c1_s1_2026-09-27");
    });
  });

  describe("recordClassAttendanceScan", () => {
    it("creates a PRESENT / SCAN record when none exists", async () => {
      const res = await recordClassAttendanceScan({
        classId,
        studentId,
        attendanceDate,
        markedBy,
        studentName: "Alpha",
        className: "Class 1",
        branchId: "kota_gorontalo",
      });

      expect(res.status).toBe("created");
      expect(res.record.status).toBe("PRESENT");
      expect(res.record.method).toBe("SCAN");
      expect(res.record.studentId).toBe(studentId);

      const op = fake.find(`classAttendance/${classId}_${studentId}_${attendanceDate}`);
      expect(op).toBeDefined();
      expect(op.kind).toBe("set");
      expect(op.data.status).toBe("PRESENT");
      expect(op.data.method).toBe("SCAN");
    });

    it("does not overwrite if attendance record already exists (repeat scan is no-op)", async () => {
      // Seed existing record
      const docId = getClassAttendanceDocId(classId, studentId, attendanceDate);
      fake.seed("classAttendance", [
        {
          id: docId,
          classId,
          studentId,
          attendanceDate,
          status: "PRESENT",
          method: "SCAN",
          markedBy: "someone_else",
          markedAt: "2026-09-27T08:00:00.000Z",
        },
      ]);

      const res = await recordClassAttendanceScan({
        classId,
        studentId,
        attendanceDate,
        markedBy,
      });

      expect(res.status).toBe("exists");
      expect(res.record.markedBy).toBe("someone_else");

      // Verify no new write op was recorded
      const setOps = fake.opsOf("set");
      expect(setOps).toHaveLength(0);
    });

    it("does not overwrite if a manual correction already exists", async () => {
      const docId = getClassAttendanceDocId(classId, studentId, attendanceDate);
      fake.seed("classAttendance", [
        {
          id: docId,
          classId,
          studentId,
          attendanceDate,
          status: "ABSENT",
          method: "MANUAL",
          markedBy: "instructor_1",
          note: "Excused illness",
        },
      ]);

      const res = await recordClassAttendanceScan({
        classId,
        studentId,
        attendanceDate,
        markedBy: "scanner_kiosk",
      });

      expect(res.status).toBe("exists");
      expect(res.record.status).toBe("ABSENT");
      expect(res.record.method).toBe("MANUAL");
      expect(fake.opsOf("set")).toHaveLength(0);
    });
  });

  describe("updateClassAttendanceManual", () => {
    it("updates status and sets method to MANUAL when doc exists", async () => {
      const docId = getClassAttendanceDocId(classId, studentId, attendanceDate);
      fake.seed("classAttendance", [
        {
          id: docId,
          classId,
          studentId,
          attendanceDate,
          status: "PRESENT",
          method: "SCAN",
        },
      ]);

      const res = await updateClassAttendanceManual({
        classId,
        studentId,
        attendanceDate,
        status: "ABSENT",
        note: "Left early with permission",
        markedBy,
        markedByName: "Teacher John",
      });

      expect(res.status).toBe("updated");
      expect(res.record.status).toBe("ABSENT");
      expect(res.record.method).toBe("MANUAL");
      expect(res.record.note).toBe("Left early with permission");

      const updateOp = fake.find(`classAttendance/${docId}`);
      expect(updateOp).toBeDefined();
      expect(updateOp.kind).toBe("update");
      expect(updateOp.data.status).toBe("ABSENT");
      expect(updateOp.data.method).toBe("MANUAL");
    });

    it("creates a new record with method MANUAL when doc does not exist", async () => {
      const docId = getClassAttendanceDocId(classId, studentId, attendanceDate);

      const res = await updateClassAttendanceManual({
        classId,
        studentId,
        attendanceDate,
        status: "LATE",
        markedBy,
      });

      expect(res.status).toBe("created");
      expect(res.record.status).toBe("LATE");
      expect(res.record.method).toBe("MANUAL");

      const setOp = fake.find(`classAttendance/${docId}`);
      expect(setOp.kind).toBe("set");
      expect(setOp.data.method).toBe("MANUAL");
    });
  });

  describe("closeOutClassAttendance", () => {
    it("creates ABSENT / CLOSE_OUT only for students without existing records", async () => {
      // Suppose student_1 is already PRESENT
      const doc1 = getClassAttendanceDocId(classId, "std_1", attendanceDate);
      fake.seed("classAttendance", [
        {
          id: doc1,
          classId,
          studentId: "std_1",
          attendanceDate,
          status: "PRESENT",
          method: "SCAN",
        },
      ]);

      const rosterStudentIds = ["std_1", "std_2", "std_3"];
      const studentsMap = {
        std_2: { displayName: "Student Two" },
        std_3: { displayName: "Student Three" },
      };

      const res = await closeOutClassAttendance({
        classId,
        attendanceDate,
        rosterStudentIds,
        studentsMap,
        markedBy,
        className: "Class 1",
      });

      expect(res.createdCount).toBe(2);
      expect(res.missingCount).toBe(2);
      expect(res.alreadyClosed).toBe(false);

      // Verify that batch set was committed for std_2 and std_3
      const setOps = fake.opsOf("set");
      expect(setOps).toHaveLength(2);

      const op2 = fake.find(`classAttendance/${classId}_std_2_${attendanceDate}`);
      expect(op2).toBeDefined();
      expect(op2.data.status).toBe("ABSENT");
      expect(op2.data.method).toBe("CLOSE_OUT");
      expect(op2.data.studentName).toBe("Student Two");

      const op3 = fake.find(`classAttendance/${classId}_std_3_${attendanceDate}`);
      expect(op3).toBeDefined();
      expect(op3.data.status).toBe("ABSENT");
      expect(op3.data.method).toBe("CLOSE_OUT");

      // Verify std_1 was NOT touched
      const op1 = fake.find(`classAttendance/${classId}_std_1_${attendanceDate}`);
      expect(op1).toBeUndefined();
    });

    it("is idempotent: returns 0 created when all students already have records", async () => {
      const doc1 = getClassAttendanceDocId(classId, "std_1", attendanceDate);
      fake.seed("classAttendance", [
        {
          id: doc1,
          classId,
          studentId: "std_1",
          attendanceDate,
          status: "PRESENT",
          method: "SCAN",
        },
      ]);

      const res = await closeOutClassAttendance({
        classId,
        attendanceDate,
        rosterStudentIds: ["std_1"],
        markedBy,
      });

      expect(res.createdCount).toBe(0);
      expect(res.alreadyClosed).toBe(true);
      expect(fake.opsOf("set")).toHaveLength(0);
    });
  });

  describe("fetchClassAttendance & fetchClassAttendanceForStudent", () => {
    it("queries class attendance by classId and date", async () => {
      fake.seed("classAttendance", [
        { id: "1", classId: "c1", attendanceDate: "2026-09-27", status: "PRESENT" },
        { id: "2", classId: "c1", attendanceDate: "2026-09-28", status: "PRESENT" },
        { id: "3", classId: "c2", attendanceDate: "2026-09-27", status: "ABSENT" },
      ]);

      const records = await fetchClassAttendance("c1", "2026-09-27");
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe("1");
    });

    it("queries student history with date window", async () => {
      fake.seed("classAttendance", [
        { id: "1", studentId: "s1", attendanceDate: "2026-09-20", status: "PRESENT" },
        { id: "2", studentId: "s1", attendanceDate: "2026-09-25", status: "PRESENT" },
        { id: "3", studentId: "s1", attendanceDate: "2026-10-01", status: "ABSENT" },
        { id: "4", studentId: "s2", attendanceDate: "2026-09-25", status: "PRESENT" },
      ]);

      const records = await fetchClassAttendanceForStudent("s1", "2026-09-22", "2026-09-30");
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe("2");
    });
  });
});
