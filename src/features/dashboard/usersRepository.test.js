import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "../../test/firestoreFake.js";
import {
  checkStaffHasAttendanceHistory,
  checkStudentHasHistory,
  createStaffAccount,
  createParentAccount,
  updateParentRecord,
  linkChildToParent,
  unlinkChildFromParent,
  unlinkStudentFromAllParents,
  archiveStudentProfile,
  updateStudentStatus,
  getParentLinkedStudents,
  findParentsForStudent,
  fetchAllParents,
  deleteUserProfile,
  updateStaffStatus,
} from "./usersRepository.js";

const authMock = vi.hoisted(() => ({
  createUserWithEmailAndPassword: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock(
  "firebase/firestore",
  async () => (await import("../../test/firestoreFake.js")).firestoreModule
);
vi.mock("firebase/auth", () => authMock);
vi.mock("../../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "admin1", getIdToken: vi.fn().mockResolvedValue("test-token") } },
  getSecondaryAuth: () => ({ secondary: true }),
}));

beforeEach(() => {
  fake.reset();
  vi.stubEnv("VITE_AI_WORKER_URL", "https://worker.test");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }));
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
    const firestore = /** @type {any} */ (await import("firebase/firestore"));
    firestore.getDocs.mockRejectedValueOnce(new Error("unavailable"));
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

  it("detects classAttendance records even if general attendance is empty", async () => {
    fake.seed("payments", []);
    fake.seed("attendance", []);
    fake.seed("classAttendance", [{ id: "ca1", studentId: "s1" }]);
    fake.seed("progressReports", []);
    expect(await checkStudentHasHistory("s1")).toEqual({
      hasPayments: false,
      hasAttendance: true,
      hasReports: false,
      error: null,
    });
  });

  it("returns the error message on a failed lookup", async () => {
    const firestore = /** @type {any} */ (await import("firebase/firestore"));
    firestore.getDocs.mockRejectedValueOnce(new Error("unavailable"));
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

  it("rolls back the created Auth account when the profile save fails", async () => {
    const userObj = { uid: "new-uid" };
    authMock.createUserWithEmailAndPassword.mockResolvedValueOnce({ user: userObj });
    fake.failWhen = () => new Error("permission-denied");
    const err = await createStaffAccount("a@b.id", "pw", {}).catch((e) => e);
    expect(err.message).toContain("Account creation failed");
    expect(err.message).toContain("rolled back");
    expect(authMock.deleteUser).toHaveBeenCalledWith(userObj);
  });
});

describe("deleteUserProfile", () => {
  it("removes parent links through the Worker and deletes the student with roster cleanup", async () => {
    fake.seed("users", [{ id: "s1", role: "student", branchId: "kota_gorontalo" }]);
    fake.seed("classes", [
      {
        id: "c1",
        studentIds: ["s1", "s2"],
        enrollments: [
          { studentId: "s1", level: "warrior" },
          { studentId: "s2", level: "warrior" },
        ],
      },
      {
        id: "c2",
        studentIds: ["s2"],
        enrollments: [{ studentId: "s2", level: "warrior" }],
      },
    ]);

    await deleteUserProfile("s1");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/parent-link$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "unlink-all", studentId: "s1" }),
      })
    );
    // User document should be deleted
    expect(fake.opsOf("delete").some((o) => o.path === "users/s1")).toBe(true);

    // Class c1 should be updated in a batch to remove s1
    const c1 = fake.find("classes/c1");
    expect(c1.via).toBe("batch");
    expect(c1.data.studentIds).toEqual(["s2"]);
    expect(c1.data.enrollments).toEqual([{ studentId: "s2", level: "warrior" }]);

    // Class c2 should NOT be touched
    expect(fake.find("classes/c2")).toBeUndefined();
  });
});

