import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "../../test/firestoreFake.js";
import { fetchStaffShifts } from "./reportsRepository.js";

vi.mock(
  "firebase/firestore",
  async () => (await import("../../test/firestoreFake.js")).firestoreModule
);
vi.mock("../../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "admin1" } },
}));

beforeEach(() => {
  fake.reset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("fetchStaffShifts", () => {
  it("normalizes user branch and prioritizes user profile over shift branch", async () => {
    fake.seed("users", [
      { id: "u1", role: "instructor", displayName: "Ms. Rina", branch: "Cabang Utama" },
      { id: "u2", role: "frontoffice", displayName: "Mr. Budi", branch: "  pohuwato  " },
      { id: "u3", role: "instructor", displayName: "Ms. Dewi" }, // missing branch
    ]);

    fake.seed("shifts", [
      {
        id: "s1",
        userId: "u1",
        clockIn: "2026-09-21T08:00:00.000Z",
        clockOut: "2026-09-21T16:00:00.000Z",
        branch: "Raw Old Branch",
      },
      {
        id: "s2",
        userId: "u2",
        clockIn: "2026-09-21T09:00:00.000Z",
        clockOut: null,
      },
      {
        id: "s3",
        userId: "u3",
        clockIn: "2026-09-21T10:00:00.000Z",
        clockOut: null,
      },
    ]);

    fake.seed("staffLeave", []);

    const { shifts, staffMembers } = await fetchStaffShifts(true);

    expect(shifts).toHaveLength(3);
    const byId = Object.fromEntries(shifts.map((s) => [s.id, s.branch]));
    // Legacy alias normalized
    expect(byId.s1).toBe("Kota Gorontalo");
    // Trimmed and canonicalized
    expect(byId.s2).toBe("Pohuwato");
    // Fallback for missing branch
    expect(byId.s3).toBe("Kota Gorontalo");

    // Staff members exclude students
    expect(staffMembers.map((m) => m.displayName)).toEqual(
      expect.arrayContaining(["Ms. Rina", "Mr. Budi", "Ms. Dewi"])
    );
  });

  it("normalizes branch from shift data if user has no branch set", async () => {
    fake.seed("users", [
      { id: "u1", role: "instructor", displayName: "Mr. Alex", branch: "" },
    ]);

    fake.seed("shifts", [
      {
        id: "s1",
        userId: "u1",
        clockIn: "2026-09-21T08:00:00.000Z",
        clockOut: null,
        branch: "bone bolango",
      },
    ]);

    fake.seed("staffLeave", []);

    const { shifts } = await fetchStaffShifts(true);
    expect(shifts[0].branch).toBe("Bone Bolango");
  });
});
