import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "../../test/firestoreFake.js";
import {
  adjustShiftWithAudit,
  applyApprovedShiftCorrection,
  clockIn,
  clockOutShift,
  clockOutShiftWithCashReconciliation,
  calculateCashDiscrepancyThreshold,
  getShiftCashReconciliation,
  fetchInstructorClasses,
  fetchOpenShiftFor,
  fetchStaffLeaves,
  logStaffLeave,
  recordStudentAttendance,
  switchClassAtomic,
} from "./shiftsRepository.js";

vi.mock(
  "firebase/firestore",
  async () => (await import("../../test/firestoreFake.js")).firestoreModule
);
vi.mock("../../firebase", () => ({ db: {}, auth: {} }));

beforeEach(() => fake.reset());

const at = new Date("2026-09-21T02:00:00.000Z");

describe("clockIn", () => {
  it("creates an open shift with the punctuality result attached", async () => {
    await clockIn({
      uid: "i1",
      displayName: "Ms. Rina",
      role: "instructor",
      classId: "c1",
      className: "Warrior A",
      clockInAt: at,
      punctuality: {
        status: "Late",
        scheduledStart: "s",
        requiredArrival: "r",
        minutesEarlyOrLate: -5,
      },
    });
    const op = fake.opsOf("add")[0];
    expect(op.path.startsWith("shifts/")).toBe(true);
    expect(op.data).toMatchObject({
      userId: "i1",
      role: "instructor",
      classId: "c1",
      className: "Warrior A",
      clockIn: "2026-09-21T02:00:00.000Z",
      clockOut: null,
      punctualityStatus: "Late",
      minutesEarlyOrLate: -5,
      stationId: "reception-01",
      clockInSource: "kiosk",
    });
  });

  it("uses safe defaults when there is no class or punctuality result", async () => {
    await clockIn({ uid: "f1", role: "frontoffice", clockInAt: at });
    expect(fake.opsOf("add")[0].data).toMatchObject({
      displayName: "",
      classId: "general",
      className: "",
      punctualityStatus: "Present",
      minutesEarlyOrLate: 0,
      scheduledStart: null,
      requiredArrival: null,
    });
  });

  it("writes to a chosen document id through a batch when docId is given", async () => {
    await clockIn({ uid: "i1", role: "instructor", clockInAt: at, docId: "fixed-id" });
    expect(fake.find("shifts/fixed-id")).toMatchObject({ kind: "set", via: "batch" });
  });

  it("records a General Duty shift for manager role", async () => {
    await clockIn({
      uid: "m1",
      displayName: "Pak Manager",
      role: "manager",
      classId: "general",
      className: "General Duty",
      clockInAt: at,
    });
    const op = fake.opsOf("add")[0];
    expect(op.data).toMatchObject({
      userId: "m1",
      displayName: "Pak Manager",
      role: "manager",
      classId: "general",
      className: "General Duty",
      clockIn: "2026-09-21T02:00:00.000Z",
      clockOut: null,
      punctualityStatus: "Present",
    });
  });

  it("attaches shiftType and eventId when clocking in to a corporate event", async () => {
    await clockIn({
      uid: "i1",
      displayName: "Ms. Rina",
      role: "instructor",
      classId: "corporate_event:evt-123",
      className: "Teacher Training Summit",
      clockInAt: at,
      shiftType: "corporate_event",
      eventId: "evt-123",
    });
    const op = fake.opsOf("add")[0];
    expect(op.data).toMatchObject({
      userId: "i1",
      displayName: "Ms. Rina",
      role: "instructor",
      classId: "corporate_event:evt-123",
      className: "Teacher Training Summit",
      shiftType: "corporate_event",
      eventId: "evt-123",
      clockIn: "2026-09-21T02:00:00.000Z",
      clockOut: null,
    });
  });
});