describe("createParentAccount", () => {
  it("creates auth user via secondary auth and saves profile with role: parent", async () => {
    authMock.createUserWithEmailAndPassword.mockResolvedValueOnce({
      user: { uid: "parent_uid_123" },
    });

    const uid = await createParentAccount("parent@example.com", "pass123456", {
      displayName: "Ibu Linda",
      phone: "081299998888",
      initialChildStudentId: "student_abc",
      branch: "Kota Gorontalo",
    });

    expect(uid).toBe("parent_uid_123");
    const userDoc = fake.find("users/parent_uid_123");
    expect(userDoc.opts).toEqual({ merge: true });
    expect(userDoc.data.role).toBe("parent");
    expect(userDoc.data.displayName).toBe("Ibu Linda");
    expect(userDoc.data.email).toBe("parent@example.com");
    expect(userDoc.data.childStudentIds).toEqual([]);
    expect(userDoc.data.branchId).toBe("kota_gorontalo");
    expect(userDoc.data.branch).toBe("Kota Gorontalo");
    expect(userDoc.data.status).toBe("active");
  });

  it("canonicalizes branchId even when callers pass a branch display name as branchId", async () => {
    authMock.createUserWithEmailAndPassword.mockResolvedValueOnce({
      user: { uid: "parent_boba_1" },
    });

    const uid = await createParentAccount("parentboba@example.com", "pass123456", {
      displayName: "Pak Rusli",
      branchId: "Bone Bolango",
      initialChildStudentId: "student_boba_1",
    });

    expect(uid).toBe("parent_boba_1");
    const userDoc = fake.find("users/parent_boba_1");
    expect(userDoc.data.branchId).toBe("bone_bolango");
    expect(userDoc.data.branch).toBe("Bone Bolango");
  });

  it("throws validation error and halts before calling auth when payload is invalid", async () => {
    await expect(
      createParentAccount("invalid-email", "short", {
        displayName: "",
      })
    ).rejects.toThrow();
    expect(authMock.createUserWithEmailAndPassword).not.toHaveBeenCalled();
  });

  it("rolls back the created Auth account when saving parent doc fails", async () => {
    const userObj = { uid: "parent_fail_1" };
    authMock.createUserWithEmailAndPassword.mockResolvedValueOnce({ user: userObj });
    fake.failWhen = () => new Error("permission-denied");
    const err = await createParentAccount("parentfail@example.com", "pass123456", {
      displayName: "Parent Fail",
    }).catch((e) => e);
    expect(err.message).toContain("Parent account creation failed");
    expect(err.message).toContain("rolled back");
    expect(authMock.deleteUser).toHaveBeenCalledWith(userObj);
  });

  it("removes the parent profile when the server rejects initial child linking", async () => {
    const userObj = { uid: "parent_link_fail" };
    authMock.createUserWithEmailAndPassword.mockResolvedValueOnce({ user: userObj });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Invalid request." }), { status: 400 })
    );

    await expect(
      createParentAccount("parentfail@example.com", "pass123456", {
        displayName: "Parent Link Fail",
        initialChildStudentId: "student1",
      })
    ).rejects.toThrow("Invalid request.");

    expect(fake.opsOf("delete").some((op) => op.path === "users/parent_link_fail")).toBe(true);
    expect(authMock.deleteUser).toHaveBeenCalledWith(userObj);
  });
});

describe("linkChildToParent and unlinkChildFromParent", () => {
  it("links a child through the server-authoritative Worker", async () => {
    await linkChildToParent("parent1", "child1");
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/\/api\/v1\/parent-link$/), expect.objectContaining({ method: "POST" }));
  });

  it("unlinks a child from a parent through the Worker", async () => {
    await unlinkChildFromParent("parent1", "child1");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/parent-link$/),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "unlink", parentUid: "parent1", studentId: "child1" }),
      })
    );
  });

  it("throws if IDs are missing", () => {
    expect(() => linkChildToParent("", "child1")).toThrow();
    expect(() => linkChildToParent("p1", "")).toThrow();
    expect(() => unlinkChildFromParent("", "child1")).toThrow();
    expect(() => unlinkChildFromParent("p1", "")).toThrow();
    expect(() => unlinkStudentFromAllParents("")).toThrow();
  });
});

describe("archiveStudentProfile", () => {
  it("archives the student, removes class roster entries, and revokes parent links", async () => {
    fake.seed("users", [
      { id: "s1", role: "student", branchId: "kota_gorontalo" },
    ]);
    fake.seed("classes", [
      {
        id: "c1",
        branchId: "kota_gorontalo",
        studentIds: ["s1", "s2"],
        enrollments: [{ studentId: "s1" }, { studentId: "s2" }],
      },
      { id: "c2", branchId: "bone_bolango", studentIds: ["s1"], enrollments: [{ studentId: "s1" }] },
    ]);

    await archiveStudentProfile("s1", { displayName: "Front Office" });

    expect(fake.opsOf("update")).toHaveLength(2);
    expect(fake.find("users/s1").data).toMatchObject({ status: "archived" });
    expect(fake.find("classes/c1").data.studentIds).toEqual(["s2"]);
    expect(fake.find("classes/c1").data.enrollments).toEqual([{ studentId: "s2" }]);
    expect(fake.find("classes/c2")).toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/parent-link$/),
      expect.objectContaining({
        body: JSON.stringify({ action: "unlink-all", studentId: "s1" }),
      })
    );
  });

  it("routes archived status changes through roster and parent-link cleanup", async () => {
    fake.seed("users", [
      { id: "s1", role: "student", branchId: "kota_gorontalo" },
    ]);

    await updateStudentStatus("s1", "archived", "staff1");

    expect(fake.find("users/s1").data.status).toBe("archived");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/parent-link$/),
      expect.objectContaining({
        body: JSON.stringify({ action: "unlink-all", studentId: "s1" }),
      })
    );
  });

  it("reports partial success when archive commits but parent-link cleanup fails", async () => {
    fake.seed("users", [{ id: "s1", role: "student", branchId: "kota_gorontalo" }]);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Worker unavailable." }), { status: 503 })
    );

    await expect(archiveStudentProfile("s1")).rejects.toThrow(
      "The student was archived, but parent-link cleanup failed."
    );
    expect(fake.find("users/s1").data.status).toBe("archived");
  });
});

