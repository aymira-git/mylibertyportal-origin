import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleKioskScan } from "./kioskScanProcessor.js";
import * as shiftsRepo from "./shiftsRepository.js";
import * as classAttRepo from "./classAttendanceRepository.js";

vi.mock("./shiftsRepository.js", () => ({
  fetchUserById: vi.fn(),
  fetchOpenShiftFor: vi.fn(),
  fetchInstructorClasses: vi.fn(),
  clockIn: vi.fn(),
  clockOutShift: vi.fn(),
  recordStudentAttendance: vi.fn(),
}));

vi.mock("./corporateEventsRepository.js", () => ({
  fetchActiveCorporateEventsForDate: vi.fn().mockResolvedValue([]),
}));

vi.mock("./classAttendanceRepository.js", () => ({
  recordClassAttendanceScan: vi.fn(),
}));

describe("kioskScanProcessor in CLASS mode", () => {
  let showStatus;
  let setLastScanned;

  beforeEach(() => {
    vi.clearAllMocks();
    showStatus = vi.fn();
    setLastScanned = vi.fn();
  });

  const studentUser = {
    id: "std_1",
    displayName: "Alice Smith",
    role: "student",
    status: "active",
    branchId: "kota_gorontalo",
  };

  const todayClasses = [
    {
      id: "class_a",
      className: "Morning English",
      studentIds: ["std_1"],
      branchId: "kota_gorontalo",
    },
  ];

  it("rejects non-student badges in class mode", async () => {
    vi.mocked(shiftsRepo.fetchUserById).mockResolvedValueOnce({
      id: "ins_1",
      displayName: "Teacher Bob",
      role: "instructor",
    });

    await handleKioskScan("ins_1", {
      attendanceMode: "CLASS",
      classId: "class_a",
      todayClasses,
      showStatus,
      setLastScanned,
    });

    expect(showStatus).toHaveBeenCalledWith(
      "Not a Student",
      "error",
      expect.any(String),
      "Teacher Bob"
    );
  });

  it("rejects inactive or graduated students", async () => {
    vi.mocked(shiftsRepo.fetchUserById).mockResolvedValueOnce({
      ...studentUser,
      status: "inactive",
    });

    await handleKioskScan("std_1", {
      attendanceMode: "CLASS",
      classId: "class_a",
      todayClasses,
      showStatus,
      setLastScanned,
    });

    expect(showStatus).toHaveBeenCalledWith(
      "Pass Inactive",
      "error",
      expect.any(String),
      "Alice Smith"
    );
  });

  it("rejects student not enrolled in the selected class", async () => {
    vi.mocked(shiftsRepo.fetchUserById).mockResolvedValueOnce(studentUser);

    const otherClass = {
      id: "class_b",
      className: "Afternoon Math",
      studentIds: ["std_other"],
    };

    await handleKioskScan("std_1", {
      attendanceMode: "CLASS",
      classId: "class_b",
      todayClasses: [otherClass],
      showStatus,
      setLastScanned,
    });

    expect(showStatus).toHaveBeenCalledWith(
      "Student Not Enrolled In This Class",
      "error",
      expect.any(String),
      "Alice Smith"
    );
  });

  it("successfully records attendance on first scan", async () => {
    vi.mocked(shiftsRepo.fetchUserById).mockResolvedValueOnce(studentUser);
    vi.mocked(classAttRepo.recordClassAttendanceScan).mockResolvedValueOnce({
      status: "created",
      record: {
        status: "PRESENT",
        method: "SCAN",
      },
    });

    await handleKioskScan("std_1", {
      attendanceMode: "CLASS",
      classId: "class_a",
      todayClasses,
      markedBy: "ins_1",
      showStatus,
      setLastScanned,
    });

    expect(classAttRepo.recordClassAttendanceScan).toHaveBeenCalledWith(
      expect.objectContaining({
        classId: "class_a",
        studentId: "std_1",
        markedBy: "ins_1",
      })
    );

    expect(showStatus).toHaveBeenCalledWith(
      "Attendance Recorded",
      "success",
      expect.stringContaining("Morning English"),
      "Alice Smith"
    );
    expect(setLastScanned).toHaveBeenCalled();
  });

  it("gives 'Already Checked In' feedback on repeat scan without overwriting", async () => {
    vi.mocked(shiftsRepo.fetchUserById).mockResolvedValueOnce(studentUser);
    vi.mocked(classAttRepo.recordClassAttendanceScan).mockResolvedValueOnce({
      status: "exists",
      record: {
        status: "PRESENT",
        method: "SCAN",
      },
    });

    await handleKioskScan("std_1", {
      attendanceMode: "CLASS",
      classId: "class_a",
      todayClasses,
      showStatus,
      setLastScanned,
    });

    expect(showStatus).toHaveBeenCalledWith(
      "Already Checked In",
      "info",
      expect.stringContaining("already checked in"),
      "Alice Smith"
    );
  });

  it("gives 'Attendance Already Decided' feedback if manual decision exists", async () => {
    vi.mocked(shiftsRepo.fetchUserById).mockResolvedValueOnce(studentUser);
    vi.mocked(classAttRepo.recordClassAttendanceScan).mockResolvedValueOnce({
      status: "exists",
      record: {
        status: "ABSENT",
        method: "MANUAL",
      },
    });

    await handleKioskScan("std_1", {
      attendanceMode: "CLASS",
      classId: "class_a",
      todayClasses,
      showStatus,
      setLastScanned,
    });

    expect(showStatus).toHaveBeenCalledWith(
      "Attendance Already Decided",
      "info",
      expect.stringContaining("manually"),
      "Alice Smith"
    );
  });
});
