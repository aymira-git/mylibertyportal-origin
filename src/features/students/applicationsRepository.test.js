import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "../../test/firestoreFake.js";
import {
  approveApplication,
  archiveApplication,
  deleteApplicationPermanently,
  restoreApplication,
} from "./applicationsRepository.js";

vi.mock("firebase/firestore", async () => (await import("../../test/firestoreFake.js")).firestoreModule);
vi.mock("../../firebase", () => ({ db: {}, auth: {} }));

const app = {
  id: "app1",
  displayName: "  Budi Santoso ",
  phone: "081234567890",
  fatherName: "Pak Santoso",
  fatherPhone: "081111111111",
  program: "General English",
};

beforeEach(() => {
  fake.reset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-21T02:00:00.000Z"));
  fake.seed("applications", [{ id: "app1", status: "pending" }]);
});
afterEach(() => vi.useRealTimers());

describe("approveApplication", () => {
  it("creates the student and marks the application approved, together", async () => {
    const student = await approveApplication({ app, level: "elite", paymentPlan: "quarterly", actorEmail: "front@school.id" });

    expect(student).toMatchObject({ id: "auto-1", displayName: "Budi Santoso", currentLevel: "elite", paymentPlan: "quarterly", role: "student", status: "active", joinedDate: "2026-09-21" });
    expect(fake.find("users/auto-1")).toMatchObject({ kind: "set", via: "transaction" });
    expect(fake.find("applications/app1").data).toMatchObject({
      status: "approved",
      approvedBy: "front@school.id",
      studentId: "auto-1",
    });
    expect(fake.find("classes/c1")).toBeUndefined();
  });

  it("defaults to level 'warrior', plan 'monthly' and approver 'system'", async () => {
    const student = await approveApplication({ app });
    expect(student).toMatchObject({ currentLevel: "warrior", paymentPlan: "monthly" });
    expect(fake.find("applications/app1").data.approvedBy).toBe("system");
  });

  it("enrols the student in the chosen batch, and the batch level wins", async () => {
    fake.seed("classes", [{ id: "c1", status: "open", classLevel: "master", maxCapacity: 10, studentIds: ["x"], classStartDate: "2026-09-01" }]);
    const student = await approveApplication({ app, level: "warrior", classId: "c1" });

    expect(student.currentLevel).toBe("master");
    const cls = fake.find("classes/c1");
    expect(cls.via).toBe("transaction");
    expect(cls.data.studentIds).toEqual({ __op: "arrayUnion", items: ["auto-1"] });
    expect(cls.data.enrollments.items[0]).toEqual({ studentId: "auto-1", dateJoined: "2026-09-01", level: "master" });
  });

  it("refuses an application that someone else already processed, and writes nothing", async () => {
    fake.seed("applications", [{ id: "app1", status: "approved" }]);
    await expect(approveApplication({ app })).rejects.toThrow("already processed");
    expect(fake.ops).toHaveLength(0);
  });

  it("refuses an application that no longer exists", async () => {
    fake.seed("applications", []);
    await expect(approveApplication({ app })).rejects.toThrow("already processed");
  });

  it.each([
    ["full", { status: "open", maxCapacity: 2, studentIds: ["a", "b"] }],
    ["completed", { status: "completed", maxCapacity: 10, studentIds: [] }],
    ["cancelled", { status: "cancelled", maxCapacity: 10, studentIds: [] }],
  ])("refuses a batch that is %s and creates no student", async (_l, cls) => {
    fake.seed("classes", [{ id: "c1", ...cls }]);
    await expect(approveApplication({ app, classId: "c1" })).rejects.toThrow("full or no longer open");
    expect(fake.ops).toHaveLength(0);
  });

  it("refuses a batch that does not exist", async () => {
    await expect(approveApplication({ app, classId: "missing" })).rejects.toThrow("full or no longer open");
    expect(fake.ops).toHaveLength(0);
  });

  // Open to debate: joinedDate uses the UTC date, so approving between 00:00 and
  // 08:00 WITA records the previous day.
  it.fails("records joinedDate as the WITA calendar day", async () => {
    vi.setSystemTime(new Date("2026-09-21T20:00:00.000Z")); // 04:00 on 22 Sep WITA
    const student = await approveApplication({ app });
    expect(student.joinedDate).toBe("2026-09-22");
  });
});

describe("archiveApplication", () => {
  it("records who rejected it, why, and when", async () => {
    await archiveApplication("app1", { reason: "duplicate", note: "same as #12", actorEmail: "front@school.id" });
    expect(fake.find("applications/app1").data).toMatchObject({
      status: "rejected",
      rejectedBy: "front@school.id",
      rejectedReason: "duplicate",
      rejectedNote: "same as #12",
    });
  });

  it("works with no options and falls back to actor 'system'", async () => {
    await archiveApplication("app1");
    expect(fake.find("applications/app1").data).toMatchObject({ rejectedBy: "system", rejectedReason: "" });
  });

  it("refuses an application that is no longer pending", async () => {
    fake.seed("applications", [{ id: "app1", status: "rejected" }]);
    await expect(archiveApplication("app1")).rejects.toThrow("already processed");
    expect(fake.ops).toHaveLength(0);
  });
});

describe("restoreApplication / deleteApplicationPermanently", () => {
  it("sets the application back to pending and removes the rejection fields", async () => {
    await restoreApplication("app1");
    const { data } = fake.find("applications/app1");
    expect(data.status).toBe("pending");
    ["rejectedAt", "rejectedBy", "rejectedReason", "rejectedNote"].forEach((k) => expect(data[k]).toEqual({ __op: "deleteField" }));
  });

  it("deletes the document", async () => {
    await deleteApplicationPermanently("app1");
    expect(fake.find("applications/app1").kind).toBe("delete");
  });
});
