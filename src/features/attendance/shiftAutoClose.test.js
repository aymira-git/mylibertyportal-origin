import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "../../test/firestoreFake.js";
import { autoCloseShift } from "./shiftAutoClose.js";

vi.mock("firebase/firestore", async () => (await import("../../test/firestoreFake.js")).firestoreModule);
vi.mock("../../firebase", () => ({ db: {}, auth: {} }));

beforeEach(() => fake.reset());

describe("autoCloseShift", () => {
  it("estimates an instructor's clock-out 90 minutes after clock-in and flags the shift", async () => {
    const out = await autoCloseShift({ id: "sh1", role: "instructor", clockIn: "2026-09-21T02:00:00.000Z" });

    expect(out).toBe("2026-09-21T03:30:00.000Z");
    expect(fake.find("shifts/sh1")).toMatchObject({
      kind: "update",
      data: { clockOut: "2026-09-21T03:30:00.000Z", autoClosed: true },
    });
  });

  it("estimates an 8 hour day for non-instructor roles", async () => {
    const out = await autoCloseShift({ id: "sh2", role: "frontoffice", clockIn: "2026-09-21T00:00:00.000Z" });
    expect(out).toBe("2026-09-21T08:00:00.000Z");
  });

  it("falls back to the 8 hour default for an unknown role", async () => {
    const out = await autoCloseShift({ id: "sh3", role: "brand-new-role", clockIn: "2026-09-21T00:00:00.000Z" });
    expect(out).toBe("2026-09-21T08:00:00.000Z");
  });

  it("passes a write failure back to the caller", async () => {
    fake.failWhen = () => new Error("permission-denied");
    await expect(autoCloseShift({ id: "sh4", role: "instructor", clockIn: "2026-09-21T02:00:00.000Z" })).rejects.toThrow(
      "permission-denied"
    );
  });
});
