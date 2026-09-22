import { beforeEach, describe, expect, it, vi } from "vitest";
import { fake } from "../../test/firestoreFake.js";
import {
  calculateRetentionCutoff,
  fetchStaleErrorLogsCount,
  purgeStaleErrorLogs,
} from "./logRetentionRepository.js";

vi.mock(
  "firebase/firestore",
  async () => (await import("../../test/firestoreFake.js")).firestoreModule
);

vi.mock("../../firebase", () => ({
  db: { fakeDb: true },
}));

describe("logRetentionRepository", () => {
  beforeEach(() => {
    fake.reset();
  });

  it("calculates retention cutoff accurately based on provided days", () => {
    const fixedNow = new Date("2026-09-22T10:00:00.000Z");
    const cutoff = calculateRetentionCutoff(38, fixedNow);
    expect(cutoff).toBe("2026-08-15T10:00:00.000Z");
  });

  it("fetchStaleErrorLogsCount counts only logs older than the cutoff", async () => {
    fake.seed("errorLogs", [
      { id: "old-1", timestamp: "2026-07-01T00:00:00.000Z", message: "Very old error" },
      { id: "old-2", timestamp: "2026-08-01T00:00:00.000Z", message: "Stale error" },
      { id: "fresh-1", timestamp: new Date().toISOString(), message: "Recent error" },
    ]);

    const count = await fetchStaleErrorLogsCount(38);
    expect(count).toBe(2);
  });

  it("purgeStaleErrorLogs deletes stale logs in batches and preserves recent logs", async () => {
    fake.seed("errorLogs", [
      { id: "stale-1", timestamp: "2026-06-01T00:00:00.000Z", message: "Ancient error" },
      { id: "stale-2", timestamp: "2026-07-01T00:00:00.000Z", message: "Old error" },
      { id: "recent-1", timestamp: new Date().toISOString(), message: "Just happened" },
    ]);

    const result = await purgeStaleErrorLogs(38);
    expect(result.deleted).toBe(2);
    expect(result.hasMore).toBe(false);

    const deleteOps = fake.opsOf("delete");
    expect(deleteOps.length).toBe(2);
    expect(deleteOps.map((op) => op.path)).toEqual([
      "errorLogs/stale-1",
      "errorLogs/stale-2",
    ]);
  });

  it("returns 0 if no stale logs exist", async () => {
    fake.seed("errorLogs", [
      { id: "recent-1", timestamp: new Date().toISOString(), message: "Recent" },
    ]);

    const result = await purgeStaleErrorLogs(38);
    expect(result.deleted).toBe(0);
    expect(fake.opsOf("delete").length).toBe(0);
  });
});
