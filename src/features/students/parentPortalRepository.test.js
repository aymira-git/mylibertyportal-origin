import { describe, it, expect, vi, beforeEach } from "vitest";
import { fake } from "../../test/firestoreFake.js";
import {
  normalizePhoneDigits,
  lookupStudentForParent,
  buildPaymentSummary,
  getStudentParentPortalBundle,
} from "./parentPortalRepository";

vi.mock(
  "firebase/firestore",
  async () => (await import("../../test/firestoreFake.js")).firestoreModule
);
vi.mock("../../firebase", () => ({ db: {}, auth: {} }));

beforeEach(() => fake.reset());

describe("Parent Portal Repository", () => {
  it("normalizes phone numbers to standard country code format", () => {
    expect(normalizePhoneDigits("081234567890")).toBe("6281234567890");
    expect(normalizePhoneDigits("+62 812-3456-7890")).toBe("6281234567890");
    expect(normalizePhoneDigits("")).toBe("");
  });

  it("handles short or empty search terms gracefully", async () => {
    const results = await lookupStudentForParent("a");
    expect(results).toEqual([]);
  });
});

describe("buildPaymentSummary", () => {
  it("maps the finance-flow fields on a paid student", () => {
    const summary = buildPaymentSummary({
      paymentStatus: "paid",
      lastPaymentPeriod: "September 2026 – November 2026 (3 Mo)",
      lastPaymentDate: "2026-09-21",
      lastPaymentAmount: 1050000,
      lastPaymentMethod: "Cash",
      paidUntil: "2026-12-21",
    });
    expect(summary).toEqual({
      status: "paid",
      lastPaymentPeriod: "September 2026 – November 2026 (3 Mo)",
      lastPaymentDate: "2026-09-21",
      lastPaymentAmount: 1050000,
      lastPaymentMethod: "Cash",
      paidUntil: "2026-12-21",
    });
  });

  it("reports pending when paymentStatus is pending, even with records", () => {
    const summary = buildPaymentSummary({
      paymentStatus: "pending",
      lastPaymentPeriod: "August 2026",
      lastPaymentDate: "2026-08-01",
    });
    expect(summary.status).toBe("pending");
  });

  it("reports none when the student has no payment records", () => {
    expect(buildPaymentSummary({ displayName: "Ani" }).status).toBe("none");
    expect(buildPaymentSummary({}).status).toBe("none");
  });

  it("guards against missing or malformed input", () => {
    expect(buildPaymentSummary(null)).toBeNull();
    expect(buildPaymentSummary("nope")).toBeNull();
    expect(buildPaymentSummary({ lastPaymentAmount: "1.050.000" }).lastPaymentAmount).toBeNull();
  });
});

describe("getStudentParentPortalBundle", () => {
  it("returns the summary from the student doc and never touches the payments collection", async () => {
    fake.seed("users", [
      {
        id: "s1",
        displayName: "Ani",
        paymentStatus: "paid",
        lastPaymentPeriod: "September 2026",
        lastPaymentDate: "2026-09-21",
        lastPaymentAmount: 1050000,
        lastPaymentMethod: "Cash",
        paidUntil: "2026-12-21",
      },
    ]);

    const bundle = await getStudentParentPortalBundle("s1");

    expect(bundle.student.displayName).toBe("Ani");
    expect(bundle.paymentSummary).toMatchObject({ status: "paid", lastPaymentAmount: 1050000 });
    // The portal is anonymous and the payments collection is staff-only in
    // Firestore rules — the bundle must not expose (or even attempt) it.
    expect(bundle).not.toHaveProperty("payments");
  });

  it("returns a none summary for a student without payment fields", async () => {
    fake.seed("users", [{ id: "s2", displayName: "Budi" }]);
    const bundle = await getStudentParentPortalBundle("s2");
    expect(bundle.paymentSummary.status).toBe("none");
  });

  it("throws when the student does not exist", async () => {
    await expect(getStudentParentPortalBundle("missing")).rejects.toThrow("Student not found.");
  });
});
