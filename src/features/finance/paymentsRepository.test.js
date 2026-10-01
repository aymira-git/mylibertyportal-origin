import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake, firestoreModule } from "../../test/firestoreFake.js";
import {
  fetchPaymentHistory,
  getPaymentsForRecordedDay,
  markPaymentPending,
  recordPayment,
} from "./paymentsRepository.js";

vi.mock(
  "firebase/firestore",
  async () => (await import("../../test/firestoreFake.js")).firestoreModule
);
vi.mock("../../firebase", () => ({ db: {}, auth: {} }));

beforeEach(() => fake.reset());

const record = {
  studentId: "s1",
  amount: 1050000,
  method: "Cash",
  period: "September 2026 – November 2026 (3 Mo)",
  planId: "quarterly",
  coverageEnd: "2026-12-21",
  recordedAt: "2026-09-21T02:00:00.000Z",
};

describe("recordPayment", () => {
  it("saves the payment and updates the student in a single batch", async () => {
    const result = await recordPayment("s1", record);

    expect(result).toEqual({
      id: "auto-1",
      ...record,
      branch: "Kota Gorontalo",
      branchId: "kota_gorontalo",
      division: "courses",
    });

    const payment = fake.find("payments/auto-1");
    const student = fake.find("users/s1");
    expect(payment).toMatchObject({
      kind: "set",
      via: "batch",
      data: {
        ...record,
        branch: "Kota Gorontalo",
        branchId: "kota_gorontalo",
        division: "courses",
      },
    });
    expect(student).toMatchObject({ kind: "set", via: "batch", opts: { merge: true } });
    expect(student.data).toEqual({
      paymentStatus: "paid",
      lastPaymentPeriod: record.period,
      lastPaymentDate: "2026-09-21",
      lastPaymentAmount: 1050000,
      lastPaymentMethod: "Cash",
      paymentPlan: "quarterly",
      paidUntil: "2026-12-21",
    });
  });

  it("does not touch paidUntil when the payment has no coverage end", async () => {
    await recordPayment("s1", { ...record, coverageEnd: undefined });
    expect(fake.find("users/s1").data).not.toHaveProperty("paidUntil");
  });

  it("defaults the student's plan to monthly", async () => {
    await recordPayment("s1", { ...record, planId: undefined });
    expect(fake.find("users/s1").data.paymentPlan).toBe("monthly");
  });

  it("saves neither document if the batch fails", async () => {
    fake.failCommit = new Error("unavailable");
    await expect(recordPayment("s1", record)).rejects.toThrow("unavailable");
    expect(fake.ops).toHaveLength(0);
  });

  it("throws validation error on invalid payment record or studentId", async () => {
    await expect(recordPayment("", record)).rejects.toThrow();
    await expect(recordPayment("s1", { ...record, amount: -100 })).rejects.toThrow();
    await expect(recordPayment("s1", { ...record, period: "" })).rejects.toThrow();
  });

  // Open to debate: lastPaymentDate uses the UTC date from the timestamp. A payment
  // recorded between 00:00 and 08:00 WITA is stamped with the previous day.
  it("stamps lastPaymentDate with the WITA calendar day", async () => {
    await recordPayment("s1", { ...record, recordedAt: "2026-09-21T20:00:00.000Z" }); // 04:00 on 22 Sep WITA
    expect(fake.find("users/s1").data.lastPaymentDate).toBe("2026-09-22");
  });

  it("writes with deterministic document ID when idempotencyKey is supplied", async () => {
    const result = await recordPayment("s1", {
      ...record,
      idempotencyKey: "idem_ML-998877",
    });

    expect(result.id).toBe("idem_ML-998877");
    const payment = fake.find("payments/idem_ML-998877");
    expect(payment).toBeDefined();
    expect(payment.data.idempotencyKey).toBe("idem_ML-998877");
  });

  it("returns existing payment on duplicate/retry submission without creating duplicate docs", async () => {
    fake.seed("payments", [
      {
        id: "idem_ML-112233",
        studentId: "s1",
        amount: 500000,
        period: "September 2026",
        method: "QRIS",
        idempotencyKey: "idem_ML-112233",
      },
    ]);

    const result = await recordPayment(
      "s1",
      {
        studentId: "s1",
        amount: 500000,
        period: "September 2026",
        method: "QRIS",
      },
      "idem_ML-112233"
    );

    expect(result.id).toBe("idem_ML-112233");
    expect(result._idempotentReplay).toBe(true);
    // Should NOT have committed a new payment to fake.ops
    expect(fake.find("payments/idem_ML-112233")).toBeUndefined();
  });
});

describe("getPaymentsForRecordedDay", () => {
  it("blocks reconciliation when its required index is missing instead of returning a partial total", async () => {
    const indexError = Object.assign(
      new Error("The query requires an index."),
      { code: "failed-precondition" }
    );
    firestoreModule.getDocs.mockRejectedValueOnce(indexError);

    await expect(
      getPaymentsForRecordedDay(new Date("2026-09-22T04:00:00.000Z"), "kota_gorontalo", "courses")
    ).rejects.toThrow("Cash reconciliation is blocked because a required payment index is not ready.");
    expect(firestoreModule.getDocs).toHaveBeenCalledOnce();
  });

  it("does not hide permission or network failures behind an index fallback", async () => {
    firestoreModule.getDocs.mockRejectedValueOnce(
      Object.assign(new Error("permission-denied"), { code: "permission-denied" })
    );

    await expect(getPaymentsForRecordedDay()).rejects.toThrow("permission-denied");
    expect(firestoreModule.getDocs).toHaveBeenCalledOnce();
  });
});

describe("markPaymentPending", () => {
  it("marks the student pending and clears paidUntil", async () => {
    await markPaymentPending("s1");
    expect(fake.find("users/s1")).toMatchObject({
      kind: "set",
      opts: { merge: true },
      data: { paymentStatus: "pending", paidUntil: { __op: "deleteField" } },
    });
  });
});

describe("fetchPaymentHistory", () => {
  it("returns only this student's payments, newest first", async () => {
    fake.seed("payments", [
      { id: "p1", studentId: "s1", recordedAt: "2026-07-01T00:00:00Z" },
      { id: "p2", studentId: "s1", recordedAt: "2026-09-01T00:00:00Z" },
      { id: "p3", studentId: "s2", recordedAt: "2026-10-01T00:00:00Z" },
      { id: "p4", studentId: "s1", recordedAt: "2026-08-01T00:00:00Z" },
    ]);
    const list = await fetchPaymentHistory("s1");
    expect(list.map((p) => p.id)).toEqual(["p2", "p4", "p1"]);
  });

  it("returns an empty list when there is no history", async () => {
    expect(await fetchPaymentHistory("nobody")).toEqual([]);
  });
});
