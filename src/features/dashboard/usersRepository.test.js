import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "../../test/firestoreFake.js";
import {
  checkStaffHasAttendanceHistory,
  checkStudentHasHistory,
  createStaffAccount,
  updateStaffStatus,
} from "./usersRepository.js";

const authMock = vi.hoisted(() => ({ createUserWithEmailAndPassword: vi.fn() }));

vi.mock(
  "firebase/firestore",
  async () => (await import("../../test/firestoreFake.js")).firestoreModule
);
vi.mock("firebase/auth", () => authMock);
vi.mock("../../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "admin1" } },
  getSecondaryAuth: () => ({ secondary: true }),
}));

beforeEach(() => {
  fake.reset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("updateStaffStatus", () => {
  it("saves the status with who changed it and when", async () => {
    await updateStaffStatus("u1", "resigned");
    const { data, opts } = fake.find("users/u1");
    expect(opts).toEqual({ merge: true });
    expect(data).toMatchObject({ status: "resigned", statusUpdatedBy: "admin1" });
    expect(new Date(data.statusUpdatedAt).toString()).not.toBe("Invalid Date");
  });
});

describe("checkStaffHasAttendanceHistory", () => {
  it("reports shift and leave history separately", async () => {
    fake.seed("shifts", [{ id: "s1", userId: "u1" }]);
    expect(await checkStaffHasAttendanceHistory("u1")).toEqual({
      hasShifts: true,
      hasLeave: false,
      error: null,
    });
    fake.seed("staffLeave", [{ id: "l1", userId: "u2" }]);
    expect(await checkStaffHasAttendanceHistory("u2")).toEqual({
      hasShifts: false,
      hasLeave: true,
      error: null,
    });
  });

  it("reports no history for a brand-new staff member", async () => {
    expect(await checkStaffHasAttendanceHistory("u3")).toEqual({
      hasShifts: false,
      hasLeave: false,
      error: null,
    });
  });

  it("handles a missing uid", async () => {
    expect(await checkStaffHasAttendanceHistory("")).toEqual({
      hasShifts: false,
      hasLeave: false,
      error: null,
    });
  });

  // The flags are false on failure; safety depends on callers checking `error`.
  // StaffDirectory does today — this test keeps that contract visible.
  it("returns the error message on a failed lookup", async () => {
    const { getDocs } = await import("firebase/firestore");
    getDocs.mockRejectedValueOnce(new Error("unavailable"));
    const result = await checkStaffHasAttendanceHistory("u1");
    expect(result.error).toBe("unavailable");
  });
});

describe("checkStudentHasHistory", () => {
  it("detects payments, attendance and progress reports", async () => {
    fake.seed("payments", [{ id: "p", studentId: "s1" }]);
    fake.seed("attendance", [{ id: "a", userId: "s1" }]);
    fake.seed("progressReports", []);
    expect(await checkStudentHasHistory("s1")).toEqual({
      hasPayments: true,
      hasAttendance: true,
      hasReports: false,
      error: null,
    });
  });

  it("returns the error message on a failed lookup", async () => {
    const { getDocs } = await import("firebase/firestore");
    getDocs.mockRejectedValueOnce(new Error("unavailable"));
    expect((await checkStudentHasHistory("s1")).error).toBe("unavailable");
  });
});

describe("createStaffAccount", () => {
  it("creates the sign-in account, then the profile, and returns the new uid", async () => {
    authMock.createUserWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: "new-uid" } });
    const uid = await createStaffAccount("a@b.id", "pw123456", { role: "instructor" });
    expect(uid).toBe("new-uid");
    expect(authMock.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      { secondary: true },
      "a@b.id",
      "pw123456"
    );
    expect(fake.find("users/new-uid")).toMatchObject({
      data: { role: "instructor" },
      opts: { merge: true },
    });
  });

  it("does not write a profile if the sign-in account cannot be created", async () => {
    authMock.createUserWithEmailAndPassword.mockRejectedValueOnce(
      new Error("email-already-in-use")
    );
    await expect(createStaffAccount("a@b.id", "pw", {})).rejects.toThrow("email-already-in-use");
    expect(fake.ops).toHaveLength(0);
  });

  it("explains the half-finished state when the profile save fails", async () => {
    authMock.createUserWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: "new-uid" } });
    fake.failWhen = () => new Error("permission-denied");
    const err = await createStaffAccount("a@b.id", "pw", {}).catch((e) => e);
    expect(err.message).toContain("Account was created in Firebase Auth");
    expect(err.message).toContain("permission-denied");
    expect(err.cause.message).toBe("permission-denied");
  });
});