describe("recordStudentAttendance", () => {
  it("records a normal student attendance when no event is attached", async () => {
    await recordStudentAttendance({ uid: "s1", displayName: "Ahmad" });
    const op = fake.opsOf("add")[0];
    expect(op.path.startsWith("attendance/")).toBe(true);
    expect(op.data).toMatchObject({
      userId: "s1",
      displayName: "Ahmad",
      role: "student",
      method: "KIOSK",
    });
    expect(op.data.eventId).toBeUndefined();
    expect(op.data.eventName).toBeUndefined();
  });

  it("attaches eventId and eventName when student attends a corporate event", async () => {
    await recordStudentAttendance({
      uid: "s2",
      displayName: "Budi",
      eventId: "evt-456",
      eventName: "School Open House",
    });
    const op = fake.opsOf("add")[0];
    expect(op.path.startsWith("attendance/")).toBe(true);
    expect(op.data).toMatchObject({
      userId: "s2",
      displayName: "Budi",
      role: "student",
      method: "KIOSK",
      eventId: "evt-456",
      eventName: "School Open House",
    });
  });

  it("writes to a deterministic document ID when dateKey is supplied to prevent double-counts", async () => {
    await recordStudentAttendance({
      uid: "s3",
      displayName: "Citra",
      dateKey: "2026-09-23",
    });
    const doc = fake.find("attendance/s3_2026-09-23");
    expect(doc).toBeDefined();
    expect(doc.data).toMatchObject({
      userId: "s3",
      displayName: "Citra",
      role: "student",
      method: "KIOSK",
    });
  });
});

describe("clockOutShift / switchClassAtomic", () => {
  it("writes the clock-out time", async () => {
    await clockOutShift("sh1", at);
    expect(fake.find("shifts/sh1").data).toEqual({ clockOut: "2026-09-21T02:00:00.000Z" });
  });

  it("closes the old shift and opens the new one at the same instant, atomically", async () => {
    await switchClassAtomic({
      previousShiftId: "old",
      clockOutAt: at,
      newShiftDocId: "new",
      uid: "i1",
      displayName: "Ms. Rina",
      role: "instructor",
      classId: "c2",
      className: "Elite B",
    });
    const oldOp = fake.find("shifts/old");
    const newOp = fake.find("shifts/new");
    expect(oldOp).toMatchObject({
      kind: "update",
      via: "batch",
      data: { clockOut: "2026-09-21T02:00:00.000Z" },
    });
    expect(newOp).toMatchObject({ kind: "set", via: "batch" });
    expect(newOp.data).toMatchObject({
      clockIn: oldOp.data.clockOut,
      clockOut: null,
      classId: "c2",
    });
  });

  it("changes nothing if the batch fails", async () => {
    fake.failCommit = new Error("offline");
    await expect(
      switchClassAtomic({ previousShiftId: "old", uid: "i1", role: "instructor" })
    ).rejects.toThrow("offline");
    expect(fake.ops).toHaveLength(0);
  });
});

describe("adjustShiftWithAudit", () => {
  const before = { clockIn: "2026-09-21T01:00:00.000Z", clockOut: null, autoClosed: true };
  const after = { clockIn: "2026-09-21T01:00:00.000Z", clockOut: "2026-09-21T03:00:00.000Z" };

  it("updates the shift and writes an audit event in the same batch", async () => {
    await adjustShiftWithAudit({
      shiftId: "sh1",
      beforeShift: before,
      afterData: after,
      reasonCode: "forgot_clock_out",
      note: "asked by manager",
      actorId: "admin1",
      actorName: "Admin",
    });
    expect(fake.find("shifts/sh1")).toMatchObject({
      kind: "update",
      via: "batch",
      data: { ...after, corrected: true, reviewStatus: "reviewed" },
    });
    const audit = fake.opsOf("set").find((o) => o.path.startsWith("shiftAuditEvents/"));
    expect(audit.via).toBe("batch");
    expect(audit.data).toMatchObject({
      shiftId: "sh1",
      action: "manual_adjustment",
      reasonCode: "forgot_clock_out",
      note: "asked by manager",
      actorId: "admin1",
      actorNameSnapshot: "Admin",
      before: { clockIn: before.clockIn, clockOut: null, autoClosed: true },
      after: { clockIn: after.clockIn, clockOut: after.clockOut },
    });
  });

  it("falls back to 'Administrator' and an empty note", async () => {
    await adjustShiftWithAudit({
      shiftId: "sh1",
      beforeShift: {},
      afterData: {},
      reasonCode: "x",
      actorId: "a",
    });
    const audit = fake.opsOf("set")[0];
    expect(audit.data).toMatchObject({ actorNameSnapshot: "Administrator", note: "" });
    expect(audit.data.before).toEqual({ clockIn: null, clockOut: null, autoClosed: false });
  });

  it("saves neither the shift change nor the audit if the batch fails", async () => {
    fake.failCommit = new Error("permission-denied");
    await expect(
      adjustShiftWithAudit({
        shiftId: "sh1",
        beforeShift: {},
        afterData: {},
        reasonCode: "x",
        actorId: "a",
      })
    ).rejects.toThrow();
    expect(fake.ops).toHaveLength(0);
  });
});

