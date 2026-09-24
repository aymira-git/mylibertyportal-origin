import { collection, getDocs, limit, query, writeBatch, doc } from "firebase/firestore";
import { db } from "../../firebase";
import { BRANCH_MAP, branchToId, idToBranch } from "../../constants/branches";

export const AUDIT_COLLECTIONS = [
  { id: "users", label: "Users (Students & Staff)" },
  { id: "payments", label: "Payments & Tuition" },
  { id: "applications", label: "Admissions Applications" },
  { id: "deskInquiries", label: "Desk Inquiries / Leads" },
  { id: "shifts", label: "Staff Shifts" },
  { id: "classes", label: "Academic Classes" },
  { id: "approvals", label: "Maker-Checker Approvals" },
  { id: "schoolOutreach", label: "School Outreach Records" },
];

/**
 * Categorizes a single document's branch status.
 *
 * @param {object} data
 * @returns {"canonical" | "legacy" | "missing"}
 */
export function classifyDocBranchStatus(data) {
  if (!data || typeof data !== "object") return "missing";

  const record = /** @type {Record<string, any>} */ (data);
  const rawBranchId = record.branchId;
  const rawBranch = record.branch;

  if (rawBranchId && typeof rawBranchId === "string" && BRANCH_MAP[rawBranchId.toLowerCase()]) {
    return "canonical";
  }

  if (rawBranch && typeof rawBranch === "string" && rawBranch.trim().length > 0) {
    return "legacy";
  }

  return "missing";
}

/**
 * Computes audit metrics for a list of document objects.
 *
 * @param {Array<object>} docs
 * @returns {{ total: number, canonical: number, legacy: number, missing: number, readinessPercent: number }}
 */
export function computeCollectionBranchMetrics(docs = []) {
  let canonical = 0;
  let legacy = 0;
  let missing = 0;

  for (const doc of docs) {
    const status = classifyDocBranchStatus(doc);
    if (status === "canonical") canonical++;
    else if (status === "legacy") legacy++;
    else missing++;
  }

  const total = docs.length;
  const readinessPercent = total === 0 ? 100 : Math.round((canonical / total) * 100);

  return {
    total,
    canonical,
    legacy,
    missing,
    readinessPercent,
  };
}

/**
 * Scans Firestore collections for branch health.
 * Bounded by maxPerCollection to protect Spark free tier read quotas.
 *
 * @param {number} maxPerCollection - Max documents to sample per collection (default 100)
 * @returns {Promise<{ overallReadiness: number, totalScanned: number, totalCanonical: number, totalLegacy: number, totalMissing: number, collections: Array<object>, timestamp: string }>}
 */
export async function runBranchHealthAudit(maxPerCollection = 100) {
  const results = [];
  let sumTotal = 0;
  let sumCanonical = 0;
  let sumLegacy = 0;
  let sumMissing = 0;

  for (const colDef of AUDIT_COLLECTIONS) {
    try {
      const colRef = collection(db, colDef.id);
      const q = query(colRef, limit(maxPerCollection));
      const snap = await getDocs(q);

      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const metrics = computeCollectionBranchMetrics(docs);

      sumTotal += metrics.total;
      sumCanonical += metrics.canonical;
      sumLegacy += metrics.legacy;
      sumMissing += metrics.missing;

      results.push({
        collectionId: colDef.id,
        label: colDef.label,
        ...metrics,
      });
    } catch (err) {
      console.warn(`[BranchAudit] Could not query collection ${colDef.id}:`, err);
      results.push({
        collectionId: colDef.id,
        label: colDef.label,
        total: 0,
        canonical: 0,
        legacy: 0,
        missing: 0,
        readinessPercent: 100,
        error: err instanceof Error ? err.message : "Query failed",
      });
    }
  }

  const overallReadiness = sumTotal === 0 ? 100 : Math.round((sumCanonical / sumTotal) * 100);

  return {
    overallReadiness,
    totalScanned: sumTotal,
    totalCanonical: sumCanonical,
    totalLegacy: sumLegacy,
    totalMissing: sumMissing,
    collections: results,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Migrates a bounded batch of legacy documents in a specific collection,
 * populating canonical branchId and normalized branch name.
 * Strictly bounded to protect Firestore write limits.
 *
 * @param {string} collectionId
 * @param {number} batchSize - Max documents to update per batch (default 50)
 * @returns {Promise<{ collectionId: string, scanned: number, migrated: number, skipped: number }>}
 */
export async function migrateLegacyBranchBatch(collectionId, batchSize = 50) {
  const colRef = collection(db, collectionId);
  const q = query(colRef, limit(batchSize));
  const snap = await getDocs(q);

  const batch = writeBatch(db);
  let migratedCount = 0;
  let skippedCount = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const status = classifyDocBranchStatus(data);

    if (status === "legacy" || status === "missing") {
      const rawBranch = data.branch || data.branchId || "Kota Gorontalo";
      const branchId = branchToId(rawBranch);
      const branch = idToBranch(branchId);

      batch.update(doc(db, collectionId, docSnap.id), {
        branchId,
        branch,
        branchMigratedAt: new Date().toISOString(),
      });
      migratedCount++;
    } else {
      skippedCount++;
    }
  }

  if (migratedCount > 0) {
    await batch.commit();
  }

  return {
    collectionId,
    scanned: snap.docs.length,
    migrated: migratedCount,
    skipped: skippedCount,
  };
}

/**
 * Migrates a bounded batch across all core collections sequentially.
 *
 * @param {number} batchSizePerCollection
 * @returns {Promise<{ totalMigrated: number, results: Array<object> }>}
 */
export async function migrateAllLegacyCollections(batchSizePerCollection = 30) {
  const results = [];
  let totalMigrated = 0;

  for (const colDef of AUDIT_COLLECTIONS) {
    try {
      const res = await migrateLegacyBranchBatch(colDef.id, batchSizePerCollection);
      totalMigrated += res.migrated;
      results.push({
        label: colDef.label,
        ...res,
      });
    } catch (err) {
      console.warn(`[BranchMigration] Failed to migrate ${colDef.id}:`, err);
      results.push({
        collectionId: colDef.id,
        label: colDef.label,
        scanned: 0,
        migrated: 0,
        skipped: 0,
        error: err instanceof Error ? err.message : "Migration failed",
      });
    }
  }

  return {
    totalMigrated,
    results,
  };
}