describe("getParentLinkedStudents and findParentsForStudent", () => {
  it("retrieves childStudentIds array for a parent doc", async () => {
    fake.seed("users", [
      { id: "parent1", role: "parent", childStudentIds: ["s1", "s2"] },
      { id: "parent2", role: "parent" },
    ]);

    expect(await getParentLinkedStudents("parent1")).toEqual(["s1", "s2"]);
    expect(await getParentLinkedStudents("parent2")).toEqual([]);
    expect(await getParentLinkedStudents("nonexistent")).toEqual([]);
  });

  it("finds parents linked to a student", async () => {
    fake.seed("users", [
      { id: "parent1", role: "parent", displayName: "Ayah", childStudentIds: ["s1"] },
      { id: "parent2", role: "parent", displayName: "Ibu", childStudentIds: ["s1", "s2"] },
      { id: "parent3", role: "parent", displayName: "Lain", childStudentIds: ["s3"] },
      { id: "student1", role: "student", childStudentIds: ["s1"] }, // not role parent
    ]);

    const parents = await findParentsForStudent("s1");
    expect(parents.map((p) => p.id)).toEqual(["parent1", "parent2"]);
  });

  it("fetches all parent records optionally filtered by branch", async () => {
    fake.seed("users", [
      { id: "p1", role: "parent", branchId: "kota_gorontalo" },
      { id: "p2", role: "parent", branchId: "limboto" },
      { id: "s1", role: "student", branchId: "kota_gorontalo" },
    ]);

    const all = await fetchAllParents();
    expect(all.map((p) => p.id)).toEqual(["p1", "p2"]);

    const gorontalo = await fetchAllParents("kota_gorontalo");
    expect(gorontalo.map((p) => p.id)).toEqual(["p1"]);
  });

  it("finds parents linked to student filtered by branchId", async () => {
    fake.seed("users", [
      { id: "parent1", role: "parent", branchId: "kota_gorontalo", childStudentIds: ["s1"] },
      { id: "parent2", role: "parent", branchId: "bone_bolango", childStudentIds: ["s1"] },
    ]);

    const gto = await findParentsForStudent("s1", "kota_gorontalo");
    expect(gto.map((p) => p.id)).toEqual(["parent1"]);
  });
});

describe("updateParentRecord", () => {
  it("writes only provided allowed keys (displayName, phone, status, updatedAt) and never writes branch or branchId", async () => {
    await updateParentRecord("parent_123", {
      displayName: "Ibu Rahma Updated",
      phone: "08123456789",
      branch: "Kota Gorontalo",
      branchId: "kota_gorontalo",
      status: "active",
      extraForbiddenField: "should_not_be_written",
    });

    const op = fake.find("users/parent_123");
    expect(op.opts).toEqual({ merge: true });
    expect(Object.keys(op.data).sort()).toEqual([
      "displayName",
      "phone",
      "status",
      "updatedAt",
    ]);
    expect(op.data.displayName).toBe("Ibu Rahma Updated");
    expect(op.data.phone).toBe("08123456789");
    expect(op.data.status).toBe("active");
    expect(op.data.branch).toBeUndefined();
    expect(op.data.branchId).toBeUndefined();
    expect(op.data.updatedAt).toBeTruthy();
  });

  it("writes only fields actually provided plus updatedAt", async () => {
    await updateParentRecord("parent_456", {
      phone: "08999999999",
    });

    const op = fake.find("users/parent_456");
    expect(Object.keys(op.data).sort()).toEqual(["phone", "updatedAt"]);
    expect(op.data.phone).toBe("08999999999");
    expect(op.data.displayName).toBeUndefined();
    expect(op.data.status).toBeUndefined();
  });
});