describe("staff leave", () => {
  it("logs approved leave, and a single-day leave ends the same day", async () => {
    await logStaffLeave({
      userId: "u1",
      type: "Sakit",
      startDate: "2026-09-22",
      createdBy: "admin1",
    });
    expect(fake.opsOf("add")[0].data).toMatchObject({
      userId: "u1",
      type: "Sakit",
      startDate: "2026-09-22",
      endDate: "2026-09-22",
      dayPortion: "full",
      status: "approved",
    });
  });

  it("only returns leave that ends on or after the given date", async () => {
    fake.seed("staffLeave", [
      { id: "l1", endDate: "2026-09-10" },
      { id: "l2", endDate: "2026-09-25" },
    ]);
    expect((await fetchStaffLeaves("2026-09-20")).map((l) => l.id)).toEqual(["l2"]);
    expect(await fetchStaffLeaves()).toHaveLength(2);
  });
});

describe("fetchOpenShiftFor / fetchInstructorClasses", () => {
  it("returns the open shift, or null", async () => {
    fake.seed("shifts", [
      { id: "a", userId: "u1", clockOut: "x" },
      { id: "b", userId: "u1", clockOut: null },
    ]);
    expect((await fetchOpenShiftFor("u1")).id).toBe("b");
    expect(await fetchOpenShiftFor("u2")).toBeNull();
  });

  it("combines main and substitute classes without duplicates", async () => {
    fake.seed("classes", [
      { id: "c1", instructorId: "i1" },
      { id: "c2", substituteInstructorId: "i1" },
      { id: "c3", instructorId: "i1", substituteInstructorId: "i1" },
      { id: "c4", instructorId: "other" },
    ]);
    const ids = (await fetchInstructorClasses("i1")).map((c) => c.id).sort();
    expect(ids).toEqual(["c1", "c2", "c3"]);
  });
});

