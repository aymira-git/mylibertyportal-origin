import { db } from "../../firebase";
import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getCountFromServer,
  writeBatch,
  limit,
} from "firebase/firestore";

export const DEFAULT_RETENTION_DAYS = 38;

/**
 * Calculates the ISO cutoff timestamp for records older than the specified days.
 * @param {number} [days=38]
 * @param {Date} [referenceDate=new Date()]
 * @returns {string} ISO 8601 string
 */
export function calculateRetentionCutoff(days = DEFAULT_RETENTION_DAYS, referenceDate = new Date()) {
  const d = new Date(referenceDate);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/**
 * Counts how many errorLogs documents are older than the cutoff days
 * using a server aggregation count to minimize document reads.
 *
 * @param {number} [cutoffDays=38]
 * @param {any} [targetDb=db]
 * @returns {Promise<number>}
 */
export async function fetchStaleErrorLogsCount(cutoffDays = DEFAULT_RETENTION_DAYS, targetDb = db) {
  if (!targetDb) return 0;
  const cutoff = calculateRetentionCutoff(cutoffDays);
  const q = query(
    collection(targetDb, "errorLogs"),
    where("timestamp", "<", cutoff)
  );

  try {
    if (typeof getCountFromServer === "function") {
      const snap = await getCountFromServer(q);
      if (snap && typeof snap.data === "function") {
        return snap.data().count ?? 0;
      }
    }
  } catch {
    // Graceful fallback if getCountFromServer is unsupported in test or environment
  }

  const snap = await getDocs(q);
  return snap.docs?.length ?? 0;
}

/**
 * Purges errorLogs older than the cutoff days in chunks of up to 500 documents.
 * Safely respects Firestore writeBatch limits.
 *
 * @param {number} [cutoffDays=38]
 * @param {any} [targetDb=db]
 * @param {number} [maxBatches=10] Maximum batches to run in one invocation (up to 5,000 docs)
 * @returns {Promise<{ deleted: number, hasMore: boolean }>}
 */
export async function purgeStaleErrorLogs(
  cutoffDays = DEFAULT_RETENTION_DAYS,
  targetDb = db,
  maxBatches = 10
) {
  if (!targetDb) return { deleted: 0, hasMore: false };
  const cutoff = calculateRetentionCutoff(cutoffDays);
  let totalDeleted = 0;
  let hasMore = false;

  for (let i = 0; i < maxBatches; i++) {
    const q = query(
      collection(targetDb, "errorLogs"),
      where("timestamp", "<", cutoff),
      limit(500)
    );
    const snap = await getDocs(q);
    if (snap.empty || !snap.docs || snap.docs.length === 0) {
      break;
    }

    const batch = writeBatch(targetDb);
    snap.docs.forEach((docSnap) => {
      const ref = docSnap.ref || doc(targetDb, "errorLogs", docSnap.id);
      batch.delete(ref);
    });
    await batch.commit();

    totalDeleted += snap.docs.length;
    if (snap.docs.length < 500) {
      break;
    }
    if (i === maxBatches - 1) {
      hasMore = true;
    }
  }

  return { deleted: totalDeleted, hasMore };
}
