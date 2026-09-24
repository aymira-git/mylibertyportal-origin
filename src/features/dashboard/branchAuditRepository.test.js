import { describe, it, expect, vi } from "vitest";
import {
  classifyDocBranchStatus,
  computeCollectionBranchMetrics,
  runBranchHealthAudit,
  migrateLegacyBranchBatch,
  migrateAllLegacyCollections,
  AUDIT_COLLECTIONS,
} from "./branchAuditRepository";

const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(true);

vi.mock("../../firebase", () => ({
  db: {},
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn((_db, col, id) => `${col}/${id}`),
  query: vi.fn(),
  limit: vi.fn(),
  writeBatch: vi.fn(() => ({
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  })),
  getDocs: vi.fn().mockResolvedValue({
    docs: [
      { id: "1", data: () => ({ branchId: "kota_gorontalo" }) },
      { id: "2", data: () => ({ branch: "Bone Bolango" }) },
      { id: "3", data: () => ({ name: "No Branch Record" }) },
    ],
  }),
}));

describe("branchAuditRepository", () => {
  it("classifies doc branch status accurately", () => {
    expect(classifyDocBranchStatus({ branchId: "kota_gorontalo" })).toBe("canonical");
    expect(classifyDocBranchStatus({ branchId: "bone_bolango" })).toBe("canonical");
    expect(classifyDocBranchStatus({ branch: "Bone Bolango" })).toBe("legacy");
    expect(classifyDocBranchStatus({ branch: "Pohuwato" })).toBe("legacy");
    expect(classifyDocBranchStatus({})).toBe("missing");
    expect(classifyDocBranchStatus(null)).toBe("missing");
  });

  it("computes collection branch metrics correctly", () => {
    const docs = [
      { branchId: "kota_gorontalo" },
      { branchId: "bone_bolango" },
      { branch: "Bone Bolango" },
      { title: "No Branch" },
    ];

    const metrics = computeCollectionBranchMetrics(docs);
    expect(metrics.total).toBe(4);
    expect(metrics.canonical).toBe(2);
    expect(metrics.legacy).toBe(1);
    expect(metrics.missing).toBe(1);
    expect(metrics.readinessPercent).toBe(50);
  });

  it("runs branch health audit across defined collections", async () => {
    const audit = await runBranchHealthAudit(50);
    expect(audit.collections.length).toBe(AUDIT_COLLECTIONS.length);
    expect(audit.totalScanned).toBeGreaterThan(0);
    expect(audit.overallReadiness).toBeDefined();
    expect(audit.timestamp).toBeDefined();
  });

  it("migrates legacy and missing documents in a bounded batch", async () => {
    mockBatchUpdate.mockClear();
    mockBatchCommit.mockClear();

    const res = await migrateLegacyBranchBatch("payments", 50);
    expect(res.collectionId).toBe("payments");
    expect(res.scanned).toBe(3);
    expect(res.migrated).toBe(2); // Doc 2 (legacy) and Doc 3 (missing)
    expect(res.skipped).toBe(1); // Doc 1 (already canonical)
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalledTimes(1);
  });

  it("migrates across all audit collections sequentially", async () => {
    const res = await migrateAllLegacyCollections(30);
    expect(res.results.length).toBe(AUDIT_COLLECTIONS.length);
    expect(res.totalMigrated).toBeGreaterThan(0);
  });
});