describe("Cash Reconciliation on Shift Clock-Out", () => {
  it("calculates discrepancy threshold correctly (smaller of fixed IDR or 1%)", () => {
    // 1% of 1,000,000 is 10,000 (< 25,000) -> 10,000
    expect(calculateCashDiscrepancyThreshold(1000000)).toBe(10000);

    // 1% of 5,000,000 is 50,000 (> 25,000 max fixed threshold) -> 25,000
    expect(calculateCashDiscrepancyThreshold(5000000)).toBe(25000);

    // Zero expected -> default 25,000
    expect(calculateCashDiscrepancyThreshold(0)).toBe(25000);
  });

  it("embeds reconciliation data without approval gate when within threshold", async () => {
    fake.seed("shifts", [{ id: "shift-1", userId: "fo-1", clockOut: null }]);

    await clockOutShiftWithCashReconciliation("shift-1", {
      clockOutAt: at,
      countedCash: 1000000,
      countedQris: 500000,
      expectedCash: 1000000,
      expectedQris: 500000,
      notes: "Balanced till",
    });

    const op = fake.opsOf("update")[0];
    expect(op.path).toBe("shifts/shift-1");
    expect(op.data.clockOut).toBe("2026-09-21T02:00:00.000Z");
    expect(op.data.cashReconciliation).toMatchObject({
      expectedCash: 1000000,
      expectedQris: 500000,
      countedCash: 1000000,
      countedQris: 500000,
      discrepancy: 0,
      exceedsThreshold: false,
      notes: "Balanced till",
    });
    expect(op.data.approval).toBeUndefined();

    // Accessor test
    expect(getShiftCashReconciliation(op.data)).toEqual(op.data.cashReconciliation);
  });

  it("escalates to Branch Manager approval queue without polluting the shift payload", async () => {
    fake.seed("shifts", [{ id: "shift-2", userId: "fo-1", clockOut: null }]);

    // Expected 2,000,000 (1% is 20,000 threshold), Counted is short by 50,000
    await clockOutShiftWithCashReconciliation("shift-2", {
      clockOutAt: at,
      countedCash: 1450000,
      countedQris: 500000,
      expectedCash: 1500000,
      expectedQris: 500000,
      notes: "Till short by 50k",
      requester: { name: "Budi FO", uid: "fo-1", role: "frontoffice" },
    });

    const op = fake.opsOf("update")[0];
    expect(op.path).toBe("shifts/shift-2");
    expect(op.data.clockOut).toBe("2026-09-21T02:00:00.000Z");
    expect(op.data.cashReconciliation.discrepancy).toBe(-50000);
    expect(op.data.cashReconciliation.exceedsThreshold).toBe(true);
    expect(op.data.approval).toBeUndefined();

    // The escalation lives in the approvals collection, not on the shift doc
    const escalation = fake
      .opsOf("add")
      .find((o) => o.path.startsWith("approvals/"));
    expect(escalation).toBeDefined();
    expect(escalation.data).toMatchObject({
      actionId: "CASH_DISCREPANCY",
      approverRole: "manager",
      mode: "blocking",
      status: "pending",
      requestedBy: "Budi FO",
      requestedByUid: "fo-1",
    });
  });

  it("refuses to close the shift when the escalation cannot be submitted", async () => {
    fake.seed("shifts", [{ id: "shift-3", userId: "fo-1", clockOut: null }]);
    fake.failWhen = (op) =>
      op.path.startsWith("approvals/") ? new Error("permission-denied") : null;

    await expect(
      clockOutShiftWithCashReconciliation("shift-3", {
        clockOutAt: at,
        countedCash: 1000000,
        countedQris: 400000,
        expectedCash: 1500000,
        expectedQris: 500000,
        notes: "Till short by 60k",
        requester: { name: "Budi FO", uid: "fo-1", role: "frontoffice" },
      })
    ).rejects.toThrow("escalation could not be submitted");

    // Shift must remain open so the discrepancy is never lost silently
    expect(fake.opsOf("update")).toHaveLength(0);
  });
});

describe("applyApprovedShiftCorrection", () => {
  const approvedApproval = {
    id: "appr-9",
    actionId: "STAFF_SHIFT_SELF_CORRECTION",
    status: "approved",
    payload: {
      shiftId: "shift-7",
      reasonCode: "forgot_clock_out",
      beforeShift: {
        id: "shift-7",
        clockIn: "2026-09-20T08:00:00.000Z",
        clockOut: "2026-09-20T15:00:00.000Z",
        autoClosed: true,
      },
      afterData: {
        clockIn: "2026-09-20T08:00:00.000Z",
        clockOut: "2026-09-20T17:30:00.000Z",
      },
    },
  };

  it("applies an approved correction atomically with a rules-verifiable approval link", async () => {
    await applyApprovedShiftCorrection({
      approval: approvedApproval,
      actor: { uid: "fo-1", displayName: "Budi FO" },
    });

    const shiftUpdate = fake.find("shifts/shift-7");
    expect(shiftUpdate).toMatchObject({
      kind: "update",
      via: "batch",
      data: {
        clockIn: "2026-09-20T08:00:00.000Z",
        clockOut: "2026-09-20T17:30:00.000Z",
        corrected: true,
        reviewStatus: "reviewed",
        appliedFromApproval: "appr-9",
      },
    });

    const audit = fake
      .opsOf("set")
      .find((o) => o.path.startsWith("shiftAuditEvents/"));
    expect(audit).toBeDefined();
    expect(audit.data).toMatchObject({
      shiftId: "shift-7",
      action: "manual_adjustment",
      reasonCode: "forgot_clock_out",
      actorId: "fo-1",
      actorNameSnapshot: "Budi FO",
      appliedFromApproval: "appr-9",
      before: { autoClosed: true },
      after: { clockOut: "2026-09-20T17:30:00.000Z" },
    });
  });

  it("rejects an approval envelope missing its shift payload", async () => {
    await expect(
      applyApprovedShiftCorrection({
        approval: { id: "appr-10", actionId: "STAFF_SHIFT_SELF_CORRECTION", payload: null },
        actor: { uid: "fo-1", displayName: "Budi FO" },
      })
    ).rejects.toThrow("missing its shift payload");

    expect(fake.ops).toHaveLength(0);
  });
});

